# Helius Integration - Offuscate Privacy Payroll

> **Powered by Helius** - Solana's Leading RPC and API Platform

This document details how Offuscate leverages Helius infrastructure for privacy-preserving payroll operations.

---

## Overview

Offuscate uses **Helius Enhanced APIs** extensively to enable real-time stealth payment detection, transaction indexing, and privacy analytics. Helius is a core infrastructure component that makes our privacy features possible.

### Why Helius?

| Requirement | Helius Solution |
|-------------|-----------------|
| Detect stealth payments in real-time | Enhanced Webhooks with memo parsing |
| Index transaction history | Enhanced Transactions API |
| Parse complex privacy transactions | Human-readable transaction enrichment |
| Fast RPC for ZK operations | Helius Devnet RPC |
| Monitor stealth addresses | Webhook address subscriptions |

---

## Helius Features Used

### 1. Enhanced Transactions API

**Endpoint:** `https://api-devnet.helius.xyz/v0`

We use Enhanced Transactions to:
- Fetch wallet transaction history with enriched metadata
- Detect stealth payments by parsing memo instructions
- Classify privacy levels (public/semi-private/private)
- Calculate transaction statistics

**Implementation:** [`/app/api/helius/transactions/route.ts`](./frontend/app/api/helius/transactions/route.ts)

```typescript
// Fetch enriched transactions for a wallet
const response = await fetch(
  `${HELIUS_API_URL}/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&limit=100`
);

// Process with privacy detection
const transactions = rawTransactions.map(processTransaction);
```

**Privacy Detection Logic:**
```typescript
function detectPrivacy(tx: any): {
  isStealth: boolean;
  privacyLevel: 'public' | 'semi' | 'private';
  ephemeralKey: string | null;
} {
  const description = tx.description || '';

  // Detect stealth memo format: "stealth:<ephemeralKey>"
  if (description.includes('stealth:')) {
    const match = description.match(/stealth:([A-Za-z0-9]+)/);
    return {
      isStealth: true,
      privacyLevel: 'semi',
      ephemeralKey: match ? match[1] : null,
    };
  }

  // Check memo program for stealth data
  for (const ix of tx.instructions || []) {
    if (ix.programId === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr') {
      if (ix.data?.includes('stealth')) {
        return { isStealth: true, privacyLevel: 'semi', ephemeralKey: null };
      }
    }
  }

  return { isStealth: false, privacyLevel: 'public', ephemeralKey: null };
}
```

---

### 2. Enhanced Webhooks (Devnet)

**Purpose:** Real-time detection of incoming stealth payments

We receive webhook events from Helius and:
- Parse stealth payment data from memo
- Extract ephemeral keys for recipient scanning
- Create notifications for stealth payment recipients
- Track privacy transaction volume

**Implementation:** [`/app/api/helius/webhook/route.ts`](./frontend/app/api/helius/webhook/route.ts)

```typescript
// Webhook receiver for Helius events
export async function POST(request: NextRequest) {
  const events = await request.json();

  for (const event of events) {
    // Parse stealth data from memo
    const { isStealth, ephemeralKey } = parseStealthMemo(event.description);

    if (isStealth) {
      console.log('[Helius Webhook] 🔒 Stealth payment detected!');

      // Create notification for recipient
      createNotification(
        'stealth_received',
        event.nativeTransfers[0].toUserAccount,
        `Stealth payment received: ${amount} SOL`,
        event.signature
      );
    }
  }
}
```

**Webhook Configuration:**
```json
{
  "webhookURL": "https://offuscate.vercel.app/api/helius/webhook",
  "transactionTypes": ["TRANSFER"],
  "accountAddresses": ["MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"],
  "webhookType": "enhancedDevnet"
}
```

---

### 3. Helius RPC (Devnet)

**Endpoint:** `https://devnet.helius-rpc.com?api-key=KEY`

Used throughout the application for:
- All Solana transactions (payroll, claims, transfers)
- ZK Compression operations (Light Protocol)
- Account queries and balance checks
- Transaction confirmation

**Configuration:** `.env.local`
```bash
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com?api-key=YOUR_KEY
NEXT_PUBLIC_HELIUS_API_KEY=YOUR_KEY
```

---

### 4. Transaction Parsing & Enrichment

Helius Enhanced Transactions provide:

| Field | Usage in Offuscate |
|-------|-------------------|
| `description` | Parse stealth memo for ephemeral keys |
| `nativeTransfers` | Track SOL movements for salary payments |
| `tokenTransfers` | Future: SPL token payroll support |
| `instructions` | Detect Memo Program usage |
| `feePayer` | Identify transaction initiator |
| `timestamp` | Payment history timeline |
| `type` | Filter by transaction type |

**Enriched Transaction Schema:**
```typescript
interface ProcessedTransaction {
  signature: string;
  timestamp: number;
  type: string;

  // Privacy detection (Offuscate custom)
  isStealth: boolean;
  privacyLevel: 'public' | 'semi' | 'private';
  ephemeralKey: string | null;

  // Helius enrichment
  nativeTransfers: Transfer[];
  tokenTransfers: TokenTransfer[];
  accountsInvolved: string[];
  programsUsed: string[];

  // Status
  success: boolean;
  error: string | null;
}
```

---

### 5. RPC Health Monitoring

**Implementation:** [`/app/api/helius/status/route.ts`](./frontend/app/api/helius/status/route.ts)

We monitor Helius RPC health and display status in the dashboard:

```typescript
// Check Helius RPC health
const start = Date.now();
const response = await fetch(HELIUS_RPC_URL, {
  method: 'POST',
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getHealth'
  })
});
const latency = Date.now() - start;

return {
  connected: response.ok,
  latency: `${latency}ms`,
  configured: Boolean(HELIUS_API_KEY)
};
```

**Dashboard Display:**
- RPC connection status (green/red indicator)
- Latency in milliseconds
- Configuration status

---

## API Endpoints

### GET `/api/helius/explorer`

Comprehensive address and transaction analysis.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `address` | string | Address to analyze |
| `tx` | string | Transaction signature to analyze |
| `assets` | boolean | Include token accounts |

**Response (address):**
```json
{
  "success": true,
  "data": {
    "address": "ABC123...",
    "balance": 1.5,
    "tokenAccounts": [...],
    "transactionCount": 25,
    "stealthInfo": {
      "isStealthAddress": true,
      "hasStealthActivity": true,
      "stealthTransactionCount": 5
    }
  }
}
```

### GET `/api/helius/monitor`

Address monitoring and Privacy Pool analytics.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Filter by type (pool, stealth, vault) |
| `address` | string | Get specific address |
| `refresh` | boolean | Refresh activity data |

**Response (pool stats):**
```json
{
  "success": true,
  "stats": {
    "deposits": [...],
    "withdrawals": [...],
    "totalDeposited": 50000000000,
    "totalWithdrawn": 25000000000,
    "transactionCount": 15
  }
}
```

### GET `/api/helius/transactions`

Fetch enriched transaction history with privacy detection.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `wallet` | string | Wallet address to query |
| `limit` | number | Max transactions (default: 20) |
| `stealthOnly` | boolean | Filter to stealth payments only |
| `type` | string | Filter by transaction type |

**Response:**
```json
{
  "success": true,
  "wallet": "ABC123...",
  "count": 15,
  "stats": {
    "total": 15,
    "stealth": 3,
    "public": 12,
    "totalVolume": 5000000000,
    "totalFees": 25000
  },
  "transactions": [...]
}
```

### GET `/api/helius/status`

Check Helius RPC health and configuration.

**Response:**
```json
{
  "success": true,
  "configured": true,
  "rpc": {
    "connected": true,
    "latency": "45ms"
  }
}
```

### POST `/api/helius/webhook`

Receive real-time events from Helius webhooks.

**Payload:** Helius Enhanced Transaction format

**Response:**
```json
{
  "success": true,
  "processed": 5,
  "stealth": 2,
  "notifications": 2
}
```

### GET `/api/helius/webhook`

Retrieve recent webhook events and notifications.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `notifications` | boolean | Get notifications for address |
| `address` | string | Filter by recipient address |
| `markRead` | boolean | Mark notifications as read |

---

## Privacy Detection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    HELIUS INTEGRATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. TRANSACTION CREATED                                          │
│     └── User sends stealth payment with memo                     │
│         memo: "stealth:<ephemeralPubKey>"                        │
│                                                                  │
│  2. HELIUS WEBHOOK                                               │
│     └── Helius detects transaction                               │
│     └── Sends enhanced payload to /api/helius/webhook            │
│     └── Includes parsed memo in description field                │
│                                                                  │
│  3. PRIVACY DETECTION                                            │
│     └── parseStealthMemo() extracts ephemeral key                │
│     └── Classifies as stealth payment                            │
│     └── Creates notification for recipient                       │
│                                                                  │
│  4. RECIPIENT SCANNING                                           │
│     └── Recipient's StealthPaymentScanner queries Helius         │
│     └── Uses Enhanced Transactions API                           │
│     └── Finds payments by ephemeral key                          │
│     └── Derives stealth spending key to claim                    │
│                                                                  │
│  5. DASHBOARD DISPLAY                                            │
│     └── Payment history via Enhanced Transactions                │
│     └── Privacy level badges (public/semi/private)               │
│     └── Real-time stats and volume tracking                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Using Helius

| File | Helius Feature |
|------|----------------|
| `/app/api/helius/transactions/route.ts` | Enhanced Transactions API |
| `/app/api/helius/webhook/route.ts` | Enhanced Webhooks |
| `/app/api/helius/status/route.ts` | RPC Health Check |
| `/app/api/helius/monitor/route.ts` | Address Monitoring |
| `/app/api/helius/explorer/route.ts` | Transaction Explorer |
| `/app/dashboard/page.tsx` | Display stats & history |
| `/app/components/StealthPaymentScanner.tsx` | Scan for stealth payments |
| `/app/lib/program/useProgram.ts` | RPC for all transactions |

---

## Environment Setup

```bash
# .env.local

# Helius RPC (required)
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com?api-key=YOUR_KEY

# Helius API Key (required for Enhanced APIs)
NEXT_PUBLIC_HELIUS_API_KEY=YOUR_KEY
```

---

## Why Helius is Essential

### Without Helius:
- ❌ Manual transaction parsing
- ❌ No real-time payment detection
- ❌ Complex memo decoding
- ❌ Slow RPC responses
- ❌ No transaction enrichment

### With Helius:
- ✅ Human-readable transaction data
- ✅ Real-time webhooks for stealth detection
- ✅ Parsed memo/instruction data
- ✅ Fast, reliable Devnet RPC
- ✅ 70+ transaction types supported
- ✅ Up to 100k addresses per webhook

---

## Summary

Offuscate relies on **Helius as core infrastructure** for:

1. **Enhanced Transactions API** - Privacy detection and transaction indexing
2. **Enhanced Webhooks** - Real-time stealth payment notifications
3. **Helius RPC** - All blockchain operations including ZK compression
4. **Transaction Enrichment** - Human-readable payment history

Helius enables the privacy features that make Offuscate possible. The combination of enhanced transaction parsing and real-time webhooks allows us to detect and process stealth payments seamlessly.

---

*Offuscate - Privacy-First B2B Payroll on Solana*
*Powered by Helius*
