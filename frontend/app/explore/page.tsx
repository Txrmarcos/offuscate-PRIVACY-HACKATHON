'use client';

import { useState, useEffect } from 'react';
import { Search, RefreshCw, Loader2, Shield, Users, Briefcase, TrendingUp, Plus, ArrowRight, Clock, Building2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { CampaignCard } from '../components/CampaignCard';
import { DonationModal } from '../components/DonationModal';
import { InviteManager } from '../components/InviteManager';
import { PayrollBatch } from '../lib/types';
import { useProgram, CampaignData } from '../lib/program';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';

function toUIPayrollBatch(
  pubkey: PublicKey,
  data: CampaignData,
  vaultBalance: number
): PayrollBatch {
  const progress = data.goal > 0 ? (vaultBalance / data.goal) * 100 : 0;
  const daysLeft = Math.max(0, Math.ceil((data.deadline - Date.now() / 1000) / 86400));

  return {
    id: data.campaignId,
    title: data.title,
    description: data.description,
    budget: data.goal,
    totalPaid: vaultBalance,
    recipients: data.donorCount,
    daysLeft,
    privacy: 'PRIVATE',
    organizer: data.owner.toBase58().slice(0, 8) + '...',
    status: 'active',
  };
}

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<PayrollBatch | null>(null);
  const [inviteBatch, setInviteBatch] = useState<PayrollBatch | null>(null);
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { listCampaigns, fetchVaultBalance } = useProgram();

  const loadBatches = async () => {
    setIsLoading(true);
    try {
      const onChainBatches = await listCampaigns();

      const uiBatches: PayrollBatch[] = [];
      for (const { pubkey, account } of onChainBatches) {
        if (account.status !== 'Active') continue;

        // Filter: only show batches owned by the connected wallet
        if (connected && publicKey) {
          if (account.owner.toBase58() !== publicKey.toBase58()) {
            continue;
          }
        }

        try {
          const vaultBalance = await fetchVaultBalance(account.campaignId);
          uiBatches.push(toUIPayrollBatch(pubkey, account, vaultBalance));
        } catch {
          // Skip batches we can't fetch vault balance for
        }
      }

      setBatches(uiBatches);
    } catch (err) {
      console.error('Failed to load payroll batches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [connected, publicKey?.toBase58()]);

  const filteredBatches = batches.filter(
    (batch) =>
      batch.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const totalPaid = batches.reduce((acc, b) => acc + b.totalPaid, 0);
  const totalRecipients = batches.reduce((acc, b) => acc + b.recipients, 0);
  const activeBatches = batches.length;

  // Get featured batch (highest progress or most recent)
  const featuredBatch = [...batches].sort((a, b) => {
    const progressA = a.totalPaid / a.budget;
    const progressB = b.totalPaid / b.budget;
    return progressB - progressA;
  })[0];

  // Require wallet connection for companies
  if (!connected) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <Building2 className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Payroll</h1>
          <p className="text-white/40 text-lg mb-3">
            Manage private payroll batches for your company.
          </p>
          <p className="text-white/25 text-sm mb-8">
            Connect your wallet to create and manage payroll distributions.
          </p>
          <button
            onClick={() => setVisible(true)}
            className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all flex items-center gap-2 mx-auto"
          >
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section - Compact */}
      <section className="relative px-6 pt-24 pb-8">
        <div className="max-w-6xl mx-auto">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-4">
                <Briefcase className="w-3.5 h-3.5 text-white/40" />
                <span className="text-[10px] text-white/40 uppercase tracking-widest">
                  Private Payroll
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Payroll Batches
              </h1>
              <p className="text-white/40 text-sm max-w-md">
                Manage private salary distributions. Recipients and amounts stay confidential.
              </p>
            </div>

            {/* Create Batch CTA */}
            <Link
              href="/launch"
              className="inline-flex items-center gap-2 px-5 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Create Payroll Batch
            </Link>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-2xl font-bold text-white">{totalPaid.toFixed(1)}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider">SOL Distributed</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-2xl font-bold text-white">{activeBatches}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider">Active Batches</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-2xl font-bold text-white">{totalRecipients}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider">Recipients</div>
            </div>
          </div>

          {/* Search Row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search payroll batches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-white text-sm placeholder-white/30 focus:border-white/[0.12] transition-colors"
              />
            </div>

            <button
              onClick={loadBatches}
              disabled={isLoading}
              className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.04] transition-all disabled:opacity-50"
              title="Refresh"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Batches Grid */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          {isLoading && batches.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
              <p className="text-white/30 text-sm">Loading payroll batches...</p>
            </div>
          ) : filteredBatches.length > 0 ? (
            <>
              {/* Featured Batch */}
              {featuredBatch && !searchQuery && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-white/30" />
                    <span className="text-xs text-white/30 uppercase tracking-wider">In Progress</span>
                  </div>
                  <CampaignCard
                    campaign={featuredBatch}
                    onSupport={setSelectedBatch}
                    onInvite={setInviteBatch}
                    featured
                  />
                </div>
              )}

              {/* All Batches */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-white/30 uppercase tracking-wider">
                    {searchQuery ? `Results for "${searchQuery}"` : 'All Payroll Batches'}
                  </span>
                  <span className="text-xs text-white/20">
                    {filteredBatches.length} {filteredBatches.length === 1 ? 'batch' : 'batches'}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {filteredBatches
                    .filter((b) => searchQuery || b.id !== featuredBatch?.id)
                    .map((batch, index) => (
                      <CampaignCard
                        key={`${batch.id}-${index}`}
                        campaign={batch}
                        onSupport={setSelectedBatch}
                        onInvite={setInviteBatch}
                      />
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mx-auto mb-6">
                <Briefcase className="w-8 h-8 text-white/20" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No payroll batches yet</h3>
              <p className="text-white/40 mb-8 max-w-sm mx-auto text-sm">
                {searchQuery
                  ? `No batches match "${searchQuery}"`
                  : 'Create your first payroll batch to start distributing funds privately.'}
              </p>
              <Link
                href="/launch"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all"
              >
                <Plus className="w-4 h-4" />
                Create First Batch
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Privacy Info Banner */}
      <section className="px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-white/50" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium mb-1">Private payroll distribution</h3>
                <p className="text-white/40 text-sm">
                  Recipients and amounts are not linkable on-chain. Each recipient claims
                  their payment through a private stealth address. Salary data remains confidential.
                </p>
              </div>
              <Link
                href="/"
                className="text-white/50 hover:text-white text-sm flex items-center gap-1 transition-colors"
              >
                Learn more
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {selectedBatch && (
        <DonationModal
          campaign={selectedBatch}
          onClose={() => setSelectedBatch(null)}
        />
      )}

      {/* Invite Manager Modal */}
      {inviteBatch && (
        <InviteManager
          campaignId={inviteBatch.id}
          campaignTitle={inviteBatch.title}
          onClose={() => setInviteBatch(null)}
        />
      )}
    </div>
  );
}
