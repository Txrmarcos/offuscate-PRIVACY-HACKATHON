'use client';

import { useState, useEffect } from 'react';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import { CampaignCard } from '../components/CampaignCard';
import { DonationModal } from '../components/DonationModal';
import { Campaign } from '../lib/types';
import { useProgram, CampaignData } from '../lib/program';
import { PublicKey } from '@solana/web3.js';

// Convert on-chain campaign to UI Campaign type
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
    privacy: 'SEMI', // Default to semi-private
    organizer: data.owner.toBase58().slice(0, 8) + '...',
  };
}

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { listCampaigns, fetchVaultBalance } = useProgram();

  // Load on-chain campaigns
  const loadCampaigns = async () => {
    setIsLoading(true);
    try {
      const onChainCampaigns = await listCampaigns();

      const uiCampaigns: Campaign[] = [];
      for (const { pubkey, account } of onChainCampaigns) {
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

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Explore Campaigns
            </h1>
            <p className="text-[#737373]">
              Support missions with complete on-chain privacy.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadCampaigns}
              disabled={isLoading}
              className="p-2.5 bg-[#141414] border border-[#262626] rounded-lg text-[#737373] hover:text-white hover:border-[#404040] transition-colors disabled:opacity-50"
              title="Refresh campaigns"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
              <input
                type="text"
                placeholder="Search missions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-[#262626] rounded-lg text-white placeholder-[#737373] focus:border-[#404040] transition-colors"
              />
            </div>
          </div>
        </div>

        {isLoading && campaigns.length === 0 ? (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
            <p className="text-[#737373]">Loading campaigns from Solana...</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-6">
              {filteredCampaigns.map((campaign, index) => (
                <CampaignCard
                  key={`${campaign.id}-${index}`}
                  campaign={campaign}
                  onSupport={setSelectedCampaign}
                />
              ))}
            </div>

            {filteredCampaigns.length === 0 && (
              <div className="text-center py-20">
                <p className="text-[#737373]">No campaigns found matching your search.</p>
              </div>
            )}
          </>
        )}
      </div>

      {selectedCampaign && (
        <DonationModal
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  );
}
