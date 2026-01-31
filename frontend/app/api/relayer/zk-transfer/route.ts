/**
 * Relayer for ZK Compressed Transfers
 *
 * This endpoint enables gasless ZK transfers using Light Protocol.
 * The relayer pays the transaction fees, hiding the fee payer identity.
 *
 * Flow:
 * 1. Frontend builds ZK transfer tx with relayer as fee payer
 * 2. User partially signs (authorizes compressed account spending)
 * 3. Frontend sends partially-signed tx to this endpoint
 * 4. Relayer adds signature and submits
 *
 * Fee Model:
 * - A small fee (0.5%) is deducted from transfers to sustain the relayer
 * - Fee is taken from the PRIVATE funds (not public wallet)
 * - This maintains privacy while funding relayer operations
 *
 * Privacy Benefit:
 * - Sender hidden via ZK compression
 * - Fee payer hidden via relayer (this endpoint)
 * - Complete transaction privacy achieved
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  Rpc,
  createRpc,
  sendAndConfirmTx,
} from '@lightprotocol/stateless.js';
import bs58 from 'bs58';
import { getRelayerFeeInfo } from '@/app/lib/config/relayerFees';

const RELAYER_SECRET_KEY = process.env.RELAYER_SECRET_KEY;
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
const RPC_URL = HELIUS_API_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.devnet.solana.com';

// Track accumulated fees (in-memory for now, should be persisted in production)
let accumulatedFeesLamports = 0;
let totalTransactionsProcessed = 0;

interface FeeInfo {
  originalAmount: number;
  recipientAmount: number;
  feeAmount: number;
  feeLamports: number;
}

interface ZKTransferRequest {
  // Base64 encoded partially-signed VersionedTransaction
  signedTransaction: string;
  // Operation type for logging
  operationType: 'compress' | 'transfer' | 'decompress' | 'donation' | 'fee';
  // Fee information (optional, for fee-aware transfers)
  feeInfo?: FeeInfo;
}

/**
 * Get relayer keypair from environment
 */
function getRelayerKeypair(): Keypair | null {
  if (!RELAYER_SECRET_KEY) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(RELAYER_SECRET_KEY));
  } catch {
    return null;
  }
}

/**
 * Create Light Protocol RPC connection
 */
function createLightRpc(): Rpc {
  return createRpc(RPC_URL, RPC_URL, RPC_URL);
}

export async function POST(request: NextRequest) {
  try {
    const body: ZKTransferRequest = await request.json();
    const { signedTransaction, operationType, feeInfo } = body;

    // Validate inputs
    if (!signedTransaction) {
      return NextResponse.json(
        { error: 'Missing signedTransaction' },
        { status: 400 }
      );
    }

    // Check if relayer is configured
    const relayerKeypair = getRelayerKeypair();
    if (!relayerKeypair) {
      return NextResponse.json(
        { error: 'Relayer not configured. Set RELAYER_SECRET_KEY env var.' },
        { status: 500 }
      );
    }

    console.log(`[ZK Relayer] Processing ${operationType || 'unknown'} request`);
    console.log(`[ZK Relayer] Relayer address: ${relayerKeypair.publicKey.toBase58()}`);

    // Log fee information if provided
    if (feeInfo) {
      console.log(`[ZK Relayer] Fee Info:`);
      console.log(`  - Original amount: ${feeInfo.originalAmount} SOL`);
      console.log(`  - Recipient receives: ${feeInfo.recipientAmount} SOL`);
      console.log(`  - Relayer fee: ${feeInfo.feeAmount} SOL (${feeInfo.feeLamports} lamports)`);
    }

    // Deserialize the partially-signed transaction
    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const tx = VersionedTransaction.deserialize(txBuffer);

    // Verify the fee payer is the relayer
    const connection = new Connection(RPC_URL, 'confirmed');
    const message = tx.message;

    // Get account keys from the message
    const accountKeys = message.staticAccountKeys;
    const feePayer = accountKeys[0];

    if (!feePayer.equals(relayerKeypair.publicKey)) {
      console.log(`[ZK Relayer] Fee payer mismatch. Expected: ${relayerKeypair.publicKey.toBase58()}, Got: ${feePayer.toBase58()}`);
      return NextResponse.json(
        { error: 'Transaction fee payer must be the relayer' },
        { status: 400 }
      );
    }

    // Sign the transaction with relayer key
    tx.sign([relayerKeypair]);

    // Send via Light Protocol RPC
    const lightRpc = createLightRpc();
    const signature = await sendAndConfirmTx(lightRpc, tx);

    // Track accumulated fees and transactions
    totalTransactionsProcessed++;

    // If this is a fee transaction, the relayer is receiving SOL directly
    if (operationType === 'fee') {
      if (feeInfo) {
        accumulatedFeesLamports += feeInfo.feeLamports;
        console.log(`[ZK Relayer] 💰 FEE RECEIVED: ${feeInfo.feeAmount} SOL (${feeInfo.feeLamports} lamports)`);
      }
      console.log(`[ZK Relayer] 💰 Total accumulated fees: ${accumulatedFeesLamports / 1e9} SOL`);
    }

    console.log(`[ZK Relayer] ✅ ${operationType || 'ZK transfer'} successful: ${signature}`);
    console.log(`[ZK Relayer] 📊 Total transactions processed: ${totalTransactionsProcessed}`);

    return NextResponse.json({
      success: true,
      signature,
      message: `Gasless ${operationType || 'ZK transfer'} completed successfully`,
      relayer: relayerKeypair.publicKey.toString(),
      feeCollected: feeInfo ? {
        amount: feeInfo.feeAmount,
        lamports: feeInfo.feeLamports,
      } : null,
    });

  } catch (error: any) {
    console.error('[ZK Relayer] Error:', error);

    // Parse error for better message
    let errorMessage = error.message || 'Unknown error';
    if (error.logs) {
      errorMessage = error.logs.join('\n');
    }

    return NextResponse.json(
      {
        error: 'ZK transfer failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check ZK relayer status and fee configuration
 */
export async function GET() {
  const relayerKeypair = getRelayerKeypair();
  const isConfigured = !!relayerKeypair;

  let relayerAddress = null;
  let balance = null;

  if (isConfigured && relayerKeypair) {
    try {
      relayerAddress = relayerKeypair.publicKey.toString();
      const connection = new Connection(RPC_URL, 'confirmed');
      balance = await connection.getBalance(relayerKeypair.publicKey) / 1e9;
    } catch (e) {
      // Error checking balance
    }
  }

  // Get fee configuration
  const feeConfig = getRelayerFeeInfo();

  return NextResponse.json({
    configured: isConfigured,
    relayerAddress,
    balance,
    rpcUrl: RPC_URL,
    supportedOperations: ['compress', 'transfer', 'decompress', 'donation', 'fee'],
    // Fee configuration
    fees: feeConfig,
    // Statistics
    stats: {
      accumulatedFeesSOL: accumulatedFeesLamports / 1e9,
      accumulatedFeesLamports,
      totalTransactionsProcessed,
    },
    // Two-transaction fee model info
    feeModel: {
      type: 'two-transaction',
      description: 'Fee is collected in TX1, transfer happens in TX2',
      flow: [
        'TX1: Decompress fee amount → Relayer wallet',
        'TX2: Decompress remaining → Recipient wallet',
      ],
    },
  });
}
