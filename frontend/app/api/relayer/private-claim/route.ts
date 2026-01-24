import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Ed25519Program } from '@solana/web3.js';
import bs58 from 'bs58';

// Relayer keypair - in production, use secure key management
const RELAYER_SECRET_KEY = process.env.RELAYER_SECRET_KEY;
const PROGRAM_ID = new PublicKey('5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq');
const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 'https://api.devnet.solana.com';

interface PrivateClaimRequest {
  // The commitment hash (hex)
  commitment: string;
  // The nullifier hash (hex)
  nullifier: string;
  // The secret hash (hex)
  secretHash: string;
  // The amount in lamports
  amount: number;
  // The recipient public key
  recipient: string;
  // The signature from the recipient keypair
  signature: string;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export async function POST(request: NextRequest) {
  try {
    const body: PrivateClaimRequest = await request.json();
    const { commitment, nullifier, secretHash, amount, recipient, signature } = body;

    // Validate inputs
    if (!commitment || !nullifier || !secretHash || !amount || !recipient || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Parse values
    const recipientPubkey = new PublicKey(recipient);
    const signatureBytes = bs58.decode(signature);
    const commitmentBytes = hexToBytes(commitment);
    const nullifierBytes = hexToBytes(nullifier);
    const secretHashBytes = hexToBytes(secretHash);

    // The message that was signed
    const message = Buffer.from(`private_withdraw:${commitment}`);

    // Create ed25519 signature verification instruction
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

    // Get commitment PDA
    const [commitmentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('commitment'), Buffer.from(commitmentBytes)],
      PROGRAM_ID
    );

    // Get nullifier PDA
    const [nullifierPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('nullifier'), Buffer.from(nullifierBytes)],
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

    // Convert to arrays for Anchor
    const nullifierArray = Array.from(nullifierBytes);
    const secretHashArray = Array.from(secretHashBytes);

    // Build the private_withdraw_relayed instruction
    const withdrawIx = await program.methods
      .privateWithdrawRelayed(nullifierArray, secretHashArray, new anchor.BN(amount))
      .accounts({
        relayer: relayerKeypair.publicKey,
        recipient: recipientPubkey,
        pool: poolPda,
        poolVault: poolVaultPda,
        commitmentPda: commitmentPda,
        nullifierPda: nullifierPda,
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
    // 2. Private withdraw instruction
    tx.add(ed25519Ix);
    tx.add(withdrawIx);

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

    console.log(`[Relayer] Private gasless claim successful: ${txSignature}`);
    console.log(`[Relayer] Recipient: ${recipient}`);
    console.log(`[Relayer] Commitment: ${commitment.slice(0, 16)}...`);

    return NextResponse.json({
      success: true,
      signature: txSignature,
      message: 'Private gasless claim submitted successfully',
      relayer: relayerKeypair.publicKey.toString(),
    });

  } catch (error: any) {
    console.error('[Relayer] Error:', error);
    console.error('[Relayer] Error message:', error.message);
    console.error('[Relayer] Error logs:', error.logs);

    let errorMessage = error.message || 'Unknown error';
    if (error.logs) {
      errorMessage = error.logs.join('\n');
    }

    return NextResponse.json(
      {
        error: 'Relayer private claim failed',
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
