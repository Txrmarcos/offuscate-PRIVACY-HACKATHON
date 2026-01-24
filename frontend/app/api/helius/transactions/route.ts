/**
 * Helius Enhanced Transactions API
 *
 * GET /api/helius/transactions?wallet=<address>&limit=20
 * - Returns indexed transactions for a wallet address
 * - Detects stealth payments from memo
 * - Enriched transaction data
 *
 * GET /api/helius/transactions?signature=<sig>
 * - Get details for a specific transaction
 */

import { NextRequest, NextResponse } from 'next/server';

const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
const HELIUS_API_URL = 'https://api-devnet.helius.xyz/v0';

interface ProcessedTransaction {
  signature: string;
  timestamp: number;
  slot: number;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  description: string;
  // Privacy detection
  isStealth: boolean;
  privacyLevel: 'public' | 'semi' | 'private';
  ephemeralKey: string | null;
  // Transfer details
  nativeTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
  tokenTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    amount: number;
    decimals: number;
  }[];
  // Account changes
  accountsInvolved: string[];
  balanceChanges: {
    account: string;
    before: number;
    after: number;
    change: number;
  }[];
  // Program interaction
  programsUsed: string[];
  // Status
  success: boolean;
  error: string | null;
}

/**
 * Parse memo/description to detect stealth payment
 */
function detectPrivacy(tx: any): {
  isStealth: boolean;
  privacyLevel: 'public' | 'semi' | 'private';
  ephemeralKey: string | null;
} {
  const description = tx.description || '';
  const instructions = tx.instructions || [];

  // Check for stealth memo format 1: "stealth:<key>"
  if (description.includes('stealth:')) {
    const match = description.match(/stealth:([A-Za-z0-9]+)/);
    return {
      isStealth: true,
      privacyLevel: 'semi',
      ephemeralKey: match ? match[1] : null,
    };
  }

  // Check for stealth memo format 2: JSON
  try {
    const jsonMatch = description.match(/\{[^}]*"type"\s*:\s*"stealth"[^}]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.type === 'stealth' && parsed.ephemeralPubKey) {
        return {
          isStealth: true,
          privacyLevel: 'semi',
          ephemeralKey: parsed.ephemeralPubKey,
        };
      }
    }
  } catch {
    // Not JSON
  }

  // Check for memo program usage with stealth data
  for (const ix of instructions) {
    if (ix.programId === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr') {
      const data = ix.data || '';
      if (data.includes('stealth') || data.includes('ephemeral')) {
        return {
          isStealth: true,
          privacyLevel: 'semi',
          ephemeralKey: null,
        };
      }
    }
  }

  // Check for privacy pool interaction (future)
  const privacyPrograms = [
    'priv', // placeholder
  ];
  for (const ix of instructions) {
    if (privacyPrograms.some(p => ix.programId?.includes(p))) {
      return {
        isStealth: true,
        privacyLevel: 'private',
        ephemeralKey: null,
      };
    }
  }

  return {
    isStealth: false,
    privacyLevel: 'public',
    ephemeralKey: null,
  };
}

/**
 * Process raw Helius transaction into enriched format
 */
function processTransaction(tx: any): ProcessedTransaction {
  const privacy = detectPrivacy(tx);

  // Extract balance changes
  const balanceChanges = (tx.accountData || []).map((acc: any) => ({
    account: acc.account,
    before: 0, // Helius doesn't provide this directly
    after: 0,
    change: acc.nativeBalanceChange || 0,
  }));

  // Extract programs used
  const programIds = (tx.instructions || [])
    .map((ix: any) => ix.programId as string)
    .filter((id: string | null): id is string => Boolean(id));
  const programsUsed: string[] = Array.from(new Set<string>(programIds));

  // Extract all accounts involved
  const accountsInvolved = [
    ...new Set([
      tx.feePayer,
      ...(tx.nativeTransfers || []).map((t: any) => t.fromUserAccount),
      ...(tx.nativeTransfers || []).map((t: any) => t.toUserAccount),
      ...(tx.tokenTransfers || []).map((t: any) => t.fromUserAccount),
      ...(tx.tokenTransfers || []).map((t: any) => t.toUserAccount),
    ].filter(Boolean)),
  ];

  return {
    signature: tx.signature,
    timestamp: tx.timestamp,
    slot: tx.slot || 0,
    type: tx.type || 'UNKNOWN',
    source: tx.source || 'UNKNOWN',
    fee: tx.fee || 0,
    feePayer: tx.feePayer || '',
    description: tx.description || '',
    // Privacy
    isStealth: privacy.isStealth,
    privacyLevel: privacy.privacyLevel,
    ephemeralKey: privacy.ephemeralKey,
    // Transfers
    nativeTransfers: tx.nativeTransfers || [],
    tokenTransfers: tx.tokenTransfers || [],
    // Accounts
    accountsInvolved,
    balanceChanges,
    programsUsed,
    // Status
    success: tx.transactionError === null,
    error: tx.transactionError || null,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');
  const signature = searchParams.get('signature');
  const limit = parseInt(searchParams.get('limit') || '20');
  const type = searchParams.get('type'); // Filter by type
  const stealthOnly = searchParams.get('stealthOnly') === 'true';

  if (!HELIUS_API_KEY) {
    return NextResponse.json(
      { error: 'Helius API key not configured' },
      { status: 500 }
    );
  }

  // Get specific transaction
  if (signature) {
    try {
      const response = await fetch(
        `${HELIUS_API_URL}/transactions/?api-key=${HELIUS_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: [signature] }),
        }
      );

      if (!response.ok) {
        throw new Error(`Helius API error: ${response.status}`);
      }

      const [tx] = await response.json();

      if (!tx) {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        transaction: processTransaction(tx),
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  }

  // Get transactions for wallet
  if (!wallet) {
    return NextResponse.json(
      { error: 'Missing wallet or signature parameter' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${HELIUS_API_URL}/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&limit=${Math.min(limit, 100)}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Helius API] Error:', errorText);
      return NextResponse.json(
        { error: 'Helius API error', details: errorText },
        { status: response.status }
      );
    }

    const rawTransactions = await response.json();

    // Process all transactions
    let transactions = rawTransactions.map(processTransaction);

    // Apply filters
    if (type) {
      transactions = transactions.filter((tx: ProcessedTransaction) => tx.type === type);
    }

    if (stealthOnly) {
      transactions = transactions.filter((tx: ProcessedTransaction) => tx.isStealth);
    }

    // Calculate stats
    const stats = {
      total: transactions.length,
      stealth: transactions.filter((tx: ProcessedTransaction) => tx.isStealth).length,
      public: transactions.filter((tx: ProcessedTransaction) => !tx.isStealth).length,
      totalVolume: transactions.reduce((sum: number, tx: ProcessedTransaction) => {
        const received = tx.nativeTransfers.find(t => t.toUserAccount === wallet);
        return sum + (received?.amount || 0);
      }, 0),
      totalFees: transactions.reduce((sum: number, tx: ProcessedTransaction) => sum + tx.fee, 0),
      types: transactions.reduce((acc: Record<string, number>, tx: ProcessedTransaction) => {
        acc[tx.type] = (acc[tx.type] || 0) + 1;
        return acc;
      }, {}),
    };

    return NextResponse.json({
      success: true,
      wallet,
      count: transactions.length,
      stats,
      transactions,
    });

  } catch (error: any) {
    console.error('[Helius API] Failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
