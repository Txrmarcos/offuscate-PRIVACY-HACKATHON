export type PrivacyLevel = 'PUBLIC' | 'SEMI' | 'PRIVATE' | 'ZK_COMPRESSED';

export interface Campaign {
  id: string;
  title: string;
  description: string;
  privacyLevel?: PrivacyLevel;
  privacy?: PrivacyLevel;
  raised: number;
  goal: number;
  supporters: number;
  daysLeft?: number;
  organizer?: string;
}

export interface Activity {
  id: string;
  type: 'incoming' | 'outgoing';
  sender: string;
  amount: number;
  privacyLevel: PrivacyLevel;
  timestamp: string;
}

export const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  PUBLIC: 'Public',
  SEMI: 'Semi',
  PRIVATE: 'Private',
  ZK_COMPRESSED: 'ZK Compressed',
};
