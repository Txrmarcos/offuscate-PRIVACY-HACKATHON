'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Shield, Lock, AlertTriangle, CheckCircle, Fingerprint, Search, X } from 'lucide-react';
import { PrivacyLevel } from '../lib/types';

interface PrivacyFeedbackProps {
  privacyLevel: PrivacyLevel;
  txSignature: string;
  amount: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

interface PrivacyConfig {
  title: string;
  description: string;
  icon: typeof Eye;
  trackability: number;
  opacity: number; // Higher = more protected
  risks: string[];
  protections: string[];
}

// Privacy level configurations
const PRIVACY_CONFIG: Record<PrivacyLevel, PrivacyConfig> = {
  PUBLIC: {
    title: 'Fully Trackable',
    description: 'Your wallet address is directly linked to this transaction.',
    icon: Eye,
    trackability: 100,
    opacity: 0.3,
    risks: [
      'Sender address visible on explorer',
      'Transaction amount fully visible',
      'Direct link between wallets',
      'Can be traced by anyone',
    ],
    protections: [],
  },
  SEMI: {
    title: 'Unlinkable Transfer',
    description: 'Mixed in privacy pool. Source wallet not visible on final transfer.',
    icon: Shield,
    trackability: 30,
    opacity: 0.6,
    risks: [
      'Deposit to pool is visible',
      'Timing analysis possible',
    ],
    protections: [
      'Withdrawal from different pool address',
      'Time delay breaks correlation',
      'Standardized amounts prevent amount tracking',
      'Multiple users in same pool',
    ],
  },
  ZK_COMPRESSED: {
    title: 'ZK Protected',
    description: 'Zero-knowledge proofs verify transfer without revealing details.',
    icon: Lock,
    trackability: 15,
    opacity: 0.8,
    risks: [
      'Initial compression visible',
      'Final decompression visible',
    ],
    protections: [
      'Compressed state hidden in Merkle tree',
      'Only state root changes on-chain',
      'ZK proof verifies without revealing',
      'Sender-receiver link broken',
      '99% reduction in on-chain data',
    ],
  },
  PRIVATE: {
    title: 'Maximum Privacy',
    description: 'Bulletproofs ZK hides both sender and amount.',
    icon: Lock,
    trackability: 5,
    opacity: 1,
    risks: [
      'Network-level metadata (IP)',
    ],
    protections: [
      'Amount hidden with range proofs',
      'Sender completely anonymous',
      'Stealth address for receiver',
      'No direct on-chain link',
    ],
  },
};

// Animated particles for privacy visualization
function PrivacyParticles({ count = 12 }: { count?: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-white opacity-40"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float-particle ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}
    </div>
  );
}

// Animated shield/lock for protected transactions
function ProtectionAnimation({ level }: { level: PrivacyLevel }) {
  const config = PRIVACY_CONFIG[level];
  const Icon = config.icon;

  return (
    <div className="relative w-24 h-24 mx-auto mb-4">
      {/* Outer pulsing ring */}
      <div
        className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping opacity-20"
        style={{ animationDuration: '2s' }}
      />

      {/* Middle rotating ring (only for protected levels) */}
      {level !== 'PUBLIC' && (
        <div
          className="absolute inset-2 rounded-full border border-dashed border-white/30 opacity-40"
          style={{ animation: 'spin 8s linear infinite' }}
        />
      )}

      {/* Icon container */}
      <div
        className="absolute inset-4 rounded-full border border-white/20 flex items-center justify-center"
        style={{ backgroundColor: `rgba(255, 255, 255, ${config.opacity * 0.1})` }}
      >
        <Icon className={`w-8 h-8 text-white ${level === 'PUBLIC' ? 'opacity-50 animate-pulse' : ''}`} style={{ opacity: config.opacity }} />
      </div>

      {/* Floating particles for protected levels */}
      {level !== 'PUBLIC' && <PrivacyParticles />}
    </div>
  );
}

// Trackability meter visualization
function TrackabilityMeter({ percentage, opacity }: { percentage: number; opacity: number }) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPercentage(percentage), 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-white/40 text-xs flex items-center gap-1">
          <Search className="w-3 h-3" />
          Trackability Risk
        </span>
        <span className="text-sm font-mono text-white" style={{ opacity }}>
          {animatedPercentage}%
        </span>
      </div>
      <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className="h-full bg-white transition-all duration-1000 ease-out"
          style={{ width: `${animatedPercentage}%`, opacity }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/20 mt-1">
        <span>Untrackable</span>
        <span>Fully Visible</span>
      </div>
    </div>
  );
}

// What can be seen visualization
function VisibilityBreakdown({ level }: { level: PrivacyLevel }) {
  const visibility = {
    PUBLIC: {
      senderAddress: true,
      receiverAddress: true,
      amount: true,
      timestamp: true,
      walletLink: true,
    },
    SEMI: {
      senderAddress: false, // Hidden after pool
      receiverAddress: true,
      amount: true, // Standardized
      timestamp: false, // Delayed
      walletLink: false,
    },
    ZK_COMPRESSED: {
      senderAddress: false,
      receiverAddress: true, // Eventually
      amount: true, // Verified by ZK
      timestamp: true,
      walletLink: false,
    },
    PRIVATE: {
      senderAddress: false,
      receiverAddress: false, // Stealth
      amount: false, // Hidden
      timestamp: true,
      walletLink: false,
    },
  };

  const items = [
    { key: 'senderAddress', label: 'Your Wallet', icon: Fingerprint },
    { key: 'receiverAddress', label: 'Destination', icon: Search },
    { key: 'amount', label: 'Amount', icon: Eye },
    { key: 'walletLink', label: 'Wallet Link', icon: AlertTriangle },
  ];

  const vis = visibility[level];

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {items.map(({ key, label, icon: Icon }) => {
        const isVisible = vis[key as keyof typeof vis];
        return (
          <div
            key={key}
            className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
              isVisible
                ? 'bg-white/[0.02] border border-white/[0.06] text-white/40'
                : 'bg-white/[0.05] border border-white/[0.1] text-white/70'
            }`}
          >
            {isVisible ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
            <span>{label}</span>
            {isVisible ? (
              <span className="ml-auto text-[10px] text-white/30">Visible</span>
            ) : (
              <span className="ml-auto text-[10px] text-white/60">Hidden</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PrivacyFeedback({
  privacyLevel,
  txSignature,
  amount,
  isExpanded = false,
  onToggleExpand,
}: PrivacyFeedbackProps) {
  const [showDetails, setShowDetails] = useState(isExpanded);
  const config = PRIVACY_CONFIG[privacyLevel];

  return (
    <div
      className="relative rounded-xl border border-white/[0.1] p-4 overflow-hidden"
      style={{ backgroundColor: `rgba(255, 255, 255, ${config.opacity * 0.02})` }}
    >
      {/* Background animation */}
      <div className="absolute inset-0 opacity-30">
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent"
          style={{ animation: 'shimmer 3s infinite' }}
        />
      </div>

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <ProtectionAnimation level={privacyLevel} />
          </div>
        </div>

        {/* Title and description */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-white mb-1">
            {config.title}
          </h3>
          <p className="text-white/40 text-sm">{config.description}</p>
        </div>

        {/* Trackability meter */}
        <TrackabilityMeter percentage={config.trackability} opacity={config.opacity} />

        {/* Quick visibility breakdown */}
        <VisibilityBreakdown level={privacyLevel} />

        {/* Expand button */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full py-2 text-white/30 hover:text-white/60 text-xs flex items-center justify-center gap-1 transition-colors"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
          <svg
            className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Expanded details */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-4 animate-fadeIn">
            {/* Risks */}
            {config.risks.length > 0 && (
              <div>
                <h4 className="text-xs text-white/40 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-white/40" />
                  Potential Risks
                </h4>
                <ul className="space-y-1">
                  {config.risks.map((risk, i) => (
                    <li key={i} className="text-xs text-white/40 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-white/30" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Protections */}
            {config.protections.length > 0 && (
              <div>
                <h4 className="text-xs text-white/40 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-white/60" />
                  Privacy Protections
                </h4>
                <ul className="space-y-1">
                  {config.protections.map((protection, i) => (
                    <li key={i} className="text-xs text-white/60 flex items-center gap-2">
                      <CheckCircle className="w-3 h-3" />
                      {protection}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Explorer note */}
            <div className="bg-white/[0.02] rounded-lg p-3">
              <p className="text-[10px] text-white/30">
                {privacyLevel === 'PUBLIC' ? (
                  <>
                    <strong className="text-white/50">Try it:</strong> Search your wallet address on{' '}
                    <a
                      href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/60 hover:underline"
                    >
                      Solana Explorer
                    </a>
                    {' '}— you'll see your address directly linked to this transaction.
                  </>
                ) : privacyLevel === 'ZK_COMPRESSED' ? (
                  <>
                    <strong className="text-white/50">Verification:</strong> The transaction on{' '}
                    <a
                      href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/60 hover:underline"
                    >
                      Explorer
                    </a>
                    {' '}shows Light System Program calls — the actual transfer details are hidden in compressed state.
                  </>
                ) : privacyLevel === 'SEMI' ? (
                  <>
                    <strong className="text-white/50">Privacy Pool:</strong> Your deposit is visible, but the withdrawal to the campaign comes from the pool — breaking the direct link.
                  </>
                ) : (
                  <>
                    <strong className="text-white/50">Maximum Privacy:</strong> Even with the transaction hash, linking this to your wallet requires breaking the cryptographic protections.
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Custom styles */}
      <style jsx>{`
        @keyframes float-particle {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.4;
          }
          50% {
            transform: translateY(-10px) scale(1.2);
            opacity: 0.7;
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// Compact inline indicator for lists
export function PrivacyBadge({ level }: { level: PrivacyLevel }) {
  const config = PRIVACY_CONFIG[level];
  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border border-white/[0.1] bg-white/[0.03]"
      style={{ opacity: 0.5 + config.opacity * 0.5 }}
    >
      <Icon className="w-3 h-3 text-white/60" />
      <span className="text-white/60">{config.trackability}% trackable</span>
    </span>
  );
}

// Mini indicator for transaction lists
export function TrackabilityDot({ level }: { level: PrivacyLevel }) {
  const config = PRIVACY_CONFIG[level];

  return (
    <div className="relative group">
      <div
        className="w-2 h-2 rounded-full bg-white"
        style={{ opacity: config.opacity }}
      />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {config.trackability}% trackable
      </div>
    </div>
  );
}
