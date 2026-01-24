import { NextRequest, NextResponse } from 'next/server';
import { isLightProtocolAvailable, createLightRpc } from '../../../lib/privacy/lightProtocol';

/**
 * Check Light Protocol ZK Compression availability
 */
export async function GET(_request: NextRequest) {
  try {
    console.log('[Light API] Health check...');

    const available = await isLightProtocolAvailable();
    const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

    return NextResponse.json({
      success: true,
      available,
      network: 'devnet',
      protocol: 'Light Protocol ZK Compression',
      features: {
        compressedSOL: true,
        zkProofs: 'Groth16',
        merkleTreeStorage: true,
        onChainSavings: '~99%',
      },
      endpoints: {
        rpc: heliusKey ? 'Helius (configured)' : 'Public devnet',
        compression: heliusKey ? 'Helius ZK Compression RPC' : 'Public endpoint',
      },
      documentation: 'https://zkcompression.com',
    });

  } catch (error: any) {
    console.error('[Light API] Health check error:', error);
    return NextResponse.json({
      success: false,
      available: false,
      error: error.message || 'Health check failed',
    });
  }
}
