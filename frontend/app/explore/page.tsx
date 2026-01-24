'use client';

import { useState, useEffect } from 'react';
import { Search, RefreshCw, Loader2, Shield, Users, Coins, TrendingUp, Filter, ArrowRight } from 'lucide-react';
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
      {/* Hero Section */}
      <section className="relative px-6 pt-24 pb-16 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-[0.03]"
            style={{
              background: 'radial-gradient(ellipse, white 0%, transparent 70%)',
            }}
          />
        </div>

        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6">
              <Shield className="w-4 h-4 text-white/40" />
              <span className="text-xs text-white/50 uppercase tracking-widest">
                Privacy-First Crowdfunding
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Support Missions That Matter
            </h1>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              Every donation is protected. Every cause is verified.
              Join the movement for private, impactful giving.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-12">
            <div className="text-center p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-white/30" />
              </div>
              <div className="text-2xl font-bold text-white">{totalRaised.toFixed(1)}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider">SOL Raised</div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-white/30" />
              </div>
              <div className="text-2xl font-bold text-white">{activeCampaigns}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider">Active Campaigns</div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-5 h-5 text-white/30" />
              </div>
              <div className="text-2xl font-bold text-white">{totalSupporters}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider">Total Backers</div>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-white placeholder-white/30 focus:border-white/[0.15] transition-colors"
              />
            </div>

            <button
              onClick={loadCampaigns}
              disabled={isLoading}
              className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-white/40 hover:text-white hover:bg-white/[0.05] transition-all disabled:opacity-50"
              title="Refresh campaigns"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </button>

            <Link
              href="/launch"
              className="px-6 py-3.5 bg-white text-black font-medium rounded-2xl hover:bg-white/90 transition-all flex items-center gap-2"
            >
              Start Campaign
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Campaigns Section */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          {isLoading && campaigns.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 animate-spin text-white/40" />
              </div>
              <p className="text-white/30">Loading campaigns from Solana...</p>
            </div>
          ) : filteredCampaigns.length > 0 ? (
            <>
              {/* Featured Campaign */}
              {featuredCampaign && !searchQuery && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-white/40" />
                    <span className="text-sm text-white/40 uppercase tracking-wider">Featured</span>
                  </div>
                  <CampaignCard
                    campaign={featuredCampaign}
                    onSupport={setSelectedCampaign}
                    featured
                  />
                </div>
              )}

              {/* All Campaigns */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-white/40 uppercase tracking-wider">
                    {searchQuery ? `Results for "${searchQuery}"` : 'All Campaigns'}
                  </span>
                  <span className="text-sm text-white/30">
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
                <Search className="w-8 h-8 text-white/20" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No campaigns found</h3>
              <p className="text-white/40 mb-8 max-w-md mx-auto">
                {searchQuery
                  ? `No campaigns match "${searchQuery}". Try a different search.`
                  : 'Be the first to create a campaign and start raising funds privately.'}
              </p>
              <Link
                href="/launch"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all"
              >
                Create First Campaign
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
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
