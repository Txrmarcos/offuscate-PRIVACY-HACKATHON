'use client';

import { useState, useEffect } from 'react';
import { X, Eye, Lock, ArrowRight, Loader2, Binary, Info, Zap, Clock, Users, DollarSign, Shield } from 'lucide-react';
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
import { PayrollBatch, PrivacyLevel } from '../lib/types';
import { useProgram, getCampaignPDAs } from '../lib/program';
import {
  generateStealthAddress,
  parseStealthMetaAddress,
} from '../lib/stealth';
import { privateDonation, type ShadowWireWallet } from '../lib/privacy/shadowWire';
import { privateZKDonation, type LightWallet, isLightProtocolAvailable } from '../lib/privacy/lightProtocol';
import { queuePrivateDonation, type BatchDonationResult } from '../lib/privacy/batchDonation';
import { triggerOffuscation } from './WaveMeshBackground';
import { FullScreenPrivacyAnimation } from './PrivacyGraphAnimation';

// Legacy alias for backwards compatibility
type Campaign = PayrollBatch;

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

interface DonationModalProps {
  campaign: Campaign;
  onClose: () => void;
}

// Privacy options with B2B terminology
const privacyOptions: {
  level: PrivacyLevel;
  title: string;
  description: string;
  shortDesc: string;
  icon: typeof Eye;
  badge?: string;
  tag?: string;
  privacyScore: number;
}[] = [
  {
    level: 'ZK_COMPRESSED',
    title: 'Maximum Privacy',
    description: 'Payments batched together. No timing or address link. Fully unlinkable.',
    shortDesc: 'ZK Protected',
    icon: Binary,
    badge: 'Devnet',
    tag: 'Recommended',
    privacyScore: 100,
  },
  {
    level: 'PRIVATE',
    title: 'Private',
    description: 'Cryptographically hidden sender and amount. Enterprise-grade privacy.',
    shortDesc: 'Sender hidden',
    icon: Lock,
    badge: 'Mainnet',
    privacyScore: 100,
  },
  {
    level: 'PUBLIC',
    title: 'Standard',
    description: 'Visible on-chain. Use when transparency is required for compliance.',
    shortDesc: 'Auditable',
    icon: Eye,
    privacyScore: 0,
  },
];

export function DonationModal({ campaign, onClose }: DonationModalProps) {
  const [selectedPrivacy, setSelectedPrivacy] = useState<PrivacyLevel>('ZK_COMPRESSED');
  const [amount, setAmount] = useState('0.1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaignMetaAddress, setCampaignMetaAddress] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Batch queue state
  const [batchResult, setBatchResult] = useState<BatchDonationResult | null>(null);
  const [isQueued, setIsQueued] = useState(false);

  const { connected, publicKey, signTransaction, signMessage } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const { donate, fetchCampaign, isConnected, privateDeposit } = useProgram();

  useEffect(() => {
    const loadCampaignMeta = async () => {
      setLoadingMeta(true);
      try {
        const campaignData = await fetchCampaign(campaign.id);
        if (campaignData?.stealthMetaAddress && campaignData.stealthMetaAddress.length > 0) {
          setCampaignMetaAddress(campaignData.stealthMetaAddress);
        }
      } catch (err) {
        console.error('Failed to load batch meta:', err);
      } finally {
        setLoadingMeta(false);
      }
    };
    loadCampaignMeta();
  }, [campaign.id, fetchCampaign]);

  const handlePayment = async () => {
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
          throw new Error(result.error || 'Private payment failed');
        }

        setTxSignature(result.signature!);
        setIsDone(true);
        triggerOffuscation();

      } else if (selectedPrivacy === 'ZK_COMPRESSED') {
        const { vaultPda } = getCampaignPDAs(campaign.id);

        if (!signMessage) {
          setError('Your wallet does not support message signing.');
          setIsProcessing(false);
          return;
        }

        // Use batch payment system for TRUE privacy
        // 1. Deposit to payroll pool (breaks sender link)
        // 2. Queue with relayer for batch processing (breaks timing link)
        // 3. Relayer processes in batch later (no link between sender and recipient)

        const result = await queuePrivateDonation(
          privateDeposit,
          campaign.id,
          vaultPda.toBase58(),
          amountSol,
          publicKey!,
          signMessage
        );

        if (!result.success) {
          throw new Error(result.error || 'Private payment failed');
        }

        // Show queued status instead of immediate success
        setBatchResult(result);
        setIsQueued(true);
        setTxSignature(result.depositSignature || null);
        setIsDone(true);
        triggerOffuscation();

      } else {
        // STANDARD - direct payment to batch vault
        const sig = await donate(campaign.id, amountSol);
        setTxSignature(sig);
        setIsDone(true);
        triggerOffuscation();
      }
    } catch (err: any) {
      console.error('Payment failed:', err);
      setError(err.message || 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Queued batch payment success screen
  if (isDone && isQueued && batchResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
        <div className="relative w-full max-w-md bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/[0.05] flex items-center justify-center">
            <Clock className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            Payment Queued
          </h2>

          <p className="text-white/60 mb-6">
            Your {amount} SOL is now in the payroll pool. It will be distributed to <strong className="text-white">{campaign.title}</strong> in the next batch settlement.
          </p>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/40 text-sm">Queue Position</span>
              <span className="text-white font-mono">#{batchResult.queuePosition}</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/40 text-sm">Estimated Settlement</span>
              <span className="text-white font-mono">
                {batchResult.estimatedProcessingTime ? `~${Math.ceil(batchResult.estimatedProcessingTime / 60)} min` : '< 5 min'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-sm">Payment ID</span>
              <span className="text-white/60 font-mono text-xs">
                {batchResult.donationId?.slice(0, 12)}...
              </span>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-white/50 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-white/70 text-sm font-medium mb-1">Maximum Privacy</p>
                <p className="text-white/40 text-xs">
                  Your payment will be processed with others. The recipient cannot link your treasury to this payment.
                </p>
              </div>
            </div>
          </div>

          {batchResult.depositSignature && (
            <a
              href={`https://explorer.solana.com/tx/${batchResult.depositSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/30 text-xs hover:text-white/50 transition-colors"
            >
              View pool deposit
            </a>
          )}

          <button
            onClick={onClose}
            className="w-full mt-4 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Regular transaction success screen
  if (isDone && txSignature) {
    return (
      <FullScreenPrivacyAnimation
        privacyLevel={selectedPrivacy}
        txSignature={txSignature}
        amount={amount}
        campaignTitle={campaign.title}
        onComplete={onClose}
      />
    );
  }

  const selectedOption = privacyOptions.find(o => o.level === selectedPrivacy);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold text-white mb-2">
          Add Payment to {campaign.title}
        </h2>

        <p className="text-white/40 text-sm mb-2">
          Distribute funds privately to recipients.
        </p>
        <p className="text-white/25 text-xs mb-6">
          Payment goes to the batch vault. Recipients claim through private addresses.
        </p>

        {/* Amount input */}
        <div className="mb-6">
          <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-3">
            Amount (SOL)
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0.001"
              className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-lg font-mono focus:border-white/[0.15] transition-colors"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
              {['0.1', '0.5', '1'].map((val) => (
                <button
                  key={val}
                  onClick={() => setAmount(val)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                    amount === val
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

        {/* Privacy level */}
        <div className="mb-6">
          <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-3">
            Privacy Level
          </label>
          <div className="grid grid-cols-3 gap-3">
            {privacyOptions.map((option) => (
              <button
                key={option.level}
                onClick={() => setSelectedPrivacy(option.level)}
                className={`relative p-4 rounded-xl border text-left transition-all ${
                  selectedPrivacy === option.level
                    ? 'border-white bg-white/[0.05]'
                    : 'border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {/* Selection indicator */}
                {selectedPrivacy === option.level && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white" />
                )}

                {/* Badge */}
                {option.badge && (
                  <span className="absolute top-3 right-8 text-[9px] px-1.5 py-0.5 rounded bg-white/[0.08] text-white/50">
                    {option.badge}
                  </span>
                )}

                <option.icon
                  className={`w-5 h-5 mb-3 ${
                    selectedPrivacy === option.level ? 'text-white' : 'text-white/30'
                  }`}
                />
                <div className="text-white font-medium mb-1 text-sm">{option.title}</div>
                <p className="text-white/40 text-[11px] leading-relaxed">{option.description}</p>

                {/* Tag */}
                {option.tag && (
                  <p className="text-white/50 text-[10px] mt-2 uppercase tracking-wider">{option.tag}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy score indicator */}
        <div className={`mb-4 p-4 rounded-xl border ${
          selectedPrivacy === 'PUBLIC'
            ? 'bg-white/[0.01] border-white/[0.04]'
            : 'bg-white/[0.03] border-white/[0.08]'
        }`}>
          <div className="flex items-start gap-3">
            {selectedOption && <selectedOption.icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              selectedPrivacy === 'PUBLIC' ? 'text-white/30' : 'text-white'
            }`} />}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-medium">
                  {selectedPrivacy === 'ZK_COMPRESSED' ? 'Batch Private Payment' :
                   selectedPrivacy === 'PRIVATE' ? 'Private Payment' :
                   'Standard Payment'}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30">Privacy</span>
                  <div className="w-20 h-1.5 bg-white/[0.1] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        selectedPrivacy === 'PUBLIC' ? 'bg-white/30' : 'bg-white'
                      }`}
                      style={{ width: `${selectedOption?.privacyScore || 0}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono ${
                    selectedPrivacy === 'PUBLIC' ? 'text-white/30' : 'text-white/60'
                  }`}>{selectedOption?.privacyScore}%</span>
                </div>
              </div>
              <p className="text-white/40 text-xs">
                {selectedPrivacy === 'ZK_COMPRESSED' ? (
                  <>Funds go to payroll pool first, then settled in batch. <strong className="text-white/70">No timing or address link</strong> between treasury and recipients.</>
                ) : selectedPrivacy === 'PRIVATE' ? (
                  <>Cryptographically protected. Sender identity and amount are hidden from on-chain observers.</>
                ) : (
                  <>Standard on-chain transfer. Sender, recipient, and amount are visible for audit purposes.</>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Info about where funds go */}
        <div className="mb-4 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl flex items-center gap-3">
          <DollarSign className="w-4 h-4 text-white/40" />
          <p className="text-[11px] text-white/50">
            {selectedPrivacy === 'ZK_COMPRESSED' ? (
              <><strong className="text-white/70">Batch settlement:</strong> Funds enter payroll pool, then distributed privately. Typical settlement within 5 minutes.</>
            ) : (
              <><strong className="text-white/70">Direct to batch:</strong> Payment goes to {campaign.title} vault. Recipients can claim privately.</>
            )}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-white/[0.02] border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {selectedPrivacy === 'ZK_COMPRESSED' ? 'Processing to payroll pool...' :
               selectedPrivacy === 'PRIVATE' ? 'Creating private payment...' : 'Processing...'}
            </>
          ) : connected ? (
            <>
              {selectedPrivacy === 'PUBLIC' ? `Pay ${amount} SOL` : `Pay ${amount} SOL Privately`}
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            'Connect Wallet'
          )}
        </button>

        {/* Privacy reassurance */}
        {selectedPrivacy !== 'PUBLIC' && (
          <p className="text-center text-white/20 text-[10px] mt-3">
            Your treasury address will not be linked to this payment on-chain
          </p>
        )}
      </div>
    </div>
  );
}
