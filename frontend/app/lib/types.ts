export type PrivacyLevel = 'PUBLIC' | 'SEMI' | 'PRIVATE' | 'ZK_COMPRESSED';

// B2B Payroll & Payment Types
export interface PayrollBatch {
  id: string;
  title: string;
  description: string;
  privacyLevel?: PrivacyLevel;
  privacy?: PrivacyLevel;
  // New B2B terminology
  totalPaid: number;
  budget: number;
  recipients: number;
  // Legacy fields for backwards compatibility
  raised?: number;
  goal?: number;
  supporters?: number;
  daysLeft?: number;
  organizer?: string;
  status?: 'active' | 'completed' | 'pending' | 'Active' | 'Closed' | 'Completed';
}

// Legacy alias for backwards compatibility with program
export type Campaign = PayrollBatch;

export interface Recipient {
  id: string;
  wallet: string;
  name?: string;
  amount: number;
  status: 'pending' | 'paid' | 'claimed';
}

export interface Payment {
  id: string;
  type: 'incoming' | 'outgoing';
  counterparty: string;
  amount: number;
  privacyLevel: PrivacyLevel;
  timestamp: string;
  description?: string;
}

// Legacy alias
export type Activity = Payment;

export const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  PUBLIC: 'Standard',
  SEMI: 'Enhanced',
  PRIVATE: 'Private',
  ZK_COMPRESSED: 'Maximum Privacy',
};

export const PRIVACY_DESCRIPTIONS: Record<PrivacyLevel, string> = {
  PUBLIC: 'Recipient visible on-chain',
  SEMI: 'Amount hidden, recipient visible',
  PRIVATE: 'Both amount and recipient protected',
  ZK_COMPRESSED: 'Zero-knowledge proof, fully unlinkable',
};
