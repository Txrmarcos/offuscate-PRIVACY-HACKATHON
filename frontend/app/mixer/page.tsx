'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Shuffle,
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

type ActiveTab = 'mix' | 'send';
type SourceWallet = 'main' | 'stealth';
type PrivacyMode = 'zk' | 'direct';

export default function MixerPage() {
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('mix');
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

  // Stealth keypair
  const [stealthKeypair, setStealthKeypair] = useState<Keypair | null>(null);

  // Send form
  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('0.1');

  // Animation state
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationData, setAnimationData] = useState<{
    privacyLevel: 'ZK_COMPRESSED' | 'PUBLIC' | 'SEMI';
    txSignature: string;
    amount: string;
  } | null>(null);

  // Generate deterministic stealth keypair
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
        setStealthKeypair(keypair);
      } catch (err) {
        console.error('Failed to derive stealth keypair:', err);
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

    if (stealthKeypair) {
      try {
        const balance = await connection.getBalance(stealthKeypair.publicKey);
        setStealthBalance(balance / LAMPORTS_PER_SOL);
      } catch {}
    }

    try {
      const stats = await fetchPoolStats();
      setPoolStats(stats);
      const notes = await getUnspentPrivateNotes();
      setPrivateNotes(notes);
    } catch {}
  }, [publicKey, stealthKeypair, fetchPoolStats, getUnspentPrivateNotes]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Copy to clipboard
  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Deposit to mixer
  const handleDeposit = async (amount: number) => {
    setProcessing('deposit');
    setError(null);
    setSuccess(null);
    try {
      const { signature } = await privateDeposit(amount);
      setTxSignature(signature);
      setSuccess(`Deposited ${amount} SOL to mixer`);
      triggerOffuscation();
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Deposit failed');
    } finally {
      setProcessing(null);
    }
  };

  // Withdraw all to stealth
  const handleWithdrawToStealth = async () => {
    if (!stealthKeypair || privateNotes.length === 0) return;
    setProcessing('withdraw');
    setError(null);
    setSuccess(null);
    try {
      const results = await quickWithdrawAllToStealth(stealthKeypair);
      if (results.length > 0) {
        const totalAmount = results.reduce((acc, r) => acc + (r.note.amount / LAMPORTS_PER_SOL), 0);
        setTxSignature(results[results.length - 1].signature);
        setSuccess(`Withdrew ${totalAmount.toFixed(2)} SOL to stealth wallet`);
        triggerOffuscation();
      }
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setProcessing(null);
    }
  };

  // Send payment
  const handleSend = async () => {
    if (!publicKey || !signTransaction) {
      setVisible(true);
      return;
    }

    const amount = parseFloat(sendAmount);
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
          publicKey: sourceWallet === 'main' ? publicKey : stealthKeypair!.publicKey,
          signTransaction: sourceWallet === 'main'
            ? signTransaction as any
            : async (tx: Transaction) => {
                tx.sign(stealthKeypair!);
                return tx;
              },
        };

        const result = await privateZKDonation(lightWallet, recipient, amount);

        if (!result.success) {
          throw new Error(result.error || 'ZK transfer failed');
        }

        setAnimationData({
          privacyLevel: 'ZK_COMPRESSED',
          txSignature: result.signature!,
          amount: sendAmount,
        });
        setShowAnimation(true);
        triggerOffuscation();

      } else {
        // Direct transfer
        const senderKeypair = sourceWallet === 'stealth' ? stealthKeypair : null;
        const senderPubkey = sourceWallet === 'main' ? publicKey : stealthKeypair!.publicKey;

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
          amount: sendAmount,
        });
        setShowAnimation(true);
      }

      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
    } finally {
      setProcessing(null);
    }
  };

  // Transfer between wallets
  const handleTransferBetweenWallets = async (direction: 'toStealth' | 'toMain') => {
    if (!publicKey || !stealthKeypair) return;

    const connection = new Connection(RPC_URL, 'confirmed');
    const fromKeypair = direction === 'toStealth' ? null : stealthKeypair;
    const fromPubkey = direction === 'toStealth' ? publicKey : stealthKeypair.publicKey;
    const toPubkey = direction === 'toStealth' ? stealthKeypair.publicKey : publicKey;
    const balance = direction === 'toStealth' ? mainBalance : stealthBalance;

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
    setSendAmount('0.1');
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
            <Shuffle className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">ShadowMix</h1>
          <p className="text-white/40 text-lg mb-8">
            Private transfers between wallets. Connect to start mixing.
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

  // Loading stealth keys
  if (!stealthKeys && !keysLoading) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <Lock className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Setup Privacy</h1>
          <p className="text-white/40 text-lg mb-8">
            Generate stealth keys for private operations.
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
                <Shuffle className="w-5 h-5 text-white/60" />
              </div>
              <h1 className="text-3xl font-bold text-white">ShadowMix</h1>
            </div>
            <p className="text-white/40 text-sm">
              Private transfers & mixing. Break the on-chain link between wallets.
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
                <h3 className="text-white font-medium mb-2">Commitment-Based Privacy</h3>
                <p className="text-white/40 text-sm mb-4">
                  Each deposit creates a cryptographic <strong className="text-white/60">commitment</strong> that includes the amount.
                  Only you have the secret to withdraw your exact deposit. Nobody can steal your funds.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-white/[0.02] rounded-lg">
                    <p className="text-white/60 font-medium mb-1">Deposit</p>
                    <p className="text-white/30">commitment = hash(secret + amount)</p>
                  </div>
                  <div className="p-3 bg-white/[0.02] rounded-lg">
                    <p className="text-white/60 font-medium mb-1">Pool</p>
                    <p className="text-white/30">All deposits mixed together</p>
                  </div>
                  <div className="p-3 bg-white/[0.02] rounded-lg">
                    <p className="text-white/60 font-medium mb-1">Withdraw</p>
                    <p className="text-white/30">Prove secret → get exact amount</p>
                  </div>
                </div>
                <p className="text-white/30 text-xs mt-3">
                  Standardized amounts (0.1, 0.5, 1.0 SOL) increase the anonymity set.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Main Wallet */}
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
                <span className="text-xs text-white/40">Main Wallet</span>
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

          {/* Stealth Wallet */}
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
                <span className="text-xs text-white/40">Stealth Wallet</span>
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
                {stealthKeypair?.publicKey.toBase58()}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(stealthKeypair?.publicKey.toBase58() || '', 'stealth');
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
            onClick={() => handleTransferBetweenWallets('toStealth')}
            disabled={processing === 'toStealth' || mainBalance <= 0.001}
            className="px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/[0.05] transition-all disabled:opacity-30 flex items-center gap-2"
          >
            {processing === 'toStealth' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
            Main → Stealth
          </button>
          <button
            onClick={() => handleTransferBetweenWallets('toMain')}
            disabled={processing === 'toMain' || stealthBalance <= 0.001}
            className="px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/[0.05] transition-all disabled:opacity-30 flex items-center gap-2"
          >
            {processing === 'toMain' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3 rotate-180" />}
            Stealth → Main
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/[0.02] border border-white/[0.06] rounded-xl mb-6 w-fit">
          <button
            onClick={() => setActiveTab('mix')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'mix'
                ? 'bg-white text-black'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Shuffle className="w-4 h-4" />
              Mix
            </span>
          </button>
          <button
            onClick={() => setActiveTab('send')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'send'
                ? 'bg-white text-black'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send
            </span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'mix' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Step 1: Deposit */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
                  <span className="text-white/60 font-bold text-sm">1</span>
                </div>
                <div>
                  <h3 className="text-white font-medium">Deposit to Mixer</h3>
                  <p className="text-white/30 text-xs">From your main wallet</p>
                </div>
              </div>

              <p className="text-white/40 text-sm mb-4">
                Deposit SOL into the privacy pool. Use standardized amounts for maximum anonymity.
              </p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {ALLOWED_WITHDRAW_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => handleDeposit(amt)}
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
                <span>Variable delay: 30s - 5min</span>
              </div>
            </div>

            {/* Step 2: Withdraw */}
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
                  <h3 className="text-white font-medium">Withdraw to Stealth</h3>
                  <p className="text-white/30 text-xs">To a new unlinked wallet</p>
                </div>
              </div>

              {privateNotes.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-4 p-3 bg-white/[0.03] rounded-lg">
                    <span className="text-white/50 text-sm">Available to withdraw</span>
                    <span className="text-white font-mono font-bold">{totalNoteBalance.toFixed(2)} SOL</span>
                  </div>

                  <button
                    onClick={handleWithdrawToStealth}
                    disabled={processing === 'withdraw'}
                    className="w-full py-3 bg-white hover:bg-white/90 text-black font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {processing === 'withdraw' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Withdraw to Stealth Wallet
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-white/30 text-center mt-3">
                    Your stealth wallet is not linked to your main wallet on-chain
                  </p>
                </>
              ) : (
                <div className="text-center py-6">
                  <Shuffle className="w-8 h-8 mx-auto mb-3 text-white/10" />
                  <p className="text-white/30 text-sm">No deposits yet</p>
                  <p className="text-white/20 text-xs mt-1">Deposit SOL to start mixing</p>
                </div>
              )}
            </div>

            {/* Pool Stats */}
            {poolStats && (
              <div className="lg:col-span-2 grid grid-cols-3 gap-4">
                {[
                  { label: 'POOL BALANCE', value: poolStats.currentBalance?.toFixed(2) || '0.00', unit: 'SOL' },
                  { label: 'TOTAL MIXED', value: poolStats.totalDeposited?.toFixed(2) || '0.00', unit: 'SOL' },
                  { label: 'TRANSACTIONS', value: (poolStats.depositCount || 0) + (poolStats.withdrawCount || 0), unit: '' },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[10px] text-white/25 tracking-wide mb-1">{label}</p>
                    <p className="text-lg font-mono text-white">
                      {value} {unit && <span className="text-sm text-white/30">{unit}</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* How it works */}
            <div className="lg:col-span-2 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <h4 className="text-white/60 text-sm font-medium mb-4">Privacy Flow</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { icon: Wallet, title: 'Deposit', desc: 'Send SOL with ZK commitment' },
                  { icon: Clock, title: 'Wait', desc: 'Variable delay for privacy' },
                  { icon: Shuffle, title: 'Mix', desc: 'Funds mixed with others' },
                  { icon: EyeOff, title: 'Withdraw', desc: 'Receive on stealth wallet' },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-4 h-4 text-white/40" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{step.title}</p>
                      <p className="text-white/30 text-xs">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'send' && (
          <div className="max-w-xl">
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <h3 className="text-white font-medium mb-4">Send Payment</h3>

              {/* Source wallet indicator */}
              <div className="mb-4 p-3 bg-white/[0.03] rounded-lg flex items-center justify-between">
                <span className="text-white/40 text-sm">Sending from</span>
                <span className="text-white font-medium">
                  {sourceWallet === 'main' ? 'Main Wallet' : 'Stealth Wallet'} ({activeWalletBalance.toFixed(4)} SOL)
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
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.001"
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-lg font-mono focus:border-white/[0.15] transition-colors"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                    {['0.1', '0.5', '1'].map((val) => (
                      <button
                        key={val}
                        onClick={() => setSendAmount(val)}
                        className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                          sendAmount === val
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
                  Privacy Mode
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
                    <p className="text-white font-medium text-sm">ZK Private</p>
                    <p className="text-white/40 text-xs">Light Protocol - sender unlinked</p>
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
                    <p className="text-white font-medium text-sm">Direct</p>
                    <p className="text-white/40 text-xs">Standard transfer - visible</p>
                  </button>
                </div>
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={processing === 'send' || !recipientAddress || parseFloat(sendAmount) <= 0}
                className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing === 'send' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {privacyMode === 'zk' ? 'Creating ZK Proof...' : 'Sending...'}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send {sendAmount} SOL
                  </>
                )}
              </button>

              {/* Privacy note */}
              {sourceWallet === 'stealth' && privacyMode === 'zk' && (
                <div className="mt-4 p-3 bg-white/[0.03] border border-white/[0.08] rounded-lg">
                  <p className="text-xs text-white/50">
                    <strong className="text-white/70">Maximum privacy:</strong> Sending from stealth wallet with ZK proofs.
                    Your main wallet is never linked to this transaction.
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
