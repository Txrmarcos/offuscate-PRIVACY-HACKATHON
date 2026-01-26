'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Building2,
  Lock,
  Clock,
  Zap,
  ArrowRight,
  Loader2,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Wallet,
  Eye,
  EyeOff,
  Send,
  AlertTriangle,
  CheckCircle,
  Binary,
  Info,
  Hash,
  DollarSign,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { useProgram } from '../lib/program';
import { PrivateNote } from '../lib/privacy';
import { ALLOWED_WITHDRAW_AMOUNTS } from '../lib/program/client';
import { useStealth } from '../lib/stealth/StealthContext';
import { privateZKDonation, type LightWallet } from '../lib/privacy/lightProtocol';
import { triggerOffuscation } from '../components/WaveMeshBackground';
import { FullScreenPrivacyAnimation } from '../components/PrivacyGraphAnimation';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

type ActiveTab = 'settle' | 'pay';
type SourceWallet = 'main' | 'stealth';
type PrivacyMode = 'zk' | 'direct';

export default function TreasuryPage() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { stealthKeys, metaAddressString, isLoading: keysLoading, deriveKeysFromWallet } = useStealth();
  const {
    fetchPoolStats,
    privateDeposit,
    privateWithdraw,
    getUnspentPrivateNotes,
    quickWithdrawAllToStealth,
  } = useProgram();

  // State
  const [activeTab, setActiveTab] = useState<ActiveTab>('settle');
  const [sourceWallet, setSourceWallet] = useState<SourceWallet>('main');
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('zk');
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Balances
  const [mainBalance, setMainBalance] = useState(0);
  const [stealthBalance, setStealthBalance] = useState(0);
  const [poolStats, setPoolStats] = useState<any>(null);
  const [privateNotes, setPrivateNotes] = useState<PrivateNote[]>([]);

  // Private keypair for recipient wallet
  const [privateKeypair, setPrivateKeypair] = useState<Keypair | null>(null);

  // Payment form
  const [recipientAddress, setRecipientAddress] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('0.1');

  // Animation state
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationData, setAnimationData] = useState<{
    privacyLevel: 'ZK_COMPRESSED' | 'PUBLIC' | 'SEMI';
    txSignature: string;
    amount: string;
  } | null>(null);

  // Generate deterministic private keypair
  useEffect(() => {
    const generateKeypair = async () => {
      if (!publicKey) return;
      try {
        const { createHash } = await import('crypto');
        const seed = createHash('sha256')
          .update(publicKey.toBuffer())
          .update('privacy_pool_stealth_v1')
          .digest();
        const keypair = Keypair.fromSeed(seed.slice(0, 32));
        setPrivateKeypair(keypair);
      } catch (err) {
        console.error('Failed to derive private keypair:', err);
      }
    };
    generateKeypair();
  }, [publicKey]);

  // Fetch balances and pool data
  const refreshData = useCallback(async () => {
    if (!publicKey) return;

    const connection = new Connection(RPC_URL, 'confirmed');

    try {
      const balance = await connection.getBalance(publicKey);
      setMainBalance(balance / LAMPORTS_PER_SOL);
    } catch {}

    if (privateKeypair) {
      try {
        const balance = await connection.getBalance(privateKeypair.publicKey);
        setStealthBalance(balance / LAMPORTS_PER_SOL);
      } catch {}
    }

    try {
      const stats = await fetchPoolStats();
      setPoolStats(stats);
      const notes = await getUnspentPrivateNotes();
      setPrivateNotes(notes);
    } catch {}
  }, [publicKey, privateKeypair, fetchPoolStats, getUnspentPrivateNotes]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Copy to clipboard
  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Fund payroll pool
  const handleFundPool = async (amount: number) => {
    setProcessing('deposit');
    setError(null);
    setSuccess(null);
    try {
      const { signature } = await privateDeposit(amount);
      setTxSignature(signature);
      setSuccess(`Added ${amount} SOL to payroll pool`);
      triggerOffuscation();
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Funding failed');
    } finally {
      setProcessing(null);
    }
  };

  // Settle to private wallet
  const handlePrivateSettlement = async () => {
    if (!privateKeypair || privateNotes.length === 0) return;
    setProcessing('withdraw');
    setError(null);
    setSuccess(null);
    try {
      const results = await quickWithdrawAllToStealth(privateKeypair);
      if (results.length > 0) {
        const totalAmount = results.reduce((acc, r) => acc + (r.note.amount / LAMPORTS_PER_SOL), 0);
        setTxSignature(results[results.length - 1].signature);
        setSuccess(`Settled ${totalAmount.toFixed(2)} SOL to private wallet`);
        triggerOffuscation();
      }
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Settlement failed');
    } finally {
      setProcessing(null);
    }
  };

  // Send payment
  const handlePayment = async () => {
    if (!publicKey || !signTransaction) {
      setVisible(true);
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Invalid amount');
      return;
    }

    if (!recipientAddress) {
      setError('Enter recipient address');
      return;
    }

    let recipient: PublicKey;
    try {
      recipient = new PublicKey(recipientAddress);
    } catch {
      setError('Invalid recipient address');
      return;
    }

    setProcessing('send');
    setError(null);
    setSuccess(null);

    try {
      const connection = new Connection(RPC_URL, 'confirmed');

      if (privacyMode === 'zk') {
        // ZK Compressed transfer via Light Protocol
        const lightWallet: LightWallet = {
          publicKey: sourceWallet === 'main' ? publicKey : privateKeypair!.publicKey,
          signTransaction: sourceWallet === 'main'
            ? signTransaction as any
            : async (tx: Transaction) => {
                tx.sign(privateKeypair!);
                return tx;
              },
        };

        const result = await privateZKDonation(lightWallet, recipient, amount);

        if (!result.success) {
          throw new Error(result.error || 'Private payment failed');
        }

        setAnimationData({
          privacyLevel: 'ZK_COMPRESSED',
          txSignature: result.signature!,
          amount: paymentAmount,
        });
        setShowAnimation(true);
        triggerOffuscation();

      } else {
        // Standard transfer
        const senderKeypair = sourceWallet === 'stealth' ? privateKeypair : null;
        const senderPubkey = sourceWallet === 'main' ? publicKey : privateKeypair!.publicKey;

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        const tx = new Transaction({
          blockhash,
          lastValidBlockHeight,
          feePayer: senderPubkey,
        });

        tx.add(
          SystemProgram.transfer({
            fromPubkey: senderPubkey,
            toPubkey: recipient,
            lamports: Math.floor(amount * LAMPORTS_PER_SOL),
          })
        );

        let signature: string;
        if (sourceWallet === 'stealth' && senderKeypair) {
          tx.sign(senderKeypair);
          signature = await connection.sendRawTransaction(tx.serialize());
        } else {
          const signedTx = await signTransaction(tx);
          signature = await connection.sendRawTransaction(signedTx.serialize());
        }

        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

        setAnimationData({
          privacyLevel: 'PUBLIC',
          txSignature: signature,
          amount: paymentAmount,
        });
        setShowAnimation(true);
      }

      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setProcessing(null);
    }
  };

  // Transfer between wallets
  const handleTransferBetweenWallets = async (direction: 'toPrivate' | 'toMain') => {
    if (!publicKey || !privateKeypair) return;

    const connection = new Connection(RPC_URL, 'confirmed');
    const fromKeypair = direction === 'toPrivate' ? null : privateKeypair;
    const fromPubkey = direction === 'toPrivate' ? publicKey : privateKeypair.publicKey;
    const toPubkey = direction === 'toPrivate' ? privateKeypair.publicKey : publicKey;
    const balance = direction === 'toPrivate' ? mainBalance : stealthBalance;

    if (balance <= 0.001) {
      setError('Insufficient balance');
      return;
    }

    setProcessing(direction);
    setError(null);
    setSuccess(null);

    try {
      const transferAmount = Math.floor((balance - 0.001) * LAMPORTS_PER_SOL);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      const tx = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: fromPubkey,
      });

      tx.add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: transferAmount,
        })
      );

      let signature: string;
      if (fromKeypair) {
        tx.sign(fromKeypair);
        signature = await connection.sendRawTransaction(tx.serialize());
      } else {
        const signedTx = await signTransaction!(tx);
        signature = await connection.sendRawTransaction(signedTx.serialize());
      }

      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

      setTxSignature(signature);
      setSuccess(`Transferred ${(transferAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
    } finally {
      setProcessing(null);
    }
  };

  // Animation complete handler
  const handleAnimationComplete = () => {
    setShowAnimation(false);
    setAnimationData(null);
    setRecipientAddress('');
    setPaymentAmount('0.1');
  };

  // Show animation
  if (showAnimation && animationData) {
    return (
      <FullScreenPrivacyAnimation
        privacyLevel={animationData.privacyLevel}
        txSignature={animationData.txSignature}
        amount={animationData.amount}
        onComplete={handleAnimationComplete}
      />
    );
  }

  // Not connected
  if (!connected) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <Building2 className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Treasury</h1>
          <p className="text-white/40 text-lg mb-3">
            Private treasury operations for enterprises.
          </p>
          <p className="text-white/25 text-sm mb-8">
            Fund pools, settle payments, and manage treasury without exposing activity on-chain.
          </p>
          <button
            onClick={() => setVisible(true)}
            className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // Loading keys
  if (!stealthKeys && !keysLoading) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <Lock className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Setup Privacy</h1>
          <p className="text-white/40 text-lg mb-8">
            Generate cryptographic keys for private treasury operations.
          </p>
          <button
            onClick={deriveKeysFromWallet}
            className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all"
          >
            Generate Keys
          </button>
        </div>
      </div>
    );
  }

  const totalNoteBalance = privateNotes.reduce((acc, n) => acc + n.amount, 0) / LAMPORTS_PER_SOL;
  const activeWalletBalance = sourceWallet === 'main' ? mainBalance : stealthBalance;

  return (
    <div className="min-h-screen px-6 py-20">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white/60" />
              </div>
              <h1 className="text-3xl font-bold text-white">Treasury</h1>
            </div>
            <p className="text-white/40 text-sm">
              Private settlements and treasury operations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHowItWorks(!showHowItWorks)}
              className="h-11 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-2 text-white/40 hover:text-white transition-all text-sm"
            >
              <Info className="w-4 h-4" />
              How it works
            </button>
            <button
              onClick={refreshData}
              className="w-11 h-11 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* How it works panel */}
        {showHowItWorks && (
          <div className="mb-6 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                <Hash className="w-5 h-5 text-white/40" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium mb-2">Private Settlement System</h3>
                <p className="text-white/40 text-sm mb-4">
                  Each deposit creates a cryptographic <strong className="text-white/60">commitment</strong> that only you can claim.
                  Funds are pooled and settled privately, breaking the on-chain link between treasury and recipients.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-white/[0.02] rounded-lg">
                    <p className="text-white/60 font-medium mb-1">Fund Pool</p>
                    <p className="text-white/30">Create private commitment</p>
                  </div>
                  <div className="p-3 bg-white/[0.02] rounded-lg">
                    <p className="text-white/60 font-medium mb-1">Payroll Pool</p>
                    <p className="text-white/30">Funds aggregated privately</p>
                  </div>
                  <div className="p-3 bg-white/[0.02] rounded-lg">
                    <p className="text-white/60 font-medium mb-1">Settlement</p>
                    <p className="text-white/30">Claim to private wallet</p>
                  </div>
                </div>
                <p className="text-white/30 text-xs mt-3">
                  Standardized amounts (0.1, 0.5, 1.0 SOL) maximize the anonymity set.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Treasury Wallet */}
          <div
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              sourceWallet === 'main'
                ? 'bg-white/[0.05] border-white/[0.15]'
                : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
            }`}
            onClick={() => setSourceWallet('main')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-white/40" />
                <span className="text-xs text-white/40">Treasury Wallet</span>
              </div>
              {sourceWallet === 'main' && (
                <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white/60">ACTIVE</span>
              )}
            </div>
            <p className="text-2xl font-mono text-white mb-1">
              {mainBalance.toFixed(4)} <span className="text-sm text-white/30">SOL</span>
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-white/20 font-mono truncate flex-1">
                {publicKey?.toBase58()}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(publicKey?.toBase58() || '', 'main');
                }}
                className="text-white/20 hover:text-white/40"
              >
                {copied === 'main' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Private Operations Wallet */}
          <div
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              sourceWallet === 'stealth'
                ? 'bg-white/[0.05] border-white/[0.15]'
                : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
            }`}
            onClick={() => setSourceWallet('stealth')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-white/40" />
                <span className="text-xs text-white/40">Private Wallet</span>
              </div>
              {sourceWallet === 'stealth' && (
                <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white/60">ACTIVE</span>
              )}
            </div>
            <p className="text-2xl font-mono text-white mb-1">
              {stealthBalance.toFixed(4)} <span className="text-sm text-white/30">SOL</span>
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-white/20 font-mono truncate flex-1">
                {privateKeypair?.publicKey.toBase58()}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(privateKeypair?.publicKey.toBase58() || '', 'stealth');
                }}
                className="text-white/20 hover:text-white/40"
              >
                {copied === 'stealth' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Quick transfer between wallets */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={() => handleTransferBetweenWallets('toPrivate')}
            disabled={processing === 'toPrivate' || mainBalance <= 0.001}
            className="px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/[0.05] transition-all disabled:opacity-30 flex items-center gap-2"
          >
            {processing === 'toPrivate' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
            Treasury → Private
          </button>
          <button
            onClick={() => handleTransferBetweenWallets('toMain')}
            disabled={processing === 'toMain' || stealthBalance <= 0.001}
            className="px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/[0.05] transition-all disabled:opacity-30 flex items-center gap-2"
          >
            {processing === 'toMain' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3 rotate-180" />}
            Private → Treasury
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/[0.02] border border-white/[0.06] rounded-xl mb-6 w-fit">
          <button
            onClick={() => setActiveTab('settle')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'settle'
                ? 'bg-white text-black'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Private Settlement
            </span>
          </button>
          <button
            onClick={() => setActiveTab('pay')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'pay'
                ? 'bg-white text-black'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Pay
            </span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'settle' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Step 1: Fund Pool */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
                  <span className="text-white/60 font-bold text-sm">1</span>
                </div>
                <div>
                  <h3 className="text-white font-medium">Fund Payroll Pool</h3>
                  <p className="text-white/30 text-xs">From treasury wallet</p>
                </div>
              </div>

              <p className="text-white/40 text-sm mb-4">
                Add funds to the payroll pool. Standardized amounts increase privacy.
              </p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {ALLOWED_WITHDRAW_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => handleFundPool(amt)}
                    disabled={processing === 'deposit' || mainBalance < amt}
                    className="py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl text-white font-medium transition-all disabled:opacity-30"
                  >
                    {processing === 'deposit' ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      `${amt} SOL`
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-white/30">
                <Clock className="w-3 h-3" />
                <span>Settlement delay: 30s - 5min</span>
              </div>
            </div>

            {/* Step 2: Settle */}
            <div className={`p-6 rounded-2xl border ${
              privateNotes.length > 0
                ? 'bg-white/[0.03] border-white/[0.1]'
                : 'bg-white/[0.01] border-white/[0.04]'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  privateNotes.length > 0 ? 'bg-white/[0.08]' : 'bg-white/[0.03]'
                }`}>
                  <span className={`font-bold text-sm ${privateNotes.length > 0 ? 'text-white' : 'text-white/30'}`}>2</span>
                </div>
                <div>
                  <h3 className="text-white font-medium">Settle to Private Wallet</h3>
                  <p className="text-white/30 text-xs">Unlinked from treasury</p>
                </div>
              </div>

              {privateNotes.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-4 p-3 bg-white/[0.03] rounded-lg">
                    <span className="text-white/50 text-sm">Ready to settle</span>
                    <span className="text-white font-mono font-bold">{totalNoteBalance.toFixed(2)} SOL</span>
                  </div>

                  <button
                    onClick={handlePrivateSettlement}
                    disabled={processing === 'withdraw'}
                    className="w-full py-3 bg-white hover:bg-white/90 text-black font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {processing === 'withdraw' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Execute Settlement
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-white/30 text-center mt-3">
                    Private wallet is not linked to your treasury on-chain
                  </p>
                </>
              ) : (
                <div className="text-center py-6">
                  <Shield className="w-8 h-8 mx-auto mb-3 text-white/10" />
                  <p className="text-white/30 text-sm">No pending settlements</p>
                  <p className="text-white/20 text-xs mt-1">Fund the pool to begin</p>
                </div>
              )}
            </div>

          </div>
        )}

        {activeTab === 'pay' && (
          <div className="max-w-xl">
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <h3 className="text-white font-medium mb-4">Private Payment</h3>

              {/* Source wallet indicator */}
              <div className="mb-4 p-3 bg-white/[0.03] rounded-lg flex items-center justify-between">
                <span className="text-white/40 text-sm">Paying from</span>
                <span className="text-white font-medium">
                  {sourceWallet === 'main' ? 'Treasury' : 'Private Wallet'} ({activeWalletBalance.toFixed(4)} SOL)
                </span>
              </div>

              {/* Recipient */}
              <div className="mb-4">
                <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="Enter Solana address..."
                  className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-white/[0.15] transition-colors"
                />
              </div>

              {/* Amount */}
              <div className="mb-4">
                <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-2">
                  Amount (SOL)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.001"
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-lg font-mono focus:border-white/[0.15] transition-colors"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                    {['0.1', '0.5', '1'].map((val) => (
                      <button
                        key={val}
                        onClick={() => setPaymentAmount(val)}
                        className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                          paymentAmount === val
                            ? 'bg-white text-black'
                            : 'bg-white/[0.05] text-white/40 hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Privacy mode */}
              <div className="mb-6">
                <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-2">
                  Privacy Level
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPrivacyMode('zk')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      privacyMode === 'zk'
                        ? 'bg-white/[0.05] border-white/[0.15]'
                        : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                    }`}
                  >
                    <Binary className={`w-5 h-5 mb-2 ${privacyMode === 'zk' ? 'text-white' : 'text-white/30'}`} />
                    <p className="text-white font-medium text-sm">Maximum Privacy</p>
                    <p className="text-white/40 text-xs">ZK protected - sender unlinkable</p>
                  </button>
                  <button
                    onClick={() => setPrivacyMode('direct')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      privacyMode === 'direct'
                        ? 'bg-white/[0.05] border-white/[0.15]'
                        : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                    }`}
                  >
                    <Eye className={`w-5 h-5 mb-2 ${privacyMode === 'direct' ? 'text-white' : 'text-white/30'}`} />
                    <p className="text-white font-medium text-sm">Standard</p>
                    <p className="text-white/40 text-xs">Direct transfer - visible</p>
                  </button>
                </div>
              </div>

              {/* Pay button */}
              <button
                onClick={handlePayment}
                disabled={processing === 'send' || !recipientAddress || parseFloat(paymentAmount) <= 0}
                className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing === 'send' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {privacyMode === 'zk' ? 'Creating ZK Proof...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Pay {paymentAmount} SOL
                  </>
                )}
              </button>

              {/* Privacy note */}
              {sourceWallet === 'stealth' && privacyMode === 'zk' && (
                <div className="mt-4 p-3 bg-white/[0.03] border border-white/[0.08] rounded-lg">
                  <p className="text-xs text-white/50">
                    <strong className="text-white/70">Maximum privacy:</strong> Paying from private wallet with ZK proofs.
                    Your treasury is never linked to this payment.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="mt-4 p-4 bg-white/[0.02] border border-red-500/20 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-4 p-4 bg-white/[0.03] border border-white/[0.1] rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-white" />
              <p className="text-white text-sm">{success}</p>
            </div>
            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1"
              >
                View transaction <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
