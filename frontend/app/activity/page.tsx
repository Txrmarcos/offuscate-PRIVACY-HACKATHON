'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Eye,
  EyeOff,
  ExternalLink,
  Server,
  Wifi,
  Shield,
  ArrowDownToLine,
  ArrowUpFromLine,
  Shuffle,
  Droplets,
} from 'lucide-react';
import Link from 'next/link';

interface Transaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  description: string;
  isStealth: boolean;
  ephemeralKey: string | null;
  nativeTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
}

interface HeliusStatus {
  success: boolean;
  configured: boolean;
  network?: string;
  rpc?: {
    provider: string;
    connected: boolean;
    latency: string;
  };
  chain?: {
    slot: number;
    blockhash: string;
  };
  apiKey?: {
    preview: string;
  };
  error?: string;
}

interface WebhookData {
  count: number;
  lastReceived: number | null;
  events: any[];
}

interface PoolStats {
  deposits: PoolTransaction[];
  withdrawals: PoolTransaction[];
  churns: PoolTransaction[];
  totalDeposited: number;
  totalWithdrawn: number;
  totalChurned: number;
  transactionCount: number;
  lastUpdated: number;
}

interface PoolTransaction {
  signature: string;
  timestamp: number;
  type: 'deposit' | 'withdraw_request' | 'withdraw_claim' | 'churn' | 'unchurn' | 'unknown';
  amount: number;
  fromAddress?: string;
  toAddress?: string;
}

export default function ActivityPage() {
  const { publicKey, connected } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [heliusStatus, setHeliusStatus] = useState<HeliusStatus | null>(null);
  const [webhookData, setWebhookData] = useState<WebhookData | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);

  // Fetch Helius status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/helius/status');
      const data = await res.json();
      setHeliusStatus(data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  // Fetch transactions
  const fetchTransactions = async () => {
    if (!publicKey) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/helius/transactions?wallet=${publicKey.toBase58()}&limit=20`);
      const data = await res.json();

      if (data.success) {
        setTransactions(data.transactions);
        setLastSync(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch webhook events
  const fetchWebhookEvents = async () => {
    try {
      const res = await fetch('/api/helius/webhook');
      const data = await res.json();
      setWebhookData(data);
    } catch (error) {
      console.error('Failed to fetch webhook events:', error);
    }
  };

  // Fetch Privacy Pool stats via Helius indexing
  const fetchPoolStats = async () => {
    setPoolLoading(true);
    try {
      const res = await fetch('/api/helius/monitor?type=pool');
      const data = await res.json();
      if (data.success) {
        setPoolStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch pool stats:', error);
    } finally {
      setPoolLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchWebhookEvents();
    fetchPoolStats();

    // Refresh status every 30 seconds
    const interval = setInterval(() => {
      fetchStatus();
      fetchWebhookEvents();
      fetchPoolStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (connected && publicKey) {
      fetchTransactions();
    }
  }, [connected, publicKey]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatAmount = (lamports: number) => {
    return (lamports / 1e9).toFixed(4);
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-[#262626] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg" />
            <span className="font-semibold">Privacy.cash</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/explore" className="text-[#737373] hover:text-white">
              Explore
            </Link>
            <Link href="/dashboard" className="text-[#737373] hover:text-white">
              Dashboard
            </Link>
            <Link href="/activity" className="text-white font-medium">
              Activity
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Activity className="w-6 h-6 text-purple-500" />
              Activity & Indexing
            </h1>
            <p className="text-[#737373] mt-1">
              Powered by Helius Enhanced Transactions API
            </p>
          </div>

          <button
            onClick={() => {
              fetchStatus();
              fetchTransactions();
              fetchWebhookEvents();
              fetchPoolStats();
            }}
            disabled={loading || poolLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#262626] rounded-lg hover:bg-[#262626] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading || poolLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Helius RPC Status */}
          <div className="bg-[#141414] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-4 h-4 text-[#737373]" />
              <span className="text-sm text-[#737373]">RPC Provider</span>
            </div>
            {heliusStatus ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {heliusStatus.rpc?.connected ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="font-medium">
                    {heliusStatus.rpc?.provider || 'Not configured'}
                  </span>
                </div>
                {heliusStatus.rpc?.latency && (
                  <p className="text-sm text-[#737373]">
                    Latency: {heliusStatus.rpc.latency}
                  </p>
                )}
                {heliusStatus.network && (
                  <p className="text-sm text-purple-400">
                    Network: {heliusStatus.network}
                  </p>
                )}
              </div>
            ) : (
              <div className="animate-pulse h-12 bg-[#262626] rounded" />
            )}
          </div>

          {/* Chain Status */}
          <div className="bg-[#141414] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-[#737373]" />
              <span className="text-sm text-[#737373]">Chain Status</span>
            </div>
            {heliusStatus?.chain ? (
              <div>
                <p className="font-medium">Slot: {heliusStatus.chain.slot.toLocaleString()}</p>
                <p className="text-sm text-[#737373] font-mono">
                  {heliusStatus.chain.blockhash}
                </p>
              </div>
            ) : (
              <div className="animate-pulse h-12 bg-[#262626] rounded" />
            )}
          </div>

          {/* Webhook Status */}
          <div className="bg-[#141414] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wifi className="w-4 h-4 text-[#737373]" />
              <span className="text-sm text-[#737373]">Webhook Events</span>
            </div>
            {webhookData ? (
              <div>
                <p className="font-medium">{webhookData.count} events received</p>
                <p className="text-sm text-[#737373]">
                  {webhookData.lastReceived
                    ? `Last: ${new Date(webhookData.lastReceived).toLocaleTimeString()}`
                    : 'No events yet'}
                </p>
              </div>
            ) : (
              <div className="animate-pulse h-12 bg-[#262626] rounded" />
            )}
          </div>
        </div>

        {/* API Key Info */}
        {heliusStatus?.apiKey && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-8">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-400 font-medium">Helius API Connected</span>
              <span className="text-green-400/60 text-sm font-mono ml-2">
                Key: {heliusStatus.apiKey.preview}
              </span>
            </div>
          </div>
        )}

        {!heliusStatus?.configured && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-8">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-yellow-500" />
              <span className="text-yellow-400">
                Helius API key not configured. Add NEXT_PUBLIC_HELIUS_API_KEY to .env.local
              </span>
            </div>
          </div>
        )}

        {/* Transactions List */}
        <div className="bg-[#141414] border border-[#262626] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#262626] flex items-center justify-between">
            <h2 className="font-semibold">Indexed Transactions</h2>
            {lastSync && (
              <span className="text-sm text-[#737373] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last sync: {lastSync.toLocaleTimeString()}
              </span>
            )}
          </div>

          {!connected ? (
            <div className="p-12 text-center text-[#737373]">
              Connect wallet to view your transaction history
            </div>
          ) : loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-500 mb-2" />
              <p className="text-[#737373]">Fetching from Helius...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center text-[#737373]">
              No transactions found
            </div>
          ) : (
            <div className="divide-y divide-[#262626]">
              {transactions.map((tx) => (
                <div key={tx.signature} className="px-6 py-4 hover:bg-[#1a1a1a] transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {tx.isStealth ? (
                          <span className="flex items-center gap-1 text-purple-400 text-sm font-medium">
                            <EyeOff className="w-4 h-4" />
                            Stealth
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[#737373] text-sm">
                            <Eye className="w-4 h-4" />
                            Public
                          </span>
                        )}
                        <span className="text-sm text-[#737373]">•</span>
                        <span className="text-sm text-[#737373]">{tx.type}</span>
                      </div>

                      <a
                        href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-blue-400 hover:underline flex items-center gap-1"
                      >
                        {truncateAddress(tx.signature)}
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      {tx.description && (
                        <p className="text-sm text-[#737373] mt-1 truncate max-w-md">
                          {tx.description}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      {tx.nativeTransfers[0] && (
                        <p className="font-medium">
                          {formatAmount(tx.nativeTransfers[0].amount)} SOL
                        </p>
                      )}
                      <p className="text-sm text-[#737373]">
                        {formatTime(tx.timestamp)}
                      </p>
                      <p className="text-xs text-[#737373]">
                        Fee: {tx.fee / 1e9} SOL
                      </p>
                    </div>
                  </div>

                  {tx.isStealth && tx.ephemeralKey && (
                    <div className="mt-2 bg-purple-500/10 border border-purple-500/20 rounded p-2">
                      <p className="text-xs text-purple-400 font-mono">
                        Ephemeral Key: {truncateAddress(tx.ephemeralKey)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Webhook Events */}
        {webhookData && webhookData.events.length > 0 && (
          <div className="mt-8 bg-[#141414] border border-[#262626] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#262626]">
              <h2 className="font-semibold">Recent Webhook Events</h2>
            </div>
            <div className="divide-y divide-[#262626]">
              {webhookData.events.slice(0, 5).map((event: any) => (
                <div key={event.id} className="px-6 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-purple-400">{event.type}</span>
                    <span className="text-[#737373]">
                      {new Date(event.receivedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  {event.signature && (
                    <p className="text-[#737373] font-mono text-xs mt-1">
                      {truncateAddress(event.signature)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Privacy Pool Activity - Indexed via Helius */}
        <div className="mt-8 bg-[#141414] border border-[#262626] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#262626] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              <h2 className="font-semibold">Privacy Pool Activity</h2>
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                Helius Indexed
              </span>
            </div>
            {poolStats && (
              <span className="text-xs text-[#737373]">
                {poolStats.transactionCount} transactions indexed
              </span>
            )}
          </div>

          {poolLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-500 mb-2" />
              <p className="text-[#737373] text-sm">Indexing pool transactions...</p>
            </div>
          ) : poolStats ? (
            <>
              {/* Pool Stats Summary */}
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-[#262626]">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <ArrowDownToLine className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-[#737373]">Deposits</span>
                  </div>
                  <p className="text-lg font-bold text-green-400">
                    {(poolStats.totalDeposited / 1e9).toFixed(2)} SOL
                  </p>
                  <p className="text-xs text-[#737373]">{poolStats.deposits.length} txs</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <ArrowUpFromLine className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-[#737373]">Withdrawals</span>
                  </div>
                  <p className="text-lg font-bold text-blue-400">
                    {(poolStats.totalWithdrawn / 1e9).toFixed(2)} SOL
                  </p>
                  <p className="text-xs text-[#737373]">{poolStats.withdrawals.length} txs</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Shuffle className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-[#737373]">Churns</span>
                  </div>
                  <p className="text-lg font-bold text-purple-400">
                    {(poolStats.totalChurned / 1e9).toFixed(2)} SOL
                  </p>
                  <p className="text-xs text-[#737373]">{poolStats.churns.length} txs</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Droplets className="w-4 h-4 text-[#737373]" />
                    <span className="text-xs text-[#737373]">Pool Balance</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {((poolStats.totalDeposited - poolStats.totalWithdrawn) / 1e9).toFixed(2)} SOL
                  </p>
                  <p className="text-xs text-[#737373]">estimated</p>
                </div>
              </div>

              {/* Recent Pool Transactions */}
              <div className="divide-y divide-[#262626]">
                {[...poolStats.deposits, ...poolStats.withdrawals, ...poolStats.churns]
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 10)
                  .map((tx) => (
                    <div key={tx.signature} className="px-6 py-3 hover:bg-[#1a1a1a] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {tx.type === 'deposit' && (
                            <span className="flex items-center gap-1 text-green-400 text-sm">
                              <ArrowDownToLine className="w-4 h-4" />
                              Deposit
                            </span>
                          )}
                          {(tx.type === 'withdraw_request' || tx.type === 'withdraw_claim') && (
                            <span className="flex items-center gap-1 text-blue-400 text-sm">
                              <ArrowUpFromLine className="w-4 h-4" />
                              {tx.type === 'withdraw_request' ? 'Request' : 'Claim'}
                            </span>
                          )}
                          {(tx.type === 'churn' || tx.type === 'unchurn') && (
                            <span className="flex items-center gap-1 text-purple-400 text-sm">
                              <Shuffle className="w-4 h-4" />
                              {tx.type === 'churn' ? 'Churn' : 'Unchurn'}
                            </span>
                          )}
                          <a
                            href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-[#737373] hover:text-white flex items-center gap-1"
                          >
                            {truncateAddress(tx.signature)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {tx.amount > 0 ? `${(tx.amount / 1e9).toFixed(4)} SOL` : '-'}
                          </p>
                          <p className="text-xs text-[#737373]">
                            {new Date(tx.timestamp * 1000).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                {poolStats.deposits.length === 0 && poolStats.withdrawals.length === 0 && poolStats.churns.length === 0 && (
                  <div className="px-6 py-8 text-center text-[#737373]">
                    No pool transactions found yet
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-[#737373]">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Unable to load pool stats</p>
              <p className="text-xs mt-1">Ensure Helius API is configured</p>
            </div>
          )}

          {/* Anti-Correlation Features Info */}
          <div className="px-6 py-4 bg-[#0a0a0a] border-t border-[#262626]">
            <p className="text-xs text-[#737373] text-center">
              <span className="text-purple-400">Anti-correlation features:</span>{' '}
              Variable delay (30s-5min) + Standardized amounts (0.1, 0.5, 1 SOL) +
              Pool churn + Batch withdrawals
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
