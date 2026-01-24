import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Ed25519Program } from '@solana/web3.js';
import bs58 from 'bs58';

// Relayer keypair - in production, use secure key management
// For hackathon demo, we use an environment variable
const RELAYER_SECRET_KEY = process.env.RELAYER_SECRET_KEY;
const PROGRAM_ID = new PublicKey('5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq');
const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 'https://api.devnet.solana.com';

interface ClaimRequest {
  // The pending withdraw PDA
  pendingPda: string;
  // The recipient (stealth address) public key
  recipient: string;
  // The signature from the stealth keypair over "claim:{pendingPda}"
  signature: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ClaimRequest = await request.json();
    const { pendingPda, recipient, signature } = body;

    // Validate inputs
    if (!pendingPda || !recipient || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields: pendingPda, recipient, signature' },
        { status: 400 }
      );
    }

    // Check if relayer is configured
    if (!RELAYER_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Relayer not configured. Set RELAYER_SECRET_KEY env var.' },
        { status: 500 }
      );
    }

    // Load relayer keypair
    const relayerKeypair = Keypair.fromSecretKey(
      bs58.decode(RELAYER_SECRET_KEY)
    );

    // Connect to Solana
    const connection = new Connection(RPC_URL, 'confirmed');

    // Parse public keys
    const pendingPdaPubkey = new PublicKey(pendingPda);
    const recipientPubkey = new PublicKey(recipient);
    const signatureBytes = bs58.decode(signature);

    // The message that was signed
    const message = Buffer.from(`claim:${pendingPda}`);

    // Create ed25519 signature verification instruction
    // This proves the recipient signed the claim message
    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
      publicKey: recipientPubkey.toBytes(),
      signature: signatureBytes,
      message: message,
    });

    // Get pool PDAs
    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('privacy_pool')],
      PROGRAM_ID
    );
    const [poolVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool_vault')],
      PROGRAM_ID
    );

    // Load the program IDL
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

    const program = new anchor.Program(idl, provider) as any;

    // Build the claim_withdraw_relayed instruction
    const claimIx = await program.methods
      .claimWithdrawRelayed()
      .accounts({
        relayer: relayerKeypair.publicKey,
        recipient: recipientPubkey,
        pool: poolPda,
        poolVault: poolVaultPda,
        pendingWithdraw: pendingPdaPubkey,
        instructionsSysvar: new PublicKey('Sysvar1nstructions1111111111111111111111111'),
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // Build transaction with both instructions
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const tx = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: relayerKeypair.publicKey,
    });

    // Add instructions in order:
    // 1. Ed25519 signature verification (must be first, checked at index 0)
    // 2. Claim instruction
    tx.add(ed25519Ix);
    tx.add(claimIx);

    // Sign and send
    tx.sign(relayerKeypair);
    const txSignature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    await connection.confirmTransaction({
      signature: txSignature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log(`[Relayer] Gasless claim successful: ${txSignature}`);
    console.log(`[Relayer] Recipient: ${recipient}`);
    console.log(`[Relayer] Pending PDA: ${pendingPda}`);

    return NextResponse.json({
      success: true,
      signature: txSignature,
      message: 'Gasless claim submitted successfully',
      relayer: relayerKeypair.publicKey.toString(),
    });

  } catch (error: any) {
    console.error('[Relayer] Error:', error);
    console.error('[Relayer] Error message:', error.message);
    console.error('[Relayer] Error logs:', error.logs);
    console.error('[Relayer] Error stack:', error.stack);

    // Parse Anchor/Solana errors
    let errorMessage = error.message || 'Unknown error';
    if (error.logs) {
      errorMessage = error.logs.join('\n');
    }

    return NextResponse.json(
      {
        error: 'Relayer claim failed',
        details: errorMessage,
        stack: error.stack?.split('\n').slice(0, 5),
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check relayer status
export async function GET() {
  const isConfigured = !!RELAYER_SECRET_KEY;

  let relayerAddress = null;
  let balance = null;

  if (isConfigured) {
    try {
      const relayerKeypair = Keypair.fromSecretKey(
        bs58.decode(RELAYER_SECRET_KEY!)
      );
      relayerAddress = relayerKeypair.publicKey.toString();

      const connection = new Connection(RPC_URL, 'confirmed');
      balance = await connection.getBalance(relayerKeypair.publicKey) / 1e9;
    } catch (e) {
      // Invalid key format
    }
  }

  return NextResponse.json({
    configured: isConfigured,
    relayerAddress,
    balance,
    rpcUrl: RPC_URL,
  });
}
