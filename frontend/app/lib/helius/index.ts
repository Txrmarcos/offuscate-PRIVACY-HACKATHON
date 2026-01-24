/**
 * Helius Integration
 *
 * Indexing and observability layer for:
 * - Enhanced Transactions API
 * - Webhooks (event-driven)
 * - Stealth payment tracking
 */

import { Connection, PublicKey } from '@solana/web3.js';

// Helius API configuration
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
const HELIUS_RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API_URL = `https://api-devnet.helius.xyz/v0`;

// Export connection using Helius RPC
export function getHeliusConnection(): Connection {
  if (!HELIUS_API_KEY) {
    console.warn('[Helius] No API key configured, falling back to default RPC');
    return new Connection('https://api.devnet.solana.com', 'confirmed');
  }
  return new Connection(HELIUS_RPC_URL, 'confirmed');
}

// Types
export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
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
  }[];
  accountData: {
    account: string;
    nativeBalanceChange: number;
  }[];
  description: string;
}

export interface HeliusWebhookEvent {
  type: string;
  signature: string;
  timestamp: number;
  accounts: string[];
  nativeTransfers?: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
}

/**
 * Fetch enhanced transactions for an address
 * Uses Helius Enhanced Transactions API
 */
export async function getEnhancedTransactions(
  address: string,
  limit: number = 20
): Promise<HeliusTransaction[]> {
  if (!HELIUS_API_KEY) {
    console.error('[Helius] No API key configured');
    return [];
  }

  try {
    const response = await fetch(
      `${HELIUS_API_URL}/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const transactions = await response.json();
    return transactions;
  } catch (error) {
    console.error('[Helius] Failed to fetch transactions:', error);
    return [];
  }
}

/**
 * Fetch transactions for a specific program
 */
export async function getProgramTransactions(
  programId: string,
  limit: number = 20
): Promise<HeliusTransaction[]> {
  return getEnhancedTransactions(programId, limit);
}

/**
 * Parse transaction to detect stealth payments
 * Looks for memo with "stealth:" prefix
 */
export function detectStealthPayment(tx: HeliusTransaction): {
  isStealth: boolean;
  ephemeralKey?: string;
  amount?: number;
  recipient?: string;
} {
  // Check if transaction has stealth memo
  const description = tx.description || '';
  const isStealthMemo = description.includes('stealth:');

  if (!isStealthMemo && tx.nativeTransfers.length === 0) {
    return { isStealth: false };
  }

  // Extract stealth info
  const transfer = tx.nativeTransfers[0];

  return {
    isStealth: isStealthMemo,
    ephemeralKey: isStealthMemo ? description.split('stealth:')[1]?.trim() : undefined,
    amount: transfer?.amount,
    recipient: transfer?.toUserAccount,
  };
}

/**
 * Get RPC health/latency
 */
export async function getHeliusHealth(): Promise<{
  connected: boolean;
  latency: number;
  slot: number;
}> {
  const connection = getHeliusConnection();
  const start = Date.now();

  try {
    const slot = await connection.getSlot();
    const latency = Date.now() - start;

    return {
      connected: true,
      latency,
      slot,
    };
  } catch (error) {
    return {
      connected: false,
      latency: -1,
      slot: 0,
    };
  }
}

/**
 * Check if Helius is properly configured
 */
export function isHeliusConfigured(): boolean {
  return !!HELIUS_API_KEY;
}

/**
 * Get Helius API key status (masked)
 */
export function getHeliusStatus(): {
  configured: boolean;
  keyPreview: string;
  rpcUrl: string;
} {
  return {
    configured: !!HELIUS_API_KEY,
    keyPreview: HELIUS_API_KEY ? `${HELIUS_API_KEY.slice(0, 4)}...${HELIUS_API_KEY.slice(-4)}` : 'Not configured',
    rpcUrl: HELIUS_API_KEY ? HELIUS_RPC_URL.replace(HELIUS_API_KEY, '***') : 'Default RPC',
  };
}

// ============================================
// PRIVACY POOL INDEXATION
// ============================================

export interface PoolTransaction {
  signature: string;
  timestamp: number;
  type: 'deposit' | 'withdraw_request' | 'withdraw_claim' | 'churn' | 'unchurn' | 'unknown';
  amount: number; // lamports
  fromAddress?: string;
  toAddress?: string;
}

export interface PoolStats {
  deposits: PoolTransaction[];
  withdrawals: PoolTransaction[];
  churns: PoolTransaction[];
  totalDeposited: number;
  totalWithdrawn: number;
  totalChurned: number;
  transactionCount: number;
  lastUpdated: number;
}

// Program ID for filtering
const PROGRAM_ID = '5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq';

// Pool vault PDA (derived from seeds: [b"pool_vault"])
const POOL_VAULT_ADDRESS = ''; // Will be populated on first call

/**
 * Fetch Privacy Pool transactions from Helius
 */
export async function getPoolTransactions(limit: number = 50): Promise<PoolTransaction[]> {
  const transactions = await getEnhancedTransactions(PROGRAM_ID, limit);

  return transactions
    .map(tx => parsePoolTransaction(tx))
    .filter((tx): tx is PoolTransaction => tx !== null);
}

/**
 * Parse a transaction to determine if it's a pool operation
 */
function parsePoolTransaction(tx: HeliusTransaction): PoolTransaction | null {
  const description = tx.description?.toLowerCase() || '';
  const transfers = tx.nativeTransfers || [];

  // Check for pool operations by analyzing description/memo
  let type: PoolTransaction['type'] = 'unknown';

  if (description.includes('pool deposit') || description.includes('pooldeposit')) {
    type = 'deposit';
  } else if (description.includes('request withdraw') || description.includes('requestwithdraw')) {
    type = 'withdraw_request';
  } else if (description.includes('claim withdraw') || description.includes('claimwithdraw')) {
    type = 'withdraw_claim';
  } else if (description.includes('pool churn') || description.includes('poolchurn')) {
    type = 'churn';
  } else if (description.includes('pool unchurn') || description.includes('poolunchurn')) {
    type = 'unchurn';
  }

  // If we can't identify the type, try to infer from transfers
  if (type === 'unknown' && transfers.length > 0) {
    const transfer = transfers[0];
    // This is a heuristic - in production you'd check account addresses
    if (transfer.amount > 0) {
      return null; // Skip unknown transactions
    }
  }

  // Calculate total amount from transfers
  const totalAmount = transfers.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    signature: tx.signature,
    timestamp: tx.timestamp,
    type,
    amount: totalAmount,
    fromAddress: transfers[0]?.fromUserAccount,
    toAddress: transfers[0]?.toUserAccount,
  };
}

/**
 * Get aggregated pool stats from recent transactions
 */
export async function getPoolIndexedStats(limit: number = 100): Promise<PoolStats> {
  const transactions = await getPoolTransactions(limit);

  const deposits = transactions.filter(tx => tx.type === 'deposit');
  const withdrawals = transactions.filter(tx => tx.type === 'withdraw_claim');
  const churns = transactions.filter(tx => tx.type === 'churn' || tx.type === 'unchurn');

  return {
    deposits,
    withdrawals,
    churns,
    totalDeposited: deposits.reduce((sum, tx) => sum + tx.amount, 0),
    totalWithdrawn: withdrawals.reduce((sum, tx) => sum + tx.amount, 0),
    totalChurned: churns.reduce((sum, tx) => sum + tx.amount, 0),
    transactionCount: transactions.length,
    lastUpdated: Date.now(),
  };
}

/**
 * Create webhook configuration for Privacy Pool monitoring
 * NOTE: This returns the configuration object - actual webhook creation
 * requires server-side API call with Helius API key
 */
export function getPoolWebhookConfig(webhookUrl: string) {
  return {
    webhookURL: webhookUrl,
    transactionTypes: ['TRANSFER', 'SWAP'],
    accountAddresses: [PROGRAM_ID],
    webhookType: 'enhanced',
    authHeader: 'x-webhook-secret',
    encoding: 'jsonParsed',
  };
}

/**
 * Parse incoming webhook event for pool operations
 */
export function parsePoolWebhookEvent(event: HeliusWebhookEvent): PoolTransaction | null {
  const transfers = event.nativeTransfers || [];
  const type = event.type?.toLowerCase() || '';

  let poolType: PoolTransaction['type'] = 'unknown';

  // Infer type from event
  if (type.includes('deposit') || transfers.some(t => t.toUserAccount?.includes('pool'))) {
    poolType = 'deposit';
  } else if (type.includes('withdraw') || type.includes('claim')) {
    poolType = 'withdraw_claim';
  } else if (type.includes('churn')) {
    poolType = 'churn';
  }

  if (poolType === 'unknown') {
    return null;
  }

  const totalAmount = transfers.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    signature: event.signature,
    timestamp: event.timestamp,
    type: poolType,
    amount: totalAmount,
    fromAddress: transfers[0]?.fromUserAccount,
    toAddress: transfers[0]?.toUserAccount,
  };
}

/**
 * Real-time pool monitoring using websocket subscriptions
 * Returns cleanup function
 */
export function subscribeToPoolEvents(
  onDeposit: (tx: PoolTransaction) => void,
  onWithdraw: (tx: PoolTransaction) => void,
  onChurn: (tx: PoolTransaction) => void
): () => void {
  const connection = getHeliusConnection();

  // Subscribe to program logs
  const subscriptionId = connection.onLogs(
    new PublicKey(PROGRAM_ID),
    (logs) => {
      // Parse logs to detect pool operations
      const logsStr = logs.logs.join('\n').toLowerCase();

      if (logsStr.includes('pool deposit')) {
        onDeposit({
          signature: logs.signature,
          timestamp: Date.now(),
          type: 'deposit',
          amount: 0, // Will need to fetch actual amount
        });
      } else if (logsStr.includes('claim') || logsStr.includes('withdrawn')) {
        onWithdraw({
          signature: logs.signature,
          timestamp: Date.now(),
          type: 'withdraw_claim',
          amount: 0,
        });
      } else if (logsStr.includes('churn')) {
        onChurn({
          signature: logs.signature,
          timestamp: Date.now(),
          type: 'churn',
          amount: 0,
        });
      }
    },
    'confirmed'
  );

  // Return cleanup function
  return () => {
    connection.removeOnLogsListener(subscriptionId);
  };
}
