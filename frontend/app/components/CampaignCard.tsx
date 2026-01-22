'use client';

import { Users } from 'lucide-react';
import { Campaign, PRIVACY_LABELS } from '../lib/types';

interface CampaignCardProps {
  campaign: Campaign;
  onSupport: (campaign: Campaign) => void;
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

export function CampaignCard({ campaign, onSupport }: CampaignCardProps) {
  const progress = Math.round((campaign.raised / campaign.goal) * 100);

  return (
    <div className="p-6 bg-[#141414] border border-[#262626] rounded-xl flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <span
          className={`px-3 py-1 text-xs font-medium rounded-full ${
            campaign.privacyLevel === 'PRIVATE'
              ? 'bg-white text-black'
              : campaign.privacyLevel === 'SEMI'
              ? 'bg-[#262626] text-white'
              : 'bg-[#262626] text-[#737373]'
          }`}
        >
          {PRIVACY_LABELS[campaign.privacyLevel]}
        </span>
        <div className="flex items-center gap-1 text-[#737373] text-sm">
          <Users className="w-4 h-4" />
          <span>{formatNumber(campaign.supporters)}</span>
        </div>
      </div>

      <h3 className="text-white font-semibold text-lg mb-2">{campaign.title}</h3>
      <p className="text-[#737373] text-sm mb-6 flex-1">{campaign.description}</p>

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-[#737373]">Progress</span>
          <span className="text-white">{progress}%</span>
        </div>
        <div className="h-1 bg-[#262626] rounded-full overflow-hidden">
          <div
            className="h-full progress-bar rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-[#737373] mt-2">
          <span>{campaign.raised} SOL RAISED</span>
          <span>GOAL: {campaign.goal} SOL</span>
        </div>
      </div>

      <button
        onClick={() => onSupport(campaign)}
        className="w-full py-3.5 border border-[#262626] text-white font-medium rounded-full hover:bg-[#1a1a1a] transition-colors"
      >
        Support Mission
      </button>
    </div>
  );
}
