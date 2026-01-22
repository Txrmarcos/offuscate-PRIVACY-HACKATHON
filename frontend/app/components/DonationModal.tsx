'use client';

import { useState } from 'react';
import { X, Eye, EyeOff, Lock, ArrowRight } from 'lucide-react';
import { Campaign, PrivacyLevel } from '../lib/types';

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
    description: 'Stealth address relayer. Sender hidden.',
    icon: EyeOff,
  },
  {
    level: 'PRIVATE',
    title: 'Fully Private',
    description: 'Zero-Knowledge. Sender, Receiver, Amount hidden.',
    icon: Lock,
  },
];

export function DonationModal({ campaign, onClose }: DonationModalProps) {
  const [selectedPrivacy, setSelectedPrivacy] = useState<PrivacyLevel>('PRIVATE');
  const [amount] = useState(1.0);

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
          Select Privacy Level
        </h2>

        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-[#737373]">Sending to</span>
          <span className="text-[#737373]">Amount</span>
        </div>
        <div className="flex items-center justify-between mb-6">
          <span className="text-white font-medium">{campaign.title}</span>
          <span className="text-white font-semibold">{amount} SOL</span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {privacyOptions.map((option) => (
            <button
              key={option.level}
              onClick={() => setSelectedPrivacy(option.level)}
              className={`relative p-4 rounded-xl border text-left transition-all h-full ${
                selectedPrivacy === option.level
                  ? 'border-white bg-[#1a1a1a]'
                  : 'border-[#262626] hover:border-[#404040]'
              }`}
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
              <p className="text-[#737373] text-sm">{option.description}</p>
            </button>
          ))}
        </div>

        <button className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
