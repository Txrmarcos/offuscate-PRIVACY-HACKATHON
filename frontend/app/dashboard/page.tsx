'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Shield,
  Loader2,
  Activity,
  Wallet,
  Server,
  Bell,
  Lock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Trash2,
  Building2,
  Users,
  DollarSign,
  Briefcase,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { SendPaymentModal } from '../components/SendPaymentModal';
import { PendingDonations } from '../components/PendingDonations';
import { useStealth } from '../lib/stealth/StealthContext';
import {
  isStealthAddressForUs,
  deriveStealthSpendingKey,
} from '../lib/stealth';
import { useProgram } from '../lib/program';
import { useRole } from '../lib/role';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const devnetConnection = new Connection(RPC_URL, 'confirmed');
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

type TabType = 'batches' | 'history' | 'receipts';
type TxFilterType = 'all' | 'received' | 'sent' | 'private' | 'standard';

const ITEMS_PER_PAGE = 8;

interface PrivateReceipt {
  signature: string;
  stealthAddress: string;
  ephemeralPubKey: string;
  amount: number;
  timestamp: number;
  canClaim: boolean;
}

interface PayrollBatch {
  id: string;
  title: string;
  budget: number;
  distributed: number;
  recipientCount: number;
  vaultBalance: number;
  stealthEnabled: boolean;
  status: 'Active' | 'Closed' | 'Completed';
}

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
  const {
    listCampaigns,
    fetchVaultBalance,
    withdraw: programWithdraw,
    closeCampaign,
    setStealthMetaAddress,
  } = useProgram();
  const { role } = useRole();

  const isEmployer = role === 'employer';
  const [activeTab, setActiveTab] = useState<TabType>(isEmployer ? 'batches' : 'receipts');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [copied, setCopied] = useState(false);
  const [receipts, setReceipts] = useState<PrivateReceipt[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  const [payrollBatches, setPayrollBatches] = useState<PayrollBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [withdrawingBatch, setWithdrawingBatch] = useState<string | null>(null);
  const [closingBatch, setClosingBatch] = useState<string | null>(null);
  const [enablingStealth, setEnablingStealth] = useState<string | null>(null);

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


  const totalClaimable = receipts.reduce((sum, p) => sum + p.amount, 0);
  const claimableReceipts = receipts.filter(p => p.canClaim);
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

  const loadPayrollBatches = useCallback(async () => {
    if (!publicKey) return;
    setLoadingBatches(true);
    try {
      const allCampaigns = await listCampaigns();
      const owned: PayrollBatch[] = [];
      for (const { account } of allCampaigns) {
        if (account.owner.toBase58() === publicKey.toBase58()) {
          const vaultBalance = await fetchVaultBalance(account.campaignId);
          owned.push({
            id: account.campaignId,
            title: account.title,
            budget: account.goal,
            distributed: account.totalRaised,
            recipientCount: account.donorCount,
            vaultBalance,
            stealthEnabled: !!account.stealthMetaAddress,
            status: account.status,
          });
        }
      }
      setPayrollBatches(owned);
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  }, [publicKey, listCampaigns, fetchVaultBalance]);

  const enableStealthOnBatch = async (batchId: string) => {
    if (!metaAddressString) return;
    setEnablingStealth(batchId);
    try {
      await setStealthMetaAddress(batchId, metaAddressString);
      setPayrollBatches(prev => prev.map(b =>
        b.id === batchId ? { ...b, stealthEnabled: true } : b
      ));
    } catch (err) {
      console.error('Failed to enable privacy:', err);
    } finally {
      setEnablingStealth(null);
    }
  };

  const withdrawFromBatch = async (batchId: string, amount: number) => {
    if (!publicKey || amount <= 0) return;
    setWithdrawingBatch(batchId);
    try {
      await programWithdraw(batchId, amount);
      await closeCampaign(batchId);
      setPayrollBatches(prev => prev.filter(b => b.id !== batchId));
    } catch (err) {
      console.error('Withdraw failed:', err);
      await loadPayrollBatches();
    } finally {
      setWithdrawingBatch(null);
    }
  };

  const handleCloseBatch = async (batchId: string) => {
    if (!publicKey) return;
    setClosingBatch(batchId);
    try {
      await closeCampaign(batchId);
      setPayrollBatches(prev => prev.filter(b => b.id !== batchId));
    } catch (err) {
      console.error('Close batch failed:', err);
    } finally {
      setClosingBatch(null);
    }
  };


  useEffect(() => {
    fetchHeliusStatus();
    fetchWebhookStats();
    if (publicKey) {
      loadPayrollBatches();
      fetchIndexedPayments();
    }
    const webhookInterval = setInterval(fetchWebhookStats, 10000);
    return () => clearInterval(webhookInterval);
  }, [publicKey, loadPayrollBatches, fetchIndexedPayments, fetchHeliusStatus, fetchWebhookStats]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scanForReceipts = useCallback(async () => {
    if (!stealthKeys) return;
    setIsScanning(true);
    try {
      const foundReceipts: PrivateReceipt[] = [];
      const signatures = await devnetConnection.getSignaturesForAddress(
        new PublicKey(MEMO_PROGRAM_ID),
        { limit: 100 }
      );

      const batchSize = 5;
      for (let i = 0; i < signatures.length; i += batchSize) {
        const batch = signatures.slice(i, i + batchSize);
        if (i > 0) await new Promise(r => setTimeout(r, 500));

        await Promise.all(batch.map(async (sig) => {
          try {
            const tx = await devnetConnection.getTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            });
            if (!tx?.meta || !tx.transaction.message) return;

            const accountKeys = tx.transaction.message.staticAccountKeys ||
                               (tx.transaction.message as any).accountKeys || [];

            for (const instruction of (tx.transaction.message as any).instructions || []) {
              const programId = accountKeys[instruction.programIdIndex]?.toBase58();
              if (programId === MEMO_PROGRAM_ID && instruction.data) {
                try {
                  const memoBytes = bs58.decode(instruction.data);
                  const memoData = new TextDecoder().decode(memoBytes);
                  let ephemeralPubKey: string | null = null;

                  if (memoData.startsWith('stealth:')) {
                    ephemeralPubKey = memoData.slice(8);
                  } else {
                    try {
                      const parsed = JSON.parse(memoData);
                      if (parsed.type === 'stealth' && parsed.ephemeralPubKey) {
                        ephemeralPubKey = parsed.ephemeralPubKey;
                      }
                    } catch {}
                  }

                  if (ephemeralPubKey) {
                    for (let j = 0; j < accountKeys.length; j++) {
                      const address = accountKeys[j];
                      const preBalance = tx.meta.preBalances[j] || 0;
                      const postBalance = tx.meta.postBalances[j] || 0;
                      const received = postBalance - preBalance;

                      if (received > 0) {
                        const isOurs = isStealthAddressForUs(
                          address,
                          ephemeralPubKey,
                          stealthKeys.viewKey.privateKey,
                          stealthKeys.spendKey.publicKey
                        );

                        if (isOurs) {
                          const currentBalance = await devnetConnection.getBalance(address);
                          if (!foundReceipts.some(r => r.stealthAddress === address.toBase58())) {
                            foundReceipts.push({
                              signature: sig.signature,
                              stealthAddress: address.toBase58(),
                              ephemeralPubKey: ephemeralPubKey,
                              amount: currentBalance / LAMPORTS_PER_SOL,
                              timestamp: sig.blockTime || 0,
                              canClaim: currentBalance > 0,
                            });
                          }
                        }
                      }
                    }
                  }
                } catch {}
              }
            }
          } catch {}
        }));
      }

      setReceipts(foundReceipts);
      setLastScan(new Date());
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  }, [stealthKeys]);

  const claimPayment = useCallback(async (receipt: PrivateReceipt) => {
    if (!stealthKeys || !publicKey) return;
    setClaiming(receipt.stealthAddress);
    try {
      const stealthKp = deriveStealthSpendingKey(
        receipt.ephemeralPubKey,
        stealthKeys.viewKey.privateKey,
        stealthKeys.spendKey.publicKey
      );
      const balance = await devnetConnection.getBalance(stealthKp.publicKey);
      const fee = 5000;
      const amountToSend = balance - fee;
      if (amountToSend <= 0) throw new Error('Insufficient balance');

      const { Transaction, SystemProgram } = await import('@solana/web3.js');
      const transaction = new Transaction();
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: stealthKp.publicKey,
          toPubkey: publicKey,
          lamports: amountToSend,
        })
      );

      const { blockhash, lastValidBlockHeight } = await devnetConnection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = stealthKp.publicKey;
      transaction.sign(stealthKp);

      const signature = await devnetConnection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: true,
      });
      await devnetConnection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

      setReceipts(prev => prev.map(r =>
        r.stealthAddress === receipt.stealthAddress
          ? { ...r, amount: 0, canClaim: false }
          : r
      ));
    } catch (err) {
      console.error('Claim error:', err);
    } finally {
      setClaiming(null);
    }
  }, [stealthKeys, publicKey]);

  useEffect(() => {
    if (stealthKeys && !lastScan) {
      scanForReceipts();
    }
  }, [stealthKeys, lastScan, scanForReceipts]);

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
      loadPayrollBatches(),
      fetchIndexedPayments(),
      scanForReceipts(),
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
              disabled={isScanning || loadingBatches || loadingPayments}
              className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.05] transition-all active:scale-95"
            >
              {(isScanning || loadingBatches || loadingPayments) ? (
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

            {isEmployer && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="h-11 px-5 bg-white text-black text-sm font-medium rounded-2xl hover:bg-white/90 transition-all active:scale-95 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send Payment
              </button>
            )}
          </div>
        </div>

        {/* Stat Cards */}
        <div className={`grid grid-cols-2 md:grid-cols-3 ${isEmployer ? 'lg:grid-cols-6' : 'lg:grid-cols-4'} gap-3 mb-6`}>
          {(isEmployer
            ? [
                { label: 'TOTAL DISTRIBUTED', value: `${totalDistributed.toFixed(2)}`, unit: 'SOL', icon: DollarSign },
                { label: 'PRIVATE VOLUME', value: `${privateVolume.toFixed(2)}`, unit: 'SOL', icon: EyeOff },
                { label: 'CLAIMABLE', value: showBalance ? `${totalClaimable.toFixed(2)}` : '****', unit: 'SOL', icon: Shield },
                { label: 'PAYROLL BATCHES', value: `${payrollBatches.length}`, unit: 'Active', icon: Briefcase },
                { label: 'OPERATIONS', value: `${indexedPayments.length}`, unit: 'Total', icon: Activity },
                { label: 'RPC', value: heliusStatus.connected ? `${heliusStatus.latency}` : '-', unit: 'ms', icon: Server, status: heliusStatus.connected },
              ]
            : [
                { label: 'CLAIMABLE', value: showBalance ? `${totalClaimable.toFixed(2)}` : '****', unit: 'SOL', icon: Shield },
                { label: 'PRIVATE RECEIPTS', value: `${receipts.length}`, unit: 'Total', icon: EyeOff },
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

        {/* Private Receiving Address */}
        <div className="mb-6 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center">
              <Lock className="w-4 h-4 text-white/30" />
            </div>
            <div>
              <p className="text-[10px] text-white/25 tracking-wide mb-0.5">PRIVATE RECEIVING ADDRESS</p>
              <p className="font-mono text-sm text-white/60">
                {metaAddressString?.slice(0, 16)} ... {metaAddressString?.slice(-12)}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleCopy(metaAddressString || '')}
            className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-all active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Pending Payments - Only for Employers */}
        {isEmployer && (
          <div className="mb-6">
            <PendingDonations />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-8 mb-8 border-b border-white/[0.06]">
          {(isEmployer
            ? [
                { id: 'batches' as TabType, label: 'Payroll Batches' },
                { id: 'history' as TabType, label: 'Payment History' },
                { id: 'receipts' as TabType, label: 'Private Receipts' },
              ]
            : [
                { id: 'receipts' as TabType, label: 'Private Receipts' },
                { id: 'history' as TabType, label: 'Payment History' },
              ]
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`pb-4 text-sm transition-all relative ${
                activeTab === id
                  ? 'text-white font-medium'
                  : 'text-white/35 hover:text-white/50'
              }`}
            >
              {label}
              {activeTab === id && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'batches' && isEmployer && (
          <div className="space-y-3">
            {payrollBatches.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <Briefcase className="w-10 h-10 mx-auto mb-3 text-white/10" />
                <p className="text-white/30 text-sm">No payroll batches yet</p>
                <p className="text-white/20 text-xs mt-1">Create your first batch to start distributing payments</p>
              </div>
            ) : (
              <>
                {payrollBatches.map((batch) => (
                  <div key={batch.id} className={`p-5 flex items-center justify-between rounded-2xl border transition-all ${
                    batch.status === 'Active'
                      ? 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                      : 'bg-white/[0.01] border-white/[0.03] opacity-60'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        batch.status === 'Active' ? 'bg-white/[0.04]' : 'bg-white/[0.02]'
                      }`}>
                        <Briefcase className="w-4 h-4 text-white/30" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-medium">{batch.title}</p>
                          <span className={`px-2 py-0.5 text-[9px] font-medium rounded-md ${
                            batch.status === 'Active'
                              ? 'bg-green-400/10 text-green-400'
                              : batch.status === 'Closed'
                              ? 'bg-red-400/10 text-red-400'
                              : 'bg-white/[0.08] text-white/60'
                          }`}>
                            {batch.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-white/30 text-xs">{batch.recipientCount} recipients</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-white">
                        {batch.vaultBalance.toFixed(4)} <span className="text-xs text-white/30">SOL</span>
                      </p>
                      {batch.status === 'Active' && batch.vaultBalance > 0 && (
                        <button
                          onClick={() => withdrawFromBatch(batch.id, batch.vaultBalance)}
                          disabled={withdrawingBatch === batch.id || closingBatch === batch.id}
                          className="h-9 px-4 bg-white text-black text-xs font-medium rounded-xl hover:bg-white/90 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {withdrawingBatch === batch.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Withdraw'
                          )}
                        </button>
                      )}
                      {batch.status === 'Active' && (
                        <button
                          onClick={() => handleCloseBatch(batch.id)}
                          disabled={closingBatch === batch.id || withdrawingBatch === batch.id}
                          className="h-9 w-9 flex items-center justify-center bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                          title="Close batch"
                        >
                          {closingBatch === batch.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (() => {
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

        {activeTab === 'receipts' && (
          <div className="space-y-3">
            {receipts.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <EyeOff className="w-10 h-10 mx-auto mb-3 text-white/10" />
                <p className="text-white/30 text-sm">No private receipts found</p>
                <p className="text-white/20 text-xs mt-1">Payments sent to your private address will appear here</p>
              </div>
            ) : (
              <>
                {receipts.map((receipt) => (
                  <div key={receipt.signature} className="px-5 py-4 flex items-center justify-between rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        receipt.canClaim ? 'bg-white/[0.06]' : 'bg-white/[0.03]'
                      }`}>
                        <ArrowDownLeft className={`w-4 h-4 ${receipt.canClaim ? 'text-white/60' : 'text-white/30'}`} />
                      </div>
                      <div>
                        <p className="text-white font-mono text-sm">
                          {receipt.stealthAddress.slice(0, 8)} ... {receipt.stealthAddress.slice(-8)}
                        </p>
                        <p className="text-xs text-white/25 mt-0.5">{formatDate(receipt.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-mono text-white">
                        {receipt.amount.toFixed(4)} <span className="text-xs text-white/30">SOL</span>
                      </p>
                      {receipt.canClaim && (
                        <button
                          onClick={() => claimPayment(receipt)}
                          disabled={claiming === receipt.stealthAddress}
                          className="h-9 px-4 bg-white text-black text-xs font-medium rounded-xl hover:bg-white/90 transition-all active:scale-95"
                        >
                          {claiming === receipt.stealthAddress ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Claim Payment'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

      </div>

      {showPaymentModal && (
        <SendPaymentModal onClose={() => setShowPaymentModal(false)} />
      )}
    </div>
  );
}
