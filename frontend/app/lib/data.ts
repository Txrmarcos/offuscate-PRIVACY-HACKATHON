import { Campaign, Activity } from './types';

export const campaigns: Campaign[] = [
  {
    id: '1',
    title: 'Journalist Protection Fund',
    description: 'Legal support for independent journalists working in high-risk zones.',
    privacyLevel: 'PRIVATE',
    raised: 342,
    goal: 500,
    supporters: 1200,
  },
  {
    id: '2',
    title: 'Open Source Privacy Tools',
    description: 'Developing decentralized encryption libraries for the Solana ecosystem.',
    privacyLevel: 'SEMI',
    raised: 890,
    goal: 1200,
    supporters: 4500,
  },
  {
    id: '3',
    title: 'Whistleblower Relief',
    description: 'Providing secure financial pathways for transparency advocates.',
    privacyLevel: 'PRIVATE',
    raised: 180,
    goal: 250,
    supporters: 850,
  },
  {
    id: '4',
    title: 'Eco-Guardian DAO',
    description: 'Protecting indigenous land rights through secure, private funding.',
    privacyLevel: 'PUBLIC',
    raised: 1100,
    goal: 2000,
    supporters: 2100,
  },
];

export const recentActivity: Activity[] = [
  {
    id: '1',
    type: 'incoming',
    sender: 'Unknown Sender',
    amount: 25.0,
    privacyLevel: 'PRIVATE',
    timestamp: '2 mins ago',
  },
  {
    id: '2',
    type: 'outgoing',
    sender: 'Human Rights Watch',
    amount: 5.0,
    privacyLevel: 'SEMI',
    timestamp: '2 hours ago',
  },
  {
    id: '3',
    type: 'incoming',
    sender: 'Grant DAO',
    amount: 100.0,
    privacyLevel: 'PUBLIC',
    timestamp: '1 day ago',
  },
];
