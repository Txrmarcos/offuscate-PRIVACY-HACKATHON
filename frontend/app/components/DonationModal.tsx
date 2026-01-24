'use client';

import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Lock, ArrowRight, Loader2, CheckCircle, ExternalLink, AlertTriangle, Clock, Shield } from 'lucide-react';
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

// Memo program for stealth ephemeral key
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Standardized amounts for privacy pool (must match Anchor program)
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

  // Load campaign's stealth meta-address
  useEffect(() => {
    const loadCampaignMeta = async () => {
      setLoadingMeta(true);
      try {
        console.log('🔍 Loading campaign meta for:', campaign.id);
        const campaignData = await fetchCampaign(campaign.id);
        console.log('📦 Campaign data:', campaignData);
        console.log('🔐 Stealth meta address:', campaignData?.stealthMetaAddress);

        // Check if stealthMetaAddress is set (not empty string)
        if (campaignData?.stealthMetaAddress && campaignData.stealthMetaAddress.length > 0) {
          setCampaignMetaAddress(campaignData.stealthMetaAddress);
          console.log('✅ Stealth available for this campaign');
        } else {
          console.log('❌ Stealth NOT configured for this campaign');
        }
      } catch (err) {
        console.error('Failed to load campaign meta:', err);
      } finally {
        setLoadingMeta(false);
      }
    };
    loadCampaignMeta();
  }, [campaign.id, fetchCampaign]);

  // Check privacy pool status
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
        console.log('Pool not initialized yet');
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
        // ==========================================
        // PRIVATE DONATION - ZK Proof via ShadowWire (Radr Labs)
        // Amount is hidden using Bulletproofs (zero-knowledge proofs)
        // ==========================================

        // Get the campaign vault PDA
        const { vaultPda } = getCampaignPDAs(campaign.id);
        const vaultAddress = vaultPda.toBase58();

        console.log('🛡️ Private Donation via ShadowWire:');
        console.log('  Amount:', amountSol, 'SOL');
        console.log('  Recipient (vault):', vaultAddress);

        // Check if wallet can sign messages and transactions
        if (!signMessage || !signTransaction) {
          setError('Your wallet does not support required signing. Try a different wallet.');
          setIsProcessing(false);
          return;
        }

        // Create wallet interface for ShadowWire
        const shadowWallet: ShadowWireWallet = {
          publicKey: publicKey!,
          signMessage: signMessage,
          signTransaction: signTransaction as any,
        };

        // Execute private donation via ShadowWire
        const result = await privateDonation(
          shadowWallet,
          vaultAddress, // Send to campaign vault PDA
          amountSol
        );

        if (!result.success) {
          throw new Error(result.error || 'Private donation failed');
        }

        console.log('  ✅ Private donation complete');
        console.log('  Transaction:', result.signature);

        setTxSignature(result.signature!);
        setIsDone(true);

      } else if (selectedPrivacy === 'SEMI') {
        // ==========================================
        // PRIVACY POOL DONATION - Breaks linkability!
        // ==========================================
        // Funds go to a mixed pool, preventing tracking
        // Campaign owner withdraws later with delay
        // ==========================================

        // Check if pool is initialized
        if (!poolInitialized) {
          // Try to initialize the pool (first time)
          console.log('🏊 Initializing Privacy Pool...');
          try {
            await initPool();
            setPoolInitialized(true);
          } catch (err: any) {
            // Pool might already be initialized by someone else
            if (!err.message?.includes('already in use')) {
              throw err;
            }
          }
        }

        console.log('🏊 Privacy Pool Donation:');
        console.log('  Amount:', amountSol, 'SOL');
        console.log('  Pool mixing for unlinkability');

        // Deposit to privacy pool
        // NO sender info, NO campaign info, NO receiver info on-chain
        const sig = await poolDeposit(amountSol);

        console.log('  ✅ Deposited to Privacy Pool');
        console.log('  Transaction:', sig);
        console.log('  ⏱️ Receiver can claim after', WITHDRAW_DELAY_SECONDS, 'seconds delay');

        // Note: The "linking" to campaign happens off-chain
        // In production, donor would share a commitment with campaign owner
        // For hackathon demo, we just show the pool deposit

        setTxSignature(sig);
        setIsDone(true);

      } else {
        // ==========================================
        // PUBLIC DONATION - Goes to vault (visible)
        // ==========================================
        const sig = await donate(campaign.id, amountSol);
        setTxSignature(sig);
        setIsDone(true);
      }
    } catch (err: any) {
      console.error('Donation failed:', err);
      setError(err.message || 'Donation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Success screen
  if (isDone && txSignature) {
    const isPoolDonation = selectedPrivacy === 'SEMI';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl p-6 text-center">
          <div className={`w-16 h-16 ${isPoolDonation ? 'bg-purple-500/20' : 'bg-green-500/20'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            {isPoolDonation ? (
              <Shield className="w-8 h-8 text-purple-500" />
            ) : (
              <CheckCircle className="w-8 h-8 text-green-500" />
            )}
          </div>

          <h2 className="text-xl font-semibold text-white mb-2">
            {isPoolDonation ? '🏊 Privacy Pool Deposit!' :
             stealthAddress ? '🔒 Stealth Donation Sent!' : 'Donation Sent!'}
          </h2>
          <p className="text-[#737373] mb-4">
            {amount} SOL {isPoolDonation ? 'deposited to privacy pool' : `sent to ${campaign.title}`}
          </p>

          {isPoolDonation && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <p className="text-purple-400 text-sm font-medium">Unlinkable Donation</p>
              </div>
              <p className="text-[#737373] text-xs mb-2">
                Your donation is now mixed in the privacy pool. The link between your wallet and this campaign is broken.
              </p>
              <div className="flex items-center gap-2 text-xs text-[#737373]">
                <span>⏱️ Withdrawal delay:</span>
                <span className="text-purple-400 font-mono">{WITHDRAW_DELAY_SECONDS}s</span>
              </div>
            </div>
          )}

          {stealthAddress && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-4 text-left">
              <p className="text-purple-400 text-xs mb-1">Stealth Address (unlinkable)</p>
              <p className="text-white font-mono text-xs break-all">{stealthAddress}</p>
            </div>
          )}

          <a
            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-6"
          >
            View on Explorer
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-gray-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Check if stealth is available (for legacy mode, not used with pool)
  const stealthAvailable = !!campaignMetaAddress;
  // Privacy pool is always available
  const poolAvailable = true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-[#141414] border border-[#262626] rounded-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#737373] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold text-white mb-6">
          Support {campaign.title}
        </h2>

        {/* Amount input */}
        <div className="mb-6">
          <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
            Amount (SOL) {selectedPrivacy === 'SEMI' && <span className="text-purple-400">• Standardized amounts for privacy</span>}
          </label>
          <div className="relative">
            {selectedPrivacy === 'SEMI' ? (
              // Standardized amounts only for privacy pool
              <div className="flex gap-3">
                {POOL_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val.toString())}
                    className={`flex-1 py-4 rounded-lg text-lg font-medium transition-all ${
                      amount === val.toString()
                        ? 'bg-purple-500 text-white'
                        : 'bg-[#1a1a1a] border border-[#262626] text-[#737373] hover:text-white hover:border-[#404040]'
                    }`}
                  >
                    {val} SOL
                  </button>
                ))}
              </div>
            ) : (
              // Free input for other modes
              <>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.001"
                  className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-4 py-3 text-white text-lg focus:border-[#404040] transition-colors"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                  {['0.1', '0.5', '1'].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmount(val)}
                      className={`px-2 py-1 text-xs rounded ${
                        amount === val
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-[#262626] text-[#737373] hover:text-white'
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
          <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
            Privacy Level
          </label>
          <div className="grid grid-cols-3 gap-3">
            {privacyOptions.map((option) => {
              // Pool (SEMI) is always available, PRIVATE might not be
              const isDisabled = false;

              return (
                <button
                  key={option.level}
                  onClick={() => !isDisabled && setSelectedPrivacy(option.level)}
                  disabled={isDisabled}
                  className={`relative p-4 rounded-xl border text-left transition-all h-full ${
                    selectedPrivacy === option.level
                      ? 'border-white bg-[#1a1a1a]'
                      : 'border-[#262626] hover:border-[#404040]'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {selectedPrivacy === option.level && (
                    <span className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                  <option.icon
                    className={`w-5 h-5 mb-3 ${
                      selectedPrivacy === option.level
                        ? 'text-white'
                        : 'text-[#737373]'
                    }`}
                  />
                  <div className="text-white font-medium mb-1">{option.title}</div>
                  <p className="text-[#737373] text-xs">{option.description}</p>
                  {option.level === 'SEMI' && (
                    <p className="text-purple-400 text-xs mt-1">Recommended</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Privacy Pool info box */}
        {selectedPrivacy === 'SEMI' && (
          <div className="mb-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-purple-400 text-sm font-medium mb-1">Privacy Pool Donation</p>
                <p className="text-[#737373] text-xs mb-2">
                  Your SOL goes into a mixed pool. The link between your wallet and this campaign is broken.
                </p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-1 text-[#737373]">
                    <Clock className="w-3 h-3" />
                    <span>Delay: <span className="text-purple-400">{WITHDRAW_DELAY_SECONDS}s</span></span>
                  </div>
                  <div className="flex items-center gap-1 text-[#737373]">
                    <span>Amounts: <span className="text-purple-400">{POOL_AMOUNTS.join(', ')} SOL</span></span>
                  </div>
                  {poolBalance !== null && (
                    <div className="flex items-center gap-1 text-[#737373]">
                      <span>Pool: <span className="text-green-400">{poolBalance.toFixed(2)} SOL</span></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedPrivacy === 'PRIVATE' && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-green-400 text-sm">
              🛡️ <strong>ShadowWire ZK Transfer</strong>: Your donation amount will be hidden using Bulletproofs (zero-knowledge proofs).
              The transaction amount is encrypted and invisible to external observers.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleDonate}
          disabled={isProcessing}
          className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {selectedPrivacy === 'PRIVATE' ? 'Generating ZK Proof...' :
               selectedPrivacy === 'SEMI' ? 'Depositing to Pool...' : 'Processing...'}
            </>
          ) : connected ? (
            <>
              {selectedPrivacy === 'PRIVATE' ? '🛡️ ' : selectedPrivacy === 'SEMI' ? '🏊 ' : ''}
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
