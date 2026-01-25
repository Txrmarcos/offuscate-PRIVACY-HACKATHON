import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';

// Queue storage path
const QUEUE_FILE = path.join(process.cwd(), '.donation-queue.json');

// Program constants - using function to avoid build-time errors
function getProgramId() {
  return new PublicKey(process.env.NEXT_PUBLIC_getProgramId() || '5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq');
}
function getRpcUrl() {
  return process.env.NEXT_PUBLIC_getRpcUrl() || 'https://api.devnet.solana.com';
}

// Minimum donations before processing batch (for privacy)
const MIN_BATCH_SIZE = 2;
// Maximum age before processing anyway (5 minutes)
const MAX_QUEUE_AGE_MS = 5 * 60 * 1000;
// Random delay between processing each donation (for privacy)
const INTER_DONATION_DELAY_MS = 2000;

interface QueuedDonation {
  id: string;
  commitment: string;
  nullifier: string;
  secretHash: string;
  amount: number;
  campaignId: string;
  campaignVault: string;
  donorSignature: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: number;
  txSignature?: string;
  error?: string;
}

interface QueueData {
  donations: QueuedDonation[];
  lastProcessed: number;
  totalProcessed: number;
  totalFailed: number;
}

function loadQueue(): QueueData {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const data = fs.readFileSync(QUEUE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load queue:', err);
  }
  return {
    donations: [],
    lastProcessed: 0,
    totalProcessed: 0,
    totalFailed: 0,
  };
}

function saveQueue(queue: QueueData): void {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  } catch (err) {
    console.error('Failed to save queue:', err);
  }
}

function getRelayerKeypair(): Keypair | null {
  const secretKey = process.env.RELAYER_SECRET_KEY;
  if (!secretKey) {
    console.error('[Relayer] RELAYER_SECRET_KEY not configured');
    return null;
  }
  try {
    const decoded = bs58.decode(secretKey);
    return Keypair.fromSecretKey(decoded);
  } catch (err) {
    console.error('[Relayer] Invalid RELAYER_SECRET_KEY');
    return null;
  }
}

function getPoolPDAs() {
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('privacy_pool')],
    getProgramId()
  );
  const [poolVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool_vault')],
    getProgramId()
  );
  return { poolPda, poolVaultPda };
}

function getCommitmentPDA(commitment: number[]): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('commitment'), Buffer.from(commitment)],
    getProgramId()
  );
  return pda;
}

function getNullifierPDA(nullifier: number[]): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('nullifier'), Buffer.from(nullifier)],
    getProgramId()
  );
  return pda;
}

function hexToArray32(hex: string): number[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substr(i, 2), 16));
  }
  while (bytes.length < 32) bytes.push(0);
  return bytes.slice(0, 32);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processDonation(
  donation: QueuedDonation,
  relayerKeypair: Keypair,
  connection: Connection,
  program: anchor.Program<any>
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    console.log(`[Batch] Processing donation ${donation.id} for campaign ${donation.campaignId}`);

    const { poolPda, poolVaultPda } = getPoolPDAs();
    const commitmentArray = hexToArray32(donation.commitment);
    const nullifierArray = hexToArray32(donation.nullifier);
    const secretHashArray = hexToArray32(donation.secretHash);

    const commitmentPda = getCommitmentPDA(commitmentArray);
    const nullifierPda = getNullifierPDA(nullifierArray);
    const recipient = new PublicKey(donation.campaignVault);

    // Call private_withdraw_relayed instruction
    // This withdraws from the pool and sends directly to the campaign vault
    const signature = await (program.methods as any)
      .privateWithdrawRelayed(
        commitmentArray,
        nullifierArray,
        secretHashArray,
        new BN(donation.amount)
      )
      .accounts({
        relayer: relayerKeypair.publicKey,
        pool: poolPda,
        poolVault: poolVaultPda,
        recipient: recipient,
        commitmentPda: commitmentPda,
        nullifierPda: nullifierPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([relayerKeypair])
      .rpc();

    console.log(`[Batch] Donation ${donation.id} processed successfully: ${signature}`);
    return { success: true, signature };

  } catch (error: any) {
    console.error(`[Batch] Failed to process donation ${donation.id}:`, error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

// POST - Process pending donations in batch
export async function POST(request: NextRequest) {
  try {
    // Verify authorization (optional - add API key check)
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.RELAYER_API_KEY;
    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      // Allow without auth for now, but log warning
      console.warn('[Batch] Request without API key authorization');
    }

    // Get relayer keypair
    const relayerKeypair = getRelayerKeypair();
    if (!relayerKeypair) {
      return NextResponse.json(
        { success: false, error: 'Relayer not configured' },
        { status: 500 }
      );
    }

    // Load queue
    const queue = loadQueue();
    const pendingDonations = queue.donations.filter(d => d.status === 'pending');

    if (pendingDonations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending donations',
        processed: 0,
      });
    }

    // Check if we should process
    const oldestPending = Math.min(...pendingDonations.map(d => d.timestamp));
    const queueAge = Date.now() - oldestPending;
    const shouldProcess = pendingDonations.length >= MIN_BATCH_SIZE || queueAge >= MAX_QUEUE_AGE_MS;

    if (!shouldProcess) {
      return NextResponse.json({
        success: true,
        message: `Waiting for more donations. Current: ${pendingDonations.length}, Min: ${MIN_BATCH_SIZE}`,
        pending: pendingDonations.length,
        queueAgeSeconds: Math.floor(queueAge / 1000),
      });
    }

    // Setup connection and program
    const connection = new Connection(getRpcUrl(), 'confirmed');

    // Check relayer balance
    const relayerBalance = await connection.getBalance(relayerKeypair.publicKey);
    if (relayerBalance < 0.01 * LAMPORTS_PER_SOL) {
      return NextResponse.json(
        { success: false, error: 'Relayer has insufficient balance for gas' },
        { status: 500 }
      );
    }

    // Load IDL and create program
    const idl = require('../../../lib/program/idl/offuscate.json');
    const provider = new anchor.AnchorProvider(
      connection,
      {
        publicKey: relayerKeypair.publicKey,
        signTransaction: async (tx: Transaction) => {
          tx.partialSign(relayerKeypair);
          return tx;
        },
        signAllTransactions: async (txs: Transaction[]) => {
          txs.forEach(tx => tx.partialSign(relayerKeypair));
          return txs;
        },
      } as any,
      { commitment: 'confirmed' }
    );
    const program = new anchor.Program(idl, provider);

    // Process donations with random delays
    const results: { id: string; success: boolean; signature?: string; error?: string }[] = [];

    // Shuffle the donations for additional privacy
    const shuffledDonations = [...pendingDonations].sort(() => Math.random() - 0.5);

    for (const donation of shuffledDonations) {
      // Mark as processing
      const idx = queue.donations.findIndex(d => d.id === donation.id);
      if (idx !== -1) {
        queue.donations[idx].status = 'processing';
        saveQueue(queue);
      }

      // Process
      const result = await processDonation(donation, relayerKeypair, connection, program);

      // Update queue
      if (idx !== -1) {
        queue.donations[idx].status = result.success ? 'completed' : 'failed';
        queue.donations[idx].processedAt = Date.now();
        queue.donations[idx].txSignature = result.signature;
        queue.donations[idx].error = result.error;

        if (result.success) {
          queue.totalProcessed++;
        } else {
          queue.totalFailed++;
        }
        saveQueue(queue);
      }

      results.push({
        id: donation.id,
        success: result.success,
        signature: result.signature,
        error: result.error,
      });

      // Random delay between donations (1-3 seconds)
      if (shuffledDonations.indexOf(donation) < shuffledDonations.length - 1) {
        const delay = INTER_DONATION_DELAY_MS + Math.random() * 1000;
        await sleep(delay);
      }
    }

    queue.lastProcessed = Date.now();
    saveQueue(queue);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[Batch] Processed ${results.length} donations: ${successful} success, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} donations`,
      processed: successful,
      failed: failed,
      results,
    });

  } catch (error: any) {
    console.error('[Batch] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process batch' },
      { status: 500 }
    );
  }
}

// GET - Get batch processing status
export async function GET(request: NextRequest) {
  try {
    const queue = loadQueue();

    const pending = queue.donations.filter(d => d.status === 'pending');
    const processing = queue.donations.filter(d => d.status === 'processing');
    const recentCompleted = queue.donations
      .filter(d => d.status === 'completed' && d.processedAt && Date.now() - d.processedAt < 3600000)
      .slice(-10);

    // Check if batch should be triggered
    const oldestPending = pending.length > 0 ? Math.min(...pending.map(d => d.timestamp)) : Date.now();
    const queueAge = Date.now() - oldestPending;
    const shouldProcess = pending.length >= MIN_BATCH_SIZE || (pending.length > 0 && queueAge >= MAX_QUEUE_AGE_MS);

    return NextResponse.json({
      success: true,
      status: {
        pending: pending.length,
        processing: processing.length,
        minBatchSize: MIN_BATCH_SIZE,
        queueAgeSeconds: Math.floor(queueAge / 1000),
        maxQueueAgeSeconds: MAX_QUEUE_AGE_MS / 1000,
        shouldProcess,
        lastProcessed: queue.lastProcessed,
        totalProcessed: queue.totalProcessed,
        totalFailed: queue.totalFailed,
      },
      recentCompleted: recentCompleted.map(d => ({
        id: d.id,
        campaignId: d.campaignId,
        amount: d.amount / LAMPORTS_PER_SOL,
        processedAt: d.processedAt,
        txSignature: d.txSignature,
      })),
    });

  } catch (error: any) {
    console.error('[Batch] Status error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}
