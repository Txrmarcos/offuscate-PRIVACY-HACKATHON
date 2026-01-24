'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Eye,
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
  Radio,
  Lock,
  MoreHorizontal,
  Zap,
  Vault,
  ChevronLeft,
  ChevronRight,
  Filter,
  Trash2,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, LAMPORTS_PER_SOL, PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { SendPaymentModal } from '../components/SendPaymentModal';
import { useStealth } from '../lib/stealth/StealthContext';
import {
  isStealthAddressForUs,
  deriveStealthSpendingKey,
} from '../lib/stealth';
import { useProgram } from '../lib/program';
import { PrivateNote } from '../lib/privacy';
import { ALLOWED_WITHDRAW_AMOUNTS } from '../lib/program/client';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const devnetConnection = new Connection(RPC_URL, 'confirmed');
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

type TabType = 'campaigns' | 'activity' | 'stealth' | 'pool';
type TxFilterType = 'all' | 'received' | 'sent' | 'stealth' | 'public';

const ITEMS_PER_PAGE = 8;

interface StealthPayment {
  signature: string;
  stealthAddress: string;
  ephemeralPubKey: string;
  amount: number;
  timestamp: number;
  canSpend: boolean;
}

interface MyCampaign {
  id: string;
  title: string;
  goal: number;
  raised: number;
  donorCount: number;
  vaultBalance: number;
  stealthEnabled: boolean;
  status: 'Active' | 'Closed' | 'Completed';
}

interface IndexedTransaction {
  signature: string;
  timestamp: number;
  type: string;
  isStealth: boolean;
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
  stealthCount: number;
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
    fetchPoolStats,
    privateDeposit,
    privateWithdraw,
    getUnspentPrivateNotes,
    quickWithdrawAllToStealth,
  } = useProgram();

  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [copied, setCopied] = useState(false);
  const [payments, setPayments] = useState<StealthPayment[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  const [myCampaigns, setMyCampaigns] = useState<MyCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [withdrawingCampaign, setWithdrawingCampaign] = useState<string | null>(null);
  const [closingCampaign, setClosingCampaign] = useState<string | null>(null);
  const [enablingStealth, setEnablingStealth] = useState<string | null>(null);

  const [indexedTxs, setIndexedTxs] = useState<IndexedTransaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [txFilter, setTxFilter] = useState<TxFilterType>('all');
  const [txPage, setTxPage] = useState(1);
  const [heliusStatus, setHeliusStatus] = useState<HeliusStatus>({
    connected: false,
    latency: 0,
    configured: false,
  });

  const [webhookStats, setWebhookStats] = useState<WebhookStats>({
    eventCount: 0,
    stealthCount: 0,
    lastReceived: null,
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const [poolStats, setPoolStats] = useState<any>(null);
  const [privateNotes, setPrivateNotes] = useState<PrivateNote[]>([]);
  const [zkMode, setZkMode] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [mainWalletBalance, setMainWalletBalance] = useState(0);
  const [stealthBalance, setStealthBalance] = useState(0);
  const [stealthKeypair, setStealthKeypair] = useState<Keypair | null>(null);

  const totalBalance = payments.reduce((sum, p) => sum + p.amount, 0);
  const spendablePayments = payments.filter(p => p.canSpend);
  const totalReceived = indexedTxs.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0) / LAMPORTS_PER_SOL;
  const stealthVolume = indexedTxs
    .filter(tx => tx.isStealth)
    .reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0) / LAMPORTS_PER_SOL;

  useEffect(() => {
    const generateDeterministicKeypair = async () => {
      if (!publicKey) return;
      try {
        const { createHash } = await import('crypto');
        const seed = createHash('sha256')
          .update(publicKey.toBuffer())
          .update('privacy_pool_stealth_v1')
          .digest();
        const keypair = Keypair.fromSeed(seed.slice(0, 32));
        setStealthKeypair(keypair);
      } catch (err) {
        console.error('Failed to derive stealth keypair:', err);
      }
    };
    generateDeterministicKeypair();
  }, [publicKey]);

  const fetchBalances = useCallback(async () => {
    if (!publicKey) return;
    try {
      const balance = await devnetConnection.getBalance(publicKey);
      setMainWalletBalance(balance / LAMPORTS_PER_SOL);
    } catch {}

    if (stealthKeypair) {
      try {
        const balance = await devnetConnection.getBalance(stealthKeypair.publicKey);
        setStealthBalance(balance / LAMPORTS_PER_SOL);
      } catch {}
    }
  }, [publicKey, stealthKeypair]);

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
        stealthCount: data.stealthCount || 0,
        lastReceived: data.lastReceived,
      });
    } catch {}
  }, []);

  const fetchIndexedTransactions = useCallback(async () => {
    if (!publicKey) return;
    setLoadingTxs(true);
    try {
      const res = await fetch(`/api/helius/transactions?wallet=${publicKey.toBase58()}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setIndexedTxs(data.transactions.map((tx: any) => ({
          signature: tx.signature,
          timestamp: tx.timestamp,
          type: tx.type || 'UNKNOWN',
          isStealth: tx.isStealth,
          amount: tx.nativeTransfers?.[0]?.amount || 0,
          fee: tx.fee || 0,
          description: tx.description || '',
        })));
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoadingTxs(false);
    }
  }, [publicKey]);

  const loadMyCampaigns = useCallback(async () => {
    if (!publicKey) return;
    setLoadingCampaigns(true);
    try {
      const allCampaigns = await listCampaigns();
      const owned: MyCampaign[] = [];
      for (const { account } of allCampaigns) {
        if (account.owner.toBase58() === publicKey.toBase58()) {
          const vaultBalance = await fetchVaultBalance(account.campaignId);
          owned.push({
            id: account.campaignId,
            title: account.title,
            goal: account.goal,
            raised: account.totalRaised,
            donorCount: account.donorCount,
            vaultBalance,
            stealthEnabled: !!account.stealthMetaAddress,
            status: account.status,
          });
        }
      }
      setMyCampaigns(owned);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoadingCampaigns(false);
    }
  }, [publicKey, listCampaigns, fetchVaultBalance]);

  const loadPoolData = useCallback(async () => {
    try {
      const stats = await fetchPoolStats();
      setPoolStats(stats);
      const notes = await getUnspentPrivateNotes();
      setPrivateNotes(notes);
    } catch {}
  }, [fetchPoolStats, getUnspentPrivateNotes]);

  const enableStealthOnCampaign = async (campaignId: string) => {
    if (!metaAddressString) return;
    setEnablingStealth(campaignId);
    try {
      await setStealthMetaAddress(campaignId, metaAddressString);
      setMyCampaigns(prev => prev.map(c =>
        c.id === campaignId ? { ...c, stealthEnabled: true } : c
      ));
    } catch (err) {
      console.error('Failed to enable stealth:', err);
    } finally {
      setEnablingStealth(null);
    }
  };

  const withdrawFromCampaign = async (campaignId: string, amount: number) => {
    if (!publicKey || amount <= 0) return;
    setWithdrawingCampaign(campaignId);
    try {
      await programWithdraw(campaignId, amount);
      await closeCampaign(campaignId);
      setMyCampaigns(prev => prev.filter(c => c.id !== campaignId));
    } catch (err) {
      console.error('Withdraw failed:', err);
      await loadMyCampaigns();
    } finally {
      setWithdrawingCampaign(null);
    }
  };

  const handleCloseCampaign = async (campaignId: string) => {
    if (!publicKey) return;
    setClosingCampaign(campaignId);
    try {
      await closeCampaign(campaignId);
      setMyCampaigns(prev => prev.filter(c => c.id !== campaignId));
    } catch (err) {
      console.error('Close campaign failed:', err);
    } finally {
      setClosingCampaign(null);
    }
  };

  const handlePrivateDeposit = async (amount: number) => {
    setProcessing('deposit');
    try {
      await privateDeposit(amount);
      await loadPoolData();
      await fetchBalances();
    } catch (err: any) {
      console.error('Deposit failed:', err);
    } finally {
      setProcessing(null);
    }
  };

  const handlePrivateWithdraw = async (note: PrivateNote) => {
    if (!stealthKeypair) return;
    setProcessing('withdraw');
    try {
      await privateWithdraw(note, stealthKeypair.publicKey);
      await loadPoolData();
      await fetchBalances();
    } catch (err: any) {
      console.error('Withdraw failed:', err);
    } finally {
      setProcessing(null);
    }
  };

  const handleQuickWithdrawAll = async () => {
    if (!stealthKeypair || privateNotes.length === 0) return;
    setProcessing('quick-withdraw');
    try {
      await quickWithdrawAllToStealth(stealthKeypair);
      await loadPoolData();
      await fetchBalances();
    } catch (err: any) {
      console.error('Quick withdraw failed:', err);
    } finally {
      setProcessing(null);
    }
  };

  useEffect(() => {
    fetchHeliusStatus();
    fetchWebhookStats();
    fetchBalances();
    if (publicKey) {
      loadMyCampaigns();
      fetchIndexedTransactions();
      loadPoolData();
    }
    const webhookInterval = setInterval(fetchWebhookStats, 10000);
    return () => clearInterval(webhookInterval);
  }, [publicKey, loadMyCampaigns, fetchIndexedTransactions, fetchHeliusStatus, fetchWebhookStats, fetchBalances, loadPoolData]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scanForPayments = useCallback(async () => {
    if (!stealthKeys) return;
    setIsScanning(true);
    try {
      const foundPayments: StealthPayment[] = [];
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
                          if (!foundPayments.some(p => p.stealthAddress === address.toBase58())) {
                            foundPayments.push({
                              signature: sig.signature,
                              stealthAddress: address.toBase58(),
                              ephemeralPubKey: ephemeralPubKey,
                              amount: currentBalance / LAMPORTS_PER_SOL,
                              timestamp: sig.blockTime || 0,
                              canSpend: currentBalance > 0,
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

      setPayments(foundPayments);
      setLastScan(new Date());
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  }, [stealthKeys]);

  const withdrawFunds = useCallback(async (payment: StealthPayment) => {
    if (!stealthKeys || !publicKey) return;
    setWithdrawing(payment.stealthAddress);
    try {
      const stealthKp = deriveStealthSpendingKey(
        payment.ephemeralPubKey,
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

      setPayments(prev => prev.map(p =>
        p.stealthAddress === payment.stealthAddress
          ? { ...p, amount: 0, canSpend: false }
          : p
      ));
    } catch (err) {
      console.error('Withdraw error:', err);
    } finally {
      setWithdrawing(null);
    }
  }, [stealthKeys, publicKey]);

  useEffect(() => {
    if (stealthKeys && !lastScan) {
      scanForPayments();
    }
  }, [stealthKeys, lastScan, scanForPayments]);

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
      loadMyCampaigns(),
      fetchIndexedTransactions(),
      scanForPayments(),
      fetchHeliusStatus(),
      fetchWebhookStats(),
      fetchBalances(),
      loadPoolData(),
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
            <Shield className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Connect Wallet</h1>
          <p className="text-white/40 text-lg">
            Connect your wallet to access your private vault.
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
            Generate stealth keys for private operations.
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
            <h1 className="text-3xl font-semibold text-white mb-1">Vault</h1>
            <p className="text-white/40 text-sm">
              Manage your private assets and stealth operations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshAll}
              disabled={isScanning || loadingCampaigns || loadingTxs}
              className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.05] transition-all active:scale-95"
            >
              {(isScanning || loadingCampaigns || loadingTxs) ? (
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
                {webhookStats.stealthCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                    {webhookStats.stealthCount > 9 ? '9+' : webhookStats.stealthCount}
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
                      <span className="text-xs text-white/40">Total</span>
                      <span className="text-xs font-mono text-white">{webhookStats.eventCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/40">Stealth</span>
                      <span className="text-xs font-mono text-white">{webhookStats.stealthCount}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowPaymentModal(true)}
              className="h-11 px-5 bg-white text-black text-sm font-medium rounded-2xl hover:bg-white/90 transition-all active:scale-95 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Private
            </button>
          </div>
        </div>

        {/* Stat Pills */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'TOTAL RECEIVED', value: `${totalReceived.toFixed(2)}`, unit: 'SOL', icon: ArrowDownLeft },
            { label: 'STEALTH VOLUME', value: `${stealthVolume.toFixed(2)}`, unit: 'SOL', icon: EyeOff },
            { label: 'CLAIMABLE', value: showBalance ? `${totalBalance.toFixed(2)}` : '••••', unit: 'SOL', icon: Shield },
            { label: 'CAMPAIGNS', value: `${myCampaigns.length}`, unit: 'Active', icon: Wallet },
            { label: 'TRANSACTIONS', value: `${indexedTxs.length}`, unit: 'Total', icon: Activity },
            { label: 'RPC', value: heliusStatus.connected ? `${heliusStatus.latency}` : '—', unit: 'ms', icon: Server, status: heliusStatus.connected },
          ].map(({ label, value, unit, icon: Icon, status }) => (
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

        {/* Stealth Address */}
        <div className="mb-6 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center">
              <Lock className="w-4 h-4 text-white/30" />
            </div>
            <div>
              <p className="text-[10px] text-white/25 tracking-wide mb-0.5">YOUR STEALTH ADDRESS</p>
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

        {/* Tabs */}
        <div className="flex items-center gap-8 mb-8 border-b border-white/[0.06]">
          {[
            { id: 'campaigns' as TabType, label: 'My Campaigns' },
            { id: 'activity' as TabType, label: 'Activity' },
            { id: 'stealth' as TabType, label: 'Stealth Payments' },
            { id: 'pool' as TabType, label: 'Privacy Pool', active: true },
          ].map(({ id, label, active }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`pb-4 text-sm transition-all relative ${
                activeTab === id
                  ? 'text-white font-medium'
                  : 'text-white/35 hover:text-white/50'
              }`}
            >
              <span className="flex items-center gap-2">
                {active && <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />}
                {label}
              </span>
              {activeTab === id && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'campaigns' && (
          <div className="space-y-3">
            {myCampaigns.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <Wallet className="w-10 h-10 mx-auto mb-3 text-white/10" />
                <p className="text-white/30 text-sm">No campaigns yet</p>
              </div>
            ) : (
              <>
                {myCampaigns.map((campaign) => (
                  <div key={campaign.id} className={`p-5 flex items-center justify-between rounded-2xl border transition-all ${
                    campaign.status === 'Active'
                      ? 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                      : 'bg-white/[0.01] border-white/[0.03] opacity-60'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        campaign.status === 'Active' ? 'bg-white/[0.04]' : 'bg-white/[0.02]'
                      }`}>
                        <Wallet className="w-4 h-4 text-white/30" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-medium">{campaign.title}</p>
                          <span className={`px-2 py-0.5 text-[9px] font-medium rounded-md ${
                            campaign.status === 'Active'
                              ? 'bg-green-400/10 text-green-400'
                              : campaign.status === 'Closed'
                              ? 'bg-red-400/10 text-red-400'
                              : 'bg-white/[0.08] text-white/60'
                          }`}>
                            {campaign.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-white/30 text-xs">{campaign.donorCount} donors</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-white">
                        {campaign.vaultBalance.toFixed(4)} <span className="text-xs text-white/30">SOL</span>
                      </p>
                      {campaign.status === 'Active' && campaign.vaultBalance > 0 && (
                        <button
                          onClick={() => withdrawFromCampaign(campaign.id, campaign.vaultBalance)}
                          disabled={withdrawingCampaign === campaign.id || closingCampaign === campaign.id}
                          className="h-9 px-4 bg-white text-black text-xs font-medium rounded-xl hover:bg-white/90 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {withdrawingCampaign === campaign.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Withdraw'
                          )}
                        </button>
                      )}
                      {campaign.status === 'Active' && (
                        <button
                          onClick={() => handleCloseCampaign(campaign.id)}
                          disabled={closingCampaign === campaign.id || withdrawingCampaign === campaign.id}
                          className="h-9 w-9 flex items-center justify-center bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                          title="Close campaign"
                        >
                          {closingCampaign === campaign.id ? (
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

        {activeTab === 'activity' && (() => {
          const filteredTxs = indexedTxs.filter(tx => {
            if (txFilter === 'all') return true;
            if (txFilter === 'received') return tx.amount > 0;
            if (txFilter === 'sent') return tx.amount <= 0;
            if (txFilter === 'stealth') return tx.isStealth;
            if (txFilter === 'public') return !tx.isStealth;
            return true;
          });
          const totalPages = Math.ceil(filteredTxs.length / ITEMS_PER_PAGE);
          const paginatedTxs = filteredTxs.slice((txPage - 1) * ITEMS_PER_PAGE, txPage * ITEMS_PER_PAGE);

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
                      { id: 'stealth' as TxFilterType, label: 'Stealth' },
                      { id: 'public' as TxFilterType, label: 'Public' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => { setTxFilter(id); setTxPage(1); }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          txFilter === id
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
                  {filteredTxs.length} transaction{filteredTxs.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* List */}
              {paginatedTxs.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                  <Activity className="w-10 h-10 mx-auto mb-3 text-white/10" />
                  <p className="text-white/30 text-sm">No transactions found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedTxs.map((tx) => (
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
                              tx.isStealth
                                ? 'bg-white/[0.08] text-white/60'
                                : 'bg-white/[0.04] text-white/30'
                            }`}>
                              {tx.isStealth ? 'STEALTH' : 'PUBLIC'}
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
                    onClick={() => setTxPage(p => Math.max(1, p - 1))}
                    disabled={txPage === 1}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setTxPage(page)}
                        className={`w-8 h-8 text-xs font-medium rounded-lg transition-all ${
                          txPage === page
                            ? 'bg-white text-black'
                            : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06]'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setTxPage(p => Math.min(totalPages, p + 1))}
                    disabled={txPage === totalPages}
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

        {activeTab === 'stealth' && (
          <div className="space-y-3">
            {payments.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <EyeOff className="w-10 h-10 mx-auto mb-3 text-white/10" />
                <p className="text-white/30 text-sm">No stealth payments found</p>
              </div>
            ) : (
              <>
                {payments.map((payment) => (
                  <div key={payment.signature} className="px-5 py-4 flex items-center justify-between rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        payment.canSpend ? 'bg-white/[0.06]' : 'bg-white/[0.03]'
                      }`}>
                        <ArrowDownLeft className={`w-4 h-4 ${payment.canSpend ? 'text-white/60' : 'text-white/30'}`} />
                      </div>
                      <div>
                        <p className="text-white font-mono text-sm">
                          {payment.stealthAddress.slice(0, 8)} ... {payment.stealthAddress.slice(-8)}
                        </p>
                        <p className="text-xs text-white/25 mt-0.5">{formatDate(payment.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-mono text-white">
                        {payment.amount.toFixed(4)} <span className="text-xs text-white/30">SOL</span>
                      </p>
                      {payment.canSpend && (
                        <button
                          onClick={() => withdrawFunds(payment)}
                          disabled={withdrawing === payment.stealthAddress}
                          className="h-9 px-4 bg-white text-black text-xs font-medium rounded-xl hover:bg-white/90 transition-all active:scale-95"
                        >
                          {withdrawing === payment.stealthAddress ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Claim'
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

        {activeTab === 'pool' && (
          <div className="space-y-4">
            {/* Main Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Balances Panel */}
              <div className="lg:col-span-2 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <p className="text-[10px] text-white/25 tracking-wide">PRIVACY POOL ACTIVE</p>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs text-white/30 mb-1">Principal Wallet</p>
                    <p className="text-2xl font-mono text-white mb-1">
                      {mainWalletBalance.toFixed(4)} <span className="text-sm text-white/30">SOL</span>
                    </p>
                    <p className="text-xs text-white/20 font-mono">
                      {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-6)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-green-400/60 mb-1">Stealth Balance</p>
                    <p className="text-2xl font-mono text-green-400 mb-1">
                      {stealthBalance.toFixed(4)} <span className="text-sm text-green-400/50">SOL</span>
                    </p>
                    <p className="text-xs text-white/20 font-mono">
                      {stealthKeypair?.publicKey.toBase58().slice(0, 8)}...{stealthKeypair?.publicKey.toBase58().slice(-6)}
                    </p>
                  </div>
                </div>
              </div>

              {/* ZK Mode Panel */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-white/40" />
                    <span className="text-xs font-medium text-white">ZK Privacy</span>
                  </div>
                  <button
                    onClick={() => setZkMode(!zkMode)}
                    className={`w-10 h-5 rounded-full transition-all relative ${zkMode ? 'bg-green-400' : 'bg-white/20'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${zkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <p className="text-[10px] text-white/25 mb-4">
                  Standardized amounts break on-chain correlation.
                </p>
                <div className="space-y-2">
                  {ALLOWED_WITHDRAW_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handlePrivateDeposit(amt)}
                      disabled={processing === 'deposit'}
                      className="w-full py-2.5 bg-white/[0.03] hover:bg-white/[0.05] text-white text-xs font-medium rounded-xl transition-all active:scale-[0.98] border border-white/[0.05]"
                    >
                      {processing === 'deposit' ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        `Deposit ${amt} SOL`
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'POOL BALANCE', value: poolStats?.currentBalance?.toFixed(2) || '0.00', unit: 'SOL' },
                { label: 'TOTAL DEPOSITED', value: poolStats?.totalDeposited?.toFixed(2) || '0.00', unit: 'SOL', accent: true },
                { label: 'WITHDRAWALS', value: poolStats?.withdrawCount || 0, unit: '' },
              ].map(({ label, value, unit, accent }) => (
                <div key={label} className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                  <p className={`text-[10px] tracking-wide mb-1 ${accent ? 'text-green-400/60' : 'text-white/25'}`}>{label}</p>
                  <p className="text-xl font-mono text-white">
                    {value} {unit && <span className="text-sm text-white/30">{unit}</span>}
                  </p>
                </div>
              ))}
            </div>

            {/* Private Notes */}
            {privateNotes.length > 0 && (
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-green-400/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400/60" />
                    <span className="text-xs font-medium text-green-400/80">
                      Private Notes ({privateNotes.length})
                    </span>
                  </div>
                  <span className="font-mono text-white">
                    {(privateNotes.reduce((acc, n) => acc + n.amount, 0) / LAMPORTS_PER_SOL).toFixed(2)} <span className="text-xs text-white/30">SOL</span>
                  </span>
                </div>

                <button
                  onClick={handleQuickWithdrawAll}
                  disabled={processing === 'quick-withdraw'}
                  className="w-full py-3 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {processing === 'quick-withdraw' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Withdraw All to Stealth
                    </>
                  )}
                </button>

                <p className="text-[10px] text-green-400/40 text-center mt-3">
                  Maximum privacy: funds go directly to stealth address
                </p>
              </div>
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
