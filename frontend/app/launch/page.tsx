'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PrivacyLevel } from '../lib/types';
import { useProgram } from '../lib/program';
import { triggerOffuscation } from '../components/WaveMeshBackground';

const TOTAL_STEPS = 4;

const privacyOptions = [
  {
    level: 'PUBLIC' as PrivacyLevel,
    title: 'Public',
    description: 'Standard transfer. Fully visible on explorer.',
    icon: Eye,
  },
  {
    level: 'SEMI' as PrivacyLevel,
    title: 'Semi-Private',
    description: 'Stealth address relayer. Sender hidden.',
    icon: EyeOff,
  },
  {
    level: 'PRIVATE' as PrivacyLevel,
    title: 'Fully Private',
    description: 'Zero-Knowledge. Sender, Receiver, Amount hidden.',
    icon: Lock,
  },
];

const privacyLabels: Record<PrivacyLevel, string> = {
  PUBLIC: 'Public Mode',
  SEMI: 'Semi Mode',
  PRIVATE: 'Private Mode',
  ZK_COMPRESSED: 'ZK Compressed Mode',
};

function generateCampaignId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export default function LaunchPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { createCampaign, isConnected } = useProgram();

  const [step, setStep] = useState(1);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchSuccess, setLaunchSuccess] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    goal: '',
    privacyLevel: 'SEMI' as PrivacyLevel,
    title: '',
    description: '',
    durationDays: '30',
  });

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleLaunch = async () => {
    if (!connected) {
      setVisible(true);
      return;
    }

    if (!isConnected) {
      setError('Wallet not connected');
      return;
    }

    setIsLaunching(true);
    setError(null);

    try {
      const id = generateCampaignId();
      const goalSol = parseFloat(formData.goal) || 1;
      const durationDays = parseInt(formData.durationDays) || 30;
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + durationDays * 24 * 60 * 60;

      const signature = await createCampaign(
        id,
        formData.title || 'Untitled Campaign',
        formData.description || 'No description',
        goalSol,
        deadlineTimestamp
      );

      setCampaignId(id);
      setTxSignature(signature);
      setLaunchSuccess(true);
      triggerOffuscation();
    } catch (err: any) {
      console.error('Launch failed:', err);
      setError(err.message || 'Failed to launch campaign');
    } finally {
      setIsLaunching(false);
    }
  };

  // Success screen
  if (launchSuccess && txSignature && campaignId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-green-400/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-400/20">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>

          <h1 className="text-3xl font-semibold text-white mb-2">Campaign Launched!</h1>
          <p className="text-white/40 mb-8">
            Your campaign is now live on Solana devnet
          </p>

          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-6 mb-6 text-left">
            <div className="mb-4">
              <span className="text-[10px] text-white/25 uppercase tracking-wide">Campaign ID</span>
              <p className="text-white font-mono mt-1">{campaignId}</p>
            </div>
            <div className="mb-4">
              <span className="text-[10px] text-white/25 uppercase tracking-wide">Title</span>
              <p className="text-white mt-1">{formData.title || 'Untitled Campaign'}</p>
            </div>
            <div>
              <span className="text-[10px] text-white/25 uppercase tracking-wide">Goal</span>
              <p className="text-white font-mono mt-1">{formData.goal} SOL</p>
            </div>
          </div>

          <a
            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-8 text-sm"
          >
            View on Explorer
            <ExternalLink className="w-4 h-4" />
          </a>

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/explore')}
              className="flex-1 py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all active:scale-[0.98]"
            >
              View Campaigns
            </button>
            <button
              onClick={() => {
                setLaunchSuccess(false);
                setStep(1);
                setFormData({
                  goal: '',
                  privacyLevel: 'SEMI',
                  title: '',
                  description: '',
                  durationDays: '30',
                });
              }}
              className="flex-1 py-4 border border-white/[0.1] text-white font-medium rounded-xl hover:bg-white/[0.03] transition-all active:scale-[0.98]"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-20">
      <div className="w-full max-w-3xl">
        {/* Progress Steps */}
        <div className="flex gap-2 mb-16">
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index < step ? 'bg-white' : 'bg-white/[0.06]'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Set Target */}
        {step === 1 && (
          <div>
            <h1 className="text-3xl font-semibold text-white mb-2">Set the target</h1>
            <p className="text-white/40 mb-10">How much SOL do you need?</p>

            <div className="mb-8">
              <label className="block text-[10px] text-white/25 uppercase tracking-wide mb-3">
                Funding Goal (SOL)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.goal}
                  onChange={(e) =>
                    setFormData({ ...formData, goal: e.target.value })
                  }
                  placeholder="0.00"
                  className="w-full bg-transparent text-white text-4xl font-light border-b border-white/[0.1] pb-4 focus:border-white/[0.2] transition-colors font-mono"
                />
                <span className="absolute right-0 bottom-4 text-white/30">
                  SOL
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-white/25 uppercase tracking-wide mb-3">
                Duration (Days)
              </label>
              <div className="flex gap-3">
                {['7', '14', '30', '60'].map((days) => (
                  <button
                    key={days}
                    onClick={() => setFormData({ ...formData, durationDays: days })}
                    className={`flex-1 py-3 rounded-xl border transition-all ${
                      formData.durationDays === days
                        ? 'border-white bg-white/[0.05] text-white'
                        : 'border-white/[0.06] text-white/40 hover:border-white/[0.1]'
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Privacy Level */}
        {step === 2 && (
          <div>
            <h1 className="text-3xl font-semibold text-white mb-2">Privacy level</h1>
            <p className="text-white/40 mb-10">
              Choose how transactions appear on-chain.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {privacyOptions.map((option) => (
                <button
                  key={option.level}
                  onClick={() =>
                    setFormData({ ...formData, privacyLevel: option.level })
                  }
                  className={`relative p-5 rounded-2xl border text-left transition-all h-full ${
                    formData.privacyLevel === option.level
                      ? 'border-white bg-white/[0.05]'
                      : 'border-white/[0.06] hover:border-white/[0.1]'
                  }`}
                >
                  {formData.privacyLevel === option.level && (
                    <span className="absolute top-3 right-3 w-2 h-2 bg-green-400 rounded-full" />
                  )}
                  <option.icon
                    className={`w-5 h-5 mb-4 ${
                      formData.privacyLevel === option.level
                        ? 'text-white'
                        : 'text-white/30'
                    }`}
                  />
                  <div className="text-white font-medium mb-2">
                    {option.title}
                  </div>
                  <p className="text-white/40 text-sm">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Campaign Details */}
        {step === 3 && (
          <div>
            <h1 className="text-3xl font-semibold text-white mb-2">Campaign details</h1>
            <p className="text-white/40 mb-10">Tell supporters about your mission.</p>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] text-white/25 uppercase tracking-wide mb-3">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter campaign name"
                  maxLength={64}
                  className="w-full bg-transparent text-white text-lg border-b border-white/[0.1] pb-3 focus:border-white/[0.2] transition-colors placeholder-white/20"
                />
                <span className="text-[10px] text-white/25 mt-1 block">{formData.title.length}/64</span>
              </div>

              <div>
                <label className="block text-[10px] text-white/25 uppercase tracking-wide mb-3">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe your campaign..."
                  rows={4}
                  maxLength={256}
                  className="w-full bg-white/[0.02] text-white border border-white/[0.06] rounded-xl p-4 focus:border-white/[0.1] transition-colors placeholder-white/20 resize-none"
                />
                <span className="text-[10px] text-white/25 mt-1 block">{formData.description.length}/256</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Finalize */}
        {step === 4 && (
          <div>
            <h1 className="text-3xl font-semibold text-white mb-2">Finalize</h1>
            <p className="text-white/40 mb-10">Review and launch your campaign.</p>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] text-white/25 uppercase tracking-wide">
                  Campaign
                </span>
                <span className="text-[10px] text-white/25 uppercase tracking-wide">
                  Goal
                </span>
              </div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-white font-medium">
                  {formData.title || 'Untitled Campaign'}
                </span>
                <span className="text-white font-mono">
                  {formData.goal || '0'} SOL
                </span>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-[10px] text-white/25 uppercase tracking-wide">
                    Security Level
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    {formData.privacyLevel === 'PUBLIC' && <Eye className="w-4 h-4 text-white/40" />}
                    {formData.privacyLevel === 'SEMI' && <EyeOff className="w-4 h-4 text-white/40" />}
                    {formData.privacyLevel === 'PRIVATE' && <Lock className="w-4 h-4 text-white/40" />}
                    <span className="text-white">
                      {privacyLabels[formData.privacyLevel]}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/25 uppercase tracking-wide">
                    Duration
                  </span>
                  <p className="text-white mt-2">{formData.durationDays} days</p>
                </div>
              </div>

              {!connected && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mt-4">
                  <p className="text-yellow-400 text-sm">
                    Connect your wallet to launch the campaign on Solana devnet
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mt-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 mt-12">
          {step > 1 && (
            <button
              onClick={handleBack}
              disabled={isLaunching}
              className="p-4 border border-white/[0.06] rounded-xl hover:bg-white/[0.03] transition-all disabled:opacity-50"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              className="flex-1 py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              disabled={isLaunching}
              className="flex-1 py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating on-chain...
                </>
              ) : connected ? (
                'Launch Campaign'
              ) : (
                'Connect Wallet to Launch'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
