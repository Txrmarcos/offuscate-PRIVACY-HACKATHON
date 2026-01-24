/**
 * Helius Explorer API
 *
 * Provides explorer-like functionality for addresses and transactions
 *
 * GET /api/helius/explorer?address=<address>
 * - Get comprehensive address info (balance, tokens, history, NFTs)
 *
 * GET /api/helius/explorer?tx=<signature>
 * - Get detailed transaction breakdown
 *
 * GET /api/helius/explorer/assets?address=<address>
 * - Get all assets (tokens, NFTs) for an address
 */

import { NextRequest, NextResponse } from 'next/server';

const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
const HELIUS_RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API_URL = 'https://api-devnet.helius.xyz/v0';

interface AddressInfo {
  address: string;
  balance: number;
  lamports: number;
  tokenAccounts: {
    mint: string;
    amount: number;
    decimals: number;
  }[];
  recentTransactions: any[];
  transactionCount: number;
  firstActivity: number | null;
  lastActivity: number | null;
  isProgram: boolean;
  isPDA: boolean;
  stealthInfo?: {
    isStealthAddress: boolean;
    hasStealthActivity: boolean;
    stealthTransactionCount: number;
  };
}

interface TransactionDetail {
  signature: string;
  slot: number;
  timestamp: number;
  blockTime: string;
  success: boolean;
  fee: number;
  feePayer: string;
  type: string;
  source: string;
  description: string;
  // Detailed breakdown
  instructions: {
    programId: string;
    programName: string;
    data: string;
    accounts: string[];
  }[];
  // Transfers
  nativeTransfers: {
    from: string;
    to: string;
    amount: number;
    amountSOL: number;
  }[];
  tokenTransfers: {
    from: string;
    to: string;
    mint: string;
    amount: number;
  }[];
  // Account changes
  accountChanges: {
    address: string;
    before: number;
    after: number;
    change: number;
    changeSOL: number;
  }[];
  // Privacy
  privacyInfo: {
    isStealth: boolean;
    privacyLevel: string;
    ephemeralKey: string | null;
  };
  // Raw
  raw: any;
}

/**
 * Get SOL balance via RPC
 */
async function getBalance(address: string): Promise<number> {
  const response = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address],
    }),
  });
  const data = await response.json();
  return data.result?.value || 0;
}

/**
 * Get token accounts via RPC
 */
async function getTokenAccounts(address: string): Promise<any[]> {
  const response = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        address,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ],
    }),
  });
  const data = await response.json();
  return (data.result?.value || []).map((acc: any) => ({
    mint: acc.account.data.parsed.info.mint,
    amount: acc.account.data.parsed.info.tokenAmount.uiAmount,
    decimals: acc.account.data.parsed.info.tokenAmount.decimals,
  }));
}

/**
 * Get account info via RPC
 */
async function getAccountInfo(address: string): Promise<{ isProgram: boolean; isPDA: boolean }> {
  const response = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [address, { encoding: 'base64' }],
    }),
  });
  const data = await response.json();
  const accountInfo = data.result?.value;

  return {
    isProgram: accountInfo?.executable || false,
    isPDA: accountInfo?.owner === '11111111111111111111111111111111' ? false : true,
  };
}

/**
 * Get transactions via Helius Enhanced API
 */
async function getTransactions(address: string, limit: number = 20): Promise<any[]> {
  const response = await fetch(
    `${HELIUS_API_URL}/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`
  );
  if (!response.ok) return [];
  return response.json();
}

/**
 * Get single transaction details
 */
async function getTransactionDetail(signature: string): Promise<any> {
  const response = await fetch(
    `${HELIUS_API_URL}/transactions/?api-key=${HELIUS_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: [signature] }),
    }
  );
  if (!response.ok) return null;
  const [tx] = await response.json();
  return tx;
}

/**
 * Detect stealth activity in transactions
 */
function analyzeStealthActivity(transactions: any[]): {
  isStealthAddress: boolean;
  hasStealthActivity: boolean;
  stealthTransactionCount: number;
} {
  let stealthCount = 0;

  for (const tx of transactions) {
    const desc = tx.description || '';
    if (desc.includes('stealth:') || desc.includes('"type":"stealth"')) {
      stealthCount++;
    }
  }

  return {
    isStealthAddress: stealthCount > 0 && stealthCount === transactions.length,
    hasStealthActivity: stealthCount > 0,
    stealthTransactionCount: stealthCount,
  };
}

/**
 * Parse transaction for detailed view
 */
function parseTransactionDetail(tx: any): TransactionDetail {
  const description = tx.description || '';
  let isStealth = false;
  let ephemeralKey = null;

  if (description.includes('stealth:')) {
    isStealth = true;
    const match = description.match(/stealth:([A-Za-z0-9]+)/);
    ephemeralKey = match ? match[1] : null;
  }

  return {
    signature: tx.signature,
    slot: tx.slot || 0,
    timestamp: tx.timestamp,
    blockTime: new Date(tx.timestamp * 1000).toISOString(),
    success: tx.transactionError === null,
    fee: tx.fee || 0,
    feePayer: tx.feePayer || '',
    type: tx.type || 'UNKNOWN',
    source: tx.source || 'UNKNOWN',
    description: tx.description || '',
    instructions: (tx.instructions || []).map((ix: any) => ({
      programId: ix.programId || '',
      programName: ix.programId?.slice(0, 8) || 'Unknown',
      data: ix.data || '',
      accounts: ix.accounts || [],
    })),
    nativeTransfers: (tx.nativeTransfers || []).map((t: any) => ({
      from: t.fromUserAccount,
      to: t.toUserAccount,
      amount: t.amount,
      amountSOL: t.amount / 1e9,
    })),
    tokenTransfers: (tx.tokenTransfers || []).map((t: any) => ({
      from: t.fromUserAccount,
      to: t.toUserAccount,
      mint: t.mint,
      amount: t.tokenAmount,
    })),
    accountChanges: (tx.accountData || []).map((a: any) => ({
      address: a.account,
      before: 0,
      after: 0,
      change: a.nativeBalanceChange || 0,
      changeSOL: (a.nativeBalanceChange || 0) / 1e9,
    })),
    privacyInfo: {
      isStealth,
      privacyLevel: isStealth ? 'semi' : 'public',
      ephemeralKey,
    },
    raw: tx,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const tx = searchParams.get('tx');
  const assets = searchParams.get('assets') === 'true';

  if (!HELIUS_API_KEY) {
    return NextResponse.json(
      { error: 'Helius API key not configured' },
      { status: 500 }
    );
  }

  // Get transaction details
  if (tx) {
    try {
      const transaction = await getTransactionDetail(tx);

      if (!transaction) {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        transaction: parseTransactionDetail(transaction),
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  }

  // Get address info
  if (!address) {
    return NextResponse.json(
      { error: 'Missing address or tx parameter' },
      { status: 400 }
    );
  }

  try {
    // Fetch all data in parallel
    const [balance, tokenAccounts, accountInfo, transactions] = await Promise.all([
      getBalance(address),
      assets ? getTokenAccounts(address) : Promise.resolve([]),
      getAccountInfo(address),
      getTransactions(address, 50),
    ]);

    // Analyze stealth activity
    const stealthInfo = analyzeStealthActivity(transactions);

    // Calculate activity timestamps
    const timestamps = transactions.map((t: any) => t.timestamp).filter(Boolean);
    const firstActivity = timestamps.length > 0 ? Math.min(...timestamps) : null;
    const lastActivity = timestamps.length > 0 ? Math.max(...timestamps) : null;

    const addressInfo: AddressInfo = {
      address,
      balance: balance / 1e9,
      lamports: balance,
      tokenAccounts,
      recentTransactions: transactions.slice(0, 10).map((tx: any) => ({
        signature: tx.signature,
        type: tx.type,
        timestamp: tx.timestamp,
        fee: tx.fee,
        nativeTransfers: tx.nativeTransfers,
      })),
      transactionCount: transactions.length,
      firstActivity,
      lastActivity,
      isProgram: accountInfo.isProgram,
      isPDA: accountInfo.isPDA,
      stealthInfo,
    };

    return NextResponse.json({
      success: true,
      data: addressInfo,
    });

  } catch (error: any) {
    console.error('[Explorer API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
