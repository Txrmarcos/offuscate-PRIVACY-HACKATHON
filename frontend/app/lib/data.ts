import { PayrollBatch, Payment } from './types';

// B2B Payroll Batches - Example data for enterprises
export const payrollBatches: PayrollBatch[] = [
  {
    id: '1',
    title: 'January 2024 Engineering Payroll',
    description: 'Monthly salary distribution for engineering team members.',
    privacyLevel: 'PRIVATE',
    totalPaid: 342,
    budget: 500,
    recipients: 12,
    // Legacy fields
    raised: 342,
    goal: 500,
    supporters: 12,
    status: 'active',
  },
  {
    id: '2',
    title: 'Q4 Contributor Bonuses',
    description: 'Performance bonuses for Q4 contributors and contractors.',
    privacyLevel: 'ZK_COMPRESSED',
    totalPaid: 890,
    budget: 1200,
    recipients: 45,
    raised: 890,
    goal: 1200,
    supporters: 45,
    status: 'active',
  },
  {
    id: '3',
    title: 'Vendor Payments - December',
    description: 'Private payments to suppliers and service providers.',
    privacyLevel: 'PRIVATE',
    totalPaid: 180,
    budget: 250,
    recipients: 8,
    raised: 180,
    goal: 250,
    supporters: 8,
    status: 'completed',
  },
  {
    id: '4',
    title: 'DAO Treasury Distribution',
    description: 'Quarterly allocation to core team and grant recipients.',
    privacyLevel: 'SEMI',
    totalPaid: 1100,
    budget: 2000,
    recipients: 21,
    raised: 1100,
    goal: 2000,
    supporters: 21,
    status: 'pending',
  },
];

// Legacy alias for backwards compatibility
export const campaigns = payrollBatches;

export const recentPayments: Payment[] = [
  {
    id: '1',
    type: 'incoming',
    counterparty: 'Private Sender',
    amount: 25.0,
    privacyLevel: 'PRIVATE',
    timestamp: '2 mins ago',
    description: 'Salary payment received',
  },
  {
    id: '2',
    type: 'outgoing',
    counterparty: 'Acme Corp',
    amount: 5.0,
    privacyLevel: 'SEMI',
    timestamp: '2 hours ago',
    description: 'Vendor invoice payment',
  },
  {
    id: '3',
    type: 'incoming',
    counterparty: 'Treasury DAO',
    amount: 100.0,
    privacyLevel: 'ZK_COMPRESSED',
    timestamp: '1 day ago',
    description: 'Grant disbursement',
  },
];

// Legacy alias
export const recentActivity = recentPayments;
