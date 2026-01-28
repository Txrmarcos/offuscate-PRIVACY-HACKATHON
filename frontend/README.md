# Offuscate Frontend

> Privacy-First B2B Payroll Platform on Solana

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Features

### For Employers

**Treasury (`/mixer`):**
- Wallet balances (Main + Offuscate)
- Circular balance chart
- Send private payments with ZK + Stealth

**Payroll (`/payroll`):**
- Create payroll batches
- Generate invite codes with salary config
- Fund batches, manage employees

**Activity (`/dashboard`):**
- **Your Stealth Address** card with one-click copy
- Payment history with filters
- Stats: distributed, private volume, operations

### For Employees

**Salary (`/salary`):**
- **Your Stealth Address** card with one-click copy
- Real-time salary streaming
- Claim to stealth wallet
- **StealthPaymentScanner** - Auto-scans for incoming payments
- Choose destination wallet (Salary/Main) when claiming
- Anonymous Receipts

**Activity (`/dashboard`):**
- **Your Stealth Address** card with one-click copy
- Payment history
- Streaming salary card

### Privacy Pool (`/pool`)
- Deposit with commitment
- Withdraw to stealth address
- Gasless withdrawals via relayer

## Privacy Technology

| Layer | Technology | Purpose |
|-------|------------|---------|
| 3 | Light Protocol ZK | Groth16 proofs, hide sender & amount |
| 2 | Stealth Addresses | One-time ECDH addresses |
| 1 | Offuscate Wallet | Deterministic keypair, hide sender |
| 0 | Privacy Pool | Fund mixing |

## Environment Variables

```bash
# .env.local

# Helius RPC (required for ZK Compression)
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com?api-key=YOUR_KEY

# Relayer (base58 encoded keypair)
RELAYER_SECRET_KEY=<base58_encoded_secret>

# Program ID
NEXT_PUBLIC_PROGRAM_ID=5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
```

## Tech Stack

- **Next.js 16** - React framework
- **Tailwind CSS** - Styling
- **Anchor** - Solana program client
- **Light Protocol** - ZK Compression
- **Solana Wallet Adapter** - Wallet connection
- **@noble/curves** - ECDH for stealth addresses
- **@noble/hashes** - SHA256 for commitments

## Project Structure

```
app/
├── page.tsx              # Home / Landing
├── mixer/                # Treasury dashboard
├── payroll/              # Payroll management
├── salary/               # Employee salary view
├── dashboard/            # Activity / History
├── pool/                 # Privacy pool
├── invite/[code]/        # Invite acceptance
├── components/
│   ├── Header.tsx                # Navigation with role-based links
│   ├── InviteManager.tsx         # Create/manage invites
│   ├── EmployeeSalaryCard.tsx    # Salary display
│   ├── StealthPaymentScanner.tsx # Auto-scan stealth payments
│   └── ReceiptsCard.tsx          # Anonymous receipts
├── lib/
│   ├── program/          # Anchor client & hooks
│   ├── stealth/          # Stealth address implementation
│   ├── privacy/          # ZK & commitment system
│   └── role/             # Role detection with localStorage
└── api/
    ├── helius/           # Helius integration
    ├── light/            # Light Protocol
    ├── privacy/          # Pool operations
    └── relayer/          # Gasless claims
```

## Key Hooks

### useProgram()
All program operations: batches, employees, invites, pool, receipts.

### useStealth()
Stealth key management with `metaAddressString` for easy sharing.

### useRole()
Role detection (employer/recipient) with localStorage persistence per wallet.

## Build

```bash
npm run build
npm start
```

---

*Solana Privacy Hackathon 2025*
*Program ID: `5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq`*
