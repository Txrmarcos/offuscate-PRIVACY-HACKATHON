'use client';

import { useState, useEffect } from 'react';
import { Clock, Check, AlertCircle, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { checkDonationStatus, getPendingDonations, type DonationStatus } from '../lib/privacy/batchDonation';

interface PendingDonation {
  commitment: string;
  campaignId: string;
  campaignVault: string;
  donationId: string;
  queuedAt: number;
  amount: number;
}

export function PendingDonations() {
  const { publicKey } = useWallet();
  const [donations, setDonations] = useState<PendingDonation[]>([]);
  const [statuses, setStatuses] = useState<Map<string, DonationStatus>>(new Map());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  // Load pending donations from localStorage
  useEffect(() => {
    if (!publicKey) {
      setDonations([]);
      return;
    }

    const pending = getPendingDonations(publicKey);
    setDonations(pending);
  }, [publicKey]);

  // Check status for all pending donations
  const checkAllStatuses = async () => {
    if (donations.length === 0) return;

    setLoading(true);
    const newStatuses = new Map<string, DonationStatus>();

    for (const donation of donations) {
      try {
        const status = await checkDonationStatus(donation.donationId);
        if (status) {
          newStatuses.set(donation.donationId, status);
        }
      } catch (err) {
        console.error('Failed to check status:', err);
      }
    }

    setStatuses(newStatuses);
    setLoading(false);
  };

  // Check status on mount and every 30 seconds
  useEffect(() => {
    if (donations.length === 0) return;

    checkAllStatuses();
    const interval = setInterval(checkAllStatuses, 30000);
    return () => clearInterval(interval);
  }, [donations]);

  // Refresh single donation status
  const refreshStatus = async (donationId: string) => {
    setRefreshing(donationId);
    try {
      const status = await checkDonationStatus(donationId);
      if (status) {
        setStatuses(prev => new Map(prev).set(donationId, status));
      }
    } catch (err) {
      console.error('Failed to refresh status:', err);
    }
    setRefreshing(null);
  };

  if (!publicKey || donations.length === 0) {
    return null;
  }

  const getStatusIcon = (status: DonationStatus['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-white/40" />;
    }
  };

  const getStatusText = (status: DonationStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'processing':
        return 'Processing...';
      case 'failed':
        return 'Failed';
      default:
        return 'Waiting for batch';
    }
  };

  const getStatusColor = (status: DonationStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'processing':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-white/40';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Filter to show only non-completed donations (or recently completed)
  const activeDonations = donations.filter(d => {
    const status = statuses.get(d.donationId);
    if (!status) return true; // Show if we don't have status yet
    if (status.status === 'completed') {
      // Hide completed donations older than 1 hour
      const age = Date.now() - (status.processedAt || d.queuedAt);
      return age < 3600000;
    }
    return true;
  });

  if (activeDonations.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#0a0a0a]/80 border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Clock className="w-4 h-4 text-white/40" />
          Pending Donations
        </h3>
        <button
          onClick={checkAllStatuses}
          disabled={loading}
          className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-white/40 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        {activeDonations.map((donation) => {
          const status = statuses.get(donation.donationId);
          const currentStatus = status?.status || 'pending';

          return (
            <div
              key={donation.donationId}
              className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(currentStatus)}
                  <span className={`text-sm ${getStatusColor(currentStatus)}`}>
                    {getStatusText(currentStatus)}
                  </span>
                </div>
                <button
                  onClick={() => refreshStatus(donation.donationId)}
                  disabled={refreshing === donation.donationId}
                  className="p-1 rounded hover:bg-white/[0.05] transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 text-white/30 ${refreshing === donation.donationId ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-white/30">Campaign</span>
                  <p className="text-white/60 truncate">{donation.campaignId}</p>
                </div>
                <div>
                  <span className="text-white/30">Amount</span>
                  <p className="text-white/60 font-mono">{(donation.amount / 1e9).toFixed(2)} SOL</p>
                </div>
                <div>
                  <span className="text-white/30">Queued</span>
                  <p className="text-white/60">{formatTime(donation.queuedAt)}</p>
                </div>
                <div>
                  <span className="text-white/30">ID</span>
                  <p className="text-white/60 font-mono truncate">{donation.donationId.slice(0, 12)}...</p>
                </div>
              </div>

              {status?.txSignature && (
                <a
                  href={`https://explorer.solana.com/tx/${status.txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1 text-xs text-green-400/60 hover:text-green-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View transaction
                </a>
              )}

              {status?.error && (
                <p className="mt-2 text-xs text-red-400/80">{status.error}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[10px] text-white/20 text-center">
        Donations are processed in batches for maximum privacy
      </p>
    </div>
  );
}
