import { NextRequest, NextResponse } from 'next/server';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

// Dynamic import to avoid webpack WASM issues
const getPrivacyCash = async () => {
  const { PrivacyCash } = await import('privacycash');
  return PrivacyCash;
};

// RPC endpoint
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

/**
 * Derive a deterministic keypair from a signature
 * This allows us to create a "privacy wallet" from a user's signature
 * Returns both the Keypair and the base58 encoded secret key
 */
function deriveKeypairFromSignature(signature: Uint8Array): { keypair: Keypair; secretKeyBase58: string } {
  // Use first 32 bytes of signature as seed
  const seed = signature.slice(0, 32);
  const keypair = Keypair.fromSeed(seed);
  // Privacy.cash SDK expects base58 encoded secret key (64 bytes)
  const secretKeyBase58 = bs58.encode(keypair.secretKey);
  return { keypair, secretKeyBase58 };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signature, amountSol } = body;

    if (!signature || !amountSol) {
      return NextResponse.json(
        { error: 'Missing required fields: signature, amountSol' },
        { status: 400 }
      );
    }

    // Decode signature from base58
    const signatureBytes = bs58.decode(signature);

    // Derive a keypair from the signature
    // This creates a deterministic "privacy wallet" for the user
    const { keypair: privacyKeypair, secretKeyBase58 } = deriveKeypairFromSignature(signatureBytes);

    console.log('[Privacy API] Deposit request:');
    console.log('  Amount:', amountSol, 'SOL');
    console.log('  Privacy wallet:', privacyKeypair.publicKey.toBase58());

    // Initialize Privacy.cash SDK (dynamic import)
    // SDK expects base58 encoded secret key, not Keypair object
    const PrivacyCash = await getPrivacyCash();
    const privacyCash = new PrivacyCash({
      RPC_url: RPC_URL,
      owner: secretKeyBase58,
      enableDebug: true,
    });

    // Execute deposit
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
    const result = await privacyCash.deposit({ lamports });

    console.log('[Privacy API] Deposit successful:', result.tx);

    return NextResponse.json({
      success: true,
      tx: result.tx,
      privacyWallet: privacyKeypair.publicKey.toBase58(),
    });

  } catch (error: any) {
    console.error('[Privacy API] Deposit error:', error);
    return NextResponse.json(
      { error: error.message || 'Deposit failed' },
      { status: 500 }
    );
  }
}
