/**
 * Helius Webhook Receiver
 *
 * POST /api/helius/webhook
 * - Receives real-time events from Helius
 * - Detects stealth payments
 * - Stores notifications for receivers
 *
 * GET /api/helius/webhook
 * - Returns recent webhook events
 *
 * GET /api/helius/webhook?notifications=true&address=<address>
 * - Returns notifications for a specific address
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory storage (in production, use Redis/DB)
interface WebhookEvent {
  id: string;
  type: string;
  signature: string;
  timestamp: number;
  data: any;
  receivedAt: number;
  isStealth: boolean;
  stealthData?: {
    ephemeralKey: string;
    amount: number;
    recipient: string;
    sender: string;
  };
}

interface Notification {
  id: string;
  type: 'stealth_received' | 'donation_received' | 'campaign_activity';
  address: string;
  message: string;
  amount?: number;
  signature: string;
  timestamp: number;
  read: boolean;
}

// Storage
const webhookEvents: WebhookEvent[] = [];
const notifications: Notification[] = [];
const monitoredAddresses: Set<string> = new Set();

const MAX_EVENTS = 100;
const MAX_NOTIFICATIONS = 500;

/**
 * Parse memo to detect stealth payment
 */
function parseStealthMemo(description: string): { isStealth: boolean; ephemeralKey?: string } {
  if (!description) return { isStealth: false };

  // Format 1: "stealth:<ephemeralKey>"
  if (description.includes('stealth:')) {
    const match = description.match(/stealth:([A-Za-z0-9]+)/);
    if (match) {
      return { isStealth: true, ephemeralKey: match[1] };
    }
  }

  // Format 2: JSON memo
  try {
    // Look for JSON in description
    const jsonMatch = description.match(/\{.*"type"\s*:\s*"stealth".*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.type === 'stealth' && parsed.ephemeralPubKey) {
        return { isStealth: true, ephemeralKey: parsed.ephemeralPubKey };
      }
    }
  } catch {
    // Not valid JSON
  }

  return { isStealth: false };
}

/**
 * Create notification for address
 */
function createNotification(
  type: Notification['type'],
  address: string,
  message: string,
  signature: string,
  amount?: number
) {
  const notification: Notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    address,
    message,
    amount,
    signature,
    timestamp: Date.now(),
    read: false,
  };

  notifications.unshift(notification);

  // Trim old notifications
  if (notifications.length > MAX_NOTIFICATIONS) {
    notifications.pop();
  }

  console.log(`[Helius Webhook] 📬 Notification created for ${address.slice(0, 8)}...`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[Helius Webhook] 📥 Received event batch');

    // Handle array of events (Helius sends batches)
    const events = Array.isArray(body) ? body : [body];
    let stealthCount = 0;
    let notificationCount = 0;

    for (const event of events) {
      // Parse stealth data from description/memo
      const { isStealth, ephemeralKey } = parseStealthMemo(event.description || '');

      // Extract transfer info
      const nativeTransfer = event.nativeTransfers?.[0];
      const amount = nativeTransfer?.amount || 0;
      const recipient = nativeTransfer?.toUserAccount || '';
      const sender = nativeTransfer?.fromUserAccount || event.feePayer || '';

      const processedEvent: WebhookEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: event.type || 'UNKNOWN',
        signature: event.signature || '',
        timestamp: event.timestamp || Date.now() / 1000,
        data: event,
        receivedAt: Date.now(),
        isStealth,
        stealthData: isStealth ? {
          ephemeralKey: ephemeralKey || '',
          amount,
          recipient,
          sender,
        } : undefined,
      };

      // Store event
      webhookEvents.unshift(processedEvent);
      if (webhookEvents.length > MAX_EVENTS) {
        webhookEvents.pop();
      }

      // Create notifications
      if (isStealth) {
        stealthCount++;
        console.log('[Helius Webhook] 🔒 Stealth payment detected!');
        console.log(`  Signature: ${event.signature}`);
        console.log(`  Amount: ${amount / 1e9} SOL`);
        console.log(`  Recipient: ${recipient}`);
        console.log(`  Ephemeral Key: ${ephemeralKey?.slice(0, 16)}...`);

        // Notify recipient (stealth address)
        if (recipient) {
          createNotification(
            'stealth_received',
            recipient,
            `Stealth payment received: ${(amount / 1e9).toFixed(4)} SOL`,
            event.signature,
            amount
          );
          notificationCount++;
        }
      } else if (event.type === 'TRANSFER' && amount > 0) {
        // Regular transfer - check if it's to a monitored address
        if (recipient && monitoredAddresses.has(recipient)) {
          createNotification(
            'donation_received',
            recipient,
            `Donation received: ${(amount / 1e9).toFixed(4)} SOL`,
            event.signature,
            amount
          );
          notificationCount++;
        }
      }

      // Check for program activity (campaign interactions)
      if (event.accountData) {
        for (const account of event.accountData) {
          if (monitoredAddresses.has(account.account)) {
            createNotification(
              'campaign_activity',
              account.account,
              `Account activity detected`,
              event.signature
            );
            notificationCount++;
          }
        }
      }
    }

    console.log(`[Helius Webhook] ✅ Processed ${events.length} events (${stealthCount} stealth, ${notificationCount} notifications)`);

    return NextResponse.json({
      success: true,
      processed: events.length,
      stealth: stealthCount,
      notifications: notificationCount,
    });

  } catch (error: any) {
    console.error('[Helius Webhook] ❌ Error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const getNotifications = searchParams.get('notifications') === 'true';
  const address = searchParams.get('address');
  const markRead = searchParams.get('markRead') === 'true';

  // Get notifications for address
  if (getNotifications && address) {
    const addressNotifications = notifications.filter(n => n.address === address);

    // Mark as read if requested
    if (markRead) {
      addressNotifications.forEach(n => {
        n.read = true;
      });
    }

    return NextResponse.json({
      success: true,
      address,
      count: addressNotifications.length,
      unread: addressNotifications.filter(n => !n.read).length,
      notifications: addressNotifications.slice(0, 50),
    });
  }

  // Get all recent events
  const stealthEvents = webhookEvents.filter(e => e.isStealth);

  return NextResponse.json({
    success: true,
    count: webhookEvents.length,
    stealthCount: stealthEvents.length,
    lastReceived: webhookEvents[0]?.receivedAt || null,
    events: webhookEvents.slice(0, 20),
    recentStealth: stealthEvents.slice(0, 10),
  });
}

// Export for address monitoring
export function addMonitoredAddress(address: string) {
  monitoredAddresses.add(address);
}

export function removeMonitoredAddress(address: string) {
  monitoredAddresses.delete(address);
}

export function getMonitoredAddresses(): string[] {
  return Array.from(monitoredAddresses);
}
