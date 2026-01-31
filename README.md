# Offuscate

**Private Payroll Infrastructure for Solana**

Offuscate is the first **privacy-first B2B payroll platform** on Solana. Pay employees, contributors, and suppliers without exposing salaries, payouts, or treasury activity on-chain — using stealth addresses, ZK compression, and gasless relayers.

![Status](https://img.shields.io/badge/Status-Beta-yellow) ![Solana](https://img.shields.io/badge/Solana-Devnet-purple) ![License](https://img.shields.io/badge/License-MIT-blue) ![Light Protocol](https://img.shields.io/badge/ZK-Light%20Protocol-green) ![Helius](https://img.shields.io/badge/Powered%20by-Helius-orange)

---

## Table of Contents

- [The Problem](#the-problem-blockchain-is-100-public)
- [The Solution](#the-solution-4-layers-of-privacy)
- [Core Technologies](#core-technologies)
  - [Stealth Addresses (ECDH)](#1-stealth-addresses-ecdh)
  - [ZK Compression (Light Protocol)](#2-zk-compression-light-protocol)
  - [Helius Infrastructure](#3-helius-infrastructure)
  - [Gasless Relayer](#4-gasless-relayer)
- [Features](#features)
- [Architecture](#architecture)
- [System Diagrams](#system-diagrams)
  - [Derive Stealth Wallet](#diagram-1-derive-stealth-wallet)
  - [Payroll Flow](#diagram-2-payroll-flow-streaming)
  - [Transfer Between Users](#diagram-3-transfer-between-users-full-privacy)
  - [Relayer Refueling](#diagram-4-relayer-refueling-system) *(Coming Soon)*
  - [Privacy Stack Summary](#privacy-stack-summary)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Security](#security-considerations)
- [Roadmap](#roadmap)

---

## The Problem: Blockchain is 100% Public

Every transaction on Solana is **permanently visible** to anyone. For payroll, this creates serious risks:

| Exposure | Risk | Impact |
|----------|------|--------|
| **Employee salaries visible** | Anyone can see how much you earn | Targeted scams, social engineering, kidnapping risk |
| **Company payroll exposed** | Competitors see your budget | Strategic disadvantage, poaching |
| **Payment patterns tracked** | All spending traceable forever | Privacy violations, profiling |
| **Recipient addresses public** | Employees linked to employers | Loss of anonymity |

### Real-World Scenarios

**Scenario 1: The Targeted Employee**
> Alice receives 10,000 USDC/month from a known DeFi protocol. Her wallet is public. Scammers now know she has money and target her with phishing attacks. Worse, in some regions, this makes her a kidnapping target.

**Scenario 2: The Exposed Startup**
> A startup pays its 20 employees on-chain. Competitors can see exactly: total payroll budget, individual salaries, hiring rate, and burn rate. They use this to poach employees and outbid on talent.

**Scenario 3: The Tracked Freelancer**
> Bob freelances for multiple DAOs. Each payment is public. Anyone can see his total income, all his clients, and payment frequency. His financial life is an open book.

### The Numbers
- **100%** of Solana transactions are publicly visible
- **0** private payroll solutions exist on Solana
- **$50B+** global payroll market
- **2,500+** active projects on Solana need this

---

## The Solution: 4 Layers of Privacy

Offuscate combines multiple privacy technologies into a single, easy-to-use platform:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: Relayer (Gasless)        → Hides fee payer        │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3: ZK Compression           → Hides sender + amount  │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: Stealth Addresses        → Hides recipient        │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1: Streaming Payroll        → Salary per second      │
└─────────────────────────────────────────────────────────────┘
```

### Privacy Matrix

| Option | Sender | Recipient | Amount | Fee Payer | Best For |
|--------|--------|-----------|--------|-----------|----------|
| Standard | Visible | Visible | Visible | Visible | Public payments |
| Stealth Address | Visible | **Hidden** | Visible | Visible | Hide who receives |
| ZK Compression | **Hidden** | Visible | **Hidden** | Visible | Hide how much |
| ZK + Stealth | **Hidden** | **Hidden** | **Hidden** | Visible | Maximum privacy |
| **ZK + Stealth + Relayer** | **Hidden** | **Hidden** | **Hidden** | **Hidden** | **Ultimate privacy** |

---

## Core Technologies

### 1. Stealth Addresses (ECDH)

#### What It Is

Stealth addresses are **one-time addresses** generated for each payment using Elliptic Curve Diffie-Hellman (ECDH) key exchange. The recipient publishes a "meta address" and senders derive unique addresses that only the recipient can spend from.

#### How It Works

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        STEALTH ADDRESS FLOW                               │
└──────────────────────────────────────────────────────────────────────────┘

  RECIPIENT (Employee)                         SENDER (Employer)
  ──────────────────────                       ─────────────────
        │                                            │
        │  1. Generate keypairs                      │
        │     • View keypair (v, V)                  │
        │     • Spend keypair (s, S)                 │
        │                                            │
        │  2. Publish Meta Address                   │
        │     st:<V>:<S>                             │
        │     ─────────────────────────────────────► │
        │                                            │
        │                                      3. Generate ephemeral keypair
        │                                         • (r, R)
        │                                            │
        │                                      4. Compute shared secret
        │                                         • secret = r * V
        │                                            │
        │                                      5. Derive stealth address
        │                                         • P = S + hash(secret)*G
        │                                            │
        │                                      6. Send funds to P
        │                                         + memo with R (ephemeral pubkey)
        │     ◄───────────────────────────────────── │
        │                                            │
  7. Scan for payments                               │
     • Find R in memo                                │
     • Compute secret = v * R                        │
     • Derive P = S + hash(secret)*G                 │
     • If P has balance → it's for us!              │
        │                                            │
  8. Derive spending key                             │
     • p = s + hash(secret)                          │
     • Spend from P                                  │
        │                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Why It Matters

| Without Stealth Addresses | With Stealth Addresses |
|---------------------------|------------------------|
| Recipient wallet is public | Each payment goes to unique address |
| All payments linkable | Payments unlinkable to each other |
| Employer-employee link visible | No on-chain connection |
| Financial history exposed | Fresh address every time |

#### Use Cases

| Use Case | How Stealth Helps |
|----------|-------------------|
| **Payroll** | Employees receive salary to one-time addresses. No one can see their total earnings or link payments to their main wallet. |
| **Contractor Payments** | Freelancers get paid without revealing all their clients or total income. |
| **Sensitive Donations** | Donate to causes without public association. The recipient knows, but the blockchain doesn't link you. |
| **Vendor Payments** | Pay suppliers without competitors knowing your supplier relationships. |

#### Implementation

```typescript
// Employee publishes their meta address (one-time setup)
const metaAddress = getStealthMetaAddress(stealthKeys);
// Format: "st:viewPublicKey:spendPublicKey"

// Employer sends payment
const { stealthAddress, ephemeralPubKey } = deriveStealthAddress(metaAddress);
// Send SOL to stealthAddress with memo "stealth:<ephemeralPubKey>"

// Employee scans and claims
const spendingKey = deriveStealthSpendingKey(
  ephemeralPubKey,
  viewPrivateKey,
  spendPublicKey
);
// Transfer funds using spendingKey
```

---

### 2. ZK Compression (Light Protocol)

#### What It Is

ZK Compression uses **zero-knowledge proofs** to create compressed accounts on Solana. Transactions are validated cryptographically without revealing the sender address or transaction amount on-chain.

#### How It Works

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        ZK COMPRESSION FLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

  TRADITIONAL TRANSFER                    ZK COMPRESSED TRANSFER
  ────────────────────                    ──────────────────────

  ┌─────────────────────┐                 ┌─────────────────────┐
  │ Transaction Data    │                 │ Transaction Data    │
  │                     │                 │                     │
  │ From: 7xKp...3nF    │  ──────────►    │ From: [HIDDEN]      │
  │ To:   9mQr...8kL    │                 │ To:   9mQr...8kL    │
  │ Amount: 1000 SOL    │                 │ Amount: [HIDDEN]    │
  │                     │                 │ Proof: 0x7f3a...    │
  └─────────────────────┘                 └─────────────────────┘

        │                                         │
        ▼                                         ▼

  ┌─────────────────────┐                 ┌─────────────────────┐
  │ On-Chain (Public)   │                 │ On-Chain (Public)   │
  │                     │                 │                     │
  │ • Sender visible    │                 │ • Sender HIDDEN     │
  │ • Amount visible    │                 │ • Amount HIDDEN     │
  │ • Fully traceable   │                 │ • Only proof visible│
  └─────────────────────┘                 └─────────────────────┘

                                          The ZK proof mathematically
                                          guarantees the transaction
                                          is valid WITHOUT revealing
                                          who sent it or how much.
```

#### Why It Matters

| Without ZK Compression | With ZK Compression |
|------------------------|---------------------|
| Sender address visible | Sender completely hidden |
| Amount visible on explorer | Amount encrypted in proof |
| Transaction graph analyzable | Graph analysis impossible |
| Salary amounts exposed | Salary amounts private |

#### Use Cases

| Use Case | How ZK Compression Helps |
|----------|--------------------------|
| **Hide Salary Amounts** | Employees claim salary without revealing how much. Observers see a transaction but not the value. |
| **Protect Treasury** | Company payments don't reveal budget allocation or total treasury size. |
| **Private Transfers** | Send money to anyone without amount being public. |
| **Competitive Intelligence Defense** | Competitors can't analyze your on-chain spending patterns. |

#### Implementation

```typescript
import { compress, transfer } from '@lightprotocol/stateless.js';

// Compress SOL (hide in ZK state)
const compressedAccount = await compress(connection, wallet, amount);

// Transfer with ZK proof (sender + amount hidden)
const result = await transfer(
  connection,
  wallet,
  compressedAccount,
  recipientAddress,
  amount
);
// On-chain: only the ZK proof is visible, not sender or amount
```

#### Light Protocol Integration

| Feature | How Offuscate Uses It |
|---------|----------------------|
| **Compressed Accounts** | Store salary in compressed state |
| **ZK Transfers** | Move funds without revealing source |
| **Proof Generation** | Client-side proof creation |
| **State Verification** | On-chain verification without exposure |

---

### 3. Helius Infrastructure

#### What It Is

Helius is Solana's leading RPC and infrastructure provider. Offuscate uses Helius for **high-performance RPC**, **transaction parsing**, **webhooks**, and **real-time monitoring** — all essential for a privacy-preserving payroll system.

#### How It Works

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        HELIUS INTEGRATION                                 │
└──────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────┐
                         │   Offuscate App     │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │   Helius RPC    │   │  Enhanced API   │   │    Webhooks     │
    │                 │   │                 │   │                 │
    │ • Fast queries  │   │ • Parse txs     │   │ • Real-time     │
    │ • ZK support    │   │ • Enrich data   │   │ • Stealth detect│
    │ • Reliable      │   │ • Index history │   │ • Notifications │
    └─────────────────┘   └─────────────────┘   └─────────────────┘
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Solana Network    │
                         └─────────────────────┘
```

#### Why It Matters

| Without Helius | With Helius |
|----------------|-------------|
| Slow public RPC | 50ms response times |
| No transaction parsing | Rich transaction data |
| Manual scanning | Real-time webhooks |
| Rate limited | High throughput |

#### Use Cases

| Helius Feature | How Offuscate Uses It |
|----------------|----------------------|
| **RPC Endpoint** | All blockchain operations — sending transactions, querying balances, ZK compression operations |
| **Enhanced Transactions API** | Parse stealth payment memos, extract ephemeral keys, classify privacy levels |
| **Webhooks** | Real-time detection of incoming stealth payments — notify users instantly |
| **Transaction Enrichment** | Human-readable payment history, automatic privacy level tagging |

#### Implementation

```typescript
// RPC for all operations
const connection = new Connection(
  `https://devnet.helius-rpc.com?api-key=${HELIUS_API_KEY}`
);

// Enhanced Transaction API - parse stealth memos
const response = await fetch(
  `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`,
  {
    method: 'POST',
    body: JSON.stringify({ transactions: [signature] })
  }
);
const parsed = await response.json();
// Extract "stealth:<ephemeralKey>" from memo

// Webhook for real-time stealth payment detection
// POST /api/helius/webhook
// Helius calls this when new transactions match our filter
export async function POST(req: Request) {
  const transactions = await req.json();
  for (const tx of transactions) {
    const ephemeralKey = parseStealthMemo(tx);
    if (ephemeralKey) {
      await notifyRecipient(ephemeralKey);
    }
  }
}
```

#### Helius Privacy Detection Flow

```
1. Stealth payment sent with memo: "stealth:<ephemeralKey>"
                    ↓
2. Helius Webhook receives transaction instantly
                    ↓
3. parseStealthMemo() extracts ephemeral key
                    ↓
4. Notification created for recipient
                    ↓
5. Recipient scans & claims via Enhanced Transactions API
```

---

### 4. Gasless Relayer

#### What It Is

The Relayer is a **server-side wallet** that submits transactions on behalf of users. This hides the fee payer identity — the final piece of the privacy puzzle. Users sign transactions, but the relayer pays gas and submits them.

#### How It Works

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        RELAYER FLOW                                       │
└──────────────────────────────────────────────────────────────────────────┘

  WITHOUT RELAYER                          WITH RELAYER
  ───────────────                          ────────────

  User Wallet                              User Wallet
      │                                        │
      │ Signs + Pays Gas                       │ Signs only
      │                                        │
      ▼                                        ▼
  ┌─────────────────┐                     ┌─────────────────┐
  │ Transaction     │                     │ Partial TX      │
  │                 │                     │ (user signature)│
  │ Fee Payer: USER │                     └────────┬────────┘
  │ (VISIBLE!)      │                              │
  └────────┬────────┘                              │
           │                                       ▼
           │                              ┌─────────────────┐
           │                              │    RELAYER      │
           │                              │                 │
           │                              │ • Adds gas fee  │
           │                              │ • Signs as payer│
           │                              │ • Submits TX    │
           │                              └────────┬────────┘
           │                                       │
           ▼                                       ▼
  ┌─────────────────┐                     ┌─────────────────┐
  │ On-Chain        │                     │ On-Chain        │
  │                 │                     │                 │
  │ Fee Payer: USER │                     │ Fee Payer:      │
  │ ───────────────►│                     │ RELAYER WALLET  │
  │ Links user to TX│                     │ (Not linked to  │
  └─────────────────┘                     │  user!)         │
                                          └─────────────────┘
```

#### Why It Matters

| Without Relayer | With Relayer |
|-----------------|--------------|
| User pays gas → linked to transaction | Relayer pays gas → user anonymous |
| Fee payer = sender (exposed) | Fee payer = relayer (shared identity) |
| Gas wallet reveals activity | No on-chain link to user |
| Need SOL in wallet for fees | Gasless for end user |

#### Use Cases

| Use Case | How Relayer Helps |
|----------|-------------------|
| **Anonymous Withdrawals** | Withdraw from privacy pool without revealing who's withdrawing. The relayer submits, user stays hidden. |
| **Stealth Claims** | Claim stealth payments without linking your main wallet as fee payer. |
| **New Wallet Funding** | Send to a fresh wallet that has no SOL for gas. Relayer pays the fee. |
| **Ultimate Privacy** | Combined with ZK + Stealth, absolutely nothing links you to the transaction. |

#### Implementation

```typescript
// Client-side: Create and sign transaction
const transaction = new Transaction();
transaction.add(transferInstruction);

// User signs but DOES NOT set fee payer
const signedByUser = await wallet.signTransaction(transaction);

// Send to relayer API
const response = await fetch('/api/relay', {
  method: 'POST',
  body: JSON.stringify({
    transaction: signedByUser.serialize().toString('base64')
  })
});

// Server-side relayer (app/api/relay/route.ts)
export async function POST(req: Request) {
  const { transaction } = await req.json();

  // Deserialize user's partial transaction
  const tx = Transaction.from(Buffer.from(transaction, 'base64'));

  // Relayer becomes fee payer
  tx.feePayer = RELAYER_KEYPAIR.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  // Relayer signs as fee payer
  tx.partialSign(RELAYER_KEYPAIR);

  // Submit to network
  const signature = await connection.sendRawTransaction(tx.serialize());

  return Response.json({ signature });
}
```

#### Relayer Security Model

| Aspect | Implementation |
|--------|----------------|
| **Key Storage** | Relayer private key in server environment variables only |
| **Rate Limiting** | Prevent abuse with per-wallet limits |
| **Funding** | Relayer wallet needs SOL balance for gas |
| **No Custody** | Relayer never holds user funds, only pays fees |

---

## Features

| Feature | Description | Technology |
|---------|-------------|------------|
| **Stealth Addresses** | One-time addresses via ECDH — recipient never exposed | Noble Curves |
| **ZK Compression** | Hide sender and amount on-chain | Light Protocol |
| **Streaming Payroll** | Real-time salary accrual per second | Anchor Program |
| **Gasless Relayer** | Transactions submitted by relayer — fee payer hidden | Custom Relayer |
| **Invite System** | Onboard employees without exposing their wallet | On-chain invites |
| **Auto-Scan Payments** | Automatic detection of incoming stealth payments | Helius Webhooks |
| **Privacy Pool** | Optional mixer for additional unlinkability | Commitment scheme |
| **Recoverable Keys** | Signature-based derivation — never lose access | Wallet signatures |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Offuscate UI                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Treasury   │  │   Payroll   │  │   Salary Wallet     │  │
│  │   /mixer    │  │  /payroll   │  │ Stealth + Streaming │  │
│  └─────────────┘  └──────┬──────┘  └──────────┬──────────┘  │
└──────────────────────────┼────────────────────┼─────────────┘
                           │                    │
        ┌──────────────────┼────────────────────┼──────────────────┐
        │                  │                    │                  │
        ▼                  ▼                    ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Stealth    │  │    Light     │  │   Helius     │  │   Relayer    │
│    ECDH      │  │   Protocol   │  │   RPC/API    │  │   Gasless    │
│              │  │              │  │              │  │              │
│ Hide         │  │ Hide sender  │  │ Fast RPC     │  │ Hide fee     │
│ recipient    │  │ + amount     │  │ + webhooks   │  │ payer        │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                 │
       └─────────────────┴────────┬────────┴─────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │      Solana Devnet      │
                    │                         │
                    │  Program ID:            │
                    │  5rCqTBfE...Tjc1iq      │
                    └─────────────────────────┘
```

---

## System Diagrams

Detailed visual diagrams explaining each privacy flow and how the technologies work together.

---

### Diagram 1: Derive Stealth Wallet

![Derive Stealth Wallet](./docs/diagrams/derive-stealth.png)

#### What This Diagram Shows

This diagram illustrates how **companies and employees derive stealth wallets** that are cryptographically separated from their main wallets.

#### Flow Explanation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DERIVE STEALTH WALLET                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Company-A ──┐                                                              │
│               │                                                              │
│   Recipient-A ┼───►  Derive Wallet (not    ───►  Generate Stealth           │
│               │      linked main wallet)         Wallet                      │
│   ...         │                                                              │
│               │      Using: wallet.sign()        Using: ECDH                 │
│   Company-N ──┤      + SHA256 hash               + Noble Curves              │
│               │                                                              │
│   Recipient-N ┘      Output: Deterministic       Output: View + Spend        │
│                      keypair (recoverable)       keypairs                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Step-by-Step Process

| Step | Action | Technology | Purpose |
|------|--------|------------|---------|
| 1 | User connects wallet | Solana Wallet Adapter | Authenticate user |
| 2 | Sign derivation message | `wallet.signMessage()` | Create deterministic seed |
| 3 | Hash signature | SHA256 | Generate keypair seed |
| 4 | Derive Offuscate Wallet | Ed25519 | Wallet not linked on-chain |
| 5 | Generate View keypair | ECDH (Noble Curves) | For scanning payments |
| 6 | Generate Spend keypair | ECDH (Noble Curves) | For claiming payments |
| 7 | Create Meta Address | String concat | `st:<viewPub>:<spendPub>` |

#### Why This Matters

| Without Derived Wallet | With Derived Wallet |
|------------------------|---------------------|
| Main wallet visible on-chain | Offuscate wallet has no link to main |
| All activity traceable to you | Fresh identity for privacy operations |
| Lost keys = lost forever | Recoverable via same signature |
| Single point of failure | Separate wallet for sensitive ops |

#### Use Cases

1. **Employer Payroll Wallet** - Company derives a separate wallet for all payroll operations. Competitors can't link payroll to company's main treasury.

2. **Employee Salary Wallet** - Employee receives salary to derived wallet. Main wallet stays clean and private.

3. **Recovery** - If browser storage is cleared, user signs the same message again → same keypair is derived → access restored.

---

### Diagram 2: Payroll Flow (Streaming)

![Payroll Flow](./docs/diagrams/payroll-flow.png)

#### What This Diagram Shows

This diagram illustrates how **salary streams from companies to employees** through batch payments and a shared pool.

#### Flow Explanation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAYROLL FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              Request Salary                                  │
│                                    │                                         │
│   Company-A ─► Batch Payment-A ────┤                                         │
│               (for n users)        │         ┌─────────┐     Recipient-A     │
│                                    ├────────►│  Pool   │◄────────────────┐   │
│   ...                              │         └─────────┘                 │   │
│                                    │              │                      │   │
│   Company-Z ─► Batch Payment-Z ────┤              ▼                      │   │
│               (for n users)        │      Stealth Wallet         Recipient-Z │
│                                    │      (Recipient)                        │
│                                    │                                         │
│              Streaming salary      │                                         │
│              per second ───────────┘                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Step-by-Step Process

| Step | Actor | Action | On-Chain Effect |
|------|-------|--------|-----------------|
| 1 | Employer | Create batch (e.g., "Engineering") | Batch PDA created |
| 2 | Employer | Generate invite codes | Invite PDAs with salary config |
| 3 | Employee | Accept invite | Employee record linked to batch |
| 4 | Employer | Fund batch vault | SOL deposited to batch PDA |
| 5 | System | Stream salary per second | `rate * elapsed_time` accrues |
| 6 | Employee | Request claim | Claim instruction sent |
| 7 | System | Calculate accrued | `now - last_claimed_at` |
| 8 | System | Transfer to stealth | Funds sent to stealth address |

#### Streaming Calculation

```
Salary Rate: 1000 SOL/month
Per Second:  1000 / (30 * 24 * 60 * 60) = 0.000385 SOL/sec = 385 lamports/sec

After 1 hour:  385 * 3600 = 1,386,000 lamports = 0.00139 SOL
After 1 day:   385 * 86400 = 33,264,000 lamports = 0.033 SOL
After 1 week:  385 * 604800 = 232,848,000 lamports = 0.233 SOL
```

#### Why Streaming Matters

| Monthly Lump Sum | Per-Second Streaming |
|------------------|----------------------|
| One big visible payment | Continuous micro-payments |
| Easy to identify salary | Harder to analyze |
| Must wait until payday | Claim anytime |
| Cash flow issues | Real-time liquidity |

#### Use Cases

1. **DAO Contributor Payments** - DAO creates batch for contributors. Each person claims when they need funds.

2. **Remote Team Payroll** - Startup pays global team. Each timezone claims at their convenience.

3. **Freelancer Retainer** - Ongoing project with streaming payment. Freelancer claims daily/weekly as needed.

---

### Diagram 3: Transfer Between Users (Full Privacy)

![Transfer Between Users](./docs/diagrams/transfer-users.png)

#### What This Diagram Shows

This diagram illustrates **private transfers between any users** using the full privacy stack: ZK Compression + Stealth Addresses + Relayer.

#### Flow Explanation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TRANSFER BETWEEN USERS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Company/          Company/                                                 │
│   Recipient-A       Recipient-A                                              │
│        │                 ▲                                                   │
│        │                 │                                                   │
│        │    ┌────────────┴────────────┐                                      │
│        └───►│  ZK + Stealth + Relayer │◄───┐                                 │
│             │                         │    │                                 │
│             │  • ZK hides sender      │    │                                 │
│             │  • ZK hides amount      │    │                                 │
│             │  • Stealth hides recv   │    │                                 │
│             │  • Relayer hides fee    │    │                                 │
│             └────────────┬────────────┘    │                                 │
│                  ▲       │       ▲         │                                 │
│                  │       │       │         │                                 │
│   Company/       │       │       │         │       Company/                  │
│   Recipient-Z ───┘       │       └─────────┘       Recipient-Z               │
│                          │                                                   │
│                          ▼                                                   │
│                    On-Chain Result:                                          │
│                    • Sender: HIDDEN (ZK)                                     │
│                    • Amount: HIDDEN (ZK)                                     │
│                    • Recipient: HIDDEN (Stealth)                             │
│                    • Fee Payer: HIDDEN (Relayer)                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Step-by-Step Process

| Step | Layer | Action | What's Hidden |
|------|-------|--------|---------------|
| 1 | **Stealth** | Sender gets recipient's meta address | - |
| 2 | **Stealth** | Derive one-time stealth address | Recipient identity |
| 3 | **ZK** | Compress SOL with Light Protocol | Sender + Amount |
| 4 | **ZK** | Create transfer proof | Transaction details |
| 5 | **Relayer** | Send partial TX to relayer API | - |
| 6 | **Relayer** | Relayer adds fee payment | Fee payer identity |
| 7 | **Relayer** | Submit to Solana | - |
| 8 | **On-chain** | Transaction confirmed | Everything hidden |

#### Privacy Stack Breakdown

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRIVACY STACK IN ACTION                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT                           OUTPUT (On-Chain)               │
│  ─────                           ─────────────────               │
│                                                                  │
│  Sender: Alice                   Sender: [ZK PROOF]              │
│     │                               │                            │
│     │  ──► ZK Compression ──►       │  Completely hidden         │
│     │                               │                            │
│  Amount: 100 SOL                 Amount: [ZK PROOF]              │
│     │                               │                            │
│     │  ──► ZK Compression ──►       │  Encrypted in proof        │
│     │                               │                            │
│  To: Bob's Main Wallet           To: 7xK...3nF (stealth)         │
│     │                               │                            │
│     │  ──► Stealth Address ──►      │  One-time address          │
│     │                               │                            │
│  Fee Payer: Alice                Fee Payer: Relayer Wallet       │
│     │                               │                            │
│     │  ──► Relayer ──►              │  Shared identity           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Why Full Stack Matters

| Single Technology | Full Stack (ZK + Stealth + Relayer) |
|-------------------|-------------------------------------|
| Partial privacy | **Complete** privacy |
| Some metadata exposed | All metadata hidden |
| Can be correlated | Correlation impossible |
| Amateur protection | Enterprise-grade privacy |

#### Use Cases

1. **Private Bonus Payment** - Company sends bonus to employee. No one knows who received how much.

2. **Inter-Company Transfer** - Business pays vendor. Competitors can't see supplier relationships.

3. **Anonymous Donation** - Donate to cause without public association.

4. **Salary Redistribution** - Employee sends part of salary to family. No trail back to employer.

---

### Diagram 4: Relayer Refueling System

> **Status:** Coming Soon - This feature will be implemented in a future release.

#### What This Diagram Shows

This diagram illustrates how the **Relayer wallet is automatically refueled** to ensure gasless transactions remain operational without manual intervention.

#### Flow Explanation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RELAYER REFUELING SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         ┌─────────────────────┐                              │
│                         │   Treasury Wallet   │                              │
│                         │   (Protocol Owned)  │                              │
│                         └──────────┬──────────┘                              │
│                                    │                                         │
│                                    │  Auto-refuel when                       │
│                                    │  balance < threshold                    │
│                                    │                                         │
│                                    ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │                      MONITORING SERVICE                           │      │
│   │                                                                   │      │
│   │   1. Check relayer balance every N minutes                       │      │
│   │   2. If balance < MIN_THRESHOLD (e.g., 0.5 SOL)                  │      │
│   │   3. Transfer REFUEL_AMOUNT (e.g., 2 SOL) from treasury          │      │
│   │   4. Log refuel event for auditing                               │      │
│   │                                                                   │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                    │                                         │
│                                    ▼                                         │
│                         ┌─────────────────────┐                              │
│                         │   Relayer Wallet    │                              │
│                         │                     │                              │
│                         │   Pays gas for all  │                              │
│                         │   user transactions │                              │
│                         └─────────────────────┘                              │
│                                    │                                         │
│                                    ▼                                         │
│                    ┌───────────────────────────────┐                         │
│                    │     Gasless Transactions      │                         │
│                    │                               │                         │
│                    │  • ZK Transfers               │                         │
│                    │  • Stealth Claims             │                         │
│                    │  • Pool Withdrawals           │                         │
│                    └───────────────────────────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Planned Implementation

| Component | Description | Status |
|-----------|-------------|--------|
| **Treasury Wallet** | Protocol-owned wallet holding refuel funds | Planned |
| **Monitoring Service** | Background job checking relayer balance | Planned |
| **Auto-Refuel Logic** | Automatic transfer when below threshold | Planned |
| **Admin Dashboard** | UI to monitor relayer health and refuel history | Planned |
| **Alerts** | Notifications when treasury is low | Planned |

#### Configuration (Planned)

```typescript
// Planned configuration for relayer refueling
const RELAYER_CONFIG = {
  // Minimum balance before triggering refuel
  MIN_THRESHOLD: 0.5 * LAMPORTS_PER_SOL, // 0.5 SOL

  // Amount to transfer when refueling
  REFUEL_AMOUNT: 2 * LAMPORTS_PER_SOL, // 2 SOL

  // Check interval
  CHECK_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes

  // Treasury wallet (holds refuel funds)
  TREASURY_PUBKEY: 'TreasuryWallet...PublicKey',

  // Relayer wallet (pays gas)
  RELAYER_PUBKEY: 'RelayerWallet...PublicKey',
};
```

#### Why Auto-Refueling Matters

| Manual Refueling | Auto-Refueling |
|------------------|----------------|
| Requires constant monitoring | Set and forget |
| Service can go down if forgotten | Always operational |
| Human error risk | Automated reliability |
| Not scalable | Scales with usage |

#### Use Cases for Auto-Refueling

1. **High-Volume Periods** - During payroll days when many employees claim at once, relayer balance can drop quickly. Auto-refuel keeps service running.

2. **24/7 Operation** - Global teams claim at all hours. No need for manual intervention during off-hours.

3. **Scaling** - As user base grows, transaction volume increases. Auto-refuel adapts automatically.

---

### Privacy Stack Summary

#### Complete Privacy Matrix

| What's Hidden | Technology | How It Works |
|---------------|------------|--------------|
| **Sender** | ZK Compression | Zero-knowledge proof validates without revealing source |
| **Amount** | ZK Compression | Value encrypted in proof, verified mathematically |
| **Recipient** | Stealth Addresses | One-time address derived via ECDH, only recipient can spend |
| **Fee Payer** | Relayer | Server wallet pays gas, shared identity across all users |
| **Wallet Link** | Derived Wallets | Signature-based derivation, no on-chain connection |
| **Payment Pattern** | Streaming | Micro-payments instead of identifiable lump sums |

#### When to Use Each Layer

| Scenario | Recommended Stack |
|----------|-------------------|
| Basic payment privacy | Stealth Address only |
| Hide payment amounts | ZK Compression |
| Hide who receives | Stealth Address |
| Maximum single-payment privacy | ZK + Stealth |
| Enterprise/paranoid privacy | ZK + Stealth + Relayer |
| Continuous payments | Streaming + Stealth |

#### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         OFFUSCATE COMPLETE ARCHITECTURE                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│                              ┌─────────────────┐                              │
│                              │   User Wallet   │                              │
│                              └────────┬────────┘                              │
│                                       │                                       │
│                                       ▼                                       │
│                              ┌─────────────────┐                              │
│                              │ Derive Stealth  │  ◄── Diagram 1               │
│                              │     Wallet      │                              │
│                              └────────┬────────┘                              │
│                                       │                                       │
│                    ┌──────────────────┼──────────────────┐                    │
│                    │                  │                  │                    │
│                    ▼                  ▼                  ▼                    │
│           ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│           │   Payroll     │  │   Transfer    │  │    Pool       │            │
│           │  (Streaming)  │  │  (ZK+Stealth) │  │   (Mixer)     │            │
│           │               │  │               │  │               │            │
│           │  Diagram 2    │  │   Diagram 3   │  │   Optional    │            │
│           └───────┬───────┘  └───────┬───────┘  └───────┬───────┘            │
│                   │                  │                  │                    │
│                   └──────────────────┼──────────────────┘                    │
│                                      │                                       │
│                                      ▼                                       │
│                              ┌─────────────────┐                              │
│                              │    Relayer      │  ◄── Diagram 4               │
│                              │   (Gasless)     │      (Coming Soon)           │
│                              └────────┬────────┘                              │
│                                       │                                       │
│                                       ▼                                       │
│                              ┌─────────────────┐                              │
│                              │  Solana Chain   │                              │
│                              │  (via Helius)   │                              │
│                              └─────────────────┘                              │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Rust 1.70+ (for smart contract)
- Solana CLI 1.18+
- Anchor 0.31.1
- A Solana wallet (Phantom, Solflare, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/offuscate.git
cd offuscate

# Install frontend dependencies
cd frontend
npm install

# Start development server
npm run dev
```

### Environment Variables

Create `frontend/.env.local`:

```env
# Helius RPC (required)
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com?api-key=YOUR_KEY
NEXT_PUBLIC_HELIUS_API_KEY=YOUR_HELIUS_KEY

# Program ID
NEXT_PUBLIC_PROGRAM_ID=5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq

# Relayer (server-side only)
RELAYER_SECRET_KEY=your_relayer_private_key_base58
```

### Deploy Smart Contract

```bash
# Build
anchor build

# Test
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Setup Relayer

```bash
# Generate relayer keypair
solana-keygen new --outfile relayer-keypair.json

# Fund relayer (devnet)
solana airdrop 2 $(solana-keygen pubkey relayer-keypair.json) --url devnet

# Export private key for .env
# Use the base58 encoded private key in RELAYER_SECRET_KEY
```

---

## Usage

### For Employers

| Step | Action |
|------|--------|
| 1 | Connect wallet and go to `/payroll` |
| 2 | Create a payroll batch (e.g., "Engineering") |
| 3 | Generate invite codes with salary amount |
| 4 | Share invite codes with employees |
| 5 | Fund the batch vault |
| 6 | Salary streams automatically per second |

### For Employees

| Step | Action |
|------|--------|
| 1 | Receive invite code from employer |
| 2 | Connect wallet and go to `/salary` |
| 3 | Enter invite code → sign message to derive keypair |
| 4 | Stealth public key registered on-chain |
| 5 | View real-time accrued salary |
| 6 | Claim to stealth address (main wallet never exposed) |

### Receiving Stealth Payments

| Step | Action |
|------|--------|
| 1 | Copy your Stealth Meta Address from `/salary` |
| 2 | Share with sender: `st:viewPubKey:spendPubKey` |
| 3 | Sender uses address to send private payment |
| 4 | Auto-scan detects incoming payments |
| 5 | Choose destination wallet and claim |

---

## Security Considerations

### What's Protected

| Layer | Protection |
|-------|------------|
| **Stealth Addresses** | Recipient identity completely hidden |
| **ZK Compression** | Sender and amount hidden on-chain |
| **Relayer** | Fee payer identity hidden |
| **Combined** | No on-chain link between parties |

### User Responsibilities

- **Backup stealth keys**: Stored locally, recoverable via wallet signature
- **Verify addresses**: Double-check recipient meta addresses
- **Secure wallet**: Wallet signature derives encryption keys

### Known Limitations

- Devnet only (mainnet Q3 2026)
- SOL only (USDC/USDT support Q1 2026)
- Anonymity set depends on pool usage
- ZK proof generation takes ~5-10 seconds

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Solana** | High-speed, low-cost blockchain |
| **Anchor** | Rust framework for smart contracts |
| **Light Protocol** | ZK compression for sender/amount privacy |
| **Noble Curves** | ECDH for stealth addresses |
| **Helius** | RPC, webhooks, transaction parsing |
| **Next.js 16** | React framework with App Router |
| **TailwindCSS** | Utility-first styling |

---

## Deployed Addresses

| Network | Program ID |
|---------|------------|
| Devnet | `5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq` |
| Mainnet | Coming Q3 2026 |

---

## Roadmap

| Phase | Features |
|-------|----------|
| **Now (2026)** | ZK Proofs, Streaming, Relayer, Stealth Addresses |
| **Q1 2026** | SDK, USDC/USDT support, Documentation |
| **Q2 2026** | Mobile app, Public testnet, Fiat on/off ramp |
| **Q3 2026** | Security audit, Enterprise dashboard, **Mainnet** |
| **Q4 2026** | Cross-chain, DAO governance |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Make your changes
4. Run tests (`anchor test`)
5. Submit a pull request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Links

- [Light Protocol](https://lightprotocol.com) — ZK compression for Solana
- [Helius](https://helius.dev) — Solana infrastructure
- [Solana](https://solana.com) — The underlying blockchain

---

<div align="center">

**Privacy is not about hiding. It's about control.**

*Built for Solana Privacy Hackathon 2025*

</div>
