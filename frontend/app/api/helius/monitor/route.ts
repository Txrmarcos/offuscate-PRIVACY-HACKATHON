/**
 * Helius Address Monitoring API
 *
 * POST /api/helius/monitor
 * - Add addresses to monitor (campaigns, stealth addresses, vaults)
 *
 * GET /api/helius/monitor
 * - Get all monitored addresses with their activity
 *
 * DELETE /api/helius/monitor?address=<address>
 * - Remove address from monitoring
 */

import { NextRequest, NextResponse } from 'next/server';

const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
const HELIUS_API_URL = 'https://api-devnet.helius.xyz/v0';

// In-memory storage for monitored addresses
interface MonitoredAddress {
  address: string;
  type: 'campaign' | 'vault' | 'stealth' | 'wallet';
  label?: string;
  addedAt: number;
  lastActivity?: number;
  totalReceived: number;
  transactionCount: number;
}

const monitoredAddresses: Map<string, MonitoredAddress> = new Map();

/**
 * Fetch address activity from Helius
 */
async function fetchAddressActivity(address: string): Promise<{
  transactions: any[];
  balance: number;
}> {
  if (!HELIUS_API_KEY) {
    return { transactions: [], balance: 0 };
  }

  try {
    // Get recent transactions
    const txResponse = await fetch(
      `${HELIUS_API_URL}/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=10`
    );
    const transactions = txResponse.ok ? await txResponse.json() : [];

    // Get balance using RPC
    const balanceResponse = await fetch(
      `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
      }
    );
    const balanceData = await balanceResponse.json();
    const balance = balanceData.result?.value || 0;

    return { transactions, balance };
  } catch (error) {
    console.error(`[Monitor] Failed to fetch activity for ${address}:`, error);
    return { transactions: [], balance: 0 };
  }
}

/**
 * POST - Add address to monitoring
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, type, label } = body;

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    // Validate address format (basic check)
    if (address.length < 32 || address.length > 44) {
      return NextResponse.json(
        { error: 'Invalid Solana address format' },
        { status: 400 }
      );
    }

    // Add to monitored addresses
    const monitored: MonitoredAddress = {
      address,
      type: type || 'wallet',
      label,
      addedAt: Date.now(),
      totalReceived: 0,
      transactionCount: 0,
    };

    // Fetch initial activity
    const { transactions, balance } = await fetchAddressActivity(address);

    if (transactions.length > 0) {
      monitored.lastActivity = transactions[0].timestamp * 1000;
      monitored.transactionCount = transactions.length;

      // Calculate total received
      monitored.totalReceived = transactions.reduce((sum: number, tx: any) => {
        const received = tx.nativeTransfers?.find(
          (t: any) => t.toUserAccount === address
        );
        return sum + (received?.amount || 0);
      }, 0);
    }

    monitoredAddresses.set(address, monitored);

    console.log(`[Monitor] ➕ Added ${type}: ${address.slice(0, 8)}...${label ? ` (${label})` : ''}`);

    return NextResponse.json({
      success: true,
      address,
      type,
      label,
      balance: balance / 1e9,
      transactionCount: monitored.transactionCount,
    });

  } catch (error: any) {
    console.error('[Monitor] Error adding address:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add address' },
      { status: 500 }
    );
  }
}

// Privacy Pool Program ID
const PROGRAM_ID = '5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq';

/**
 * Fetch Privacy Pool transactions and stats
 */
async function fetchPoolStats(): Promise<{
  success: boolean;
  stats: {
    deposits: any[];
    withdrawals: any[];
    churns: any[];
    totalDeposited: number;
    totalWithdrawn: number;
    totalChurned: number;
    transactionCount: number;
    lastUpdated: number;
  };
}> {
  if (!HELIUS_API_KEY) {
    return {
      success: false,
      stats: {
        deposits: [],
        withdrawals: [],
        churns: [],
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalChurned: 0,
        transactionCount: 0,
        lastUpdated: Date.now(),
      },
    };
  }

  try {
    // Fetch program transactions
    const response = await fetch(
      `${HELIUS_API_URL}/addresses/${PROGRAM_ID}/transactions?api-key=${HELIUS_API_KEY}&limit=100`
    );

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const transactions = await response.json();

    // Parse transactions to identify pool operations
    const deposits: any[] = [];
    const withdrawals: any[] = [];
    const churns: any[] = [];

    for (const tx of transactions) {
      const description = (tx.description || '').toLowerCase();
      const logs = tx.logs?.join(' ').toLowerCase() || '';
      const combined = description + ' ' + logs;

      // Get amount from native transfers
      const amount = tx.nativeTransfers?.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0) || 0;

      const poolTx = {
        signature: tx.signature,
        timestamp: tx.timestamp,
        amount,
        fromAddress: tx.nativeTransfers?.[0]?.fromUserAccount,
        toAddress: tx.nativeTransfers?.[0]?.toUserAccount,
      };

      if (combined.includes('pool deposit') || combined.includes('pool_deposit')) {
        deposits.push({ ...poolTx, type: 'deposit' });
      } else if (combined.includes('claim') || combined.includes('withdraw')) {
        if (combined.includes('request')) {
          withdrawals.push({ ...poolTx, type: 'withdraw_request' });
        } else {
          withdrawals.push({ ...poolTx, type: 'withdraw_claim' });
        }
      } else if (combined.includes('churn')) {
        if (combined.includes('unchurn')) {
          churns.push({ ...poolTx, type: 'unchurn' });
        } else {
          churns.push({ ...poolTx, type: 'churn' });
        }
      }
    }

    return {
      success: true,
      stats: {
        deposits,
        withdrawals,
        churns,
        totalDeposited: deposits.reduce((sum, tx) => sum + tx.amount, 0),
        totalWithdrawn: withdrawals.reduce((sum, tx) => sum + tx.amount, 0),
        totalChurned: churns.reduce((sum, tx) => sum + tx.amount, 0),
        transactionCount: deposits.length + withdrawals.length + churns.length,
        lastUpdated: Date.now(),
      },
    };
  } catch (error) {
    console.error('[Monitor] Failed to fetch pool stats:', error);
    return {
      success: false,
      stats: {
        deposits: [],
        withdrawals: [],
        churns: [],
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalChurned: 0,
        transactionCount: 0,
        lastUpdated: Date.now(),
      },
    };
  }
}

/**
 * GET - Get monitored addresses with activity
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const type = searchParams.get('type');
  const refresh = searchParams.get('refresh') === 'true';

  // Special case: Pool stats
  if (type === 'pool') {
    const result = await fetchPoolStats();
    return NextResponse.json(result);
  }

  // Get specific address
  if (address) {
    const monitored = monitoredAddresses.get(address);

    if (!monitored) {
      return NextResponse.json(
        { error: 'Address not monitored' },
        { status: 404 }
      );
    }

    // Refresh activity if requested
    if (refresh) {
      const { transactions, balance } = await fetchAddressActivity(address);

      if (transactions.length > 0) {
        monitored.lastActivity = transactions[0].timestamp * 1000;
        monitored.transactionCount = transactions.length;
      }

      return NextResponse.json({
        success: true,
        ...monitored,
        balance: balance / 1e9,
        transactions: transactions.slice(0, 5),
      });
    }

    return NextResponse.json({
      success: true,
      ...monitored,
    });
  }

  // Get all monitored addresses
  let addresses = Array.from(monitoredAddresses.values());

  // Filter by type if specified
  if (type) {
    addresses = addresses.filter(a => a.type === type);
  }

  // Refresh all if requested (limited to avoid rate limits)
  if (refresh && addresses.length <= 5) {
    for (const addr of addresses) {
      const { transactions, balance } = await fetchAddressActivity(addr.address);
      if (transactions.length > 0) {
        addr.lastActivity = transactions[0].timestamp * 1000;
        addr.transactionCount = transactions.length;
      }
    }
  }

  // Calculate stats
  const stats = {
    total: addresses.length,
    byCampaign: addresses.filter(a => a.type === 'campaign').length,
    byVault: addresses.filter(a => a.type === 'vault').length,
    byStealth: addresses.filter(a => a.type === 'stealth').length,
    byWallet: addresses.filter(a => a.type === 'wallet').length,
    totalReceived: addresses.reduce((sum, a) => sum + a.totalReceived, 0) / 1e9,
  };

  return NextResponse.json({
    success: true,
    stats,
    addresses: addresses.sort((a, b) => b.addedAt - a.addedAt),
  });
}

/**
 * DELETE - Remove address from monitoring
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { error: 'Address is required' },
      { status: 400 }
    );
  }

  const existed = monitoredAddresses.delete(address);

  if (!existed) {
    return NextResponse.json(
      { error: 'Address was not monitored' },
      { status: 404 }
    );
  }

  console.log(`[Monitor] ➖ Removed: ${address.slice(0, 8)}...`);

  return NextResponse.json({
    success: true,
    removed: address,
  });
}
