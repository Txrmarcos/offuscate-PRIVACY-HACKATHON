# Offuscate Frontend

> Privacy-First Donations & Wallet Mixing on Solana

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Features

### Private Donations (`/explore`)
- Browse crowdfunding campaigns
- Donate with privacy protection
- **ZK Private** - Light Protocol ZK Compression (recommended)
- **ShadowWire** - Bulletproofs ZK (maximum privacy)
- **Public** - Standard transparent donation

### ShadowMix (`/mixer`)
- Personal wallet mixer
- Two wallet system (Main + Stealth)
- Deposit to privacy pool with standardized amounts
- Withdraw to stealth wallet (untraceable)
- Send payments with ZK or direct mode

### Campaign Management
- `/launch` - Create new campaigns
- `/dashboard` - Manage your campaigns and stealth keys
- `/activity` - View transaction history

## Privacy Technology

| Layer | Technology | Purpose |
|-------|------------|---------|
| 4 | Light Protocol ZK | Groth16 proofs, sender unlinkable |
| 3 | Commitment System | Cryptographic unlinkability |
| 2 | Relayer | Gas abstraction |
| 1 | Privacy Pool | Fund mixing |
| 0 | Stealth Addresses | One-time addresses |

## Environment Variables

```bash
# .env.local

# Helius RPC (required for ZK Compression)
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com?api-key=YOUR_KEY
NEXT_PUBLIC_HELIUS_API_KEY=YOUR_KEY

# Relayer (base58 encoded keypair)
RELAYER_SECRET_KEY=<base58_encoded_secret>

# Program ID
NEXT_PUBLIC_PROGRAM_ID=5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
```

## Tech Stack

- **Next.js 15** - React framework
- **Tailwind CSS 4** - Styling
- **Anchor** - Solana program client
- **Light Protocol** - ZK Compression
- **Solana Wallet Adapter** - Wallet connection

## Project Structure

```
app/
├── page.tsx              # Home
├── explore/              # Campaigns browser
├── mixer/                # ShadowMix
├── launch/               # Create campaign
├── dashboard/            # User dashboard
├── components/
│   ├── DonationModal     # Privacy donation selection
│   ├── TraceSimulator    # Traceability test
│   └── PrivacyFeedback   # Privacy analysis
└── lib/
    ├── program/          # Anchor client
    ├── privacy/          # ZK & commitment system
    └── stealth/          # Stealth addresses
```

## Build

```bash
npm run build
npm start
```

---

*Solana Privacy Hackathon 2025*
