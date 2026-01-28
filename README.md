# Offuscate - Privacy-First B2B Payroll on Solana

> **Enterprise payroll platform** with maximum privacy for employers and employees through stealth addresses, ZK compression, and untraceable payments.

![Solana](https://img.shields.io/badge/Solana-Devnet-green)
![Anchor](https://img.shields.io/badge/Anchor-0.31.1-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Privacy](https://img.shields.io/badge/Privacy-Maximum-purple)

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

## Privacy Architecture

```
                    OFFUSCATE PRIVACY STACK
┌─────────────────────────────────────────────────────────────┐
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

## How It Works

### Employer Flow

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

### Employee Flow

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

| Option | Sender | Recipient | Amount |
|--------|--------|-----------|--------|
| Standard | Visible | Visible | Visible |
| Offuscate Wallet | Hidden | Visible | Visible |
| Stealth Address | Visible | Hidden | Visible |
| ZK Compression | Hidden | Visible | Hidden |
| **ZK + Stealth** | **Hidden** | **Hidden** | **Hidden** |

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
NEXT_PUBLIC_PROGRAM_ID=5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
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
