# Offuscate - Privacy-First B2B Payroll on Solana

> **Enterprise payroll platform** with maximum privacy for employers and employees through stealth addresses, ZK compression, and untraceable payments.

![Solana](https://img.shields.io/badge/Solana-Devnet-green)
![Anchor](https://img.shields.io/badge/Anchor-0.31.1-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Privacy](https://img.shields.io/badge/Privacy-Maximum-purple)
![Helius](https://img.shields.io/badge/Powered%20by-Helius-orange)
![Light Protocol](https://img.shields.io/badge/ZK-Light%20Protocol-blue)

## Overview

Offuscate is a **B2B privacy payroll platform** that enables companies to pay employees without exposing salary information on-chain. Employees receive payments to stealth addresses that cannot be linked to their main wallet, ensuring complete financial privacy.

### Key Features

- **Stealth Addresses** - One-time addresses for each payment, unlinkable to employee's main wallet
- **Easy Stealth Address Sharing** - One-click copy of your stealth meta address on Dashboard and Salary pages
- **ZK Compression** - Hide sender and amount using zero-knowledge proofs (Light Protocol)
- **Offuscate Wallet / Salary Wallet** - Derived privacy wallet for transactions
- **Streaming Payroll** - Real-time salary accrual per second
- **Invite System** - Onboard employees without exposing their wallet addresses
- **Auto-Scan Stealth Payments** - Automatic detection of incoming stealth payments
- **Privacy Pool** - Mix funds for additional unlinkability

## Deployed Addresses (Devnet)

```
Program ID:  5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
```

## Powered by Helius

Offuscate uses **Helius** as core infrastructure for privacy-preserving payroll operations.

| Helius Feature | Usage in Offuscate |
|----------------|-------------------|
| **Enhanced Transactions API** | Parse stealth payments, detect privacy levels, index transaction history |
| **Enhanced Webhooks (Devnet)** | Real-time stealth payment detection and notifications |
| **Helius RPC** | All blockchain operations including ZK compression |
| **Transaction Enrichment** | Human-readable payment history with memo parsing |

### Why Helius?

```
┌─────────────────────────────────────────────────────────────────┐
│                 HELIUS PRIVACY DETECTION FLOW                    │
├─────────────────────────────────────────────────────────────────┤
│  1. Stealth payment sent with memo: "stealth:<ephemeralKey>"    │
│                           ↓                                      │
│  2. Helius Webhook receives transaction                          │
│                           ↓                                      │
│  3. parseStealthMemo() extracts ephemeral key                   │
│                           ↓                                      │
│  4. Notification created for recipient                          │
│                           ↓                                      │
│  5. Recipient scans & claims via Enhanced Transactions API      │
└─────────────────────────────────────────────────────────────────┘
```

**Helius enables:**
- Real-time detection of stealth payments via webhooks
- Privacy level classification (public/semi-private/private)
- Transaction history with enriched metadata
- Fast RPC for ZK compression operations

See [HELIUS_INTEGRATION.md](./HELIUS_INTEGRATION.md) for full documentation.

## Privacy Architecture

```
                    OFFUSCATE PRIVACY STACK
┌─────────────────────────────────────────────────────────────┐
│  ULTIMATE PRIVACY: ZK + Stealth + Relayer                   │
│  └── Sender, Recipient, Amount, Fee Payer ALL hidden        │
├─────────────────────────────────────────────────────────────┤
│  LAYER 4: Relayer (Gasless)                                 │
│  └── Hides fee payer identity                               │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3: ZK Compression (Light Protocol)                   │
│  └── Hides sender address and transaction amount            │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: Stealth Addresses                                 │
│  └── One-time addresses via ECDH key exchange               │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1: Offuscate Wallet / Salary Wallet                  │
│  └── Deterministic keypair, not linked to main wallet       │
├─────────────────────────────────────────────────────────────┤
│  LAYER 0: Privacy Pool                                      │
│  └── Fund mixing with variable delays                       │
└─────────────────────────────────────────────────────────────┘
```

## Architecture Diagrams

### Payroll Flow (Employer → Employee)

![Payroll Flow](./docs/diagrams/payroll-flow.png)

Companies create batch payments that stream salary per second to employee stealth wallets. Employees can optionally route funds through the Privacy Pool for additional unlinkability.

### Derive Stealth Wallet

![Derive Stealth](./docs/diagrams/derive-stealth.png)

Both employers and employees can derive a stealth wallet that is **not linked** to their main wallet on-chain. The derivation happens locally using cryptographic hashing.

### Transfer Between Users (ZK + Stealth + Relayer)

![Transfer Users](./docs/diagrams/transfer-users.png)

Private transfers between any users using the full privacy stack: ZK Compression (hides sender & amount) + Stealth Addresses (hides recipient) + Relayer (hides fee payer).

## Platform Pages

### For Employers (Company)

| Page | Route | Description |
|------|-------|-------------|
| **Treasury** | `/mixer` | Dashboard with wallet balances, circular chart, and send payments |
| **Payroll** | `/payroll` | Manage batches, employees, invites, and fund payroll |
| **Activity** | `/dashboard` | Payment history, stealth address display with easy copy |
| **Pool** | `/pool` | Privacy pool for additional mixing |

### For Employees (Recipients)

| Page | Route | Description |
|------|-------|-------------|
| **Salary** | `/salary` | View accrued salary, claim payments, stealth address with easy copy, auto-scan stealth payments |
| **Activity** | `/dashboard` | Payment history, stealth address display |
| **Pool** | `/pool` | Privacy pool access |

## Use Cases & User Flows

### Employer (Company) - Complete Feature Set

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EMPLOYER USE CASES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        TREASURY (/mixer)                             │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  • View Main Wallet balance                                          │    │
│  │  • View Offuscate Wallet balance (privacy wallet)                    │    │
│  │  • Transfer between wallets                                          │    │
│  │  • Send payments with privacy options:                               │    │
│  │      ├── Standard (public)                                           │    │
│  │      ├── Offuscate Wallet (hide sender)                              │    │
│  │      ├── Stealth Address (hide recipient)                            │    │
│  │      ├── ZK Compression (hide amount)                                │    │
│  │      └── ZK + Stealth (maximum privacy)                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        PAYROLL (/payroll)                            │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  • Create payroll batches (departments/teams)                        │    │
│  │  • Generate invite codes with salary configuration                   │    │
│  │  • Set salary rate (SOL/month)                                       │    │
│  │  • Copy/share invite codes                                           │    │
│  │  • Revoke pending invites                                            │    │
│  │  • Fund batch vault                                                  │    │
│  │  • View employees per batch                                          │    │
│  │  • Monitor salary streaming                                          │    │
│  │  • View total budget vs paid                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       ACTIVITY (/dashboard)                          │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  • View payment history                                              │    │
│  │  • Filter by: All / Received / Sent / Private / Standard            │    │
│  │  • Copy stealth meta address (one-click)                            │    │
│  │  • View transaction signatures                                       │    │
│  │  • Monitor RPC status                                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         POOL (/pool)                                 │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  • Deposit to privacy pool (with commitment)                         │    │
│  │  • Withdraw from pool (breaks link)                                  │    │
│  │  • Gasless withdrawal via relayer                                    │    │
│  │  • View pool balance                                                 │    │
│  │  • View unspent notes                                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Employee (Recipient) - Complete Feature Set

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EMPLOYEE USE CASES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         SALARY (/salary)                             │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  ONBOARDING:                                                         │    │
│  │  • Accept invite code from employer                                  │    │
│  │  • Generate stealth keypair (stored locally)                         │    │
│  │  • Register stealth pubkey on-chain                                  │    │
│  │                                                                       │    │
│  │  WALLET MANAGEMENT:                                                  │    │
│  │  • View Main Wallet balance                                          │    │
│  │  • View Salary Wallet balance (stealth)                              │    │
│  │  • Copy stealth meta address (share for payments)                    │    │
│  │  • Transfer between wallets                                          │    │
│  │                                                                       │    │
│  │  SALARY STREAMING:                                                   │    │
│  │  • View monthly salary rate                                          │    │
│  │  • View real-time accrued amount                                     │    │
│  │  • View total claimed to date                                        │    │
│  │  • Claim accrued salary                                              │    │
│  │                                                                       │    │
│  │  STEALTH PAYMENT SCANNER:                                            │    │
│  │  • Auto-scan for incoming stealth payments                           │    │
│  │  • View found payments with amounts                                  │    │
│  │  • Choose destination wallet (Salary/Main)                           │    │
│  │  • Claim stealth payments                                            │    │
│  │                                                                       │    │
│  │  ANONYMOUS RECEIPTS:                                                 │    │
│  │  • Create receipt (proof of payment)                                 │    │
│  │  • Export receipt for sharing                                        │    │
│  │  • Verify receipt authenticity                                       │    │
│  │  • Amount remains hidden                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       ACTIVITY (/dashboard)                          │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  • View payment history                                              │    │
│  │  • Filter transactions                                               │    │
│  │  • Copy stealth meta address                                         │    │
│  │  • View streaming salary status                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         POOL (/pool)                                 │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  • Deposit claimed salary to pool                                    │    │
│  │  • Withdraw to any address (breaks link)                             │    │
│  │  • Gasless withdrawal                                                │    │
│  │  • Additional mixing for privacy                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Complete User Journey Diagrams

#### Employer Journey

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         EMPLOYER COMPLETE JOURNEY                             │
└──────────────────────────────────────────────────────────────────────────────┘

   ┌─────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
   │ Connect │────►│  Detected   │────►│   Treasury   │────►│   Payroll   │
   │ Wallet  │     │ as Employer │     │   Overview   │     │  Management │
   └─────────┘     └─────────────┘     └──────────────┘     └──────┬──────┘
                                                                    │
        ┌───────────────────────────────────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                           PAYROLL SETUP                                   │
   │                                                                           │
   │   Create Batch ──► Generate Invites ──► Share Codes ──► Fund Vault       │
   │        │                   │                  │              │            │
   │        ▼                   ▼                  ▼              ▼            │
   │   "Engineering"      "ABC123"           Email/Slack    10 SOL deposited   │
   │   batch created      1000 SOL/mo                                          │
   └──────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                         SALARY STREAMING                                  │
   │                                                                           │
   │          Employee            Accrued                  Claimed             │
   │          Accepts    ──►     Per Second    ──►      by Employee            │
   │          Invite              ~385 lamports/s                              │
   │                                                                           │
   └──────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                      PRIVATE PAYMENTS (Treasury)                          │
   │                                                                           │
   │   Select Wallet    Select Privacy      Enter Amount      Send Payment     │
   │        │                  │                  │                │           │
   │        ▼                  ▼                  ▼                ▼           │
   │   Main/Offuscate   ZK+Stealth           0.5 SOL        Tx Confirmed      │
   │                    (Maximum)                                              │
   └──────────────────────────────────────────────────────────────────────────┘
```

#### Employee Journey

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         EMPLOYEE COMPLETE JOURNEY                             │
└──────────────────────────────────────────────────────────────────────────────┘

   ┌─────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
   │ Connect │────►│   Receive   │────►│    Accept    │────►│   Salary    │
   │ Wallet  │     │   Invite    │     │    Invite    │     │    Page     │
   └─────────┘     └─────────────┘     └──────────────┘     └──────┬──────┘
                                              │                     │
                                              ▼                     │
                                    ┌─────────────────┐             │
                                    │ Generate Stealth│             │
                                    │ Keypair Locally │             │
                                    └─────────────────┘             │
                                                                    │
        ┌───────────────────────────────────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                         SALARY MANAGEMENT                                 │
   │                                                                           │
   │   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
   │   │ View Accrued │    │    Claim     │    │ Funds go to Salary Wallet│   │
   │   │   Salary     │───►│   Salary     │───►│   (Stealth Address)      │   │
   │   │  Real-time   │    │              │    │                          │   │
   │   └──────────────┘    └──────────────┘    └──────────────────────────┘   │
   │                                                                           │
   └──────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                    RECEIVE STEALTH PAYMENTS                               │
   │                                                                           │
   │   Copy Stealth    Share with     Auto-Scan      Choose         Claim     │
   │   Meta Address ──► Sender    ──► Detects    ──► Destination ──► Funds    │
   │                                  Payment        Wallet                    │
   │   st:viewPub:                                  Salary/Main                │
   │   spendPub                                                                │
   └──────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                      PROOF OF PAYMENT (Receipts)                          │
   │                                                                           │
   │   Create         Export           Share with        Verify               │
   │   Receipt   ──►  as JSON    ──►   Bank/Visa    ──►  Authenticity         │
   │                                                                           │
   │   Amount stays hidden - proves payment without revealing salary           │
   └──────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                      ADDITIONAL PRIVACY (Pool)                            │
   │                                                                           │
   │   Deposit to       Wait for         Withdraw to        Link is           │
   │   Privacy Pool ──► Mixing      ──►  Any Address   ──►  Broken            │
   │                                                                           │
   └──────────────────────────────────────────────────────────────────────────┘
```

### Privacy Options Matrix

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                              PRIVACY OPTIONS MATRIX                                    │
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   OPTION                  SENDER    RECIPIENT   AMOUNT    FEE PAYER   USE CASE         │
│   ─────────────────────────────────────────────────────────────────────────────────   │
│                                                                                        │
│   Standard                Visible   Visible     Visible   Visible     Public payments  │
│   ─────────────────────────────────────────────────────────────────────────────────   │
│                                                                                        │
│   Offuscate Wallet        HIDDEN    Visible     Visible   Visible     Hide company     │
│   ─────────────────────────────────────────────────────────────────────────────────   │
│                                                                                        │
│   Stealth Address         Visible   HIDDEN      Visible   Visible     Hide recipient   │
│   ─────────────────────────────────────────────────────────────────────────────────   │
│                                                                                        │
│   ZK Compression          HIDDEN    Visible     HIDDEN    Visible     Hide amount      │
│   ─────────────────────────────────────────────────────────────────────────────────   │
│                                                                                        │
│   ZK + Relayer            HIDDEN    Visible     HIDDEN    HIDDEN      Gasless private  │
│   ─────────────────────────────────────────────────────────────────────────────────   │
│                                                                                        │
│   ZK + Stealth            HIDDEN    HIDDEN      HIDDEN    Visible     Maximum privacy  │
│   ─────────────────────────────────────────────────────────────────────────────────   │
│                                                                                        │
│   ZK + Stealth + Relayer  HIDDEN    HIDDEN      HIDDEN    HIDDEN      ULTIMATE PRIVACY │
│   ─────────────────────────────────────────────────────────────────────────────────   │
│                                                                                        │
│   + Privacy Pool          BROKEN LINK between deposit and withdrawal                   │
│                                                                                        │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### Privacy Layers Explained

| Layer | Technology | What it Hides |
|-------|------------|---------------|
| **Stealth Address** | ECDH key exchange | Recipient identity |
| **ZK Compression** | Light Protocol (Groth16) | Sender identity + Amount |
| **Relayer** | Gasless transactions | Fee payer identity |
| **Privacy Pool** | Commitment scheme | Link between deposit/withdrawal |

### Simplified Flow Diagrams

#### Employer Flow (Simple)

```
1. Create Batch (department/team)
        ↓
2. Generate Invite Codes with salary config
        ↓
3. Share invite codes with employees
        ↓
4. Fund batch vault
        ↓
5. Salary streams automatically per second
```

#### Employee Flow (Simple)

```
1. Receive invite code from employer
        ↓
2. Accept invite → generates stealth keypair locally
        ↓
3. Stealth public key registered on-chain
        ↓
4. Salary accrues in real-time
        ↓
5. Claim to stealth address (main wallet never exposed)
```

### Receiving Stealth Payments

```
1. Copy your Stealth Meta Address from Dashboard or Salary page
        ↓
2. Share with sender (format: st:viewPubKey:spendPubKey)
        ↓
3. Sender uses address to send private payment
        ↓
4. Auto-scan detects incoming payments on Salary page
        ↓
5. Choose destination wallet (Salary or Main) and claim
```

### Payment Privacy Options

| Option | Sender | Recipient | Amount | Fee Payer |
|--------|--------|-----------|--------|-----------|
| Standard | Visible | Visible | Visible | Visible |
| Offuscate Wallet | Hidden | Visible | Visible | Visible |
| Stealth Address | Visible | Hidden | Visible | Visible |
| ZK Compression | Hidden | Visible | Hidden | Visible |
| ZK + Stealth | Hidden | Hidden | Hidden | Visible |
| **ZK + Stealth + Relayer** | **Hidden** | **Hidden** | **Hidden** | **Hidden** |

## Quick Start

### Prerequisites

- Rust 1.70+
- Solana CLI 1.18+
- Anchor 0.31.1
- Node.js 18+

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

# Install
npm install

# Development
npm run dev

# Production
npm run build && npm start
```

### Environment Variables

```bash
# frontend/.env.local
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com?api-key=YOUR_KEY
NEXT_PUBLIC_HELIUS_API_KEY=YOUR_HELIUS_KEY
NEXT_PUBLIC_PROGRAM_ID=5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq

# Relayer (server-side only - for gasless transactions)
RELAYER_SECRET_KEY=your_relayer_private_key_in_base58
```

### Relayer Setup (for Gasless Transactions)

The relayer is a server-side wallet that pays gas fees on behalf of users, hiding the fee payer identity.

```bash
# 1. Generate a new keypair for the relayer
solana-keygen new --outfile relayer-keypair.json

# 2. Get the base58 private key
# (use the output in RELAYER_SECRET_KEY)

# 3. Fund the relayer with SOL (devnet)
solana airdrop 2 <RELAYER_ADDRESS> --url devnet
```

## Project Structure

```
├── programs/
│   └── offuscate/
│       └── src/
│           └── lib.rs                    # Anchor smart contract
├── frontend/
│   └── app/
│       ├── components/
│       │   ├── Header.tsx                # Navigation with role-based links
│       │   ├── InviteManager.tsx         # Create/manage employee invites
│       │   ├── EmployeeSalaryCard.tsx    # Salary display for employees
│       │   ├── StealthPaymentScanner.tsx # Auto-scan for stealth payments
│       │   └── ReceiptsCard.tsx          # Anonymous payment receipts
│       ├── lib/
│       │   ├── program/
│       │   │   ├── client.ts             # PDA helpers and constants
│       │   │   ├── useProgram.ts         # React hook for all operations
│       │   │   └── idl/                  # Anchor IDL
│       │   ├── stealth/
│       │   │   ├── index.ts              # Stealth address implementation
│       │   │   └── StealthContext.tsx    # React context for stealth keys
│       │   ├── privacy/
│       │   │   └── index.ts              # Commitment/nullifier system
│       │   └── role/
│       │       └── index.tsx             # Employer/recipient role detection with localStorage persistence
│       ├── mixer/
│       │   └── page.tsx                  # Treasury dashboard
│       ├── payroll/
│       │   └── page.tsx                  # Payroll management
│       ├── dashboard/
│       │   └── page.tsx                  # Activity/history with stealth address card
│       ├── salary/
│       │   └── page.tsx                  # Employee salary view with stealth scanner
│       └── pool/
│           └── page.tsx                  # Privacy pool
└── README.md
```

## Key Concepts

### Stealth Addresses

Stealth addresses are one-time addresses generated using ECDH key exchange:

1. Employee publishes **stealth meta-address**: `st:<viewPubKey>:<spendPubKey>`
2. Employer generates **ephemeral keypair** for each payment
3. Employer computes **shared secret**: `S = ephemeralPrivate * viewPublic`
4. Employer derives **stealth address** from shared secret + spendPubKey
5. Employee scans using viewKey, derives spending key to claim

### Easy Stealth Address Sharing

Both Dashboard and Salary pages feature a prominent "Your Stealth Address" card with:
- Full display of your stealth meta address
- One-click copy button
- Helper text explaining usage

### Auto-Scan Stealth Payments

The Salary page automatically scans the Solana Memo Program for incoming stealth payments:
- Runs on page load
- Scans recent memo transactions for ephemeral keys
- Derives stealth addresses to find payments meant for you
- Choose destination wallet (Salary or Main) when claiming

### ZK Compression (Light Protocol)

ZK compression hides the sender and amount by:
- Creating compressed accounts with zero-knowledge proofs
- Sender address not visible on-chain
- Amount encrypted in the compressed state

### Offuscate Wallet / Salary Wallet

A deterministic keypair derived from the main wallet:
- Not linked to main wallet on-chain
- Used for sending private payments
- Same seed always produces same keypair

### Streaming Payroll

Salary is calculated per-second:
```
accruedSalary = salaryRate * (currentTime - lastClaimedAt)
```

Where `salaryRate` is in lamports/second (e.g., 1000 SOL/month = ~385 lamports/sec)

### Role Persistence

User roles (employer/recipient) are persisted per wallet address in localStorage for instant recognition on reconnect.

## API Reference

### Employer Operations

```typescript
// Create payroll batch
const { signature, batchIndex } = await createBatch("Engineering Team");

// Create invite with salary
const { signature, inviteCode } = await createInvite(campaignId, 1000); // 1000 SOL/month

// Fund batch
await fundBatch(batchIndex, amountLamports);

// List employees
const employees = await listBatchEmployees(batchIndex);
```

### Employee Operations

```typescript
// Accept invite with stealth keypair
const stealthKeypair = Keypair.generate();
await acceptInviteStreaming(inviteCode, stealthMetaAddress, stealthKeypair, batchIndex);

// Check accrued salary
const record = await findMyEmployeeRecord();
console.log(`Accrued: ${record.employee.accruedSalary / LAMPORTS_PER_SOL} SOL`);

// Claim salary
await claimSalaryWithStealth(batchIndex, employeeIndex, stealthKeypair);
```

### Privacy Pool Operations

```typescript
// Private deposit with commitment
const { signature, note } = await privateDeposit(0.5);

// Withdraw to stealth address
await privateWithdraw(note, stealthKeypair.publicKey);

// Gasless withdrawal via relayer
const result = await privateWithdrawRelayed(note, stealthKeypair);
```

### ZK Transfer Operations (with Relayer)

```typescript
import { privateZKDonation, privateZKDonationRelayed } from './lib/privacy/lightProtocol';

// Standard ZK transfer (fee payer visible)
const result = await privateZKDonation(wallet, recipientPubkey, amount);

// Relayed ZK transfer (fee payer hidden - ULTIMATE PRIVACY)
const result = await privateZKDonationRelayed(wallet, recipientPubkey, amount);
```

## Security Considerations

1. **Stealth Keypair Storage** - Employee must securely store stealth private key locally
2. **Note Backup** - Private pool notes must be backed up (stored in localStorage)
3. **Anonymity Set** - Privacy pool effectiveness depends on number of users
4. **Timing Analysis** - Variable delays help but not perfect against sophisticated analysis

## Tech Stack

**Smart Contract:**
- Anchor Framework (Rust)
- Solana Program Library
- Light Protocol (ZK compression)

**Frontend:**
- Next.js 16
- @solana/web3.js
- @coral-xyz/anchor
- @lightprotocol/stateless.js
- @noble/curves (ECDH)
- @noble/hashes (SHA256)
- TailwindCSS

**Infrastructure (Helius):**
- Helius RPC (Devnet) - All blockchain operations
- Enhanced Transactions API - Transaction indexing & parsing
- Enhanced Webhooks - Real-time stealth payment detection
- Transaction Enrichment - Privacy level classification

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## License

MIT

---

*Privacy Hackathon SOL 2025*
*Program ID: `5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq`*
