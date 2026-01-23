'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { SendPaymentModal } from '../components/SendPaymentModal';
import { useStealth } from '../lib/stealth/StealthContext';
import {
  isStealthAddressForUs,
  deriveStealthSpendingKey,
} from '../lib/stealth';
import { useProgram, CampaignData } from '../lib/program';

// Devnet connection
const DEVNET_RPC = 'https://api.devnet.solana.com';
const devnetConnection = new Connection(DEVNET_RPC, 'confirmed');
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

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
}

export default function DashboardPage() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { stealthKeys, metaAddressString, isLoading: keysLoading, deriveKeysFromWallet } = useStealth();
  const { listCampaigns, fetchVaultBalance, withdraw: programWithdraw } = useProgram();

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

  // Calculate totals
  const totalBalance = payments.reduce((sum, p) => sum + p.amount, 0);
  const spendablePayments = payments.filter(p => p.canSpend);
  const totalCampaignBalance = myCampaigns.reduce((sum, c) => sum + c.vaultBalance, 0);

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

  // Withdraw from campaign
  const withdrawFromCampaign = async (campaignId: string, amount: number) => {
    if (!publicKey || amount <= 0) return;

    setWithdrawingCampaign(campaignId);
    try {
      await programWithdraw(campaignId, amount);
      // Reload campaigns to update balances
      await loadMyCampaigns();
    } catch (err) {
      console.error('Withdraw failed:', err);
    } finally {
      setWithdrawingCampaign(null);
    }
  };

  // Load campaigns on mount
  useEffect(() => {
    if (publicKey) {
      loadMyCampaigns();
    }
  }, [publicKey, loadMyCampaigns]);

  // Copy to clipboard
  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Scan for payments with timeout and rate limit handling
  const scanForPayments = useCallback(async () => {
    if (!stealthKeys) return;

    setIsScanning(true);

    try {
      const signatures = await devnetConnection.getSignaturesForAddress(
        new PublicKey(MEMO_PROGRAM_ID),
        { limit: 20 } // Reduced to avoid rate limits
      );

      const foundPayments: StealthPayment[] = [];
      let errorCount = 0;
      const maxErrors = 5; // Stop after too many errors

      for (const sig of signatures) {
        // Stop if too many errors (rate limited)
        if (errorCount >= maxErrors) break;

        try {
          const tx = await devnetConnection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx?.meta || !tx.transaction.message) continue;

          const accountKeys = tx.transaction.message.staticAccountKeys ||
                             (tx.transaction.message as any).accountKeys || [];

          for (const instruction of (tx.transaction.message as any).instructions || []) {
            const programId = accountKeys[instruction.programIdIndex]?.toBase58();

            if (programId === MEMO_PROGRAM_ID && instruction.data) {
              try {
                const memoBytes = bs58.decode(instruction.data);
                const memoData = new TextDecoder().decode(memoBytes);
                const parsed = JSON.parse(memoData);

                if (parsed.type === 'stealth' && parsed.ephemeralPubKey) {
                  for (let i = 0; i < accountKeys.length; i++) {
                    const address = accountKeys[i];
                    const preBalance = tx.meta.preBalances[i] || 0;
                    const postBalance = tx.meta.postBalances[i] || 0;
                    const received = postBalance - preBalance;

                    if (received > 0) {
                      const isOurs = isStealthAddressForUs(
                        address,
                        parsed.ephemeralPubKey,
                        stealthKeys.viewKey.privateKey,
                        stealthKeys.spendKey.publicKey
                      );

                      if (isOurs) {
                        const currentBalance = await devnetConnection.getBalance(address);

                        if (!foundPayments.some(p => p.signature === sig.signature)) {
                          foundPayments.push({
                            signature: sig.signature,
                            stealthAddress: address.toBase58(),
                            ephemeralPubKey: parsed.ephemeralPubKey,
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
                // Not a valid stealth memo
              }
            }
          }
        } catch {
          errorCount++;
        }
      }

      setPayments(foundPayments);
      setLastScan(new Date());
    } catch (err) {
      console.error('Scan error:', err);
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

      // Update payment
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

  return (
    <div className="min-h-screen px-6 py-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-[#737373]">
              Manage your private assets and stealth payments.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={scanForPayments}
              disabled={isScanning}
              className="px-5 py-2.5 bg-[#1a1a1a] border border-[#262626] text-white font-medium rounded-full hover:bg-[#262626] transition-colors flex items-center gap-2"
            >
              {isScanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isScanning ? 'Scanning...' : 'Refresh'}
            </button>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-full transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Payment
            </button>
          </div>
        </div>

        {/* Your Stealth Address Card */}
        <div className="mb-8 p-6 bg-gradient-to-br from-purple-500/10 to-purple-900/10 border border-purple-500/20 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">Your Stealth Address</span>
            </div>
            <button
              onClick={() => handleCopy(metaAddressString || '')}
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="font-mono text-sm text-white/80 break-all leading-relaxed">
            {metaAddressString}
          </p>
          <p className="text-xs text-purple-400/60 mt-3">
            Share this address to receive private payments
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {/* Total Balance */}
          <div className="p-6 bg-[#141414] border border-[#262626] rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#737373]">Total Balance</span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-[#737373] hover:text-white transition-colors"
              >
                {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {showBalance ? `${totalBalance.toFixed(4)} SOL` : '••••• SOL'}
            </div>
            <div className="text-sm text-[#737373]">
              {spendablePayments.length} spendable payment{spendablePayments.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Payments Received */}
          <div className="p-6 bg-[#141414] border border-[#262626] rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#737373]">Payments Received</span>
              <ArrowDownLeft className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {payments.length}
            </div>
            <div className="text-sm text-[#737373]">
              Via stealth addresses
            </div>
          </div>

          {/* Privacy Level */}
          <div className="p-6 bg-[#141414] border border-[#262626] rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#737373]">Privacy Status</span>
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              Active
            </div>
            <div className="text-sm text-[#737373]">
              Stealth keys configured
            </div>
          </div>
        </div>

        {/* My Campaigns */}
        {myCampaigns.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">My Campaigns</h2>
              <button
                onClick={loadMyCampaigns}
                disabled={loadingCampaigns}
                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                {loadingCampaigns ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Refresh
              </button>
            </div>

            <div className="space-y-4">
              {myCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="p-5 bg-[#141414] border border-[#262626] rounded-2xl"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-medium">{campaign.title}</h3>
                      <p className="text-sm text-[#737373]">
                        {campaign.donorCount} donor{campaign.donorCount !== 1 ? 's' : ''} • Goal: {campaign.goal} SOL
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        {campaign.vaultBalance.toFixed(4)} SOL
                      </div>
                      <p className="text-xs text-[#737373]">Available to withdraw</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="h-2 bg-[#262626] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                        style={{ width: `${Math.min(100, (campaign.vaultBalance / campaign.goal) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {campaign.vaultBalance > 0 ? (
                    <button
                      onClick={() => withdrawFromCampaign(campaign.id, campaign.vaultBalance)}
                      disabled={withdrawingCampaign === campaign.id}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center gap-2"
                    >
                      {withdrawingCampaign === campaign.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Withdrawing...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Withdraw {campaign.vaultBalance.toFixed(4)} SOL
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="text-center py-3 text-[#737373] text-sm">
                      No funds to withdraw
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
            {lastScan && (
              <span className="text-xs text-[#737373]">
                Last scan: {lastScan.toLocaleTimeString()}
              </span>
            )}
          </div>

          {isScanning && payments.length === 0 ? (
            <div className="text-center py-16">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
              <p className="text-[#737373]">Scanning blockchain for your payments...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-16 bg-[#141414] border border-[#262626] rounded-2xl">
              <Download className="w-12 h-12 text-[#737373] mx-auto mb-4 opacity-50" />
              <p className="text-[#737373] mb-2">No payments found yet</p>
              <p className="text-sm text-[#737373]/60">
                Share your stealth address to receive private payments
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.signature}
                  className="flex items-center justify-between p-5 bg-[#141414] border border-[#262626] rounded-2xl hover:bg-[#1a1a1a] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-500/10 border border-green-500/20">
                      <ArrowDownLeft className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <div className="text-white font-medium">Stealth Payment</div>
                      <div className="text-sm text-[#737373] font-mono">
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
              ))}
            </div>
          )}
        </div>
      </div>

      {showPaymentModal && (
        <SendPaymentModal onClose={() => setShowPaymentModal(false)} />
      )}
    </div>
  );
}
