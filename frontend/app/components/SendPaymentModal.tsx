'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Eye, EyeOff, Lock, ArrowRight, Check, Shield, RefreshCw, Copy, ExternalLink } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  PublicKey as SolanaPublicKey,
  Connection,
} from '@solana/web3.js';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const devnetConnection = new Connection(RPC_URL, 'confirmed');
import { PrivacyLevel } from '../lib/types';
import { generateStealthAddress, parseStealthMetaAddress, StealthAddressResult } from '../lib/stealth';
import { privateZKDonation, type LightWallet } from '../lib/privacy/lightProtocol';
import { triggerOffuscation } from './WaveMeshBackground';

interface SendPaymentModalProps {
  onClose: () => void;
}

type ModalStep = 'form' | 'processing' | 'success' | 'error';

const privacyOptions: {
  level: PrivacyLevel;
  title: string;
  description: string;
  icon: typeof Eye;
  badge?: string;
}[] = [
  {
    level: 'PUBLIC',
    title: 'Public',
    description: 'Standard transfer. Fully visible.',
    icon: Eye,
  },
  {
    level: 'SEMI',
    title: 'Stealth',
    description: 'Receiver hidden via stealth address.',
    icon: EyeOff,
  },
  {
    level: 'ZK_COMPRESSED',
    title: 'ZK Compressed',
    description: 'Light Protocol. Sender link broken.',
    icon: Lock,
    badge: 'Devnet',
  },
  {
    level: 'PRIVATE',
    title: 'Full Privacy',
    description: 'Stealth + Confidential (coming soon).',
    icon: Lock,
    badge: 'Soon',
  },
];

const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  PUBLIC: 'Public',
  SEMI: 'Stealth',
  PRIVATE: 'Full Privacy',
  ZK_COMPRESSED: 'ZK Compressed',
};

const MEMO_PROGRAM_ID = new SolanaPublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export function SendPaymentModal({ onClose }: SendPaymentModalProps) {
  const { publicKey, signTransaction } = useWallet();

  const [step, setStep] = useState<ModalStep>('form');
  const [selectedPrivacy, setSelectedPrivacy] = useState<PrivacyLevel>('SEMI');
  const [recipientMetaAddress, setRecipientMetaAddress] = useState('');
  const [recipientPublicAddress, setRecipientPublicAddress] = useState('');
  const [amount, setAmount] = useState('0.01');
  const [stealthResult, setStealthResult] = useState<StealthAddressResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const generateNewStealthAddress = useCallback(() => {
    const trimmed = recipientMetaAddress.trim();

    if (!trimmed.startsWith('st:')) {
      setStealthResult(null);
      if (trimmed.length > 0 && selectedPrivacy !== 'PUBLIC') {
        setError('Address must start with "st:"');
      } else {
        setError(null);
      }
      return;
    }

    try {
      const metaAddress = parseStealthMetaAddress(trimmed);
      const result = generateStealthAddress(metaAddress);
      setStealthResult(result);
      setError(null);
    } catch (err) {
      console.error('Error generating stealth address:', err);
      setError(err instanceof Error ? err.message : 'Invalid Stealth Meta Address');
      setStealthResult(null);
    }
  }, [recipientMetaAddress, selectedPrivacy]);

  useEffect(() => {
    if (selectedPrivacy !== 'PUBLIC') {
      generateNewStealthAddress();
    } else {
      setError(null);
    }
  }, [recipientMetaAddress, selectedPrivacy, generateNewStealthAddress]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-6)}`;

  const executeTransaction = async () => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected or does not support signing');
      return;
    }

    const amountSol = parseFloat(amount);
    const amountLamports = amountSol * LAMPORTS_PER_SOL;
    if (isNaN(amountLamports) || amountLamports <= 0) {
      setError('Invalid amount');
      return;
    }

    setStep('processing');
    setStatusMessage('Preparing transaction...');

    try {
      // Handle ZK Compressed transfer via Light Protocol
      if (selectedPrivacy === 'ZK_COMPRESSED') {
        if (!recipientPublicAddress) {
          throw new Error('Recipient address required for ZK transfer');
        }

        setStatusMessage('Compressing SOL via Light Protocol...');

        const lightWallet: LightWallet = {
          publicKey,
          signTransaction: signTransaction as any,
        };

        const recipientPubkey = new SolanaPublicKey(recipientPublicAddress);
        const result = await privateZKDonation(lightWallet, recipientPubkey, amountSol);

        if (!result.success) {
          throw new Error(result.error || 'ZK Compressed transfer failed');
        }

        setTxHash(result.signature!);
        setStep('success');
        triggerOffuscation();
        return;
      }

      let destinationPubkey: SolanaPublicKey;
      let memoInstruction: TransactionInstruction | null = null;

      if (selectedPrivacy === 'PUBLIC') {
        if (!recipientPublicAddress) {
          throw new Error('Recipient address required');
        }
        destinationPubkey = new SolanaPublicKey(recipientPublicAddress);
      } else {
        if (!stealthResult) {
          throw new Error('Stealth address not generated');
        }
        destinationPubkey = stealthResult.stealthAddress;

        const memoData = JSON.stringify({
          type: 'stealth',
          ephemeralPubKey: stealthResult.ephemeralPubKey,
        });

        memoInstruction = new TransactionInstruction({
          keys: [],
          programId: MEMO_PROGRAM_ID,
          data: Buffer.from(memoData),
        });
      }

      setStatusMessage('Creating transaction...');

      const transaction = new Transaction();

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: destinationPubkey,
          lamports: amountLamports,
        })
      );

      if (memoInstruction) {
        transaction.add(memoInstruction);
      }

      setStatusMessage('Getting blockhash from devnet...');
      const { blockhash, lastValidBlockHeight } = await devnetConnection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      setStatusMessage('Waiting for wallet signature...');

      const signedTransaction = await signTransaction(transaction);

      setStatusMessage('Sending to devnet...');

      const signature = await devnetConnection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });

      setStatusMessage('Confirming on devnet...');

      await devnetConnection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      setTxHash(signature);
      setStep('success');

      // Trigger offuscation effect on successful transaction
      triggerOffuscation();
    } catch (err) {
      console.error('Transaction error:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('error');
    }
  };

  const handleContinue = () => {
    if (selectedPrivacy === 'PUBLIC' || selectedPrivacy === 'ZK_COMPRESSED') {
      if (!recipientPublicAddress) {
        setError('Please enter recipient address');
        return;
      }
    } else if (selectedPrivacy === 'SEMI') {
      if (!stealthResult) {
        setError('Please enter a valid Stealth Meta Address');
        return;
      }
    }
    executeTransaction();
  };

  const handleRetry = () => {
    setError(null);
    setStep('form');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/[0.06] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step 1: Form */}
        {step === 'form' && (
          <>
            <h2 className="text-xl font-semibold text-white mb-6">
              Send Payment
            </h2>

            {/* Privacy Level */}
            <div className="mb-6">
              <label className="text-[10px] text-white/25 uppercase tracking-wide mb-3 block">Privacy Level</label>
              <div className="grid grid-cols-2 gap-2">
                {privacyOptions.map((option) => (
                  <button
                    key={option.level}
                    onClick={() => setSelectedPrivacy(option.level)}
                    disabled={option.level === 'PRIVATE'}
                    className={`relative p-3 rounded-xl border text-left transition-all ${
                      option.level === 'PRIVATE'
                        ? 'border-white/[0.04] opacity-50 cursor-not-allowed'
                        : selectedPrivacy === option.level
                          ? option.level === 'ZK_COMPRESSED'
                            ? 'border-purple-400 bg-purple-400/[0.05]'
                            : 'border-white bg-white/[0.05]'
                          : 'border-white/[0.06] hover:border-white/[0.1]'
                    }`}
                  >
                    {selectedPrivacy === option.level && (
                      <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                        option.level === 'ZK_COMPRESSED' ? 'bg-purple-400' : 'bg-green-400'
                      }`} />
                    )}
                    {option.badge && (
                      <span className={`absolute top-2 right-6 text-[8px] px-1.5 py-0.5 rounded ${
                        option.level === 'ZK_COMPRESSED'
                          ? 'bg-purple-400/10 text-purple-400'
                          : 'bg-white/10 text-white/40'
                      }`}>
                        {option.badge}
                      </span>
                    )}
                    <option.icon
                      className={`w-4 h-4 mb-2 ${
                        selectedPrivacy === option.level
                          ? option.level === 'ZK_COMPRESSED' ? 'text-purple-400' : 'text-white'
                          : 'text-white/30'
                      }`}
                    />
                    <div className="text-white font-medium text-xs mb-1">{option.title}</div>
                    <p className="text-white/40 text-xs leading-tight">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient */}
            {selectedPrivacy === 'PUBLIC' || selectedPrivacy === 'ZK_COMPRESSED' ? (
              <div className="mb-4">
                <label className="text-[10px] text-white/25 uppercase tracking-wide mb-2 block">
                  Recipient Wallet Address
                </label>
                <input
                  type="text"
                  value={recipientPublicAddress}
                  onChange={(e) => setRecipientPublicAddress(e.target.value)}
                  placeholder="Enter Solana address..."
                  className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-white/[0.1]"
                />
              </div>
            ) : selectedPrivacy === 'SEMI' ? (
              <div className="mb-4">
                <label className="text-[10px] text-white/25 uppercase tracking-wide mb-2 block">
                  Recipient Stealth Meta Address
                </label>
                <input
                  type="text"
                  value={recipientMetaAddress}
                  onChange={(e) => setRecipientMetaAddress(e.target.value)}
                  placeholder="st:ABC123...XYZ:DEF456...UVW"
                  className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-white/[0.1]"
                />
              </div>
            ) : null}

            {/* ZK Compressed Info */}
            {selectedPrivacy === 'ZK_COMPRESSED' && (
              <div className="mb-4 p-3 bg-purple-400/5 border border-purple-400/10 rounded-xl">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-purple-400 text-xs font-medium mb-1">Light Protocol ZK Compression</p>
                    <p className="text-white/40 text-xs">
                      Your SOL is compressed into a Merkle tree. The sender-receiver link is broken via ZK proofs.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

            {/* Amount */}
            <div className="mb-4">
              <label className="text-[10px] text-white/25 uppercase tracking-wide mb-2 block">Amount (SOL)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-white/[0.1]"
              />
            </div>

            {/* Generated Stealth Address */}
            {selectedPrivacy === 'SEMI' && stealthResult && (
              <div className="mb-6 p-4 bg-green-400/5 border border-green-400/10 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-green-400">
                    One-Time Stealth Address
                  </span>
                  <button
                    onClick={generateNewStealthAddress}
                    className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    New
                  </button>
                </div>

                <div className="bg-white/[0.02] rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-white break-all">
                      {stealthResult.stealthAddress.toBase58()}
                    </span>
                    <button
                      onClick={() => handleCopy(stealthResult.stealthAddress.toBase58())}
                      className="ml-2 text-white/30 hover:text-white flex-shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-white/30">
                  Funds go here. <span className="text-green-400">Unique to this payment</span> - unlinkable to recipient.
                </p>
              </div>
            )}

            {/* Transaction Summary */}
            <div className="mb-6 p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/30">From</span>
                <span className="text-white font-mono">
                  {publicKey ? shortAddress(publicKey.toBase58()) : 'Not connected'}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/30">To</span>
                <span className="text-green-400 font-mono">
                  {selectedPrivacy === 'PUBLIC'
                    ? (recipientPublicAddress ? shortAddress(recipientPublicAddress) : '...')
                    : (stealthResult ? shortAddress(stealthResult.stealthAddress.toBase58()) : '...')
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/30">Amount</span>
                <span className="text-white font-mono">{amount} SOL</span>
              </div>
            </div>

            {/* Devnet reminder */}
            <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="text-xs text-yellow-400 text-center">
                Using <span className="font-semibold">Devnet</span> - Get free SOL at{' '}
                <a
                  href="https://faucet.solana.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-yellow-300"
                >
                  faucet.solana.com
                </a>
              </p>
            </div>

            <button
              onClick={handleContinue}
              disabled={
                !publicKey ||
                ((selectedPrivacy === 'PUBLIC' || selectedPrivacy === 'ZK_COMPRESSED') && !recipientPublicAddress) ||
                (selectedPrivacy === 'SEMI' && !stealthResult)
              }
              className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
            >
              {!publicKey ? 'Connect Wallet First' : selectedPrivacy === 'ZK_COMPRESSED' ? 'Send ZK Payment' : 'Send Payment'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="py-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-2 border-white/[0.06] rounded-full" />
              <div className="absolute inset-0 border-2 border-white rounded-full border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield className="w-8 h-8 text-white/60" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              Processing
            </h2>
            <p className="text-white/40 text-sm mb-6">
              {statusMessage}
            </p>

            {stealthResult && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="text-[10px] text-white/25 uppercase tracking-wide mb-1">Sending to Stealth Address</div>
                <div className="font-mono text-sm text-green-400">
                  {shortAddress(stealthResult.stealthAddress.toBase58())}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <div className="py-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-green-400/10 rounded-full flex items-center justify-center border border-green-400/20">
              <Check className="w-10 h-10 text-green-400" />
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              Payment Sent!
            </h2>
            <p className="text-white/40 text-sm mb-6">
              Transaction confirmed on Solana.
            </p>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-6 text-left">
              <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                <span className="text-white/30 text-sm">Privacy</span>
                <div className="flex items-center gap-2 text-white text-sm">
                  {selectedPrivacy === 'PUBLIC' ? <Eye className="w-4 h-4 text-white/40" /> : <EyeOff className="w-4 h-4 text-white/40" />}
                  {PRIVACY_LABELS[selectedPrivacy]}
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                <span className="text-white/30 text-sm">Amount</span>
                <span className="text-white text-sm font-mono">{amount} SOL</span>
              </div>
              {stealthResult && (
                <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                  <span className="text-white/30 text-sm">Stealth Address</span>
                  <span className="text-green-400 text-sm font-mono">
                    {shortAddress(stealthResult.stealthAddress.toBase58())}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <span className="text-white/30 text-sm">Transaction</span>
                <a
                  href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/40 hover:text-white text-sm font-mono flex items-center gap-1"
                >
                  {shortAddress(txHash)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        )}

        {/* Step 4: Error */}
        {step === 'error' && (
          <div className="py-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <X className="w-10 h-10 text-red-400" />
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              Transaction Failed
            </h2>
            <p className="text-red-400 text-sm mb-6">
              {error}
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 border border-white/[0.06] text-white font-medium rounded-xl hover:bg-white/[0.03] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
