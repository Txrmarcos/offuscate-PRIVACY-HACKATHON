'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Download,
  Eye,
  EyeOff,
  Key,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Shield,
  Loader2,
  Zap,
  Activity,
  Wallet,
  Server,
  Bell,
  Radio,
  Search,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { SendPaymentModal } from '../components/SendPaymentModal';
import { PrivacyPoolPanel } from '../components/PrivacyPoolPanel';
import { useStealth } from '../lib/stealth/StealthContext';
import {
  isStealthAddressForUs,
  deriveStealthSpendingKey,
} from '../lib/stealth';
import { useProgram, CampaignData } from '../lib/program';

// Helius RPC connection (falls back to default devnet)
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const devnetConnection = new Connection(RPC_URL, 'confirmed');
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

type TabType = 'campaigns' | 'activity' | 'stealth' | 'pool';

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

interface WebhookNotification {
  id: string;
  type: string;
  message: string;
  amount?: number;
  signature: string;
  timestamp: number;
  read: boolean;
}

interface WebhookStats {
  eventCount: number;
  stealthCount: number;
  lastReceived: number | null;
}

export default function DashboardPage() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { stealthKeys, metaAddressString, isLoading: keysLoading, deriveKeysFromWallet } = useStealth();
  const { listCampaigns, fetchVaultBalance, withdraw: programWithdraw, closeCampaign, setStealthMetaAddress, fetchCampaign } = useProgram();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('campaigns');

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [copied, setCopied] = useState(false);
  const [payments, setPayments] = useState<StealthPayment[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  // Campaign management
  const [myCampaigns, setMyCampaigns] = useState<MyCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [withdrawingCampaign, setWithdrawingCampaign] = useState<string | null>(null);
  const [enablingStealth, setEnablingStealth] = useState<string | null>(null);

  // Helius indexed transactions
  const [indexedTxs, setIndexedTxs] = useState<IndexedTransaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [heliusStatus, setHeliusStatus] = useState<HeliusStatus>({
    connected: false,
    latency: 0,
    configured: false,
  });

  // Webhook notifications
  const [webhookStats, setWebhookStats] = useState<WebhookStats>({
    eventCount: 0,
    stealthCount: 0,
    lastReceived: null,
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Calculate totals
  const totalBalance = payments.reduce((sum, p) => sum + p.amount, 0);
  const spendablePayments = payments.filter(p => p.canSpend);
  const totalCampaignBalance = myCampaigns.reduce((sum, c) => sum + c.vaultBalance, 0);

  // Total received from all transactions (Activity)
  const totalReceived = indexedTxs.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0) / LAMPORTS_PER_SOL;

  // Stealth volume (historical stealth transactions)
  const stealthVolume = indexedTxs
    .filter(tx => tx.isStealth)
    .reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0) / LAMPORTS_PER_SOL;

  // Fetch Helius status
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

  // Fetch webhook stats
  const fetchWebhookStats = useCallback(async () => {
    try {
      const res = await fetch('/api/helius/webhook');
      const data = await res.json();
      setWebhookStats({
        eventCount: data.count || 0,
        stealthCount: data.stealthCount || 0,
        lastReceived: data.lastReceived,
      });
    } catch {
      // Webhook API might not be available
    }
  }, []);

  // Fetch indexed transactions from Helius
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

  // Load user's campaigns
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

  // Enable stealth on a campaign
  const enableStealthOnCampaign = async (campaignId: string) => {
    if (!metaAddressString) {
      console.error('No stealth meta address available');
      return;
    }

    setEnablingStealth(campaignId);
    try {
      await setStealthMetaAddress(campaignId, metaAddressString);

      // Update local state
      setMyCampaigns(prev => prev.map(c =>
        c.id === campaignId ? { ...c, stealthEnabled: true } : c
      ));
    } catch (err) {
      console.error('Failed to enable stealth:', err);
    } finally {
      setEnablingStealth(null);
    }
  };

  // Withdraw from campaign and close it
  const withdrawFromCampaign = async (campaignId: string, amount: number) => {
    if (!publicKey || amount <= 0) return;

    setWithdrawingCampaign(campaignId);
    try {
      // Withdraw funds
      await programWithdraw(campaignId, amount);

      // Close the campaign after withdraw
      await closeCampaign(campaignId);

      // Remove from local state immediately
      setMyCampaigns(prev => prev.filter(c => c.id !== campaignId));
    } catch (err) {
      console.error('Withdraw failed:', err);
      // Reload campaigns in case of partial success
      await loadMyCampaigns();
    } finally {
      setWithdrawingCampaign(null);
    }
  };

  // Load on mount
  useEffect(() => {
    fetchHeliusStatus();
    fetchWebhookStats();
    if (publicKey) {
      loadMyCampaigns();
      fetchIndexedTransactions();
    }

    // Poll webhook stats every 10 seconds for real-time updates
    const webhookInterval = setInterval(fetchWebhookStats, 10000);
    return () => clearInterval(webhookInterval);
  }, [publicKey, loadMyCampaigns, fetchIndexedTransactions, fetchHeliusStatus, fetchWebhookStats]);

  // Copy to clipboard
  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // PURE BLOCKCHAIN SCANNER - No on-chain registry needed!
  const scanForPayments = useCallback(async () => {
    if (!stealthKeys) {
      console.log('❌ No stealth keys, cannot scan');
      return;
    }

    console.log('🔍 Scanning blockchain for stealth payments (pure mode)...');
    setIsScanning(true);

    try {
      const foundPayments: StealthPayment[] = [];

      const signatures = await devnetConnection.getSignaturesForAddress(
        new PublicKey(MEMO_PROGRAM_ID),
        { limit: 100 }
      );

      console.log(`📝 Found ${signatures.length} memo transactions to scan`);

      const batchSize = 5;
      for (let i = 0; i < signatures.length; i += batchSize) {
        const batch = signatures.slice(i, i + batchSize);

        if (i > 0) {
          await new Promise(r => setTimeout(r, 500));
        }

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
                    } catch {
                      // Not JSON, skip
                    }
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
                          console.log(`✅ Found stealth payment: ${address.toBase58().slice(0, 8)}... Balance: ${currentBalance / LAMPORTS_PER_SOL} SOL`);

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
                } catch {
                  // Invalid memo format, skip
                }
              }
            }
          } catch (txErr) {
            // Transaction fetch failed (rate limit), continue with others
          }
        }));
      }

      console.log(`✅ Pure scan complete. Found ${foundPayments.length} payments.`);
      setPayments(foundPayments);
      setLastScan(new Date());
    } catch (err) {
      console.error('❌ Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  }, [stealthKeys]);

  // Withdraw funds
  const withdrawFunds = useCallback(async (payment: StealthPayment) => {
    if (!stealthKeys || !publicKey) return;

    setWithdrawing(payment.stealthAddress);

    try {
      const stealthKeypair = deriveStealthSpendingKey(
        payment.ephemeralPubKey,
        stealthKeys.viewKey.privateKey,
        stealthKeys.spendKey.publicKey
      );

      const balance = await devnetConnection.getBalance(stealthKeypair.publicKey);
      const fee = 5000;
      const amountToSend = balance - fee;

      if (amountToSend <= 0) throw new Error('Insufficient balance');

      const { Transaction, SystemProgram } = await import('@solana/web3.js');
      const transaction = new Transaction();

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: stealthKeypair.publicKey,
          toPubkey: publicKey,
          lamports: amountToSend,
        })
      );

      const { blockhash, lastValidBlockHeight } = await devnetConnection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = stealthKeypair.publicKey;

      transaction.sign(stealthKeypair);

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

  // Auto scan on mount if keys exist
  useEffect(() => {
    if (stealthKeys && !lastScan) {
      scanForPayments();
    }
  }, [stealthKeys, lastScan, scanForPayments]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Refresh all data
  const refreshAll = async () => {
    await Promise.all([
      loadMyCampaigns(),
      fetchIndexedTransactions(),
      scanForPayments(),
      fetchHeliusStatus(),
      fetchWebhookStats(),
    ]);
  };

  // Not connected state
  if (!connected) {
    return (
      <div className="min-h-screen px-6 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <Shield className="w-16 h-16 text-purple-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-4">Connect Your Wallet</h1>
          <p className="text-[#737373] mb-8">
            Connect your wallet to access your private dashboard and manage stealth payments.
          </p>
        </div>
      </div>
    );
  }

  // No stealth keys state
  if (!stealthKeys && !keysLoading) {
    return (
      <div className="min-h-screen px-6 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <Key className="w-16 h-16 text-purple-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-4">Setup Privacy Keys</h1>
          <p className="text-[#737373] mb-8">
            Generate your stealth keys to receive private payments. Your keys are derived from your wallet signature.
          </p>
          <button
            onClick={deriveKeysFromWallet}
            className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-full transition-colors"
          >
            Generate Stealth Keys
          </button>
        </div>
      </div>
    );
  }

  const formatAmount = (lamports: number) => (lamports / LAMPORTS_PER_SOL).toFixed(4);
  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="min-h-screen px-6 py-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-[#737373]">
              Manage your campaigns, payments, and stealth funds.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={refreshAll}
              disabled={isScanning || loadingCampaigns || loadingTxs}
              className="px-5 py-2.5 bg-[#1a1a1a] border border-[#262626] text-white font-medium rounded-full hover:bg-[#262626] transition-colors flex items-center gap-2"
            >
              {(isScanning || loadingCampaigns || loadingTxs) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>

            {/* Webhook Notifications */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="px-3 py-2.5 bg-[#1a1a1a] border border-[#262626] text-white rounded-full hover:bg-[#262626] transition-colors relative"
              >
                <Bell className="w-4 h-4" />
                {webhookStats.stealthCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {webhookStats.stealthCount > 9 ? '9+' : webhookStats.stealthCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 bg-[#1a1a1a] border border-[#262626] rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Webhook Events</span>
                    <div className="flex items-center gap-1.5">
                      <Radio className={`w-3 h-3 ${webhookStats.lastReceived ? 'text-green-400' : 'text-[#737373]'}`} />
                      <span className="text-xs text-[#737373]">
                        {webhookStats.lastReceived ? 'Live' : 'Waiting'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#737373]">Total Events</span>
                      <span className="text-sm font-medium text-white">{webhookStats.eventCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#737373]">Stealth Payments</span>
                      <span className="text-sm font-medium text-purple-400">{webhookStats.stealthCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#737373]">Last Event</span>
                      <span className="text-xs text-[#737373]">
                        {webhookStats.lastReceived
                          ? new Date(webhookStats.lastReceived).toLocaleTimeString()
                          : 'None yet'}
                      </span>
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-[#262626] bg-[#141414]">
                    <p className="text-xs text-[#737373] text-center">
                      Real-time updates via Helius Webhooks
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-full transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Payment
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {/* Total Received */}
          <div className="p-4 bg-[#141414] border border-[#262626] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#737373]">Total Received</span>
              <ArrowDownLeft className="w-3 h-3 text-green-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {totalReceived.toFixed(2)} SOL
            </div>
            <div className="text-xs text-[#737373] mt-1">
              All transactions
            </div>
          </div>

          {/* Stealth Volume */}
          <div className="p-4 bg-[#141414] border border-purple-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-purple-400">Stealth Volume</span>
              <EyeOff className="w-3 h-3 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-purple-400">
              {stealthVolume.toFixed(2)} SOL
            </div>
            <div className="text-xs text-[#737373] mt-1">
              Private txs
            </div>
          </div>

          {/* Claimable Balance */}
          <div className="p-4 bg-[#141414] border border-[#262626] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#737373]">Claimable</span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-[#737373] hover:text-white transition-colors"
              >
                {showBalance ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
            <div className="text-xl font-bold text-green-400">
              {showBalance ? `${totalBalance.toFixed(4)}` : '•••••'} SOL
            </div>
            <div className="text-xs text-[#737373] mt-1">
              {spendablePayments.length} pending
            </div>
          </div>

          {/* Campaigns */}
          <div className="p-4 bg-[#141414] border border-[#262626] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#737373]">Campaigns</span>
              <Wallet className="w-3 h-3 text-[#737373]" />
            </div>
            <div className="text-xl font-bold text-white">
              {myCampaigns.length}
            </div>
            <div className="text-xs text-[#737373] mt-1">
              {totalCampaignBalance.toFixed(2)} SOL vaults
            </div>
          </div>

          {/* Transactions */}
          <div className="p-4 bg-[#141414] border border-[#262626] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#737373]">Transactions</span>
              <Activity className="w-3 h-3 text-[#737373]" />
            </div>
            <div className="text-xl font-bold text-white">
              {indexedTxs.length}
            </div>
            <div className="text-xs text-[#737373] mt-1">
              Helius indexed
            </div>
          </div>

          {/* Helius Status */}
          <div className="p-4 bg-[#141414] border border-[#262626] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#737373]">Helius RPC</span>
              <Server className="w-3 h-3 text-[#737373]" />
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${heliusStatus.connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-lg font-bold text-white">
                {heliusStatus.connected ? `${heliusStatus.latency}ms` : 'Off'}
              </span>
            </div>
            <div className="text-xs text-[#737373] mt-1">
              {heliusStatus.configured ? 'Connected' : 'Offline'}
            </div>
          </div>
        </div>

        {/* Stealth Address Card */}
        <div className="mb-8 p-5 bg-gradient-to-br from-purple-500/10 to-purple-900/10 border border-purple-500/20 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">Your Stealth Address</span>
            </div>
            <button
              onClick={() => handleCopy(metaAddressString || '')}
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="font-mono text-xs text-white/80 break-all leading-relaxed">
            {metaAddressString}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-[#141414] border border-[#262626] rounded-xl w-fit">
          {[
            { id: 'campaigns' as TabType, label: 'My Campaigns', icon: Wallet },
            { id: 'activity' as TabType, label: 'Activity', icon: Activity },
            { id: 'stealth' as TabType, label: 'Stealth Payments', icon: EyeOff },
            { id: 'pool' as TabType, label: 'Privacy Pool', icon: Shield },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                activeTab === id
                  ? 'bg-purple-600 text-white'
                  : 'text-[#737373] hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'stealth' && spendablePayments.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-green-500 text-white text-xs rounded-full">
                  {spendablePayments.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-[#141414] border border-[#262626] rounded-xl overflow-hidden">
          {/* Campaigns Tab */}
          {activeTab === 'campaigns' && (
            <div>
              <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between">
                <h2 className="font-semibold text-white">My Campaigns</h2>
                <button
                  onClick={loadMyCampaigns}
                  disabled={loadingCampaigns}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  {loadingCampaigns ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Refresh
                </button>
              </div>

              {myCampaigns.length === 0 ? (
                <div className="p-12 text-center text-[#737373]">
                  <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No campaigns yet</p>
                  <p className="text-sm mt-1">Create a campaign to start receiving donations</p>
                </div>
              ) : (
                <div className="divide-y divide-[#262626]">
                  {myCampaigns.map((campaign) => (
                    <div key={campaign.id} className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-white font-medium">{campaign.title}</h3>
                          <p className="text-sm text-[#737373]">
                            {campaign.donorCount} donor{campaign.donorCount !== 1 ? 's' : ''} • Goal: {campaign.goal} SOL
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-white">
                            {campaign.vaultBalance.toFixed(4)} SOL
                          </div>
                          <p className="text-xs text-[#737373]">in vault</p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className="h-1.5 bg-[#262626] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                            style={{ width: `${Math.min(100, (campaign.vaultBalance / campaign.goal) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        {campaign.stealthEnabled ? (
                          <div className="flex items-center gap-2 text-xs text-green-400">
                            <Shield className="w-3 h-3" />
                            Stealth enabled
                          </div>
                        ) : (
                          <button
                            onClick={() => enableStealthOnCampaign(campaign.id)}
                            disabled={enablingStealth === campaign.id}
                            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50"
                          >
                            {enablingStealth === campaign.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Shield className="w-3 h-3" />
                            )}
                            Enable Stealth Donations
                          </button>
                        )}

                        {campaign.vaultBalance > 0 && (
                          <button
                            onClick={() => withdrawFromCampaign(campaign.id, campaign.vaultBalance)}
                            disabled={withdrawingCampaign === campaign.id}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-full flex items-center gap-1"
                          >
                            {withdrawingCampaign === campaign.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            Withdraw
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity Tab - Helius Indexed */}
          {activeTab === 'activity' && (
            <div>
              <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-white">Transaction History</h2>
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                    Helius
                  </span>
                </div>
                <button
                  onClick={fetchIndexedTransactions}
                  disabled={loadingTxs}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  {loadingTxs ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Refresh
                </button>
              </div>

              {indexedTxs.length === 0 ? (
                <div className="p-12 text-center text-[#737373]">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No transactions yet</p>
                  <p className="text-sm mt-1">Your transaction history will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-[#262626]">
                  {indexedTxs.map((tx) => (
                    <div key={tx.signature} className="px-5 py-4 hover:bg-[#1a1a1a] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            tx.isStealth
                              ? 'bg-purple-500/20 border border-purple-500/30'
                              : 'bg-[#262626]'
                          }`}>
                            {tx.isStealth ? (
                              <EyeOff className="w-4 h-4 text-purple-400" />
                            ) : (
                              <Eye className="w-4 h-4 text-[#737373]" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${tx.isStealth ? 'text-purple-400' : 'text-white'}`}>
                                {tx.isStealth ? 'Stealth' : 'Public'}
                              </span>
                              <span className="text-xs text-[#737373]">{tx.type}</span>
                            </div>
                            <a
                              href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#737373] hover:text-purple-400 font-mono flex items-center gap-1"
                            >
                              {tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-medium">
                            {formatAmount(tx.amount)} SOL
                          </div>
                          <div className="text-xs text-[#737373]">
                            {formatTime(tx.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stealth Payments Tab */}
          {activeTab === 'stealth' && (
            <div>
              <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between">
                <h2 className="font-semibold text-white">Stealth Payments</h2>
                <div className="flex items-center gap-3">
                  {lastScan && (
                    <span className="text-xs text-[#737373]">
                      Last scan: {lastScan.toLocaleTimeString()}
                    </span>
                  )}
                  <button
                    onClick={scanForPayments}
                    disabled={isScanning}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Scan
                  </button>
                </div>
              </div>

              {isScanning && payments.length === 0 ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
                  <p className="text-[#737373]">Scanning blockchain for your payments...</p>
                </div>
              ) : payments.length === 0 ? (
                <div className="p-12 text-center text-[#737373]">
                  <EyeOff className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No stealth payments found</p>
                  <p className="text-sm mt-1">Share your stealth address to receive private payments</p>
                </div>
              ) : (
                <div className="divide-y divide-[#262626]">
                  {payments.map((payment) => (
                    <div key={payment.signature} className="px-5 py-4 hover:bg-[#1a1a1a] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            payment.canSpend
                              ? 'bg-green-500/20 border border-green-500/30'
                              : 'bg-[#262626]'
                          }`}>
                            <ArrowDownLeft className={`w-5 h-5 ${payment.canSpend ? 'text-green-400' : 'text-[#737373]'}`} />
                          </div>
                          <div>
                            <div className="text-white font-medium">Stealth Payment</div>
                            <div className="text-xs text-[#737373] font-mono">
                              {payment.stealthAddress.slice(0, 8)}...{payment.stealthAddress.slice(-8)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-white font-semibold">
                              {payment.amount.toFixed(4)} SOL
                            </div>
                            <div className="text-xs text-[#737373]">
                              {payment.timestamp ? new Date(payment.timestamp * 1000).toLocaleDateString() : 'Unknown'}
                            </div>
                          </div>

                          {payment.canSpend ? (
                            <button
                              onClick={() => withdrawFunds(payment)}
                              disabled={withdrawing === payment.stealthAddress}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-full flex items-center gap-2"
                            >
                              {withdrawing === payment.stealthAddress ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                              Claim
                            </button>
                          ) : (
                            <span className="px-4 py-2 bg-[#262626] text-[#737373] text-sm rounded-full">
                              Claimed
                            </span>
                          )}

                          <a
                            href={`https://explorer.solana.com/tx/${payment.signature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#737373] hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Privacy Pool Tab */}
          {activeTab === 'pool' && (
            <PrivacyPoolPanel />
          )}
        </div>
      </div>

      {showPaymentModal && (
        <SendPaymentModal onClose={() => setShowPaymentModal(false)} />
      )}
    </div>
  );
}
