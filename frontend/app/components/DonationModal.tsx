'use client';

import { useState } from 'react';
import { X, Eye, EyeOff, Lock, ArrowRight, Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Campaign, PrivacyLevel } from '../lib/types';
import { useProgram } from '../lib/program';

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
    title: 'Semi-Private',
    description: 'Stealth address. Sender hidden.',
    icon: EyeOff,
  },
  {
    level: 'PRIVATE',
    title: 'Fully Private',
    description: 'ZK Proof. Coming soon.',
    icon: Lock,
  },
];

export function DonationModal({ campaign, onClose }: DonationModalProps) {
  const [selectedPrivacy, setSelectedPrivacy] = useState<PrivacyLevel>('PUBLIC');
  const [amount, setAmount] = useState('0.1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { donate, isReady } = useProgram();

  const handleDonate = async () => {
    if (!connected) {
      setVisible(true);
      return;
    }

    if (!isReady) {
      setError('Wallet not ready');
      return;
    }

    const amountSol = parseFloat(amount);
    if (isNaN(amountSol) || amountSol <= 0) {
      setError('Invalid amount');
      return;
    }

    if (selectedPrivacy === 'PRIVATE') {
      setError('ZK donations coming soon');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // For PUBLIC: direct donation to vault
      // For SEMI: TODO - integrate stealth address
      const sig = await donate(campaign.id, amountSol);
      setTxSignature(sig);
      setIsDone(true);
    } catch (err: any) {
      console.error('Donation failed:', err);
      setError(err.message || 'Donation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Success screen
  if (isDone && txSignature) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl p-6 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>

          <h2 className="text-xl font-semibold text-white mb-2">Donation Sent!</h2>
          <p className="text-[#737373] mb-6">
            {amount} SOL sent to {campaign.title}
          </p>

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
          </div>
        </div>

        {/* Privacy level */}
        <div className="mb-6">
          <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
            Privacy Level
          </label>
          <div className="grid grid-cols-3 gap-3">
            {privacyOptions.map((option) => (
              <button
                key={option.level}
                onClick={() => setSelectedPrivacy(option.level)}
                disabled={option.level === 'PRIVATE'}
                className={`relative p-4 rounded-xl border text-left transition-all h-full ${
                  selectedPrivacy === option.level
                    ? 'border-white bg-[#1a1a1a]'
                    : 'border-[#262626] hover:border-[#404040]'
                } ${option.level === 'PRIVATE' ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              </button>
            ))}
          </div>
        </div>

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
              Processing...
            </>
          ) : connected ? (
            <>
              Donate {amount} SOL
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
