import { NextRequest, NextResponse } from 'next/server';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const getPrivacyCash = async () => {
  const { PrivacyCash } = await import('privacycash');
  return PrivacyCash;
};

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

function deriveKeypairFromSignature(signature: Uint8Array): { keypair: Keypair; secretKeyBase58: string } {
  const seed = signature.slice(0, 32);
  const keypair = Keypair.fromSeed(seed);
  const secretKeyBase58 = bs58.encode(keypair.secretKey);
  return { keypair, secretKeyBase58 };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signature } = body;

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing required field: signature' },
        { status: 400 }
      );
    }

    const signatureBytes = bs58.decode(signature);
    const { keypair: privacyKeypair, secretKeyBase58 } = deriveKeypairFromSignature(signatureBytes);

    console.log('[Privacy API] Balance request for:', privacyKeypair.publicKey.toBase58());

    const PrivacyCash = await getPrivacyCash();
    const privacyCash = new PrivacyCash({
      RPC_url: RPC_URL,
      owner: secretKeyBase58,
      enableDebug: true,
    });

    const result = await privacyCash.getPrivateBalance();

    return NextResponse.json({
      success: true,
      lamports: result.lamports,
      sol: result.lamports / LAMPORTS_PER_SOL,
      privacyWallet: privacyKeypair.publicKey.toBase58(),
    });

  } catch (error: any) {
    console.error('[Privacy API] Balance error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get balance' },
      { status: 500 }
    );
  }
}
