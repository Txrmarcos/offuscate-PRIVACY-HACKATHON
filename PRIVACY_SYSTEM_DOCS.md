# Offuscate - Complete Privacy Payroll Documentation

> **Privacy-First B2B Payroll Platform on Solana**
> Built for Solana Privacy Hackathon 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Platform Architecture](#platform-architecture)
3. [Privacy Technology Stack](#privacy-technology-stack)
4. [User Flows](#user-flows)
5. [Pages & Navigation](#pages--navigation)
6. [Smart Contract Reference](#smart-contract-reference)
7. [API Reference](#api-reference)
8. [Security & Privacy Guarantees](#security--privacy-guarantees)
9. [Deployment Guide](#deployment-guide)

---

## Overview

**Offuscate** is a privacy-first B2B payroll platform that enables companies to pay employees without exposing salary information on-chain.

### The Problem

Standard blockchain payroll is fully transparent:
```
company_wallet ─────► employee_wallet_A ─────► 1000 SOL
       │              employee_wallet_B ─────► 2000 SOL
       └──────────────────────────────────────── All salaries visible!
```

Anyone can see who pays whom, how much, and when.

### Our Solution

```
┌─────────────────────────────────────────────────────────────┐
│                    OFFUSCATE PRIVACY STACK                   │
├─────────────────────────────────────────────────────────────┤
│  MAXIMUM PRIVACY: ZK + Stealth + Offuscate Wallet           │
│  └── Sender hidden, Recipient hidden, Amount hidden         │
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

### Key Features

| Feature | Description |
|---------|-------------|
| **Stealth Addresses** | One-time addresses for each payment, unlinkable to employee's main wallet |
| **Easy Stealth Address Sharing** | One-click copy of your stealth meta address on Dashboard and Salary pages |
| **ZK Compression** | Hide sender and amount using Light Protocol zero-knowledge proofs |
| **Offuscate Wallet / Salary Wallet** | Derived privacy wallet for transactions |
| **Streaming Payroll** | Real-time salary accrual per second |
| **Invite System** | Onboard employees without exposing their wallet addresses |
| **Auto-Scan Stealth Payments** | Automatic detection of incoming stealth payments on Salary page |
| **Privacy Pool** | Mix funds for additional unlinkability |
| **Role Persistence** | Remember employer/recipient role per wallet in localStorage |

### Deployed Addresses (Devnet)

| Component | Address |
|-----------|---------|
| Program ID | `5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq` |

---

## Platform Architecture

### Role-Based System

The platform has two user roles:

| Role | Detection | Features |
|------|-----------|----------|
| **Employer** | Owns at least one payroll batch | Create batches, generate invites, fund payroll, send payments |
| **Recipient** | Has accepted at least one invite | View salary, claim payments, access receipts |

Role detection is persisted per wallet in localStorage for instant recognition on reconnect.

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Wallet    │  │   Stealth   │  │   Payroll   │  │    Treasury     │ │
│  │  Adapter    │  │   Context   │  │   Manager   │  │    Dashboard    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         └────────────────┴────────────────┴───────────────────┘          │
│                                   │                                       │
│                          ┌────────┴────────┐                              │
│                          │  useProgram()   │                              │
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

### Data Model

```
MasterVault (singleton)
    │
    ├── PayrollBatch #0
    │       ├── Employee #0 (wallet: stealth_pubkey_A)
    │       ├── Employee #1 (wallet: stealth_pubkey_B)
    │       └── BatchVault (holds SOL for streaming)
    │
    ├── PayrollBatch #1
    │       ├── Employee #0
    │       └── BatchVault
    │
    └── PayrollBatch #N...

Invites:
    ├── Invite "ABC123" → links to batch, has salary rate
    └── Invite "XYZ789" → links to batch, has salary rate
```

---

## Privacy Technology Stack

### Layer 0: Stealth Addresses

One-time addresses generated using ECDH (Elliptic Curve Diffie-Hellman).

**Traditional (traceable):**
```
employer_wallet → employee_main_wallet ← Link visible
```

**Stealth (unlinkable):**
```
employer_wallet → stealth_address_1
employer_wallet → stealth_address_2  ← Different address each time!
employer_wallet → stealth_address_3
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

**Flow:**
1. Employee publishes stealth meta-address: `st:<viewPubKey>:<spendPubKey>`
2. Employer generates ephemeral keypair for each payment
3. Employer computes shared secret: `S = ephemeralPrivate * viewPublic`
4. Employer derives stealth address from shared secret + spendPubKey
5. Employee scans using viewKey, derives spending key to claim

**Easy Sharing:**
Both Dashboard and Salary pages display a prominent "Your Stealth Address" card with one-click copy functionality.

**Implementation:** `frontend/app/lib/stealth/`

---

### Layer 1: Offuscate Wallet / Salary Wallet

A deterministic keypair derived from the main wallet:

```typescript
// Derive Offuscate wallet from main wallet seed
const seed = sha256(mainWallet.publicKey + "privacy_pool_stealth_v1");
const offuscateKeypair = Keypair.fromSeed(seed.slice(0, 32));
```

**Properties:**
- Not linked to main wallet on-chain
- Same seed always produces same keypair
- Used for sending private payments
- Employer can use to hide their identity as sender

---

### Layer 2: ZK Compression (Light Protocol)

Zero-knowledge compression hides sender and amount:

```
WITHOUT ZK:
  employer_wallet ──► employee_stealth ── Amount: 1000 SOL (visible!)

WITH ZK:
  [compressed_account] ──► employee_stealth ── Amount: ??? (hidden!)
```

**How it works:**
- Funds are compressed into Merkle tree state
- Transfers use Groth16 ZK proofs
- Sender address not visible on-chain
- Amount encrypted in compressed state

**SDK:**
```typescript
import { Rpc, createRpc } from "@lightprotocol/stateless.js";
import { compress, transfer } from "@lightprotocol/compressed-token";

// ZK compressed transfer
await transfer(rpc, payer, amount, owner, toAddress);
```

---

### Layer 3: Privacy Pool

Commitment-based mixing for additional unlinkability:

```
WITHOUT POOL:
  employer_A ──────────────────────► recipient_X  ← DIRECT LINK

WITH POOL:
  employer_A ───┐                          ┌──► recipient_X
  employer_B ───┼──► [ PRIVACY POOL ] ─────┼──► recipient_Y
  employer_C ───┘     (mixed funds)        └──► recipient_Z
                           ↑
                      LINK BROKEN
```

**Commitment System:**
```
deposit:
  commitment = SHA256(secret || nullifier || amount)

withdraw:
  prove: I know (secret, nullifier) that produces commitment
  check: nullifier not used before (NullifierPDA)
```

---

### Combined Privacy Options

| Option | Sender | Recipient | Amount | How |
|--------|--------|-----------|--------|-----|
| Standard | Visible | Visible | Visible | Direct transfer |
| Offuscate Wallet | Hidden | Visible | Visible | Use derived keypair |
| Stealth Address | Visible | Hidden | Visible | One-time ECDH address |
| ZK Compression | Hidden | Visible | Hidden | Light Protocol |
| **ZK + Stealth** | **Hidden** | **Hidden** | **Hidden** | Maximum privacy |

---

## User Flows

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
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       ACTIVITY (/dashboard)                          │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  • View payment history                                              │    │
│  │  • Filter by: All / Received / Sent / Private / Standard            │    │
│  │  • Copy stealth meta address (one-click)                            │    │
│  │  • View transaction signatures                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         POOL (/pool)                                 │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  • Deposit to privacy pool (with commitment)                         │    │
│  │  • Withdraw from pool (breaks link)                                  │    │
│  │  • Gasless withdrawal via relayer                                    │    │
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
│  │                                                                       │    │
│  │  WALLET MANAGEMENT:                                                  │    │
│  │  • View Main Wallet balance                                          │    │
│  │  • View Salary Wallet balance (stealth)                              │    │
│  │  • Copy stealth meta address (share for payments)                    │    │
│  │                                                                       │    │
│  │  SALARY STREAMING:                                                   │    │
│  │  • View monthly salary rate                                          │    │
│  │  • View real-time accrued amount                                     │    │
│  │  • Claim accrued salary                                              │    │
│  │                                                                       │    │
│  │  STEALTH PAYMENT SCANNER:                                            │    │
│  │  • Auto-scan for incoming stealth payments                           │    │
│  │  • Choose destination wallet (Salary/Main)                           │    │
│  │  • Claim stealth payments                                            │    │
│  │                                                                       │    │
│  │  ANONYMOUS RECEIPTS:                                                 │    │
│  │  • Create receipt (proof of payment)                                 │    │
│  │  • Export receipt for sharing                                        │    │
│  │  • Verify receipt (amount hidden)                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       ACTIVITY (/dashboard)                          │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  • View payment history                                              │    │
│  │  • Copy stealth meta address                                         │    │
│  │  • View streaming salary status                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         POOL (/pool)                                 │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  • Deposit to privacy pool                                           │    │
│  │  • Withdraw to any address (breaks link)                             │    │
│  │  • Additional mixing for privacy                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Employer Flow (Step by Step)

```
1. SETUP
   ├── Connect wallet
   ├── System detects employer role (or first time)
   └── Navigate to Treasury

2. CREATE PAYROLL
   ├── Go to Payroll page
   ├── Create new batch (e.g., "Engineering Team")
   └── Batch created with index-based PDA

3. ONBOARD EMPLOYEES
   ├── Generate invite code with salary config
   │   └── createInvite(batchId, 1000) // 1000 SOL/month
   ├── Share invite code with employee (off-chain)
   └── Employee accepts → stealth pubkey registered

4. FUND PAYROLL
   ├── Go to batch → Fund Batch
   ├── Enter amount in SOL
   └── SOL transferred to batch vault

5. SALARY STREAMING
   └── Salary accrues per second automatically
       accruedSalary = salaryRate * (now - lastClaimedAt)

6. SEND PAYMENTS (Treasury)
   ├── Select wallet: Main or Offuscate
   ├── Select recipient type: Public or Stealth
   ├── Enable ZK for amount privacy
   └── Send with maximum privacy combination
```

### Employee Flow (Step by Step)

```
1. RECEIVE INVITE
   └── Get invite code from employer (email, Slack, etc.)

2. ACCEPT INVITE
   ├── Go to /invite/[code] or /salary page
   ├── Enter invite code
   ├── System generates stealth keypair locally
   ├── Accept invite → registers stealth pubkey on-chain
   └── Store stealth private key in localStorage

3. VIEW SALARY
   ├── Salary accrues in real-time
   ├── View: Monthly rate, accrued amount, total claimed
   └── Status: Active/Paused/Terminated

4. CLAIM SALARY
   ├── Click "Claim" when ready
   ├── Signs with stealth keypair (not main wallet!)
   └── SOL transferred to stealth address

5. USE FUNDS
   ├── Transfer from stealth to main wallet (reduces privacy)
   └── Or use directly from stealth address
```

### Receiving Stealth Payments Flow

```
1. SHARE STEALTH ADDRESS
   ├── Go to Dashboard or Salary page
   ├── Find "Your Stealth Address" card
   ├── Click copy button to copy meta address
   └── Share with sender (format: st:viewPubKey:spendPubKey)

2. AUTO-SCAN
   ├── Salary page auto-scans on load
   ├── Scans Memo Program for stealth:ephemeralKey transactions
   ├── Derives stealth addresses using your viewKey
   └── Lists found payments with balances

3. CLAIM PAYMENT
   ├── Select destination: Salary Wallet or Main Wallet
   └── Click claim to transfer funds
```

### Privacy Options Matrix

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         PRIVACY OPTIONS MATRIX                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   OPTION              SENDER    RECIPIENT   AMOUNT    USE CASE                │
│   ───────────────────────────────────────────────────────────────────────    │
│   Standard            Visible   Visible     Visible   Public payments         │
│   Offuscate Wallet    HIDDEN    Visible     Visible   Hide company identity   │
│   Stealth Address     Visible   HIDDEN      Visible   Hide employee wallet    │
│   ZK Compression      HIDDEN    Visible     HIDDEN    Hide amount             │
│   ZK + Stealth        HIDDEN    HIDDEN      HIDDEN    MAXIMUM PRIVACY         │
│   + Privacy Pool      BROKEN LINK between deposit and withdrawal              │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Pages & Navigation

### Employer Navigation

| Page | Route | Description |
|------|-------|-------------|
| **Treasury** | `/mixer` | Dashboard with wallet balances, circular chart, send payments |
| **Payroll** | `/payroll` | Manage batches, employees, invites, fund payroll |
| **Activity** | `/dashboard` | Payment history, stealth address card |
| **Pool** | `/pool` | Privacy pool for additional mixing |

### Recipient Navigation

| Page | Route | Description |
|------|-------|-------------|
| **Salary** | `/salary` | View accrued salary, stealth address card, auto-scan scanner, receipts |
| **Activity** | `/dashboard` | Payment history, stealth address card |
| **Pool** | `/pool` | Privacy pool access |

### Page Components

**Treasury (`/mixer`):**
- Wallet balances (Main + Offuscate)
- Circular balance chart (filterable by wallet)
- Send Payment form:
  - Wallet selection (Main/Offuscate)
  - Recipient type (Public/Stealth)
  - ZK toggle for amount privacy
  - Privacy summary showing what's hidden

**Payroll (`/payroll`):**
- Batch list with stats
- Create batch form
- Invite manager (create, copy, revoke)
- Employee list per batch
- Fund batch form with error handling

**Dashboard (`/dashboard`):**
- **Your Stealth Address card** with one-click copy
- Payment History with filters (All/Received/Sent/Private/Standard)
- Stats: Total distributed, private volume, operations, RPC status
- Streaming Salary Card (for recipients)

**Salary (`/salary`):**
- **Your Stealth Address card** with one-click copy
- Wallet balances (Main + Salary Wallet)
- Salary streaming card with claim button
- **StealthPaymentScanner** - Auto-scans for incoming payments
  - Wallet destination selector (Salary/Main)
  - Claim functionality
- Anonymous Receipts card

---

## Smart Contract Reference

### Program ID
```
5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
```

### Key Instructions

#### Master Vault
| Instruction | Description |
|-------------|-------------|
| `init_master_vault` | Initialize singleton master vault |

#### Payroll Batches
| Instruction | Description |
|-------------|-------------|
| `create_batch` | Create new payroll batch |
| `fund_batch` | Add funds to batch vault |

#### Employees
| Instruction | Description |
|-------------|-------------|
| `add_employee` | Add employee directly (requires wallet) |
| `claim_salary` | Employee claims accrued salary |
| `update_salary_rate` | Owner updates employee salary |

#### Invites
| Instruction | Description |
|-------------|-------------|
| `create_invite` | Create invite with salary config |
| `accept_invite` | Accept invite (simple) |
| `accept_invite_streaming` | Accept invite + add to streaming payroll |
| `revoke_invite` | Revoke pending invite |

#### Privacy Pool
| Instruction | Description |
|-------------|-------------|
| `init_privacy_pool` | Initialize pool (once) |
| `private_deposit` | Deposit with commitment |
| `private_withdraw` | Withdraw with nullifier proof |

### Account Structures

```rust
#[account]
pub struct MasterVault {
    pub authority: Pubkey,      // Who initialized
    pub batch_count: u32,       // Number of batches
    pub total_employees: u32,   // Total across all batches
    pub total_deposited: u64,   // Total SOL deposited
    pub total_paid: u64,        // Total SOL paid out
    pub bump: u8,
}

#[account]
pub struct PayrollBatch {
    pub master_vault: Pubkey,   // Reference to master
    pub owner: Pubkey,          // Company wallet
    pub index: u32,             // Batch index
    pub title: String,          // Batch name
    pub employee_count: u32,    // Employees in batch
    pub total_budget: u64,      // Total funded
    pub total_paid: u64,        // Total claimed
    pub created_at: i64,
    pub status: BatchStatus,    // Active/Paused/Closed
    pub vault_bump: u8,
    pub batch_bump: u8,
}

#[account]
pub struct Employee {
    pub batch: Pubkey,          // Parent batch
    pub wallet: Pubkey,         // Stealth pubkey (NOT main wallet!)
    pub index: u32,             // Employee index
    pub stealth_address: String, // Meta-address for verification
    pub salary_rate: u64,       // Lamports per second
    pub start_time: i64,
    pub last_claimed_at: i64,
    pub total_claimed: u64,
    pub status: EmployeeStatus, // Active/Paused/Terminated
    pub bump: u8,
}

#[account]
pub struct Invite {
    pub batch: Pubkey,          // Target batch
    pub invite_code: String,    // 8-char code
    pub creator: Pubkey,        // Employer wallet
    pub recipient: Pubkey,      // Filled on accept
    pub recipient_stealth_address: String,
    pub salary_rate: u64,       // Lamports per second
    pub status: InviteStatus,   // Pending/Accepted/Revoked
    pub created_at: i64,
    pub accepted_at: i64,
    pub bump: u8,
}
```

### PDA Seeds

| Account | Seeds |
|---------|-------|
| MasterVault | `["master_vault"]` |
| PayrollBatch | `["batch", master_vault, index.to_le_bytes()]` |
| BatchVault | `["batch_vault", batch]` |
| Employee | `["employee", batch, index.to_le_bytes()]` |
| Invite | `["invite", invite_code]` |

---

## API Reference

### useProgram() Hook

Main hook for all program operations:

```typescript
const {
  // Payroll
  initMasterVault,
  createBatch,
  fundBatch,
  fetchBatch,
  listMyBatches,
  listBatchEmployees,

  // Employees
  addEmployee,
  claimSalary,
  claimSalaryWithStealth,
  findMyEmployeeRecord,
  findEmployeeByStealthPubkey,

  // Invites
  createInvite,
  acceptInvite,
  acceptInviteStreaming,
  revokeInvite,
  fetchInvite,

  // Privacy Pool
  privateDeposit,
  privateWithdraw,
  getUnspentPrivateNotes,

  // Receipts
  createReceipt,
  createReceiptWithStealth,
  listMyReceipts,
  verifyReceiptBlind,
} = useProgram();
```

### useStealth() Hook

Stealth key management:

```typescript
const {
  stealthKeys,           // Current stealth keys
  metaAddressString,     // Formatted meta address (st:viewPub:spendPub)
  isInitialized,         // Has stealth keys
  isLoading,
  isDeriving,
  deriveKeysFromWallet,  // Generate keys from wallet signature
  clearKeys,
  exportKeys,
} = useStealth();
```

### useRole() Hook

Role detection with localStorage persistence:

```typescript
const {
  role,                  // 'employer' | 'recipient' | null
  setRole,
  isLoading,
  needsOnboarding,
  pendingInviteCode,
  setPendingInviteCode,
  refreshRole,
} = useRole();
```

### Employer Operations

```typescript
// Create batch
const { signature, batchIndex } = await createBatch("Engineering Team");

// Create invite with salary (1000 SOL/month)
const { signature, inviteCode } = await createInvite(campaignId, 1000);

// Fund batch
await fundBatch(batchIndex, amountLamports);

// List employees
const employees = await listBatchEmployees(batchIndex);
```

### Employee Operations

```typescript
// Accept invite (generates stealth keypair)
const stealthKeypair = Keypair.generate();
await acceptInviteStreaming(inviteCode, stealthMetaAddress, stealthKeypair, batchIndex);

// Check salary
const record = await findMyEmployeeRecord();
console.log(`Accrued: ${record.employee.accruedSalary / LAMPORTS_PER_SOL} SOL`);

// Claim with stealth keypair
await claimSalaryWithStealth(batchIndex, employeeIndex, stealthKeypair);
```

---

## Security & Privacy Guarantees

### Threat Model

| Threat | Attack Vector | Mitigation |
|--------|---------------|------------|
| Salary Discovery | View employer transactions | Stealth addresses + ZK compression |
| Employee Identification | Link payment to person | Stealth addresses, invite system |
| Amount Correlation | Analyze payment amounts | ZK compression hides amounts |
| Timing Analysis | Correlate deposit/withdraw | Variable delays in privacy pool |
| Fee Payer Exposure | Identify via gas payment | Relayer pays gas |
| Address Reuse | Link multiple payments | Fresh stealth address per payment |

### Privacy Levels Summary

| Component | What It Hides |
|-----------|--------------|
| Stealth Address | Recipient identity |
| Offuscate Wallet | Sender identity |
| ZK Compression | Sender + Amount |
| Privacy Pool | Deposit-withdrawal link |
| Invite System | Employee-wallet link |

### Best Practices

**For Employers:**
1. Use Offuscate Wallet for payments
2. Enable ZK compression when possible
3. Use stealth addresses for recipients
4. Fund batches from Offuscate Wallet

**For Employees:**
1. Securely store stealth private key
2. Accept invites from a fresh browser session
3. Don't transfer directly from stealth to known wallet
4. Use privacy pool for additional mixing

---

## Deployment Guide

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

# RPC URL
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com?api-key=YOUR_KEY

# Program ID
NEXT_PUBLIC_PROGRAM_ID=5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
```

---

## Summary

**Offuscate** is a privacy-first B2B payroll platform providing:

### For Employers
- Create payroll batches for teams
- Onboard employees via invite codes
- Stream salaries per-second
- Send payments with maximum privacy (ZK + Stealth)
- Separate "Offuscate Wallet" hides sender identity
- Easy stealth address sharing on Dashboard

### For Employees
- Accept invites without exposing main wallet
- Salary accrues automatically
- Claim to stealth address (untraceable)
- Full privacy from employer and on-chain observers
- Auto-scan for incoming stealth payments
- Easy stealth address sharing for receiving payments
- Choose destination wallet when claiming

### Privacy Guarantees
- **Sender hidden** via Offuscate Wallet + ZK
- **Recipient hidden** via Stealth Addresses
- **Amount hidden** via ZK Compression
- **Link broken** via Privacy Pool
- **Identity protected** via Invite System
- **Role remembered** via localStorage per wallet

---

*Documentation for Solana Privacy Hackathon 2025*
*Project: Offuscate - Privacy-First B2B Payroll*
*Program ID: `5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq`*
