'use client';

import { Users, Clock, Target, Shield, Lock, Eye, TrendingUp, Zap, DollarSign, Briefcase, UserPlus } from 'lucide-react';
import { PayrollBatch, PRIVACY_LABELS, PrivacyLevel } from '../lib/types';

// Legacy alias for backwards compatibility
type Campaign = PayrollBatch;

interface CampaignCardProps {
  campaign: Campaign;
  onSupport: (campaign: Campaign) => void;
  onInvite?: (campaign: Campaign) => void;
  featured?: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

function getPrivacyIcon(level: PrivacyLevel) {
  switch (level) {
    case 'PRIVATE':
    case 'ZK_COMPRESSED':
      return Lock;
    case 'SEMI':
      return Shield;
    default:
      return Eye;
  }
}

function getStatusLabel(daysLeft: number): { label: string; urgent: boolean } {
  if (daysLeft <= 0) return { label: 'Completed', urgent: false };
  if (daysLeft <= 3) return { label: `${daysLeft}d remaining`, urgent: true };
  if (daysLeft <= 7) return { label: `${daysLeft} days left`, urgent: true };
  return { label: `${daysLeft} days left`, urgent: false };
}

export function CampaignCard({ campaign, onSupport, onInvite, featured = false }: CampaignCardProps) {
  // Support both old (raised/goal) and new (totalPaid/budget) field names
  const totalPaid = (campaign as any).totalPaid ?? campaign.raised ?? 0;
  const budget = (campaign as any).budget ?? campaign.goal ?? 1;
  const recipients = (campaign as any).recipients ?? campaign.supporters ?? 0;

  const progress = Math.min(100, Math.round((totalPaid / budget) * 100));
  const privacyLevel = (campaign.privacyLevel || campaign.privacy || 'SEMI') as PrivacyLevel;
  const PrivacyIcon = getPrivacyIcon(privacyLevel);
  const status = getStatusLabel(campaign.daysLeft ?? 0);
  const isComplete = progress >= 100;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl transition-all duration-300 ${
        featured
          ? 'bg-gradient-to-br from-white/[0.08] to-white/[0.02] border-2 border-white/[0.1] hover:border-white/[0.2]'
          : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
      }`}
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
      </div>

      {/* Featured badge */}
      {featured && (
        <div className="absolute top-0 right-0">
          <div className="bg-white text-black text-[10px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            IN PROGRESS
          </div>
        </div>
      )}

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-xl ${
                privacyLevel === 'PRIVATE' || privacyLevel === 'ZK_COMPRESSED'
                  ? 'bg-white/[0.1]'
                  : privacyLevel === 'SEMI'
                  ? 'bg-white/[0.06]'
                  : 'bg-white/[0.03]'
              }`}
            >
              <PrivacyIcon className="w-4 h-4 text-white/70" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-white/40">
                {PRIVACY_LABELS[privacyLevel]}
              </span>
            </div>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
              status.urgent
                ? 'bg-white/[0.1] text-white'
                : 'bg-white/[0.03] text-white/40'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>{status.label}</span>
          </div>
        </div>

        {/* Title & Description */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-white/90 transition-colors line-clamp-1">
            {campaign.title}
          </h3>
          <p className="text-white/40 text-sm leading-relaxed line-clamp-2">
            {campaign.description}
          </p>
        </div>

        {/* Progress Section */}
        <div className="mb-6">
          {/* Progress bar */}
          <div className="relative h-2 bg-white/[0.06] rounded-full overflow-hidden mb-3">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                isComplete
                  ? 'bg-gradient-to-r from-white to-white/80'
                  : 'bg-white'
              }`}
              style={{ width: `${progress}%` }}
            />
            {/* Animated shimmer */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">{totalPaid.toFixed(2)}</span>
                <span className="text-white/40 text-sm">SOL</span>
              </div>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">
                of {budget} SOL budget
              </span>
            </div>

            <div className="text-right">
              <div className="text-2xl font-bold text-white">{progress}%</div>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">distributed</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-white/40">
              <Users className="w-4 h-4" />
              <span className="text-sm">{formatNumber(recipients)}</span>
              <span className="text-xs text-white/30">recipients</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onInvite && (
              <button
                onClick={() => onInvite(campaign)}
                className="px-4 py-2.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98] flex items-center gap-2 bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white border border-white/[0.06]"
              >
                <UserPlus className="w-4 h-4" />
                Invite
              </button>
            )}

            <button
              onClick={() => onSupport(campaign)}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98] flex items-center gap-2 ${
                isComplete
                  ? 'bg-white/[0.1] text-white/60 hover:bg-white/[0.15]'
                  : 'bg-white text-black hover:bg-white/90'
              }`}
            >
              {isComplete ? (
                'Completed'
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  Add Payment
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-white/20 via-white/40 to-white/20 transition-all duration-500"
        style={{ width: `${progress}%` }}
      />

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
