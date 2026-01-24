import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getCompressedBalance } from '../../../lib/privacy/lightProtocol';

/**
 * Get compressed SOL balance for a wallet address
 * Uses Light Protocol ZK Compression
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Missing required parameter: address' },
        { status: 400 }
      );
    }

    // Validate address
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(address);
    } catch {
      return NextResponse.json(
        { error: 'Invalid Solana address' },
        { status: 400 }
      );
    }

    console.log('[Light API] Balance request for:', address);

    const balance = await getCompressedBalance(pubkey);

    return NextResponse.json({
      success: true,
      address,
      lamports: balance.lamports,
      sol: balance.sol,
      protocol: 'Light Protocol ZK Compression',
    });

  } catch (error: any) {
    console.error('[Light API] Balance error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get compressed balance' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json(
        { error: 'Missing required field: address' },
        { status: 400 }
      );
    }

    // Validate address
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(address);
    } catch {
      return NextResponse.json(
        { error: 'Invalid Solana address' },
        { status: 400 }
      );
    }

    console.log('[Light API] Balance request for:', address);

    const balance = await getCompressedBalance(pubkey);

    return NextResponse.json({
      success: true,
      address,
      lamports: balance.lamports,
      sol: balance.sol,
      protocol: 'Light Protocol ZK Compression',
    });

  } catch (error: any) {
    console.error('[Light API] Balance error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get compressed balance' },
      { status: 500 }
    );
  }
}
