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
    const { signature, amountSol, recipientAddress } = body;

    if (!signature || !amountSol) {
      return NextResponse.json(
        { error: 'Missing required fields: signature, amountSol' },
        { status: 400 }
      );
    }

    const signatureBytes = bs58.decode(signature);
    const { keypair: privacyKeypair, secretKeyBase58 } = deriveKeypairFromSignature(signatureBytes);

    console.log('[Privacy API] Withdraw request:');
    console.log('  Amount:', amountSol, 'SOL');
    console.log('  Recipient:', recipientAddress || 'self');

    const PrivacyCash = await getPrivacyCash();
    const privacyCash = new PrivacyCash({
      RPC_url: RPC_URL,
      owner: secretKeyBase58,
      enableDebug: true,
    });

    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
    const result = await privacyCash.withdraw({
      lamports,
      recipientAddress: recipientAddress || undefined,
    });

    console.log('[Privacy API] Withdraw successful:', result.tx);

    return NextResponse.json({
      success: true,
      tx: result.tx,
      recipient: result.recipient,
      amount_in_lamports: result.amount_in_lamports,
      fee_in_lamports: result.fee_in_lamports,
      isPartial: result.isPartial,
    });

  } catch (error: any) {
    console.error('[Privacy API] Withdraw error:', error);
    return NextResponse.json(
      { error: error.message || 'Withdraw failed' },
      { status: 500 }
    );
  }
}
