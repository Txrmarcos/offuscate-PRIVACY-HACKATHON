'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Loader2,
  CheckCircle,
  ExternalLink,
  Sparkles,
  Shield,
  Users,
  Target,
  Zap,
  Clock,
  Binary,
} from 'lucide-react';
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
    subtitle: 'Transparent',
    description: 'Donors are visible. Best when you want to recognize supporters publicly.',
    icon: Eye,
    features: ['Donors visible', 'Amounts shown', 'Full transparency'],
  },
  {
    level: 'SEMI' as PrivacyLevel,
    title: 'Semi-Private',
    subtitle: 'Protected',
    description: 'Donors stay anonymous. Perfect for sensitive causes.',
    icon: Shield,
    features: ['Donors hidden', 'Amounts visible', 'Safe for sensitive causes'],
    recommended: true,
  },
  {
    level: 'ZK_COMPRESSED' as PrivacyLevel,
    title: 'ZK Private',
    subtitle: 'Maximum Privacy',
    description: 'Complete anonymity. Nobody knows who helped.',
    icon: Binary,
    features: ['Donors hidden', 'Amounts hidden', 'Cryptographically private'],
  },
];

const privacyLabels: Record<PrivacyLevel, string> = {
  PUBLIC: 'Public',
  SEMI: 'Semi-Private',
  PRIVATE: 'Fully Private',
  ZK_COMPRESSED: 'ZK Compressed',
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
        <div className="w-full max-w-lg text-center">
          {/* Success animation */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-white/[0.03] animate-ping" />
            </div>
            <div className="relative w-24 h-24 bg-white/[0.05] rounded-full flex items-center justify-center mx-auto border border-white/[0.1]">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-3">You're Live!</h1>
          <p className="text-white/40 mb-3 text-lg">
            Your campaign is now accepting donations
          </p>
          <p className="text-white/25 mb-8 text-sm">
            Share it with supporters. They can help you anonymously.
          </p>

          {/* Campaign preview */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-6 mb-6 text-left">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Campaign</span>
                <h3 className="text-xl font-semibold text-white mt-1">
                  {formData.title || 'Untitled Campaign'}
                </h3>
              </div>
              <div className="px-3 py-1 rounded-lg bg-white/[0.05] border border-white/[0.1]">
                <span className="text-xs text-white/60">{privacyLabels[formData.privacyLevel]}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 rounded-xl bg-white/[0.02]">
                <Target className="w-4 h-4 text-white/30 mb-1" />
                <div className="text-xl font-bold text-white">{formData.goal} SOL</div>
                <span className="text-[10px] text-white/30 uppercase">Goal</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02]">
                <Clock className="w-4 h-4 text-white/30 mb-1" />
                <div className="text-xl font-bold text-white">{formData.durationDays}</div>
                <span className="text-[10px] text-white/30 uppercase">Days</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] font-mono text-sm">
              <span className="text-white/30">ID: </span>
              <span className="text-white">{campaignId}</span>
            </div>
          </div>

          <a
            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-8 text-sm transition-colors"
          >
            View transaction on Solana Explorer
            <ExternalLink className="w-4 h-4" />
          </a>

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/explore')}
              className="flex-1 py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all active:scale-[0.98]"
            >
              View All Campaigns
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
    <div className="min-h-screen flex flex-col">
      {/* Header with progress */}
      <div className="px-6 pt-8">
        <div className="max-w-3xl mx-auto">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/30">Step {step} of {TOTAL_STEPS}</span>
            <span className="text-sm text-white/30">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  index < step ? 'bg-white' : 'bg-white/[0.08]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center px-6 py-12">
        <div className="w-full max-w-3xl">
          {/* Step 1: Set Target */}
          {step === 1 && (
            <div>
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-4">
                  <Target className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Funding Goal</span>
                </div>
                <h1 className="text-4xl font-bold text-white mb-3">
                  How much do you need?
                </h1>
                <p className="text-white/40 text-lg">
                  Set a realistic goal. You can always exceed it.
                </p>
              </div>

              <div className="mb-10">
                <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-3">
                  Target Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.goal}
                    onChange={(e) =>
                      setFormData({ ...formData, goal: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full bg-transparent text-white text-5xl font-light border-b-2 border-white/[0.1] pb-4 focus:border-white/[0.3] transition-colors font-mono placeholder-white/10"
                  />
                  <span className="absolute right-0 bottom-5 text-2xl text-white/30 font-light">
                    SOL
                  </span>
                </div>
                <p className="text-white/20 text-sm mt-2">
                  ≈ ${((parseFloat(formData.goal) || 0) * 150).toFixed(2)} USD
                </p>
              </div>

              <div>
                <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-4">
                  Campaign Duration
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {['7', '14', '30', '60'].map((days) => (
                    <button
                      key={days}
                      onClick={() => setFormData({ ...formData, durationDays: days })}
                      className={`relative py-4 rounded-2xl border transition-all ${
                        formData.durationDays === days
                          ? 'border-white bg-white/[0.05] text-white'
                          : 'border-white/[0.08] text-white/40 hover:border-white/[0.15] hover:text-white/60'
                      }`}
                    >
                      <div className="text-2xl font-semibold">{days}</div>
                      <div className="text-xs text-white/30">days</div>
                      {days === '30' && formData.durationDays !== '30' && (
                        <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-white text-black text-[9px] font-bold rounded-full">
                          POPULAR
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Privacy Level */}
          {step === 2 && (
            <div>
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-4">
                  <Shield className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Protect Your Donors</span>
                </div>
                <h1 className="text-4xl font-bold text-white mb-3">
                  How much protection do supporters need?
                </h1>
                <p className="text-white/40 text-lg mb-2">
                  Some causes need visible support. Others need quiet help.
                </p>
                <p className="text-white/25 text-sm">
                  Private donations encourage more giving from people who can't be public.
                </p>
              </div>

              <div className="space-y-4">
                {privacyOptions.map((option) => (
                  <button
                    key={option.level}
                    onClick={() =>
                      setFormData({ ...formData, privacyLevel: option.level })
                    }
                    className={`relative w-full p-6 rounded-2xl border text-left transition-all ${
                      formData.privacyLevel === option.level
                        ? 'border-white bg-white/[0.05]'
                        : 'border-white/[0.08] hover:border-white/[0.15]'
                    }`}
                  >
                    {option.recommended && (
                      <span className="absolute -top-3 left-6 px-3 py-1 bg-white text-black text-[10px] font-bold rounded-full">
                        RECOMMENDED
                      </span>
                    )}

                    <div className="flex items-start gap-4">
                      <div
                        className={`p-3 rounded-xl ${
                          formData.privacyLevel === option.level
                            ? 'bg-white/[0.1]'
                            : 'bg-white/[0.03]'
                        }`}
                      >
                        <option.icon
                          className={`w-6 h-6 ${
                            formData.privacyLevel === option.level
                              ? 'text-white'
                              : 'text-white/40'
                          }`}
                        />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-semibold text-white">
                            {option.title}
                          </span>
                          <span className="text-xs text-white/30 px-2 py-0.5 rounded bg-white/[0.05]">
                            {option.subtitle}
                          </span>
                        </div>
                        <p className="text-white/40 text-sm mb-3">
                          {option.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {option.features.map((feature) => (
                            <span
                              key={feature}
                              className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.03] text-white/40"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>

                      {formData.privacyLevel === option.level && (
                        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-black" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Campaign Details */}
          {step === 3 && (
            <div>
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-4">
                  <Sparkles className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Campaign Story</span>
                </div>
                <h1 className="text-4xl font-bold text-white mb-3">
                  Tell your story
                </h1>
                <p className="text-white/40 text-lg">
                  A compelling story inspires more support.
                </p>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-3">
                    Campaign Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Give your campaign a memorable name"
                    maxLength={64}
                    className="w-full bg-transparent text-white text-2xl font-medium border-b-2 border-white/[0.1] pb-3 focus:border-white/[0.3] transition-colors placeholder-white/20"
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-white/20">Make it catchy and clear</span>
                    <span className="text-xs text-white/30">{formData.title.length}/64</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-3">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Explain why you're raising funds and how they'll be used..."
                    rows={5}
                    maxLength={256}
                    className="w-full bg-white/[0.02] text-white text-base border border-white/[0.08] rounded-2xl p-4 focus:border-white/[0.15] transition-colors placeholder-white/20 resize-none leading-relaxed"
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-white/20">Be specific about your needs</span>
                    <span className="text-xs text-white/30">{formData.description.length}/256</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Finalize */}
          {step === 4 && (
            <div>
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-4">
                  <Zap className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Final Review</span>
                </div>
                <h1 className="text-4xl font-bold text-white mb-3">
                  Ready to launch?
                </h1>
                <p className="text-white/40 text-lg">
                  Review your campaign before going live on Solana.
                </p>
              </div>

              {/* Preview card */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] overflow-hidden mb-6">
                <div className="p-6 border-b border-white/[0.06]">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white/[0.05]">
                        {formData.privacyLevel === 'PUBLIC' && <Eye className="w-5 h-5 text-white/60" />}
                        {formData.privacyLevel === 'SEMI' && <Shield className="w-5 h-5 text-white/60" />}
                        {(formData.privacyLevel === 'PRIVATE' || formData.privacyLevel === 'ZK_COMPRESSED') && (
                          <Lock className="w-5 h-5 text-white/60" />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-white/30 uppercase tracking-wider">
                          {privacyLabels[formData.privacyLevel]} Campaign
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.05]">
                      <Clock className="w-3 h-3 text-white/40" />
                      <span className="text-xs text-white/50">{formData.durationDays} days</span>
                    </div>
                  </div>

                  <h3 className="text-2xl font-semibold text-white mb-2">
                    {formData.title || 'Untitled Campaign'}
                  </h3>
                  <p className="text-white/40 text-sm line-clamp-2">
                    {formData.description || 'No description provided'}
                  </p>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">Goal</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-bold text-white">{formData.goal || '0'}</span>
                        <span className="text-white/40">SOL</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">Network</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-2 h-2 rounded-full bg-white/50" />
                        <span className="text-white">Solana Devnet</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!connected && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
                      <Lock className="w-5 h-5 text-white/40" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Wallet Required</p>
                      <p className="text-white/40 text-sm">Connect your wallet to launch on Solana</p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-12">
            {step > 1 && (
              <button
                onClick={handleBack}
                disabled={isLaunching}
                className="p-4 border border-white/[0.08] rounded-2xl hover:bg-white/[0.03] transition-all disabled:opacity-50"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            )}

            {step < TOTAL_STEPS ? (
              <button
                onClick={handleNext}
                className="flex-1 py-4 bg-white text-black font-medium rounded-2xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleLaunch}
                disabled={isLaunching}
                className="flex-1 py-4 bg-white text-black font-medium rounded-2xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
              >
                {isLaunching ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Deploying to Solana...
                  </>
                ) : connected ? (
                  <>
                    <Zap className="w-5 h-5" />
                    Launch Campaign
                  </>
                ) : (
                  'Connect Wallet to Launch'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
