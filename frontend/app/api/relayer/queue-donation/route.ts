import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

// Queue storage path
const QUEUE_FILE = path.join(process.cwd(), '.donation-queue.json');

export interface QueuedDonation {
  id: string;
  commitment: string;
  nullifier: string;
  secretHash: string;
  amount: number; // lamports
  campaignId: string;
  campaignVault: string;
  donorSignature: string; // Prova que o doador autorizou
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: number;
  txSignature?: string;
  error?: string;
}

interface QueueData {
  donations: QueuedDonation[];
  lastProcessed: number;
  totalProcessed: number;
  totalFailed: number;
}

function loadQueue(): QueueData {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const data = fs.readFileSync(QUEUE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load queue:', err);
  }
  return {
    donations: [],
    lastProcessed: 0,
    totalProcessed: 0,
    totalFailed: 0,
  };
}

function saveQueue(queue: QueueData): void {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  } catch (err) {
    console.error('Failed to save queue:', err);
  }
}

function generateId(): string {
  return `don_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// POST - Add donation to queue
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { commitment, nullifier, secretHash, amount, campaignId, campaignVault, donorSignature } = body;

    // Validate required fields
    if (!commitment || !nullifier || !secretHash || !amount || !campaignId || !campaignVault || !donorSignature) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate campaign vault is a valid pubkey
    try {
      new PublicKey(campaignVault);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid campaign vault address' },
        { status: 400 }
      );
    }

    // Load current queue
    const queue = loadQueue();

    // Check if this commitment is already queued
    const existing = queue.donations.find(d => d.commitment === commitment);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Donation already queued', donationId: existing.id },
        { status: 409 }
      );
    }

    // Create new queued donation
    const donation: QueuedDonation = {
      id: generateId(),
      commitment,
      nullifier,
      secretHash,
      amount,
      campaignId,
      campaignVault,
      donorSignature,
      timestamp: Date.now(),
      status: 'pending',
    };

    // Add to queue
    queue.donations.push(donation);
    saveQueue(queue);

    console.log(`[Queue] Added donation ${donation.id} for campaign ${campaignId}, amount: ${amount / 1e9} SOL`);

    // Return queue position and estimated processing time
    const pendingCount = queue.donations.filter(d => d.status === 'pending').length;
    const estimatedDelay = Math.max(30, pendingCount * 15); // Min 30s, +15s per pending

    return NextResponse.json({
      success: true,
      donationId: donation.id,
      queuePosition: pendingCount,
      estimatedProcessingTime: estimatedDelay,
      message: `Donation queued. Will be processed in batch for maximum privacy.`,
    });

  } catch (error: any) {
    console.error('[Queue] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to queue donation' },
      { status: 500 }
    );
  }
}

// GET - Check donation status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const donationId = searchParams.get('id');
    const commitment = searchParams.get('commitment');

    const queue = loadQueue();

    if (donationId) {
      const donation = queue.donations.find(d => d.id === donationId);
      if (!donation) {
        return NextResponse.json(
          { success: false, error: 'Donation not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        donation: {
          id: donation.id,
          status: donation.status,
          campaignId: donation.campaignId,
          amount: donation.amount,
          timestamp: donation.timestamp,
          processedAt: donation.processedAt,
          txSignature: donation.txSignature,
          error: donation.error,
        },
      });
    }

    if (commitment) {
      const donation = queue.donations.find(d => d.commitment === commitment);
      if (!donation) {
        return NextResponse.json(
          { success: false, error: 'Donation not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        donation: {
          id: donation.id,
          status: donation.status,
          campaignId: donation.campaignId,
          amount: donation.amount,
          timestamp: donation.timestamp,
          processedAt: donation.processedAt,
          txSignature: donation.txSignature,
          error: donation.error,
        },
      });
    }

    // Return queue stats
    const pending = queue.donations.filter(d => d.status === 'pending').length;
    const processing = queue.donations.filter(d => d.status === 'processing').length;
    const completed = queue.donations.filter(d => d.status === 'completed').length;
    const failed = queue.donations.filter(d => d.status === 'failed').length;

    return NextResponse.json({
      success: true,
      stats: {
        pending,
        processing,
        completed,
        failed,
        total: queue.donations.length,
        lastProcessed: queue.lastProcessed,
      },
    });

  } catch (error: any) {
    console.error('[Queue] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check queue' },
      { status: 500 }
    );
  }
}
