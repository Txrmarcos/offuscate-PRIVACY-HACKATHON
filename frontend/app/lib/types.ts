export type PrivacyLevel = 'PUBLIC' | 'SEMI' | 'PRIVATE';

export interface Campaign {
  id: string;
  title: string;
  description: string;
  privacyLevel: PrivacyLevel;
  raised: number;
  goal: number;
  supporters: number;
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
};
