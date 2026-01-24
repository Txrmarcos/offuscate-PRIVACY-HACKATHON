'use client';

import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Lock, ArrowRight, Loader2, CheckCircle, ExternalLink, Clock, Shield } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useConnection } from '@solana/wallet-adapter-react';
import {
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  PublicKey,
} from '@solana/web3.js';
import { Campaign, PrivacyLevel } from '../lib/types';
import { useProgram, getCampaignPDAs } from '../lib/program';
import { ALLOWED_WITHDRAW_AMOUNTS, WITHDRAW_DELAY_SECONDS } from '../lib/program/client';
import {
  generateStealthAddress,
  parseStealthMetaAddress,
} from '../lib/stealth';
import { privateDonation, type ShadowWireWallet } from '../lib/privacy/shadowWire';
import { triggerOffuscation } from './WaveMeshBackground';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const POOL_AMOUNTS = [0.1, 0.5, 1.0];

interface DonationModalProps {
  campaign: Campaign;
  onClose: () => void;
}

const privacyOptions: {
  level: PrivacyLevel;
  title: string;
  description: string;
  icon: typeof Eye;
}[] = [
  {
    level: 'PUBLIC',
    title: 'Public',
    description: 'Standard transfer. Fully visible on explorer.',
    icon: Eye,
  },
  {
    level: 'SEMI',
    title: 'Privacy Pool',
    description: 'Unlinkable. Funds mixed in pool with delay.',
    icon: Shield,
  },
  {
    level: 'PRIVATE',
    title: 'Fully Private',
    description: 'ZK Proof via ShadowWire. Amount hidden.',
    icon: Lock,
  },
];

export function DonationModal({ campaign, onClose }: DonationModalProps) {
  const [selectedPrivacy, setSelectedPrivacy] = useState<PrivacyLevel>('PUBLIC');
  const [amount, setAmount] = useState('0.1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [stealthAddress, setStealthAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaignMetaAddress, setCampaignMetaAddress] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const { connected, publicKey, signTransaction, signMessage } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const { donate, fetchCampaign, isConnected, poolDeposit, fetchPoolStats, isPoolInitialized, initPool } = useProgram();
  const [poolBalance, setPoolBalance] = useState<number | null>(null);
  const [poolInitialized, setPoolInitialized] = useState(false);

  useEffect(() => {
    const loadCampaignMeta = async () => {
      setLoadingMeta(true);
      try {
        const campaignData = await fetchCampaign(campaign.id);
        if (campaignData?.stealthMetaAddress && campaignData.stealthMetaAddress.length > 0) {
          setCampaignMetaAddress(campaignData.stealthMetaAddress);
        }
      } catch (err) {
        console.error('Failed to load campaign meta:', err);
      } finally {
        setLoadingMeta(false);
      }
    };
    loadCampaignMeta();
  }, [campaign.id, fetchCampaign]);

  useEffect(() => {
    const checkPool = async () => {
      try {
        const initialized = await isPoolInitialized();
        setPoolInitialized(initialized);
        if (initialized) {
          const stats = await fetchPoolStats();
          if (stats) {
            setPoolBalance(stats.currentBalance);
          }
        }
      } catch (err) {
        setPoolInitialized(false);
      }
    };
    checkPool();
  }, [isPoolInitialized, fetchPoolStats]);

  const handleDonate = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setVisible(true);
      return;
    }

    if (!isConnected) {
      setError('Wallet not connected');
      return;
    }

    const amountSol = parseFloat(amount);
    if (isNaN(amountSol) || amountSol <= 0) {
      setError('Invalid amount');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (selectedPrivacy === 'PRIVATE') {
        const { vaultPda } = getCampaignPDAs(campaign.id);
        const vaultAddress = vaultPda.toBase58();

        if (!signMessage || !signTransaction) {
          setError('Your wallet does not support required signing.');
          setIsProcessing(false);
          return;
        }

        const shadowWallet: ShadowWireWallet = {
          publicKey: publicKey!,
          signMessage: signMessage,
          signTransaction: signTransaction as any,
        };

        const result = await privateDonation(shadowWallet, vaultAddress, amountSol);

        if (!result.success) {
          throw new Error(result.error || 'Private donation failed');
        }

        setTxSignature(result.signature!);
        setIsDone(true);
        triggerOffuscation();

      } else if (selectedPrivacy === 'SEMI') {
        if (!poolInitialized) {
          try {
            await initPool();
            setPoolInitialized(true);
          } catch (err: any) {
            if (!err.message?.includes('already in use')) {
              throw err;
            }
          }
        }

        const sig = await poolDeposit(amountSol);
        setTxSignature(sig);
        setIsDone(true);
        triggerOffuscation();

      } else {
        const sig = await donate(campaign.id, amountSol);
        setTxSignature(sig);
        setIsDone(true);
        triggerOffuscation();
      }
    } catch (err: any) {
      console.error('Donation failed:', err);
      setError(err.message || 'Donation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isDone && txSignature) {
    const isPoolDonation = selectedPrivacy === 'SEMI';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md bg-[#0a0a0a] border border-white/[0.06] rounded-2xl p-6 text-center">
          <div className={`w-16 h-16 ${isPoolDonation ? 'bg-green-400/10 border-green-400/20' : 'bg-green-400/10 border-green-400/20'} border rounded-full flex items-center justify-center mx-auto mb-4`}>
            {isPoolDonation ? (
              <Shield className="w-8 h-8 text-green-400" />
            ) : (
              <CheckCircle className="w-8 h-8 text-green-400" />
            )}
          </div>

          <h2 className="text-xl font-semibold text-white mb-2">
            {isPoolDonation ? 'Privacy Pool Deposit!' :
             stealthAddress ? 'Stealth Donation Sent!' : 'Donation Sent!'}
          </h2>
          <p className="text-white/40 mb-4">
            {amount} SOL {isPoolDonation ? 'deposited to privacy pool' : `sent to ${campaign.title}`}
          </p>

          {isPoolDonation && (
            <div className="bg-green-400/5 border border-green-400/10 rounded-xl p-4 mb-4 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-green-400" />
                <p className="text-green-400 text-sm font-medium">Unlinkable Donation</p>
              </div>
              <p className="text-white/40 text-xs mb-2">
                Your donation is now mixed in the privacy pool. The link between your wallet and this campaign is broken.
              </p>
              <div className="flex items-center gap-2 text-xs text-white/30">
                <span>Withdrawal delay:</span>
                <span className="text-green-400 font-mono">{WITHDRAW_DELAY_SECONDS}s</span>
              </div>
            </div>
          )}

          {stealthAddress && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 mb-4 text-left">
              <p className="text-[10px] text-white/25 uppercase tracking-wide mb-1">Stealth Address</p>
              <p className="text-white font-mono text-xs break-all">{stealthAddress}</p>
            </div>
          )}

          <a
            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-6 text-sm"
          >
            View on Explorer
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/[0.06] rounded-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold text-white mb-6">
          Support {campaign.title}
        </h2>

        {/* Amount input */}
        <div className="mb-6">
          <label className="block text-[10px] text-white/25 uppercase tracking-wide mb-2">
            Amount (SOL) {selectedPrivacy === 'SEMI' && <span className="text-green-400">• Standardized amounts for privacy</span>}
          </label>
          <div className="relative">
            {selectedPrivacy === 'SEMI' ? (
              <div className="flex gap-3">
                {POOL_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val.toString())}
                    className={`flex-1 py-4 rounded-xl text-lg font-mono transition-all ${
                      amount === val.toString()
                        ? 'bg-white text-black'
                        : 'bg-white/[0.02] border border-white/[0.06] text-white/40 hover:text-white hover:border-white/[0.1]'
                    }`}
                  >
                    {val} SOL
                  </button>
                ))}
              </div>
            ) : (
              <>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.001"
                  className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-lg font-mono focus:border-white/[0.1] transition-colors"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                  {['0.1', '0.5', '1'].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmount(val)}
                      className={`px-2 py-1 text-xs rounded-lg ${
                        amount === val
                          ? 'bg-white text-black'
                          : 'bg-white/[0.04] text-white/40 hover:text-white'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Privacy level */}
        <div className="mb-6">
          <label className="block text-[10px] text-white/25 uppercase tracking-wide mb-2">
            Privacy Level
          </label>
          <div className="grid grid-cols-3 gap-3">
            {privacyOptions.map((option) => (
              <button
                key={option.level}
                onClick={() => setSelectedPrivacy(option.level)}
                className={`relative p-4 rounded-xl border text-left transition-all h-full ${
                  selectedPrivacy === option.level
                    ? 'border-white bg-white/[0.05]'
                    : 'border-white/[0.06] hover:border-white/[0.1]'
                }`}
              >
                {selectedPrivacy === option.level && (
                  <span className="absolute top-3 right-3 w-2 h-2 bg-green-400 rounded-full" />
                )}
                <option.icon
                  className={`w-5 h-5 mb-3 ${
                    selectedPrivacy === option.level
                      ? 'text-white'
                      : 'text-white/30'
                  }`}
                />
                <div className="text-white font-medium mb-1">{option.title}</div>
                <p className="text-white/40 text-xs">{option.description}</p>
                {option.level === 'SEMI' && (
                  <p className="text-green-400 text-xs mt-1">Recommended</p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy Pool info box */}
        {selectedPrivacy === 'SEMI' && (
          <div className="mb-4 p-4 bg-green-400/5 border border-green-400/10 rounded-xl">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-400 text-sm font-medium mb-1">Privacy Pool Donation</p>
                <p className="text-white/40 text-xs mb-2">
                  Your SOL goes into a mixed pool. The link between your wallet and this campaign is broken.
                </p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-1 text-white/30">
                    <Clock className="w-3 h-3" />
                    <span>Delay: <span className="text-green-400">{WITHDRAW_DELAY_SECONDS}s</span></span>
                  </div>
                  <div className="flex items-center gap-1 text-white/30">
                    <span>Amounts: <span className="text-green-400">{POOL_AMOUNTS.join(', ')} SOL</span></span>
                  </div>
                  {poolBalance !== null && (
                    <div className="flex items-center gap-1 text-white/30">
                      <span>Pool: <span className="text-green-400 font-mono">{poolBalance.toFixed(2)} SOL</span></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedPrivacy === 'PRIVATE' && (
          <div className="mb-4 p-4 bg-green-400/5 border border-green-400/10 rounded-xl">
            <p className="text-green-400 text-sm">
              <strong>ShadowWire ZK Transfer</strong>: Your donation amount will be hidden using Bulletproofs (zero-knowledge proofs).
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleDonate}
          disabled={isProcessing}
          className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {selectedPrivacy === 'PRIVATE' ? 'Generating ZK Proof...' :
               selectedPrivacy === 'SEMI' ? 'Depositing to Pool...' : 'Processing...'}
            </>
          ) : connected ? (
            <>
              {selectedPrivacy === 'SEMI' ? `Deposit ${amount} SOL to Pool` : `Donate ${amount} SOL`}
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            'Connect Wallet'
          )}
        </button>
      </div>
    </div>
  );
}
