'use client';

import { useState, useEffect } from 'react';
import { Search, RefreshCw, Loader2, Shield, Users, Heart, TrendingUp, Plus, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { CampaignCard } from '../components/CampaignCard';
import { DonationModal } from '../components/DonationModal';
import { Campaign } from '../lib/types';
import { useProgram, CampaignData } from '../lib/program';
import { PublicKey } from '@solana/web3.js';

function toUICampaign(
  pubkey: PublicKey,
  data: CampaignData,
  vaultBalance: number
): Campaign {
  const progress = data.goal > 0 ? (vaultBalance / data.goal) * 100 : 0;
  const daysLeft = Math.max(0, Math.ceil((data.deadline - Date.now() / 1000) / 86400));

  return {
    id: data.campaignId,
    title: data.title,
    description: data.description,
    goal: data.goal,
    raised: vaultBalance,
    supporters: data.donorCount,
    daysLeft,
    privacy: 'SEMI',
    organizer: data.owner.toBase58().slice(0, 8) + '...',
  };
}

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { listCampaigns, fetchVaultBalance } = useProgram();

  const loadCampaigns = async () => {
    setIsLoading(true);
    try {
      const onChainCampaigns = await listCampaigns();

      const uiCampaigns: Campaign[] = [];
      for (const { pubkey, account } of onChainCampaigns) {
        if (account.status !== 'Active') continue;

        try {
          const vaultBalance = await fetchVaultBalance(account.campaignId);
          uiCampaigns.push(toUICampaign(pubkey, account, vaultBalance));
        } catch {
          // Skip campaigns we can't fetch vault balance for
        }
      }

      setCampaigns(uiCampaigns);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const filteredCampaigns = campaigns.filter(
    (campaign) =>
      campaign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const totalRaised = campaigns.reduce((acc, c) => acc + c.raised, 0);
  const totalSupporters = campaigns.reduce((acc, c) => acc + c.supporters, 0);
  const activeCampaigns = campaigns.length;

  // Get featured campaign (highest progress or most recent)
  const featuredCampaign = [...campaigns].sort((a, b) => {
    const progressA = a.raised / a.goal;
    const progressB = b.raised / b.goal;
    return progressB - progressA;
  })[0];

  return (
    <div className="min-h-screen">
      {/* Hero Section - Compact */}
      <section className="relative px-6 pt-24 pb-8">
        <div className="max-w-6xl mx-auto">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-4">
                <Heart className="w-3.5 h-3.5 text-white/40" />
                <span className="text-[10px] text-white/40 uppercase tracking-widest">
                  Private Donations
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Campaigns
              </h1>
              <p className="text-white/40 text-sm max-w-md">
                Support causes anonymously. Your wallet stays hidden, the cause gets funded.
              </p>
            </div>

            {/* Create Campaign CTA */}
            <Link
              href="/launch"
              className="inline-flex items-center gap-2 px-5 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </Link>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-2xl font-bold text-white">{totalRaised.toFixed(1)}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider">SOL Raised</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-2xl font-bold text-white">{activeCampaigns}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider">Active</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-2xl font-bold text-white">{totalSupporters}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider">Backers</div>
            </div>
          </div>

          {/* Search Row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-white text-sm placeholder-white/30 focus:border-white/[0.12] transition-colors"
              />
            </div>

            <button
              onClick={loadCampaigns}
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

      {/* Campaigns Grid */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          {isLoading && campaigns.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
              <p className="text-white/30 text-sm">Loading campaigns...</p>
            </div>
          ) : filteredCampaigns.length > 0 ? (
            <>
              {/* Featured Campaign */}
              {featuredCampaign && !searchQuery && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-white/30" />
                    <span className="text-xs text-white/30 uppercase tracking-wider">Featured</span>
                  </div>
                  <CampaignCard
                    campaign={featuredCampaign}
                    onSupport={setSelectedCampaign}
                    featured
                  />
                </div>
              )}

              {/* All Campaigns */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-white/30 uppercase tracking-wider">
                    {searchQuery ? `Results for "${searchQuery}"` : 'All Campaigns'}
                  </span>
                  <span className="text-xs text-white/20">
                    {filteredCampaigns.length} {filteredCampaigns.length === 1 ? 'campaign' : 'campaigns'}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {filteredCampaigns
                    .filter((c) => searchQuery || c.id !== featuredCampaign?.id)
                    .map((campaign, index) => (
                      <CampaignCard
                        key={`${campaign.id}-${index}`}
                        campaign={campaign}
                        onSupport={setSelectedCampaign}
                      />
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mx-auto mb-6">
                <Heart className="w-8 h-8 text-white/20" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No campaigns yet</h3>
              <p className="text-white/40 mb-8 max-w-sm mx-auto text-sm">
                {searchQuery
                  ? `No campaigns match "${searchQuery}"`
                  : 'Be the first to create a campaign and start raising funds privately.'}
              </p>
              <Link
                href="/launch"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all"
              >
                <Plus className="w-4 h-4" />
                Create First Campaign
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
                <h3 className="text-white font-medium mb-1">Your donations are protected</h3>
                <p className="text-white/40 text-sm">
                  When you donate with ZK Private, your wallet address is never linked to the campaign.
                  The cause gets funded, but nobody knows it was you.
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

      {selectedCampaign && (
        <DonationModal
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  );
}
