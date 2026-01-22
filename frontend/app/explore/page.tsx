'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { CampaignCard } from '../components/CampaignCard';
import { DonationModal } from '../components/DonationModal';
import { campaigns } from '../lib/data';
import { Campaign } from '../lib/types';

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

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

        <div className="grid md:grid-cols-2 gap-6">
          {filteredCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
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
