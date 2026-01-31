'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Wallet,
  Users,
  TrendingUp,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Send,
  Clock,
  Shield,
  DollarSign,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { useProgram } from '../lib/program';
import { useStealth } from '../lib/stealth/StealthContext';
import { privateZKDonation, privateZKDonationRelayed, privateTransferWithFee, getRelayerPublicKey, type LightWallet, type TwoTxTransferResult } from '../lib/privacy/lightProtocol';
import { TransactionResult } from '../components/TransactionResult';
import { calculateRelayerFee, type FeeBreakdown } from '../lib/config/relayerFees';
import { triggerOffuscation } from '../components/WaveMeshBackground';
import { generateStealthAddress, parseStealthMetaAddress } from '../lib/stealth';
import { StealthPaymentScanner } from '../components/StealthPaymentScanner';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

type SelectedWallet = 'all' | 'main' | 'private';
type RecipientType = 'public' | 'stealth';

// Circular progress component
function CircularProgress({
  percentage,
  size = 200,
  strokeWidth = 12,
  color = 'white',
  secondaryPercentage,
  secondaryColor = 'rgba(255,255,255,0.3)',
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  secondaryPercentage?: number;
  secondaryColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const secondaryOffset = secondaryPercentage !== undefined
    ? circumference - (secondaryPercentage / 100) * circumference
    : circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Secondary progress (private wallet) */}
      {secondaryPercentage !== undefined && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={secondaryColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={secondaryOffset}
          className="transition-all duration-1000 ease-out"
        />
      )}
      {/* Primary progress (main wallet) */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

export default function TreasuryPage() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { stealthKeys, isLoading: keysLoading, deriveKeysFromWallet } = useStealth();
  const {
    listMyBatches,
    isMasterVaultInitialized,
  } = useProgram();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [mainBalance, setMainBalance] = useState(0);
  const [stealthBalance, setStealthBalance] = useState(0);
  const [privateKeypair, setPrivateKeypair] = useState<Keypair | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Selected wallet for chart filter
  const [selectedWallet, setSelectedWallet] = useState<SelectedWallet>('all');

  // Payment state
  const [showPayment, setShowPayment] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('0.1');
  const [recipientType, setRecipientType] = useState<RecipientType>('stealth');
  const [useZK, setUseZK] = useState(false); // ZK to hide amount
  const [useRelayer, setUseRelayer] = useState(false); // Relayer to hide fee payer
  const [relayerAvailable, setRelayerAvailable] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<TwoTxTransferResult | null>(null);

  // Payroll stats
  const [payrollStats, setPayrollStats] = useState({
    totalEmployees: 0,
    totalFunded: 0,
    totalPaid: 0,
    activeBatches: 0,
  });

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

  // Check if relayer is available
  useEffect(() => {
    const checkRelayer = async () => {
      const relayerPubkey = await getRelayerPublicKey();
      setRelayerAvailable(!!relayerPubkey);
    };
    checkRelayer();
  }, []);

  // Fetch all data
  const refreshData = useCallback(async () => {
    if (!publicKey) return;

    setIsLoading(true);
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
      const initialized = await isMasterVaultInitialized();
      if (initialized) {
        const batches = await listMyBatches();

        // Calculate stats from user's own batches
        setPayrollStats({
          totalEmployees: batches.reduce((sum, b) => sum + b.employeeCount, 0),
          totalFunded: batches.reduce((sum, b) => sum + b.totalBudget, 0) / LAMPORTS_PER_SOL,
          totalPaid: batches.reduce((sum, b) => sum + b.totalPaid, 0) / LAMPORTS_PER_SOL,
          activeBatches: batches.filter((b) => b.status === 'Active').length,
        });
      }
    } catch {}

    setIsLoading(false);
  }, [publicKey, privateKeypair, listMyBatches, isMasterVaultInitialized]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Copy to clipboard
  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
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

    // Check balance
    const sourceBalance = selectedWallet === 'private' ? stealthBalance : mainBalance;
    if (amount > sourceBalance) {
      setError('Insufficient balance');
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);
    setTxSignature(null);
    setTxResult(null);

    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      const senderKeypair = selectedWallet === 'private' ? privateKeypair : null;
      const senderPubkey = selectedWallet === 'private' ? privateKeypair!.publicKey : publicKey;

      if (recipientType === 'stealth') {
        // Parse stealth meta address
        let stealthMeta;
        try {
          stealthMeta = parseStealthMetaAddress(recipientAddress);
        } catch {
          throw new Error('Invalid stealth address format. Expected: st:<viewPubKey>:<spendPubKey>');
        }

        // Generate one-time stealth address
        const { stealthAddress, ephemeralPubKey } = generateStealthAddress(stealthMeta);

        if (useZK) {
          // MAXIMUM PRIVACY: ZK + Stealth (+ optional Relayer)
          // 1. Send ZK compressed transfer to stealth address (hides sender & amount)
          // 2. If relayer enabled, fee payer is also hidden
          // 3. Send separate memo with ephemeral pubkey (so recipient can claim)

          const lightWallet: LightWallet = {
            publicKey: selectedWallet === 'private' ? privateKeypair!.publicKey : publicKey,
            signTransaction: selectedWallet === 'private'
              ? async (tx: Transaction) => {
                  tx.sign(privateKeypair!);
                  return tx;
                }
              : signTransaction as any,
          };

          // ZK transfer to stealth address (with or without relayer)
          if (useRelayer) {
            // Two-transaction model: fee goes to relayer, then transfer to recipient
            const result = await privateTransferWithFee(lightWallet, stealthAddress, amount);

            if (!result.success) {
              throw new Error(result.error || 'ZK payment failed');
            }

            // Store full result for display
            setTxResult(result);
            setTxSignature(result.transferSignature || null);
            setSuccess(`Sent with ULTIMATE PRIVACY! Recipient receives ${result.feeBreakdown.recipientAmount.toFixed(4)} SOL`);
          } else {
            // Single transaction (no relayer)
            const result = await privateZKDonation(lightWallet, stealthAddress, amount);

            if (!result.success) {
              throw new Error(result.error || 'ZK payment failed');
            }

            setTxSignature(result.signature!);
            setSuccess(`Sent ${amount} SOL with MAXIMUM PRIVACY (sender, recipient & amount hidden!)`);
          }

          // Send memo with ephemeral pubkey in separate transaction
          // This allows recipient to find and claim the funds
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          const memoTx = new Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: senderPubkey,
          });

          const memoData = `stealth:${ephemeralPubKey}`;
          memoTx.add(
            new TransactionInstruction({
              keys: [],
              programId: MEMO_PROGRAM_ID,
              data: Buffer.from(memoData, 'utf-8'),
            })
          );

          // Sign and send memo
          if (selectedWallet === 'private' && senderKeypair) {
            memoTx.sign(senderKeypair);
            await connection.sendRawTransaction(memoTx.serialize());
          } else {
            const signedMemoTx = await signTransaction(memoTx);
            await connection.sendRawTransaction(signedMemoTx.serialize());
          }

          triggerOffuscation();
        } else {
          // Stealth only (no ZK) - amount visible
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          const tx = new Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: senderPubkey,
          });

          // Transfer to stealth address
          tx.add(
            SystemProgram.transfer({
              fromPubkey: senderPubkey,
              toPubkey: stealthAddress,
              lamports: Math.floor(amount * LAMPORTS_PER_SOL),
            })
          );

          // Add memo with ephemeral public key so recipient can find and claim
          const memoData = `stealth:${ephemeralPubKey}`;
          tx.add(
            new TransactionInstruction({
              keys: [],
              programId: MEMO_PROGRAM_ID,
              data: Buffer.from(memoData, 'utf-8'),
            })
          );

          let signature: string;
          if (selectedWallet === 'private' && senderKeypair) {
            tx.sign(senderKeypair);
            signature = await connection.sendRawTransaction(tx.serialize());
          } else {
            const signedTx = await signTransaction(tx);
            signature = await connection.sendRawTransaction(signedTx.serialize());
          }

          await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

          setTxSignature(signature);
          setSuccess(`Sent ${amount} SOL to stealth address (recipient hidden!)`);
          triggerOffuscation();
        }
      } else {
        // Public address
        let recipient: PublicKey;
        try {
          recipient = new PublicKey(recipientAddress);
        } catch {
          throw new Error('Invalid recipient address');
        }

        if (useZK) {
          // ZK compressed transfer - hides sender and amount (+ optional relayer for fee payer)
          const lightWallet: LightWallet = {
            publicKey: selectedWallet === 'private' ? privateKeypair!.publicKey : publicKey,
            signTransaction: selectedWallet === 'private'
              ? async (tx: Transaction) => {
                  tx.sign(privateKeypair!);
                  return tx;
                }
              : signTransaction as any,
          };

          if (useRelayer) {
            // Two-transaction model with fee
            const result = await privateTransferWithFee(lightWallet, recipient, amount);

            if (!result.success) {
              throw new Error(result.error || 'ZK payment failed');
            }

            setTxResult(result);
            setTxSignature(result.transferSignature || null);
            setSuccess(`Sent with FULL PRIVACY! Recipient receives ${result.feeBreakdown.recipientAmount.toFixed(4)} SOL`);
          } else {
            // Single transaction (no relayer)
            const result = await privateZKDonation(lightWallet, recipient, amount);

            if (!result.success) {
              throw new Error(result.error || 'ZK payment failed');
            }

            setTxSignature(result.signature!);
            setSuccess(`Sent ${amount} SOL with ZK privacy (sender & amount hidden)`);
          }
          triggerOffuscation();
        } else {
          // Direct transfer
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
          if (selectedWallet === 'private' && senderKeypair) {
            tx.sign(senderKeypair);
            signature = await connection.sendRawTransaction(tx.serialize());
          } else {
            const signedTx = await signTransaction(tx);
            signature = await connection.sendRawTransaction(signedTx.serialize());
          }

          await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

          setTxSignature(signature);
          setSuccess(`Sent ${amount} SOL`);
        }
      }

      setRecipientAddress('');
      setPaymentAmount('0.1');
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  // Calculate display values based on selected wallet
  const getDisplayBalance = () => {
    if (selectedWallet === 'main') return mainBalance;
    if (selectedWallet === 'private') return stealthBalance;
    return mainBalance + stealthBalance;
  };

  const getChartPercentage = () => {
    const total = mainBalance + stealthBalance;
    if (total === 0) return 50;
    if (selectedWallet === 'main') return 100;
    if (selectedWallet === 'private') return 100;
    return (mainBalance / total) * 100;
  };

  const fundedPercentage = payrollStats.totalFunded > 0
    ? ((payrollStats.totalFunded - payrollStats.totalPaid) / payrollStats.totalFunded) * 100
    : 0;

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
            Manage your company's treasury and payroll funds.
          </p>
          <p className="text-white/25 text-sm mb-8">
            Connect your wallet to view balances and manage funds.
          </p>
          <button
            onClick={() => setVisible(true)}
            className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all flex items-center gap-2 mx-auto"
          >
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // Setup stealth keys
  if (!stealthKeys && !keysLoading) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <Shield className="w-10 h-10 text-white/60" />
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

  return (
    <div className="min-h-screen px-6 py-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-white/40 text-sm mb-1">Welcome back</p>
            <h1 className="text-3xl font-bold text-white">Treasury Overview</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPayment(!showPayment)}
              className={`h-11 px-5 text-sm font-medium rounded-2xl transition-all flex items-center gap-2 ${
                showPayment
                  ? 'bg-white text-black'
                  : 'bg-white/[0.03] border border-white/[0.06] text-white hover:bg-white/[0.05]'
              }`}
            >
              <Send className="w-4 h-4" />
              Send Payment
            </button>
            <button
              onClick={refreshData}
              disabled={isLoading}
              className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.05] transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Payment Panel */}
        {showPayment && (
          <div className="mb-8 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
            <h3 className="text-white font-medium mb-4">Send Payment</h3>

            {/* Source Wallet Selection */}
            <div className="mb-4">
              <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-2">
                From Wallet
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedWallet('main')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedWallet === 'main' || selectedWallet === 'all'
                      ? 'bg-white/[0.05] border-white/[0.15]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-white/40" />
                    <span className="text-white font-medium text-sm">Main Wallet</span>
                  </div>
                  <p className="text-white font-mono">{mainBalance.toFixed(4)} SOL</p>
                </button>
                <button
                  onClick={() => setSelectedWallet('private')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedWallet === 'private'
                      ? 'bg-white/[0.05] border-white/[0.15]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <EyeOff className="w-4 h-4 text-white/40" />
                    <span className="text-white font-medium text-sm">Offuscate Wallet</span>
                  </div>
                  <p className="text-white font-mono">{stealthBalance.toFixed(4)} SOL</p>
                </button>
              </div>
            </div>

            {/* Recipient Type */}
            <div className="mb-4">
              <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-2">
                Recipient Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setRecipientType('stealth');
                    setRecipientAddress('');
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    recipientType === 'stealth'
                      ? 'bg-white/[0.05] border-white/[0.15]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                  }`}
                >
                  <EyeOff className={`w-5 h-5 mb-2 ${recipientType === 'stealth' ? 'text-white' : 'text-white/30'}`} />
                  <p className="text-white font-medium text-sm">Stealth Address</p>
                  <p className="text-white/40 text-xs">Recipient hidden on-chain</p>
                </button>
                <button
                  onClick={() => {
                    setRecipientType('public');
                    setRecipientAddress('');
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    recipientType === 'public'
                      ? 'bg-white/[0.05] border-white/[0.15]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                  }`}
                >
                  <Eye className={`w-5 h-5 mb-2 ${recipientType === 'public' ? 'text-white' : 'text-white/30'}`} />
                  <p className="text-white font-medium text-sm">Public Address</p>
                  <p className="text-white/40 text-xs">Recipient visible on-chain</p>
                </button>
              </div>
            </div>

            {/* Recipient Address */}
            <div className="mb-4">
              <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-2">
                {recipientType === 'stealth' ? 'Stealth Meta Address' : 'Recipient Address'}
              </label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder={recipientType === 'stealth'
                  ? 'st:viewPubKey:spendPubKey...'
                  : 'Enter Solana address...'}
                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-white/[0.15] transition-colors"
              />
              {recipientType === 'stealth' && (
                <p className="text-white/30 text-xs mt-2">
                  Ask the recipient for their stealth meta address (format: st:viewPubKey:spendPubKey)
                </p>
              )}
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

            {/* ZK Toggle - available for both recipient types */}
            <div className="mb-4">
              <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-2">
                ZK Compression (Hide Sender & Amount)
              </label>
              <button
                onClick={() => setUseZK(!useZK)}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
                  useZK
                    ? 'bg-white/[0.08] border-white/[0.2]'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className={`w-5 h-5 ${useZK ? 'text-white' : 'text-white/30'}`} />
                    <div>
                      <p className="text-white font-medium text-sm">
                        {useZK ? 'ZK Enabled' : 'ZK Disabled'}
                      </p>
                      <p className="text-white/40 text-xs">
                        {useZK
                          ? 'Sender & Amount hidden via ZK proof'
                          : 'Sender & Amount visible on-chain'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-all ${
                    useZK ? 'bg-white' : 'bg-white/20'
                  }`}>
                    <div className={`w-4 h-4 mt-1 rounded-full transition-all ${
                      useZK ? 'ml-5 bg-black' : 'ml-1 bg-white'
                    }`} />
                  </div>
                </div>
              </button>
            </div>

            {/* Relayer Toggle - only visible when ZK is enabled */}
            {useZK && (
              <div className="mb-4">
                <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-2">
                  Full Privacy Mode (Hide Fee Payer)
                </label>
                <button
                  onClick={() => setUseRelayer(!useRelayer)}
                  disabled={!relayerAvailable}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    useRelayer
                      ? 'bg-white/[0.08] border-white/[0.2]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                  } ${!relayerAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Shield className={`w-5 h-5 ${useRelayer ? 'text-white' : 'text-white/30'}`} />
                      <div>
                        <p className="text-white font-medium text-sm">
                          {useRelayer ? 'Full Privacy Enabled' : 'Standard Privacy'}
                        </p>
                        <p className="text-white/40 text-xs">
                          {!relayerAvailable
                            ? 'Relayer not configured on server'
                            : useRelayer
                            ? 'Relayer pays gas • 0.5% privacy fee applies'
                            : 'Your wallet pays gas (visible on-chain)'}
                        </p>
                      </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-all ${
                      useRelayer ? 'bg-white' : 'bg-white/20'
                    }`}>
                      <div className={`w-4 h-4 mt-1 rounded-full transition-all ${
                        useRelayer ? 'ml-5 bg-black' : 'ml-1 bg-white'
                      }`} />
                    </div>
                  </div>
                </button>
                {/* Fee info when relayer is enabled */}
                {useRelayer && amount > 0 && (
                  <div className="mt-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-orange-400/80 text-xs">
                      <Shield className="w-3 h-3" />
                      <span>Privacy fee: {(amount * 0.005).toFixed(4)} SOL (0.5%)</span>
                    </div>
                    <p className="text-orange-400/60 text-[10px] mt-1">
                      Recipient receives: {(amount * 0.995).toFixed(4)} SOL
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Privacy Summary */}
            <div className={`mb-6 p-4 rounded-xl border transition-all ${
              recipientType === 'stealth' && useZK
                ? 'bg-white/[0.05] border-white/[0.15]'
                : 'bg-white/[0.02] border-white/[0.06]'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <Shield className={`w-5 h-5 ${
                  recipientType === 'stealth' && useZK
                    ? 'text-white'
                    : (selectedWallet === 'private' || useZK) && (recipientType === 'stealth' || useZK)
                    ? 'text-white/70'
                    : 'text-white/40'
                }`} />
                <span className="text-white font-medium text-sm">Privacy Summary</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Sender</span>
                  <span className={
                    selectedWallet === 'private' || useZK
                      ? 'text-white'
                      : 'text-white/30'
                  }>
                    {useZK
                      ? '✓ Hidden (ZK Proof)'
                      : selectedWallet === 'private'
                      ? '✓ Hidden (Offuscate Wallet)'
                      : '✗ Visible'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Recipient</span>
                  <span className={recipientType === 'stealth' ? 'text-white' : 'text-white/30'}>
                    {recipientType === 'stealth'
                      ? '✓ Hidden (Stealth Address)'
                      : '✗ Visible'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Amount</span>
                  <span className={useZK ? 'text-white' : 'text-white/30'}>
                    {useZK
                      ? '✓ Hidden (ZK Compressed)'
                      : '✗ Visible'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Fee Payer</span>
                  <span className={useZK && useRelayer ? 'text-white' : 'text-white/30'}>
                    {useZK && useRelayer
                      ? '✓ Hidden (Relayer)'
                      : '✗ Visible'}
                  </span>
                </div>
              </div>

              {/* Privacy Score */}
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                {recipientType === 'stealth' && useZK && useRelayer ? (
                  <p className="text-white text-xs font-medium">
                    ULTIMATE PRIVACY - Sender, Recipient, Amount & Fee Payer ALL hidden!
                  </p>
                ) : recipientType === 'stealth' && useZK ? (
                  <p className="text-white text-xs font-medium">
                    MAXIMUM PRIVACY - Sender, Recipient & Amount hidden (enable Relayer for fee payer)
                  </p>
                ) : (selectedWallet === 'private' || useZK) && recipientType === 'stealth' ? (
                  <p className="text-white/70 text-xs font-medium">
                    High Privacy - Sender & Recipient hidden (enable ZK for amount)
                  </p>
                ) : useZK ? (
                  <p className="text-white/70 text-xs font-medium">
                    High Privacy - Sender & Amount hidden (use Stealth for recipient)
                  </p>
                ) : (
                  <p className="text-white/40 text-xs">
                    Enable ZK and/or Stealth Address for better privacy
                  </p>
                )}
              </div>
            </div>

            {/* Pay button */}
            <button
              onClick={handlePayment}
              disabled={processing || !recipientAddress || parseFloat(paymentAmount) <= 0}
              className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {recipientType === 'stealth'
                    ? 'Generating Stealth Address...'
                    : useZK && useRelayer
                    ? 'Creating ZK Proof via Relayer...'
                    : useZK
                    ? 'Creating ZK Proof...'
                    : 'Processing...'}
                </>
              ) : (
                <>
                  {recipientType === 'stealth' || useZK ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send {paymentAmount} SOL
                  {recipientType === 'stealth' || useZK ? ' Privately' : ''}
                </>
              )}
            </button>

            {/* Messages */}
            {error && (
              <div className="mt-4 p-3 bg-white/[0.03] border border-white/[0.1] rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-white/60" />
                <p className="text-white/60 text-sm">{error}</p>
              </div>
            )}

            {/* Transaction Result with Fee Breakdown */}
            {txResult && (
              <div className="mt-4">
                <TransactionResult
                  success={txResult.success}
                  feeSignature={txResult.feeSignature}
                  transferSignature={txResult.transferSignature}
                  feeBreakdown={txResult.feeBreakdown}
                  error={txResult.error}
                  failedStep={txResult.failedStep}
                  onClose={() => setTxResult(null)}
                  showPrivacyInfo={true}
                />
              </div>
            )}

            {/* Simple success message (for non-relayer transfers) */}
            {success && !txResult && (
              <div className="mt-4 p-3 bg-white/[0.05] border border-white/[0.15] rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-white" />
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
        )}

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Total Balance Card with Chart */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08]">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-white/40 text-sm mb-1">
                  {selectedWallet === 'all' ? 'Total Balance' :
                   selectedWallet === 'main' ? 'Main Wallet' : 'Offuscate Wallet'}
                </p>
                <h2 className="text-4xl font-bold text-white">
                  {getDisplayBalance().toFixed(4)}
                  <span className="text-lg text-white/40 ml-2">SOL</span>
                </h2>
              </div>
              <button
                onClick={() => setSelectedWallet('all')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                  selectedWallet === 'all'
                    ? 'bg-white/[0.08] border border-white/[0.15]'
                    : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05]'
                }`}
              >
                <TrendingUp className={`w-3.5 h-3.5 ${selectedWallet === 'all' ? 'text-white' : 'text-white/40'}`} />
                <span className={`text-xs font-medium ${selectedWallet === 'all' ? 'text-white' : 'text-white/40'}`}>
                  View All
                </span>
              </button>
            </div>

            <div className="flex items-center gap-8">
              {/* Circular Chart */}
              <div className="relative">
                <CircularProgress
                  percentage={selectedWallet === 'private' ? 0 : getChartPercentage()}
                  secondaryPercentage={selectedWallet === 'main' ? undefined : (selectedWallet === 'private' ? 100 : 100)}
                  size={160}
                  strokeWidth={14}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {selectedWallet === 'main' ? (
                    <Wallet className="w-6 h-6 text-white/60 mb-1" />
                  ) : selectedWallet === 'private' ? (
                    <EyeOff className="w-6 h-6 text-white/40 mb-1" />
                  ) : (
                    <DollarSign className="w-6 h-6 text-white/40 mb-1" />
                  )}
                  <span className="text-xs text-white/30">
                    {selectedWallet === 'all' ? 'Total' : selectedWallet === 'main' ? 'Main' : 'Offuscate'}
                  </span>
                </div>
              </div>

              {/* Wallet Cards - Clickable */}
              <div className="flex-1 space-y-4">
                <button
                  onClick={() => setSelectedWallet(selectedWallet === 'main' ? 'all' : 'main')}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                    selectedWallet === 'main'
                      ? 'bg-white/[0.08] ring-2 ring-white/20'
                      : 'bg-white/[0.03] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${selectedWallet === 'main' ? 'bg-white' : 'bg-white/60'}`} />
                    <div className="text-left">
                      <p className="text-white font-medium">Main Wallet</p>
                      <p className="text-white/40 text-xs font-mono">
                        {publicKey?.toBase58().slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-mono">{mainBalance.toFixed(4)}</p>
                    <p className="text-white/30 text-xs">SOL</p>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedWallet(selectedWallet === 'private' ? 'all' : 'private')}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                    selectedWallet === 'private'
                      ? 'bg-white/[0.08] ring-2 ring-white/20'
                      : 'bg-white/[0.03] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${selectedWallet === 'private' ? 'bg-white/60' : 'bg-white/30'}`} />
                    <div className="text-left">
                      <p className="text-white font-medium">Offuscate Wallet</p>
                      <p className="text-white/40 text-xs">Stealth operations</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-mono">{stealthBalance.toFixed(4)}</p>
                    <p className="text-white/30 text-xs">SOL</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <Link
              href="/payroll"
              className="flex items-center gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center group-hover:bg-white/[0.08] transition-all">
                <Users className="w-5 h-5 text-white/60" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Manage Payroll</p>
                <p className="text-white/40 text-xs">Add employees, fund batches</p>
              </div>
              <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white/40 transition-all" />
            </Link>

            <Link
              href="/pool"
              className="flex items-center gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center group-hover:bg-white/[0.08] transition-all">
                <Shield className="w-5 h-5 text-white/60" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Privacy Pool</p>
                <p className="text-white/40 text-xs">Deposit, withdraw privately</p>
              </div>
              <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white/40 transition-all" />
            </Link>

            <Link
              href="/dashboard"
              className="flex items-center gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center group-hover:bg-white/[0.08] transition-all">
                <Clock className="w-5 h-5 text-white/60" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Activity</p>
                <p className="text-white/40 text-xs">View transaction history</p>
              </div>
              <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white/40 transition-all" />
            </Link>
          </div>
        </div>

        {/* Payroll Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-white/30" />
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Employees</span>
            </div>
            <p className="text-3xl font-bold text-white">{payrollStats.totalEmployees}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-white/30" />
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Batches</span>
            </div>
            <p className="text-3xl font-bold text-white">{payrollStats.activeBatches}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-white/30" />
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Funded</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {payrollStats.totalFunded.toFixed(2)}
              <span className="text-sm text-white/30 ml-1">SOL</span>
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-white/30" />
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Paid Out</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {payrollStats.totalPaid.toFixed(2)}
              <span className="text-sm text-white/30 ml-1">SOL</span>
            </p>
          </div>
        </div>

        {/* Payroll Budget Visualization */}
        {payrollStats.totalFunded > 0 && (
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-medium">Payroll Budget</h3>
                <p className="text-white/40 text-sm">Remaining funds for employee salaries</p>
              </div>
              <div className="text-right">
                <p className="text-white font-mono text-lg">
                  {(payrollStats.totalFunded - payrollStats.totalPaid).toFixed(4)} SOL
                </p>
                <p className="text-white/30 text-xs">remaining of {payrollStats.totalFunded.toFixed(2)} SOL</p>
              </div>
            </div>

            <div className="h-3 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-white to-white/60 rounded-full transition-all duration-1000"
                style={{ width: `${fundedPercentage}%` }}
              />
            </div>

            <div className="flex justify-between mt-2 text-xs text-white/30">
              <span>{fundedPercentage.toFixed(0)}% remaining</span>
              <span>{(100 - fundedPercentage).toFixed(0)}% paid</span>
            </div>
          </div>
        )}

        {/* Wallet Addresses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-white/40" />
                <span className="text-sm text-white/60">Main Wallet</span>
              </div>
              <button
                onClick={() => handleCopy(publicKey?.toBase58() || '', 'main')}
                className="text-white/30 hover:text-white/60 transition-all"
              >
                {copied === 'main' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-white font-mono text-sm truncate">{publicKey?.toBase58()}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-white/40" />
                <span className="text-sm text-white/60">Offuscate Wallet</span>
              </div>
              <button
                onClick={() => handleCopy(privateKeypair?.publicKey.toBase58() || '', 'private')}
                className="text-white/30 hover:text-white/60 transition-all"
              >
                {copied === 'private' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-white font-mono text-sm truncate">{privateKeypair?.publicKey.toBase58()}</p>
          </div>
        </div>

        {/* Incoming Stealth Payments Scanner */}
        <div className="mt-8">
          <StealthPaymentScanner />
        </div>
      </div>
    </div>
  );
}
