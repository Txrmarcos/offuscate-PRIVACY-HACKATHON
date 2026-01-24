/**
 * Helius Status/Health API
 *
 * GET /api/helius/status
 *
 * Returns:
 * - RPC connection status
 * - Latency
 * - Current slot
 * - API configuration
 */

import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';

const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
const HELIUS_RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export async function GET() {
  const isConfigured = !!HELIUS_API_KEY;

  if (!isConfigured) {
    return NextResponse.json({
      success: false,
      configured: false,
      error: 'Helius API key not configured',
    });
  }

  try {
    const connection = new Connection(HELIUS_RPC_URL, 'confirmed');

    // Measure latency
    const start = Date.now();
    const slot = await connection.getSlot();
    const latency = Date.now() - start;

    // Get recent blockhash to verify full connectivity
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    return NextResponse.json({
      success: true,
      configured: true,
      network: 'devnet',
      rpc: {
        provider: 'Helius',
        url: HELIUS_RPC_URL.replace(HELIUS_API_KEY, '***'),
        connected: true,
        latency: `${latency}ms`,
      },
      chain: {
        slot,
        blockhash: blockhash.slice(0, 16) + '...',
        lastValidBlockHeight,
      },
      apiKey: {
        configured: true,
        preview: `${HELIUS_API_KEY.slice(0, 4)}...${HELIUS_API_KEY.slice(-4)}`,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Helius Status] Error:', error);
    return NextResponse.json({
      success: false,
      configured: true,
      error: error.message || 'Connection failed',
      rpc: {
        provider: 'Helius',
        connected: false,
      },
    });
  }
}
