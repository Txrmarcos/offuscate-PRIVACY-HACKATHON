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

// Devnet RPC (uses Helius if configured)
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const devnetConnection = new Connection(RPC_URL, 'confirmed');
import { PrivacyLevel } from '../lib/types';
import { generateStealthAddress, parseStealthMetaAddress, StealthAddressResult } from '../lib/stealth';

interface SendPaymentModalProps {
  onClose: () => void;
}

type ModalStep = 'form' | 'processing' | 'success' | 'error';

const privacyOptions: {
  level: PrivacyLevel;
  title: string;
  description: string;
  icon: typeof Eye;
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
    level: 'PRIVATE',
    title: 'Full Privacy',
    description: 'Stealth + Confidential (coming soon).',
    icon: Lock,
  },
];

const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  PUBLIC: 'Public',
  SEMI: 'Stealth',
  PRIVATE: 'Full Privacy',
};

// Memo program ID for storing ephemeral key
const MEMO_PROGRAM_ID = new SolanaPublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export function SendPaymentModal({ onClose }: SendPaymentModalProps) {
  const { publicKey, signTransaction } = useWallet();

  const [step, setStep] = useState<ModalStep>('form');
  const [selectedPrivacy, setSelectedPrivacy] = useState<PrivacyLevel>('SEMI');
  const [recipientMetaAddress, setRecipientMetaAddress] = useState('');
  const [recipientPublicAddress, setRecipientPublicAddress] = useState(''); // For public transfers
  const [amount, setAmount] = useState('0.01');
  const [stealthResult, setStealthResult] = useState<StealthAddressResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Generate stealth address when meta address changes
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

  // Regenerate when meta address changes
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

  // Execute the real transaction
  const executeTransaction = async () => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected or does not support signing');
      return;
    }

    const amountLamports = parseFloat(amount) * LAMPORTS_PER_SOL;
    if (isNaN(amountLamports) || amountLamports <= 0) {
      setError('Invalid amount');
      return;
    }

    setStep('processing');
    setStatusMessage('Preparing transaction...');

    try {
      let destinationPubkey: SolanaPublicKey;
      let memoInstruction: TransactionInstruction | null = null;

      if (selectedPrivacy === 'PUBLIC') {
        // Public transfer - direct to recipient
        if (!recipientPublicAddress) {
          throw new Error('Recipient address required');
        }
        destinationPubkey = new SolanaPublicKey(recipientPublicAddress);
      } else {
        // Stealth transfer - to one-time stealth address
        if (!stealthResult) {
          throw new Error('Stealth address not generated');
        }
        destinationPubkey = stealthResult.stealthAddress;

        // Add memo with ephemeral public key so receiver can find the payment
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

      // Create the transaction
      const transaction = new Transaction();

      // Add transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: destinationPubkey,
          lamports: amountLamports,
        })
      );

      // Add memo if stealth transfer
      if (memoInstruction) {
        transaction.add(memoInstruction);
      }

      // Get recent blockhash from devnet (using explicit devnet connection)
      setStatusMessage('Getting blockhash from devnet...');
      const { blockhash, lastValidBlockHeight } = await devnetConnection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      setStatusMessage('Waiting for wallet signature...');

      // Sign transaction with wallet
      const signedTransaction = await signTransaction(transaction);

      setStatusMessage('Sending to devnet...');

      // Send signed transaction directly to devnet
      // skipPreflight: true to avoid simulation issues
      const signature = await devnetConnection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });

      setStatusMessage('Confirming on devnet...');

      // Wait for confirmation on devnet
      await devnetConnection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      setTxHash(signature);
      setStep('success');
    } catch (err) {
      console.error('Transaction error:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('error');
    }
  };

  const handleContinue = () => {
    if (selectedPrivacy === 'PUBLIC') {
      if (!recipientPublicAddress) {
        setError('Please enter recipient address');
        return;
      }
    } else {
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-[#141414] border border-[#262626] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#737373] hover:text-white transition-colors"
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
              <label className="text-sm text-gray-400 mb-3 block">Privacy Level</label>
              <div className="grid grid-cols-3 gap-2">
                {privacyOptions.map((option) => (
                  <button
                    key={option.level}
                    onClick={() => setSelectedPrivacy(option.level)}
                    disabled={option.level === 'PRIVATE'}
                    className={`relative p-3 rounded-xl border text-left transition-all ${
                      option.level === 'PRIVATE'
                        ? 'border-[#262626] opacity-50 cursor-not-allowed'
                        : selectedPrivacy === option.level
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-[#262626] hover:border-[#404040]'
                    }`}
                  >
                    {selectedPrivacy === option.level && (
                      <span className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full" />
                    )}
                    <option.icon
                      className={`w-4 h-4 mb-2 ${
                        selectedPrivacy === option.level
                          ? 'text-purple-400'
                          : 'text-[#737373]'
                      }`}
                    />
                    <div className="text-white font-medium text-xs mb-1">{option.title}</div>
                    <p className="text-[#737373] text-xs leading-tight">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient - changes based on privacy level */}
            {selectedPrivacy === 'PUBLIC' ? (
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">
                  Recipient Wallet Address
                </label>
                <input
                  type="text"
                  value={recipientPublicAddress}
                  onChange={(e) => setRecipientPublicAddress(e.target.value)}
                  placeholder="Enter Solana address..."
                  className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-3 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
            ) : (
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">
                  Recipient Stealth Meta Address
                </label>
                <input
                  type="text"
                  value={recipientMetaAddress}
                  onChange={(e) => setRecipientMetaAddress(e.target.value)}
                  placeholder="st:ABC123...XYZ:DEF456...UVW"
                  className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-3 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
            )}

            {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

            {/* Amount */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-2 block">Amount (SOL)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-3 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Generated Stealth Address */}
            {selectedPrivacy !== 'PUBLIC' && stealthResult && (
              <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-purple-400">
                    One-Time Stealth Address
                  </span>
                  <button
                    onClick={generateNewStealthAddress}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    New
                  </button>
                </div>

                <div className="bg-[#0a0a0a] rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-white break-all">
                      {stealthResult.stealthAddress.toBase58()}
                    </span>
                    <button
                      onClick={() => handleCopy(stealthResult.stealthAddress.toBase58())}
                      className="ml-2 text-gray-400 hover:text-white flex-shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Funds go here. <span className="text-purple-400">Unique to this payment</span> - unlinkable to recipient.
                </p>
              </div>
            )}

            {/* Transaction Summary */}
            <div className="mb-6 p-3 bg-[#0a0a0a] rounded-lg border border-[#262626]">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">From</span>
                <span className="text-white font-mono">
                  {publicKey ? shortAddress(publicKey.toBase58()) : 'Not connected'}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">To</span>
                <span className="text-purple-400 font-mono">
                  {selectedPrivacy === 'PUBLIC'
                    ? (recipientPublicAddress ? shortAddress(recipientPublicAddress) : '...')
                    : (stealthResult ? shortAddress(stealthResult.stealthAddress.toBase58()) : '...')
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="text-white">{amount} SOL</span>
              </div>
            </div>

            {/* Devnet reminder */}
            <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
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
              disabled={!publicKey || (selectedPrivacy !== 'PUBLIC' && !stealthResult)}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-full transition-colors flex items-center justify-center gap-2"
            >
              {!publicKey ? 'Connect Wallet First' : 'Send Payment'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="py-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-2 border-[#262626] rounded-full" />
              <div className="absolute inset-0 border-2 border-purple-500 rounded-full border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield className="w-8 h-8 text-purple-400" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              Processing
            </h2>
            <p className="text-[#737373] text-sm mb-6">
              {statusMessage}
            </p>

            {stealthResult && (
              <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Sending to Stealth Address</div>
                <div className="font-mono text-sm text-purple-400">
                  {shortAddress(stealthResult.stealthAddress.toBase58())}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <div className="py-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500/30">
              <Check className="w-10 h-10 text-green-400" />
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              Payment Sent!
            </h2>
            <p className="text-[#737373] text-sm mb-6">
              Transaction confirmed on Solana.
            </p>

            <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-4 mb-6 text-left">
              <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                <span className="text-[#737373] text-sm">Privacy</span>
                <div className="flex items-center gap-2 text-purple-400 text-sm">
                  {selectedPrivacy === 'PUBLIC' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {PRIVACY_LABELS[selectedPrivacy]}
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                <span className="text-[#737373] text-sm">Amount</span>
                <span className="text-white text-sm">{amount} SOL</span>
              </div>
              {stealthResult && (
                <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                  <span className="text-[#737373] text-sm">Stealth Address</span>
                  <span className="text-purple-400 text-sm font-mono">
                    {shortAddress(stealthResult.stealthAddress.toBase58())}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <span className="text-[#737373] text-sm">Transaction</span>
                <a
                  href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 text-sm font-mono flex items-center gap-1 hover:text-purple-300"
                >
                  {shortAddress(txHash)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-4 bg-white text-black font-medium rounded-full hover:bg-gray-100 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Step 4: Error */}
        {step === 'error' && (
          <div className="py-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500/30">
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
                className="flex-1 py-3 border border-[#262626] text-white font-medium rounded-full hover:bg-[#1a1a1a] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-full transition-colors"
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
