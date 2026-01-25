/**
 * Batch Donation System
 *
 * Provides maximum privacy for donations by:
 * 1. Depositing to the privacy pool (hides sender)
 * 2. Queueing donation intent for batch processing
 * 3. Relayer processes multiple donations together (hides timing)
 * 4. Campaign receives SOL without any link to donor
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { generatePrivateNote, saveNote, PrivateNote } from './index';

export interface BatchDonationResult {
  success: boolean;
  donationId?: string;
  queuePosition?: number;
  estimatedProcessingTime?: number;
  depositSignature?: string;
  error?: string;
}

export interface DonationStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  campaignId: string;
  amount: number;
  timestamp: number;
  processedAt?: number;
  txSignature?: string;
  error?: string;
}

/**
 * Queue a private donation to a campaign
 *
 * Flow:
 * 1. Generate commitment (secret + nullifier + amount)
 * 2. Deposit to privacy pool on-chain
 * 3. Queue donation intent with relayer
 * 4. Relayer will process in batch later
 *
 * @param privateDeposit - Function to deposit to pool
 * @param campaignId - Target campaign
 * @param campaignVault - Campaign vault address
 * @param amountSol - Amount in SOL
 * @param walletPublicKey - Donor's wallet public key
 * @param signMessage - Function to sign authorization message
 */
export async function queuePrivateDonation(
  privateDeposit: (amount: number) => Promise<{ signature: string; note: PrivateNote }>,
  campaignId: string,
  campaignVault: string,
  amountSol: number,
  walletPublicKey: PublicKey,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<BatchDonationResult> {
  try {
    console.log(`[BatchDonation] Starting private donation of ${amountSol} SOL to campaign ${campaignId}`);

    // Step 1: Deposit to privacy pool
    console.log('[BatchDonation] Step 1: Depositing to privacy pool...');
    const { signature: depositSignature, note } = await privateDeposit(amountSol);
    console.log('[BatchDonation] Deposit successful:', depositSignature);

    // Step 2: Create authorization signature
    console.log('[BatchDonation] Step 2: Creating authorization...');
    const message = new TextEncoder().encode(
      `Authorize private donation to campaign ${campaignId}: ${note.commitment}`
    );
    const authSignature = await signMessage(message);
    const authSignatureHex = Buffer.from(authSignature).toString('hex');

    // Step 3: Queue with relayer
    console.log('[BatchDonation] Step 3: Queueing with relayer...');
    const response = await fetch('/api/relayer/queue-donation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commitment: note.commitment,
        nullifier: note.nullifier,
        secretHash: note.secretHash,
        amount: note.amount,
        campaignId,
        campaignVault,
        donorSignature: authSignatureHex,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to queue donation');
    }

    console.log(`[BatchDonation] Queued successfully! ID: ${data.donationId}, Position: ${data.queuePosition}`);

    // Save note locally with campaign info
    const noteWithCampaign = {
      ...note,
      campaignId,
      campaignVault,
      donationId: data.donationId,
      queuedAt: Date.now(),
    };

    // Store in localStorage for tracking
    const storageKey = `batch_donation_${walletPublicKey.toBase58()}`;
    const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
    existing.push(noteWithCampaign);
    localStorage.setItem(storageKey, JSON.stringify(existing));

    return {
      success: true,
      donationId: data.donationId,
      queuePosition: data.queuePosition,
      estimatedProcessingTime: data.estimatedProcessingTime,
      depositSignature,
    };

  } catch (error: any) {
    console.error('[BatchDonation] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to queue private donation',
    };
  }
}

/**
 * Check status of a queued donation
 */
export async function checkDonationStatus(donationId: string): Promise<DonationStatus | null> {
  try {
    const response = await fetch(`/api/relayer/queue-donation?id=${donationId}`);
    const data = await response.json();

    if (!data.success) {
      return null;
    }

    return data.donation;
  } catch (error) {
    console.error('[BatchDonation] Status check error:', error);
    return null;
  }
}

/**
 * Get all pending donations for a wallet
 */
export function getPendingDonations(walletPublicKey: PublicKey): any[] {
  const storageKey = `batch_donation_${walletPublicKey.toBase58()}`;
  return JSON.parse(localStorage.getItem(storageKey) || '[]');
}

/**
 * Get batch queue statistics
 */
export async function getBatchQueueStats(): Promise<{
  pending: number;
  processing: number;
  minBatchSize: number;
  queueAgeSeconds: number;
  shouldProcess: boolean;
} | null> {
  try {
    const response = await fetch('/api/relayer/process-batch');
    const data = await response.json();

    if (!data.success) {
      return null;
    }

    return data.status;
  } catch (error) {
    console.error('[BatchDonation] Stats error:', error);
    return null;
  }
}

/**
 * Trigger batch processing (admin only)
 */
export async function triggerBatchProcessing(): Promise<{
  success: boolean;
  processed?: number;
  failed?: number;
  error?: string;
}> {
  try {
    const response = await fetch('/api/relayer/process-batch', {
      method: 'POST',
    });
    const data = await response.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to trigger batch processing',
    };
  }
}
