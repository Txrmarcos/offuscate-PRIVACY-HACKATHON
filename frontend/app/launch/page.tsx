'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PrivacyLevel } from '../lib/types';

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
};

export default function LaunchPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    goal: '',
    privacyLevel: 'SEMI' as PrivacyLevel,
    title: '',
    description: '',
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

  const handleLaunch = () => {
    router.push('/explore');
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-3xl">
        {/* Progress Steps */}
        <div className="flex gap-2 mb-16">
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index < step ? 'bg-white' : 'bg-[#262626]'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Set Target */}
        {step === 1 && (
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Set the target</h1>
            <p className="text-[#737373] mb-10">How much SOL do you need?</p>

            <div className="mb-8">
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-3">
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
                  className="w-full bg-transparent text-white text-4xl font-light border-b border-[#262626] pb-4 focus:border-[#404040] transition-colors"
                />
                <span className="absolute right-0 bottom-4 text-[#737373]">
                  SOL
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Privacy Level */}
        {step === 2 && (
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Privacy level</h1>
            <p className="text-[#737373] mb-10">
              Choose how transactions appear on-chain.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {privacyOptions.map((option) => (
                <button
                  key={option.level}
                  onClick={() =>
                    setFormData({ ...formData, privacyLevel: option.level })
                  }
                  className={`relative p-5 rounded-xl border text-left transition-all h-full ${
                    formData.privacyLevel === option.level
                      ? 'border-white bg-[#1a1a1a]'
                      : 'border-[#262626] hover:border-[#404040]'
                  }`}
                >
                  {formData.privacyLevel === option.level && (
                    <span className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                  <option.icon
                    className={`w-5 h-5 mb-4 ${
                      formData.privacyLevel === option.level
                        ? 'text-white'
                        : 'text-[#737373]'
                    }`}
                  />
                  <div className="text-white font-medium mb-2">
                    {option.title}
                  </div>
                  <p className="text-[#737373] text-sm">
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
            <h1 className="text-3xl font-bold text-white mb-2">Campaign details</h1>
            <p className="text-[#737373] mb-10">Tell supporters about your mission.</p>

            <div className="space-y-6">
              <div>
                <label className="block text-xs text-[#737373] uppercase tracking-wider mb-3">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter campaign name"
                  className="w-full bg-transparent text-white text-lg border-b border-[#262626] pb-3 focus:border-[#404040] transition-colors placeholder-[#404040]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#737373] uppercase tracking-wider mb-3">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe your campaign..."
                  rows={4}
                  className="w-full bg-[#141414] text-white border border-[#262626] rounded-lg p-4 focus:border-[#404040] transition-colors placeholder-[#404040] resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Finalize */}
        {step === 4 && (
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Finalize</h1>
            <p className="text-[#737373] mb-10">Review and launch your campaign.</p>

            <div className="p-6 bg-[#141414] border border-[#262626] rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-[#737373] uppercase tracking-wider">
                  Campaign
                </span>
                <span className="text-xs text-[#737373] uppercase tracking-wider">
                  Goal
                </span>
              </div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-white font-medium">
                  {formData.title || 'Untitled Campaign'}
                </span>
                <span className="text-white font-semibold">
                  {formData.goal || '0'} SOL
                </span>
              </div>

              <div>
                <span className="text-xs text-[#737373] uppercase tracking-wider">
                  Security Level
                </span>
                <div className="flex items-center gap-2 mt-2">
                  {formData.privacyLevel === 'PUBLIC' && <Eye className="w-4 h-4 text-[#737373]" />}
                  {formData.privacyLevel === 'SEMI' && <EyeOff className="w-4 h-4 text-[#737373]" />}
                  {formData.privacyLevel === 'PRIVATE' && <Lock className="w-4 h-4 text-[#737373]" />}
                  <span className="text-white">
                    {privacyLabels[formData.privacyLevel]}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 mt-12">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="p-4 border border-[#262626] rounded-xl hover:bg-[#141414] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              className="flex-1 py-4 bg-white text-black font-medium rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              className="flex-1 py-4 bg-white text-black font-medium rounded-xl hover:bg-gray-100 transition-colors"
            >
              Launch Campaign
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
