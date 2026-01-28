'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Loader2,
  Activity,
  Server,
  Bell,
  Lock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Building2,
  DollarSign,
  Key,
  Copy,
  Check,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { EmployeeSalaryCard } from '../components/EmployeeSalaryCard';
import { useStealth } from '../lib/stealth/StealthContext';
import { useRole } from '../lib/role';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

type TabType = 'history';
type TxFilterType = 'all' | 'received' | 'sent' | 'private' | 'standard';

const ITEMS_PER_PAGE = 8;


interface IndexedPayment {
  signature: string;
  timestamp: number;
  type: string;
  isPrivate: boolean;
  amount: number;
  fee: number;
  description: string;
}

interface HeliusStatus {
  connected: boolean;
  latency: number;
  configured: boolean;
}

interface WebhookStats {
  eventCount: number;
  privateCount: number;
  lastReceived: number | null;
}

export default function DashboardPage() {
  const { connected, publicKey } = useWallet();
  const { stealthKeys, metaAddressString, isLoading: keysLoading, deriveKeysFromWallet } = useStealth();
  const { role } = useRole();

  const isEmployer = role === 'employer';


  const [indexedPayments, setIndexedPayments] = useState<IndexedPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<TxFilterType>('all');
  const [paymentPage, setPaymentPage] = useState(1);
  const [heliusStatus, setHeliusStatus] = useState<HeliusStatus>({
    connected: false,
    latency: 0,
    configured: false,
  });

  const [webhookStats, setWebhookStats] = useState<WebhookStats>({
    eventCount: 0,
    privateCount: 0,
    lastReceived: null,
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Copy to clipboard
  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };


  const totalDistributed = indexedPayments.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0) / LAMPORTS_PER_SOL;
  const privateVolume = indexedPayments
    .filter(tx => tx.isPrivate)
    .reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0) / LAMPORTS_PER_SOL;

  const fetchHeliusStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/helius/status');
      const data = await res.json();
      setHeliusStatus({
        connected: data.success && data.rpc?.connected,
        latency: parseInt(data.rpc?.latency) || 0,
        configured: data.configured,
      });
    } catch {
      setHeliusStatus({ connected: false, latency: 0, configured: false });
    }
  }, []);

  const fetchWebhookStats = useCallback(async () => {
    try {
      const res = await fetch('/api/helius/webhook');
      const data = await res.json();
      setWebhookStats({
        eventCount: data.count || 0,
        privateCount: data.stealthCount || 0,
        lastReceived: data.lastReceived,
      });
    } catch {}
  }, []);

  const fetchIndexedPayments = useCallback(async () => {
    if (!publicKey) return;
    setLoadingPayments(true);
    try {
      const res = await fetch(`/api/helius/transactions?wallet=${publicKey.toBase58()}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setIndexedPayments(data.transactions.map((tx: any) => ({
          signature: tx.signature,
          timestamp: tx.timestamp,
          type: tx.type || 'UNKNOWN',
          isPrivate: tx.isStealth,
          amount: tx.nativeTransfers?.[0]?.amount || 0,
          fee: tx.fee || 0,
          description: tx.description || '',
        })));
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  }, [publicKey]);


  useEffect(() => {
    fetchHeliusStatus();
    fetchWebhookStats();
    if (publicKey) {
      fetchIndexedPayments();
    }
    const webhookInterval = setInterval(fetchWebhookStats, 10000);
    return () => clearInterval(webhookInterval);
  }, [publicKey, fetchIndexedPayments, fetchHeliusStatus, fetchWebhookStats]);

  
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const refreshAll = async () => {
    await Promise.all([
      fetchIndexedPayments(),
      fetchHeliusStatus(),
      fetchWebhookStats(),
    ]);
  };

  const formatAmount = (lamports: number) => (lamports / LAMPORTS_PER_SOL).toFixed(4);
  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  // Not connected state
  if (!connected) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl flex items-center justify-center">
            <Building2 className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Connect Wallet</h1>
          <p className="text-white/40 text-lg">
            Connect your wallet to access your operations dashboard.
          </p>
        </div>
      </div>
    );
  }

  // No stealth keys state
  if (!stealthKeys && !keysLoading) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl flex items-center justify-center">
            <Lock className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Setup Privacy</h1>
          <p className="text-white/40 text-lg mb-8">
            Generate cryptographic keys for private operations.
          </p>
          <button
            onClick={deriveKeysFromWallet}
            className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.15)]"
          >
            Generate Keys
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-white mb-1">
              {isEmployer ? 'Operations Dashboard' : 'My Payments'}
            </h1>
            <p className="text-white/40 text-sm">
              {isEmployer
                ? 'Manage payroll batches and private payments.'
                : 'View and claim your private payments.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshAll}
              disabled={loadingPayments}
              className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.05] transition-all active:scale-95"
            >
              {loadingPayments ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>

            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.05] transition-all active:scale-95 relative"
              >
                <Bell className="w-4 h-4" />
                {webhookStats.privateCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                    {webhookStats.privateCount > 9 ? '9+' : webhookStats.privateCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-64 bg-[#0a0a0a] border border-white/[0.06] rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs font-medium text-white">Events</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${webhookStats.lastReceived ? 'bg-green-400' : 'bg-white/20'}`} />
                      <span className="text-[10px] text-white/40">
                        {webhookStats.lastReceived ? 'Live' : 'Waiting'}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/40">Total Operations</span>
                      <span className="text-xs font-mono text-white">{webhookStats.eventCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/40">Private Payments</span>
                      <span className="text-xs font-mono text-white">{webhookStats.privateCount}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Stat Cards */}
        <div className={`grid grid-cols-2 md:grid-cols-3 ${isEmployer ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 mb-6`}>
          {(isEmployer
            ? [
                { label: 'TOTAL DISTRIBUTED', value: `${totalDistributed.toFixed(2)}`, unit: 'SOL', icon: DollarSign },
                { label: 'PRIVATE VOLUME', value: `${privateVolume.toFixed(2)}`, unit: 'SOL', icon: EyeOff },
                { label: 'OPERATIONS', value: `${indexedPayments.length}`, unit: 'Total', icon: Activity },
                { label: 'RPC', value: heliusStatus.connected ? `${heliusStatus.latency}` : '-', unit: 'ms', icon: Server, status: heliusStatus.connected },
              ]
            : [
                { label: 'PRIVATE VOLUME', value: `${privateVolume.toFixed(2)}`, unit: 'SOL', icon: EyeOff },
                { label: 'PAYMENT HISTORY', value: `${indexedPayments.length}`, unit: 'Total', icon: Activity },
                { label: 'RPC', value: heliusStatus.connected ? `${heliusStatus.latency}` : '-', unit: 'ms', icon: Server, status: heliusStatus.connected },
              ]
          ).map(({ label, value, unit, icon: Icon, status }) => (
            <div
              key={label}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-white/30" />
                </div>
                {status !== undefined && (
                  <div className={`w-2 h-2 rounded-full ${status ? 'bg-green-400' : 'bg-red-400'}`} />
                )}
              </div>
              <p className="text-[10px] text-white/25 tracking-wide mb-1">{label}</p>
              <p className="text-lg font-mono text-white">
                {value} <span className="text-xs text-white/30">{unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Your Stealth Address - Easy Copy Card */}
        <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.1]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
                <Key className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <h3 className="text-white font-medium">Your Stealth Address</h3>
                <p className="text-white/30 text-xs">Share this to receive private payments</p>
              </div>
            </div>
            {!metaAddressString && (
              <button
                onClick={async () => {
                  try {
                    await deriveKeysFromWallet();
                  } catch (e) {
                    console.error('Failed to derive stealth keys:', e);
                  }
                }}
                className="h-9 px-4 bg-white/[0.08] text-white text-sm font-medium rounded-xl hover:bg-white/[0.12] transition-all flex items-center gap-2"
              >
                <Key className="w-4 h-4" />
                Generate
              </button>
            )}
          </div>

          {metaAddressString ? (
            <div className="space-y-3">
              {/* Stealth Meta Address with Copy */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-black/20 border border-white/[0.08]">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Stealth Meta Address</p>
                  <p className="text-white font-mono text-sm break-all">
                    {metaAddressString}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(metaAddressString, 'stealth-meta')}
                  className="flex-shrink-0 h-10 w-10 bg-white text-black rounded-xl hover:bg-white/90 transition-all flex items-center justify-center"
                  title="Copy stealth address"
                >
                  {copied === 'stealth-meta' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              {/* Helper text */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02]">
                <EyeOff className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" />
                <p className="text-white/40 text-xs">
                  {isEmployer
                    ? 'Use this address when adding employees to payroll for maximum privacy. Employees can also share their stealth address with you.'
                    : 'Share this address with anyone who wants to send you private payments. They can use it to generate a one-time stealth address that only you can claim.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.1] text-center">
              <EyeOff className="w-8 h-8 mx-auto mb-2 text-white/20" />
              <p className="text-white/40 text-sm mb-1">No stealth address yet</p>
              <p className="text-white/25 text-xs">Click Generate to create your stealth address</p>
            </div>
          )}
        </div>

        {/* Streaming Salary Card - Only for Recipients */}
        {!isEmployer && (
          <div className="mb-6">
            <EmployeeSalaryCard />
          </div>
        )}

        
        {/* Payment History */}
        <h2 className="text-lg font-medium text-white mb-4">Payment History</h2>
        {(() => {
          const filteredPayments = indexedPayments.filter(tx => {
            if (paymentFilter === 'all') return true;
            if (paymentFilter === 'received') return tx.amount > 0;
            if (paymentFilter === 'sent') return tx.amount <= 0;
            if (paymentFilter === 'private') return tx.isPrivate;
            if (paymentFilter === 'standard') return !tx.isPrivate;
            return true;
          });
          const totalPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE);
          const paginatedPayments = filteredPayments.slice((paymentPage - 1) * ITEMS_PER_PAGE, paymentPage * ITEMS_PER_PAGE);

          return (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-white/30" />
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'all' as TxFilterType, label: 'All' },
                      { id: 'received' as TxFilterType, label: 'Received' },
                      { id: 'sent' as TxFilterType, label: 'Sent' },
                      { id: 'private' as TxFilterType, label: 'Private' },
                      { id: 'standard' as TxFilterType, label: 'Standard' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => { setPaymentFilter(id); setPaymentPage(1); }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          paymentFilter === id
                            ? 'bg-white text-black'
                            : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-white/30">
                  {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* List */}
              {paginatedPayments.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                  <Activity className="w-10 h-10 mx-auto mb-3 text-white/10" />
                  <p className="text-white/30 text-sm">No payments found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedPayments.map((tx) => (
                    <div key={tx.signature} className="px-5 py-4 flex items-center justify-between rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          tx.amount > 0 ? 'bg-white/[0.06]' : 'bg-white/[0.03]'
                        }`}>
                          {tx.amount > 0 ? (
                            <ArrowDownLeft className="w-4 h-4 text-white/60" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-white/30" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-mono text-sm">
                              {tx.signature.slice(0, 8)} ... {tx.signature.slice(-8)}
                            </span>
                            <span className={`px-2 py-0.5 text-[9px] font-medium rounded-md ${
                              tx.isPrivate
                                ? 'bg-white/[0.08] text-white/60'
                                : 'bg-white/[0.04] text-white/30'
                            }`}>
                              {tx.isPrivate ? 'PRIVATE' : 'STANDARD'}
                            </span>
                          </div>
                          <p className="text-xs text-white/25 mt-0.5">{formatDate(tx.timestamp)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-mono text-white">
                          {tx.amount > 0 ? '+' : ''}{formatAmount(tx.amount)} <span className="text-xs text-white/30">SOL</span>
                        </p>
                        <a
                          href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setPaymentPage(p => Math.max(1, p - 1))}
                    disabled={paymentPage === 1}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setPaymentPage(page)}
                        className={`w-8 h-8 text-xs font-medium rounded-lg transition-all ${
                          paymentPage === page
                            ? 'bg-white text-black'
                            : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06]'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setPaymentPage(p => Math.min(totalPages, p + 1))}
                    disabled={paymentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        
      </div>
    </div>
  );
}
