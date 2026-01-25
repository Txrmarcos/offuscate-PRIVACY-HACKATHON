# Offuscate - Complete Privacy Platform Documentation

> **Private Donations & Wallet Mixing on Solana**
> Built for Solana Privacy Hackathon 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Platform Products](#platform-products)
   - [Private Donations](#1-private-donations)
   - [ShadowMix (Personal Mixer)](#2-shadowmix-personal-mixer)
3. [Privacy Technology Stack](#privacy-technology-stack)
4. [User Interface & Pages](#user-interface--pages)
5. [Technical Architecture](#technical-architecture)
6. [Smart Contract Reference](#smart-contract-reference)
7. [API Reference](#api-reference)
8. [Security & Privacy Guarantees](#security--privacy-guarantees)
9. [Deployment Guide](#deployment-guide)

---

## Overview

**Offuscate** is a privacy-first platform on Solana with two distinct products:

| Product | Purpose | Privacy Method |
|---------|---------|----------------|
| **Private Donations** | Donate to campaigns privately | Light Protocol ZK Compression |
| **ShadowMix** | Personal wallet mixing | Commitment-based Privacy Pool |

### The Problem

Standard blockchain transactions are fully transparent:
```
wallet_A ─────► wallet_B ─────► wallet_C
    │              │              │
    └──────────────┴──────────────┴──── All visible on explorer
```

Anyone can trace funds, identify donors, and link wallets.

### Our Solution

```
┌─────────────────────────────────────────────────────────────┐
│                    OFFUSCATE PRIVACY STACK                   │
├─────────────────────────────────────────────────────────────┤
│  LAYER 4: Light Protocol ZK Compression                     │
│  └── Groth16 ZK proofs, sender-receiver link broken         │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3: Commitment + Nullifier System                     │
│  └── Cryptographic unlinkability for deposits/withdrawals   │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: Gas Abstraction (Relayer)                         │
│  └── Stealth address never appears as fee payer             │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1: Privacy Pool                                      │
│  └── Variable delay + Standardized amounts + Pool mixing    │
├─────────────────────────────────────────────────────────────┤
│  LAYER 0: Stealth Addresses                                 │
│  └── One-time addresses derived via ECDH                    │
└─────────────────────────────────────────────────────────────┘
```

### Deployed Addresses (Devnet)

| Component | Address |
|-----------|---------|
| Program ID | `5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq` |
| Relayer | `BEfcVt7sUkRC4HVmWn2FHLkKPKMu1uhkXb4dDr5g7A1a` |
| Privacy Pool PDA | `seeds = ["privacy_pool"]` |
| Pool Vault PDA | `seeds = ["pool_vault"]` |

---

## Platform Products

### 1. Private Donations

**Purpose:** Donate to crowdfunding campaigns with privacy protection.

**Location:** `/explore` → Campaign → Donate

#### Privacy Options for Donations

| Level | Name | Description | Privacy Score |
|-------|------|-------------|---------------|
| `ZK_COMPRESSED` | **ZK Private** (Recommended) | Batch processing via Privacy Pool. Donations batched together. | 100% |
| `PRIVATE` | **ShadowWire** | Bulletproofs ZK. Amount AND sender hidden. | 100% |
| `PUBLIC` | **Public** | Standard transfer. Fully visible on explorer. | 0% |

#### How ZK Private Donations Work (Batch System)

The batch donation system provides **maximum privacy** by:
1. Breaking the **address link** (donor deposits to privacy pool)
2. Breaking the **timing link** (donations processed in batches)
3. Breaking the **amount link** (standardized amounts: 0.1, 0.5, 1.0 SOL)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        BATCH DONATION FLOW                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STEP 1: DEPOSIT TO PRIVACY POOL                                         │
│  ────────────────────────────────                                        │
│  Donor Wallet ────────────────► Privacy Pool                             │
│       │                              │                                   │
│       │  commitment = hash(secret +  │                                   │
│       │               nullifier +    │                                   │
│       │               amount)        │                                   │
│       │                              │                                   │
│       └─ This tx is visible but NOT linked to campaign                   │
│                                                                          │
│  STEP 2: QUEUE WITH RELAYER                                              │
│  ──────────────────────────────                                          │
│  Donation intent stored locally. Relayer queues for batch processing.   │
│                                                                          │
│       Queue: [Don_1, Don_2, Don_3, ...]                                  │
│                     │                                                    │
│                     ▼                                                    │
│       Batched when: 2+ donations OR 5 minutes elapsed                    │
│                                                                          │
│  STEP 3: BATCH PROCESSING (by Relayer)                                   │
│  ──────────────────────────────────────                                  │
│  Relayer withdraws from pool → sends to campaign vaults                  │
│                                                                          │
│       Privacy Pool ────┬──────────────► Campaign A Vault                 │
│            │           │                                                 │
│            │           └──────────────► Campaign B Vault                 │
│            │                                                             │
│            └─ Relayer pays gas. Donors never appear in this tx!          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

RESULT:
  - On-chain: Donor → Pool (no campaign link)
  - On-chain: Pool → Campaign (relayer-signed, no donor link)
  - Timeline: Deposit and withdrawal at different times (breaks timing)
  - Amounts: Standardized (breaks amount correlation)
```

#### Key Features

- **Campaign Discovery:** Browse all active campaigns at `/explore`
- **Privacy Selection:** Choose privacy level before donating
- **Visual Feedback:** PrivacyGraphAnimation shows transaction flow
- **Trace Simulator:** Test if your transaction can be traced

---

### 2. ShadowMix (Personal Mixer)

**Purpose:** Private transfers between wallets. Break the on-chain link between your wallets.

**Location:** `/mixer`

#### Two Wallet System

| Wallet | Description | Use Case |
|--------|-------------|----------|
| **Main Wallet** | Connected wallet (Phantom, etc.) | Public transactions, receiving |
| **Stealth Wallet** | Derived deterministically from main | Private operations, untraceable |

#### ShadowMix Features

**Mix Tab:**
- Deposit SOL into privacy pool (standardized amounts: 0.1, 0.5, 1.0 SOL)
- Withdraw to stealth wallet after variable delay
- Pool stats display (balance, total mixed, transactions)

**Send Tab:**
- Send payments from either wallet
- Choose privacy mode: ZK Private or Direct
- Maximum privacy: Stealth wallet + ZK mode

#### Commitment-Based Privacy

Each deposit creates a cryptographic commitment that binds the amount:

```
commitment = hash(secret + nullifier + amount)
```

**Why nobody can steal your funds:**

| Step | What Happens | Security |
|------|--------------|----------|
| Deposit | commitment = hash(secret + amount) | Amount cryptographically bound |
| Pool | All deposits mixed together | Funds indistinguishable |
| Withdraw | Prove secret → get exact amount | Cannot withdraw more than deposited |

**Standardized amounts** (0.1, 0.5, 1.0 SOL) increase the anonymity set - more deposits at the same amount = harder to trace.

#### Quick Transfers

- **Main → Stealth:** Move funds to your private wallet
- **Stealth → Main:** Consolidate back (reduces privacy)

---

## Privacy Technology Stack

### Layer 0: Stealth Addresses

One-time addresses generated for each transaction using ECDH (Elliptic Curve Diffie-Hellman).

```
TRADITIONAL (traceable):
  sender_wallet → recipient_main_wallet ← Link visible

STEALTH (unlinkable):
  sender_wallet → stealth_address_1
  sender_wallet → stealth_address_2  ← Different address each time!
  sender_wallet → stealth_address_3
```

**Key Generation:**
```typescript
interface StealthKeys {
  viewKey: { privateKey, publicKey };   // Can share with view-only party
  spendKey: { privateKey, publicKey };  // MUST remain secret
}

// Meta-address format (shareable)
const metaAddress = `st:${bs58.encode(viewPublicKey)}:${bs58.encode(spendPublicKey)}`;
```

**Implementation:** `frontend/app/lib/stealth/`

---

### Layer 1: Privacy Pool

The Privacy Pool breaks the direct link between deposits and withdrawals.

```
WITHOUT POOL:
  donor_A ──────────────────────► recipient_X  ← DIRECT LINK

WITH POOL:
  donor_A ───┐                          ┌──► recipient_X
  donor_B ───┼──► [ PRIVACY POOL ] ─────┼──► recipient_Y
  donor_C ───┘     (mixed funds)        └──► recipient_Z
                       ↑
                  LINK BROKEN
```

**Anti-Correlation Features:**

| Feature | Purpose |
|---------|---------|
| Variable Delay (30s - 5min) | Prevents timing correlation |
| Standardized Amounts | Prevents value correlation |
| Pool Churn | Internal mixing for graph resistance |
| Batch Withdrawals | Multiple recipients in single tx |

---

### Layer 2: Gas Abstraction (Relayer)

The relayer solves fee payer exposure:

```
WITHOUT RELAYER:
  stealth_address (SIGNER) ──► claim_tx ──► receives funds
          │                         │
          └── FEE PAYER ────────────┘  ← EXPOSED!

WITH RELAYER:
  stealth_address ──┐
         │          │  Signs message off-chain
         │          ▼
         │     ┌─────────┐
         │     │ Relayer │ ← Builds tx, PAYS GAS
         │     └────┬────┘
         │          │
         └────► receives funds (NO ON-CHAIN SIGNING)
```

**Relayer API:** `POST /api/relayer/claim`

---

### Layer 3: Commitment + Nullifier System

Inspired by Tornado Cash, provides cryptographic unlinkability.

**Deposit:**
```
secret = random(32 bytes)
nullifier_secret = random(32 bytes)
commitment = SHA256(SHA256(secret) || SHA256(nullifier_secret) || amount)
```

**On-chain:** Only the commitment hash is stored (reveals nothing)

**Withdrawal:**
```
1. Provide: nullifier, secret_hash, amount
2. On-chain recomputes: SHA256(secret_hash || nullifier || amount)
3. Verify: computed == stored_commitment
4. Check: NullifierPDA doesn't exist (no double-spend)
5. Create NullifierPDA, transfer funds
```

**Why it's unlinkable:** Without `secret` and `nullifier_secret`, cannot prove which deposit matches which withdrawal.

---

### Layer 4: Light Protocol ZK Compression

The most powerful privacy layer using Groth16 zero-knowledge proofs.

**Technology:**
- Compressed SOL stored in Merkle trees
- Groth16 ZK proofs verify transfers
- 99% on-chain data reduction
- Complete sender unlinkability

**SDK:**
```json
{
  "@lightprotocol/stateless.js": "^0.22.0",
  "@lightprotocol/compressed-token": "^0.22.0"
}
```

**On-Chain Programs (Devnet):**

| Program | Address |
|---------|---------|
| Light System Program | `SySTEM1eSU2p4BGQfQpimFEWWSC1XDFeun3Nqzz3rT7` |
| Account Compression | `compr6CUsB5m2jS4Y3831ztGSTnDpnKJTKS95d64XVq` |
| State Merkle Tree | `smt3AFtReRGVcrP11D6bSLEaKdUmrGfaTNowMVccJeu` |

**Implementation:** `frontend/app/lib/privacy/lightProtocol.ts`

---

## User Interface & Pages

### Navigation

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Landing page with platform overview |
| `/explore` | Campaigns | Browse and donate to campaigns |
| `/mixer` | ShadowMix | Personal wallet mixer |
| `/launch` | Launch | Create new campaign |
| `/dashboard` | Dashboard | Manage your campaigns and stealth keys |
| `/activity` | Activity | Transaction history |

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DonationModal` | `/components/DonationModal.tsx` | Privacy-level donation selection |
| `SendPaymentModal` | `/components/SendPaymentModal.tsx` | P2P transfers with privacy |
| `PrivacyFeedback` | `/components/PrivacyFeedback.tsx` | Post-transaction privacy analysis |
| `TraceSimulator` | `/components/TraceSimulator.tsx` | Interactive traceability test |
| `PrivacyGraphAnimation` | `/components/PrivacyGraphAnimation.tsx` | Visual transaction flow |
| `WaveMeshBackground` | `/components/WaveMeshBackground.tsx` | Animated background |

### Design System

**Color Palette:** Monochrome (white/black/gray)
- Background: `#0a0a0a`
- Cards: `bg-white/[0.02]` to `bg-white/[0.05]`
- Borders: `border-white/[0.06]` to `border-white/[0.15]`
- Text: `text-white`, `text-white/60`, `text-white/40`, `text-white/20`
- Accent: White buttons on dark background

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Wallet    │  │   Stealth   │  │  ShadowMix  │  │    Campaign     │ │
│  │  Adapter    │  │   Context   │  │    Mixer    │  │    Manager      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         └────────────────┴────────────────┴───────────────────┘          │
│                                   │                                       │
│                          ┌────────┴────────┐                              │
│                          │  Program Client │                              │
│                          └────────┬────────┘                              │
└───────────────────────────────────┼───────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  Solana   │   │  Relayer  │   │   Light   │
            │  Devnet   │   │    API    │   │  Protocol │
            └───────────┘   └───────────┘   └───────────┘
```

### File Structure

```
frontend/
├── app/
│   ├── page.tsx              # Home
│   ├── explore/page.tsx      # Campaigns browser
│   ├── mixer/page.tsx        # ShadowMix mixer
│   ├── launch/page.tsx       # Create campaign
│   ├── dashboard/page.tsx    # User dashboard
│   ├── activity/page.tsx     # Transaction history
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── DonationModal.tsx
│   │   ├── SendPaymentModal.tsx
│   │   ├── PrivacyFeedback.tsx
│   │   ├── TraceSimulator.tsx
│   │   ├── PrivacyGraphAnimation.tsx
│   │   └── WaveMeshBackground.tsx
│   ├── lib/
│   │   ├── program/          # Anchor client
│   │   ├── privacy/          # Privacy utilities
│   │   │   ├── index.ts      # Commitment system
│   │   │   └── lightProtocol.ts  # ZK Compression
│   │   └── stealth/          # Stealth addresses
│   │       ├── index.ts
│   │       └── StealthContext.tsx
│   └── api/
│       ├── relayer/
│       │   ├── claim/route.ts
│       │   └── private-claim/route.ts
│       ├── light/
│       │   ├── balance/route.ts
│       │   └── health/route.ts
│       └── privacy/
│           ├── deposit/route.ts
│           └── withdraw/route.ts
└── public/
```

### Key Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `@solana/web3.js` | ^1.98 | Solana SDK |
| `@coral-xyz/anchor` | ^0.30 | Program client |
| `@lightprotocol/stateless.js` | ^0.22 | ZK Compression |
| `@solana/wallet-adapter-react` | ^0.15 | Wallet connection |
| `next` | ^15 | React framework |
| `lucide-react` | ^0.468 | Icons |
| `tailwindcss` | ^4 | Styling |

---

## Smart Contract Reference

### Program ID
```
5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
```

### Instructions

#### Campaign Management

| Instruction | Description |
|-------------|-------------|
| `create_campaign` | Create new campaign with vault |
| `donate` | Public donation to campaign |
| `close_campaign` | Close campaign (owner only) |
| `withdraw_funds` | Withdraw funds to owner |

#### Privacy Pool

| Instruction | Description |
|-------------|-------------|
| `init_privacy_pool` | Initialize pool (once) |
| `pool_deposit` | Deposit to pool |
| `request_withdraw` | Request withdrawal with delay |
| `claim_withdraw` | Claim after delay |
| `claim_withdraw_relayed` | Gasless claim via relayer |

#### Commitment Privacy

| Instruction | Description |
|-------------|-------------|
| `private_deposit` | Deposit with commitment hash |
| `private_withdraw` | Withdraw with proof |
| `private_withdraw_relayed` | Gasless withdraw via relayer |

### Account Structures

```rust
#[account]
pub struct Campaign {
    pub owner: Pubkey,
    pub campaign_id: String,
    pub title: String,
    pub description: String,
    pub goal: u64,
    pub total_raised: u64,
    pub donor_count: u32,
    pub deadline: i64,
    pub status: CampaignStatus,
    pub stealth_meta_address: String,
}

#[account]
pub struct PrivacyPool {
    pub authority: Pubkey,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub deposit_count: u64,
    pub withdraw_count: u64,
}

#[account]
pub struct CommitmentPDA {
    pub commitment: [u8; 32],
    pub amount: u64,
    pub timestamp: i64,
    pub spent: bool,
}

#[account]
pub struct NullifierPDA {
    pub nullifier: [u8; 32],
    pub used_at: i64,
}
```

---

## API Reference

### Relayer Endpoints

#### `GET /api/relayer/claim`
Check relayer status.

```json
{
  "configured": true,
  "relayerAddress": "BEfcVt7sUkRC4HVmWn2FHLkKPKMu1uhkXb4dDr5g7A1a",
  "balance": 2.5
}
```

#### `POST /api/relayer/claim`
Claim from Privacy Pool via relayer.

```json
// Request
{
  "pendingPda": "base58_pending_withdraw_pda",
  "recipient": "base58_stealth_address",
  "signature": "base58_ed25519_signature"
}

// Response
{
  "success": true,
  "signature": "tx_signature"
}
```

#### `POST /api/relayer/private-claim`
Claim from commitment system via relayer.

```json
// Request
{
  "commitment": "hex_commitment_hash",
  "nullifier": "hex_nullifier_hash",
  "secretHash": "hex_secret_hash",
  "amount": 500000000,
  "recipient": "base58_stealth_address",
  "signature": "base58_ed25519_signature"
}
```

### Batch Donation Endpoints

#### `POST /api/relayer/queue-donation`
Queue a private donation for batch processing.

```json
// Request
{
  "commitment": "hex_commitment_hash",
  "nullifier": "hex_nullifier_hash",
  "secretHash": "hex_secret_hash",
  "amount": 100000000,
  "campaignId": "my-campaign-id",
  "campaignVault": "base58_vault_address",
  "donorSignature": "hex_signature"
}

// Response
{
  "success": true,
  "donationId": "don_1234567890_abc123",
  "queuePosition": 3,
  "estimatedProcessingTime": 120,
  "message": "Donation queued. Will be processed in batch for maximum privacy."
}
```

#### `GET /api/relayer/queue-donation?id={donationId}`
Check status of a queued donation.

```json
// Response
{
  "success": true,
  "donation": {
    "id": "don_1234567890_abc123",
    "status": "pending", // pending | processing | completed | failed
    "campaignId": "my-campaign-id",
    "amount": 100000000,
    "timestamp": 1706140800000,
    "processedAt": null,
    "txSignature": null,
    "error": null
  }
}
```

#### `GET /api/relayer/process-batch`
Get batch queue status.

```json
// Response
{
  "success": true,
  "status": {
    "pending": 5,
    "processing": 0,
    "minBatchSize": 2,
    "queueAgeSeconds": 180,
    "maxQueueAgeSeconds": 300,
    "shouldProcess": true,
    "lastProcessed": 1706140000000,
    "totalProcessed": 42,
    "totalFailed": 1
  }
}
```

#### `POST /api/relayer/process-batch`
Trigger batch processing (admin/cron job).

```json
// Response
{
  "success": true,
  "message": "Processed 5 donations",
  "processed": 4,
  "failed": 1,
  "results": [
    { "id": "don_1", "success": true, "signature": "tx_sig_1" },
    { "id": "don_2", "success": true, "signature": "tx_sig_2" }
  ]
}
```

### Light Protocol Endpoints

#### `GET /api/light/health`
Check Light Protocol availability.

```json
{
  "success": true,
  "available": true,
  "protocol": "Light Protocol ZK Compression",
  "features": {
    "compressedSOL": true,
    "zkProofs": "Groth16",
    "merkleTreeStorage": true
  }
}
```

#### `POST /api/light/balance`
Get compressed SOL balance.

```json
// Request
{ "publicKey": "base58_address" }

// Response
{ "balance": 1.5 }
```

---

## Security & Privacy Guarantees

### Threat Model

| Threat | Attack Vector | Mitigation |
|--------|---------------|------------|
| Timing Correlation | Match deposit/withdraw times | Variable delay (30s-5min) |
| Amount Correlation | Match deposit/withdraw amounts | Standardized amounts only |
| Graph Analysis | Trace fund flow | Pool mixing + churn |
| Address Reuse | Link multiple payments | Stealth addresses |
| Fee Payer Exposure | Identify recipient via gas | Relayer pays gas |
| Indexer Correlation | Advanced on-chain analysis | Commitment + nullifier |
| Double-Spend | Withdraw same deposit twice | NullifierPDA uniqueness |

### Privacy Scores by Level

| Level | Score | What's Hidden | What's Visible |
|-------|-------|---------------|----------------|
| PUBLIC | 0% | Nothing | Sender, receiver, amount, time |
| SEMI | 70% | Direct link | Pool deposit/withdraw |
| ZK_COMPRESSED | 100% | Sender, timing, link | Deposit to pool (not linked to campaign) |
| PRIVATE | 100% | Sender, amount, link | Pool activity |
| PRIVATE | 100% | Everything | Only network metadata |

### Best Practices for Users

1. **Backup private notes** - Required for withdrawals
2. **Wait before withdrawing** - More time = more mixing
3. **Use stealth addresses** - Always for receiving
4. **Use relayer** - Never pay gas with stealth address
5. **Vary timing** - Don't deposit/withdraw in patterns
6. **Use standardized amounts** - Larger anonymity set

---

## Deployment Guide

### Prerequisites

- Node.js 18+
- Solana CLI
- Anchor CLI
- Helius API key (for Light Protocol)

### Smart Contract

```bash
# Build
anchor build

# Test
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Development
npm run dev

# Production build
npm run build
npm start
```

### Environment Variables

```bash
# frontend/.env.local

# RPC (Helius recommended for ZK Compression)
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com?api-key=YOUR_KEY
NEXT_PUBLIC_HELIUS_API_KEY=YOUR_KEY

# Relayer keypair (base58 encoded)
RELAYER_SECRET_KEY=<base58_encoded_64_byte_secret>

# Program ID
NEXT_PUBLIC_PROGRAM_ID=5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
```

### Relayer Setup

```bash
# Generate keypair
solana-keygen new -o relayer.json

# Fund on devnet
solana airdrop 2 $(solana address -k relayer.json) --url devnet

# Convert to base58
node -e "console.log(require('bs58').encode(require('./relayer.json')))"

# Add to .env.local
```

---

## Summary

**Offuscate** provides two privacy-focused products on Solana:

### Private Donations
- Donate to crowdfunding campaigns
- **ZK Private** (recommended): Light Protocol ZK Compression
- **ShadowWire**: Maximum privacy with Bulletproofs
- **Public**: Traditional transparent donation

### ShadowMix
- Personal wallet mixer
- Two wallet system (Main + Stealth)
- Commitment-based privacy pool
- Nobody can steal funds (amount bound in commitment)
- Standardized amounts increase anonymity

### Privacy Guarantees
- **Cryptographic unlinkability** between deposits and withdrawals
- **No on-chain depositor info** - only commitment hash stored
- **No recipient link** - stealth addresses + relayer
- **Double-spend prevention** - nullifier system

---

*Documentation for Solana Privacy Hackathon 2025*
*Project: Offuscate - Private Donations & Wallet Mixing on Solana*
*Program ID: `5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq`*
