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
  const privacyLevel = campaign.privacyLevel || campaign.privacy || 'SEMI';

  return (
    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <span
          className={`px-2.5 py-1 text-[10px] font-medium rounded-lg ${
            privacyLevel === 'PRIVATE'
              ? 'bg-white text-black'
              : privacyLevel === 'SEMI'
              ? 'bg-white/[0.08] text-white/60'
              : 'bg-white/[0.04] text-white/30'
          }`}
        >
          {PRIVACY_LABELS[privacyLevel]}
        </span>
        <div className="flex items-center gap-1 text-white/30 text-xs">
          <Users className="w-3.5 h-3.5" />
          <span>{formatNumber(campaign.supporters)}</span>
        </div>
      </div>

      <h3 className="text-white font-medium text-lg mb-2">{campaign.title}</h3>
      <p className="text-white/40 text-sm mb-6 flex-1 line-clamp-2">{campaign.description}</p>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-white/30">Progress</span>
          <span className="text-white font-mono">{progress}%</span>
        </div>
        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-white/25 mt-2 uppercase tracking-wide">
          <span>{campaign.raised.toFixed(2)} SOL RAISED</span>
          <span>GOAL: {campaign.goal} SOL</span>
        </div>
      </div>

      <button
        onClick={() => onSupport(campaign)}
        className="w-full py-3 border border-white/[0.1] text-white text-sm font-medium rounded-xl hover:bg-white/[0.03] transition-all active:scale-[0.98]"
      >
        Support Mission
      </button>
    </div>
  );
}
