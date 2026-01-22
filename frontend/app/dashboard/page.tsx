'use client';

import { useState } from 'react';
import { Circle, ArrowUpRight, ArrowDownLeft, MoreHorizontal } from 'lucide-react';
import { recentActivity } from '../lib/data';
import { PRIVACY_LABELS } from '../lib/types';
import { SendPaymentModal } from '../components/SendPaymentModal';

const stats = [
  {
    label: 'Total Balance (Private)',
    value: '**** SOL',
    subValue: '= $**** USD',
    icon: Circle,
    showPrivacyToggle: true,
  },
  {
    label: 'Active Campaigns',
    value: '3',
    subValue: '+1 this week',
    icon: ArrowUpRight,
  },
  {
    label: 'Total Anonymized Vol',
    value: '450.5 SOL',
    subValue: 'Lifetime',
    icon: ArrowDownLeft,
  },
];

export default function DashboardPage() {
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-[#737373]">
              Manage your private assets and campaigns.
            </p>
          </div>

          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-6 py-3 border border-[#262626] text-white font-medium rounded-full hover:bg-[#141414] transition-colors"
          >
            Send Private Payment
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-6 bg-[#141414] border border-[#262626] rounded-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-[#737373]">{stat.label}</span>
                <stat.icon className="w-4 h-4 text-[#737373]" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="flex items-center gap-2 text-sm text-[#737373]">
                {stat.subValue}
                {stat.showPrivacyToggle && (
                  <button className="w-4 h-4 rounded-full border border-[#404040] flex items-center justify-center">
                    <Circle className="w-2 h-2 text-[#737373]" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-6">
            Recent Activity
          </h2>

          <div className="space-y-2">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-4 bg-[#141414] border border-[#262626] rounded-xl hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#1a1a1a]">
                    {activity.type === 'incoming' ? (
                      <ArrowDownLeft className="w-4 h-4 text-white" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="text-white font-medium">{activity.sender}</div>
                    <div className="text-sm text-[#737373]">
                      {activity.timestamp}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-white font-medium">
                      {activity.amount.toFixed(2)} SOL
                    </div>
                    <div className="flex items-center gap-1 text-sm text-[#737373]">
                      <Circle className="w-3 h-3" />
                      {PRIVACY_LABELS[activity.privacyLevel]}
                    </div>
                  </div>
                  <button className="text-[#737373] hover:text-white transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <SendPaymentModal onClose={() => setShowPaymentModal(false)} />
      )}
    </div>
  );
}
