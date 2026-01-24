# Offuscate - Private Donations on Solana

> **Privacy-first donation platform** that breaks the linkability between donors and recipients through multiple layers of cryptographic privacy.

![Solana](https://img.shields.io/badge/Solana-Devnet-green)
![Anchor](https://img.shields.io/badge/Anchor-0.31.1-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Privacy](https://img.shields.io/badge/Privacy-Maximum-purple)

## Status

**FULLY IMPLEMENTED & DEPLOYED ON DEVNET**

| Feature | Status | Description |
|---------|--------|-------------|
| Privacy Pool | Working | Fund mixing with variable delays |
| Stealth Addresses | Working | One-time ECDH-derived addresses |
| Relayer (Gasless) | Working | Gas abstraction for recipients |
| Commitment Privacy | Working | ZK-like commitment/nullifier scheme |
| Variable Delay | Working | 30s-5min pseudo-random delays |
| Standardized Amounts | Working | 0.1, 0.5, 1.0 SOL only |
| Batch Withdrawals | Working | Multiple claims per transaction |
| Pool Churn | Working | Internal mixing for graph resistance |

## Deployed Addresses (Devnet)

```
Program ID:  5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
Relayer:     BEfcVt7sUkRC4HVmWn2FHLkKPKMu1uhkXb4dDr5g7A1a
```

## Privacy Architecture

```
                    OFFUSCATE PRIVACY STACK
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: Commitment + Nullifier (ZK-Like)                  │
│  └── Even advanced indexers cannot correlate deposits       │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: Gas Abstraction (Relayer)                         │
│  └── Stealth address never appears as fee payer             │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1: Privacy Pool                                      │
│  └── Variable delay + Standardized amounts + Pool churn     │
├─────────────────────────────────────────────────────────────┤
│  LAYER 0: Stealth Addresses                                 │
│  └── One-time addresses derived via ECDH                    │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### Maximum Privacy Flow

```
Donor Wallet                                         Campaign Owner
     │                                                      ▲
     │  1. Generate commitment (secret + nullifier)         │
     ▼                                                      │
 ┌─────────┐                                                │
 │Commitment│ = SHA256(secret_hash || nullifier || amount)  │
 └────┬────┘                                                │
      │  2. Deposit to Privacy Pool                         │
      ▼                                                     │
 ┌─────────────┐                                            │
 │ Pool Vault  │  ← Funds mixed from all donors             │
 └──────┬──────┘                                            │
        │                                                   │
        │  3. Variable delay (30s - 5min)                   │
        ▼                                                   │
 ┌─────────────────┐                                        │
 │ Generate stealth│  ← One-time unlinkable address         │
 │ address         │                                        │
 └────────┬────────┘                                        │
          │                                                 │
          │  4. Claim via Relayer (gasless)                 │
          ▼                                                 │
 ┌──────────────────┐                                       │
 │     Relayer      │  ← Pays gas, no fee payer exposure    │
 └────────┬─────────┘                                       │
          │                                                 │
          │  5. Funds to stealth address                    │
          ▼                                                 │
 ┌─────────────────┐                                        │
 │ Stealth Address │────────────────────────────────────────┘
 └─────────────────┘
          │
          │  6. Owner derives spending key
          ▼
 ┌─────────────────┐
 │ Owner's Wallet  │  ← Clean, unlinkable funds
 └─────────────────┘
```

### What Adversaries See vs. Cannot Determine

| What They See | What They Cannot Determine |
|---------------|---------------------------|
| Commitment hash | Who deposited |
| Nullifier hash | Which deposit corresponds |
| Stealth address | Recipient identity |
| Standardized amounts | Amount correlation |
| Variable timing | Timing correlation |

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

### Environment

```bash
# frontend/.env.local
NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com?api-key=YOUR_KEY
RELAYER_SECRET_KEY=<base58_encoded_keypair>
```

## Privacy Guarantees

### Threats Mitigated

| Threat | Attack Vector | Mitigation |
|--------|---------------|------------|
| Timing Correlation | Match deposit/withdraw times | Variable delay (30s-5min) |
| Amount Correlation | Match deposit/withdraw amounts | Standardized amounts only |
| Graph Analysis | Trace fund flow | Pool mixing + churn |
| Address Reuse | Link multiple payments | Stealth addresses |
| Fee Payer Exposure | Identify recipient via gas | Relayer pays gas |
| Indexer Correlation | Advanced on-chain analysis | Commitment + nullifier |
| Double-Spend | Withdraw same deposit twice | NullifierPDA uniqueness |

### Mathematical Guarantee

Without `secret` and `nullifier_secret` (stored locally only), it is cryptographically impossible to prove which deposit matches which withdrawal, even with complete blockchain access.

## Documentation

| Document | Description |
|----------|-------------|
| [PRIVACY_SYSTEM_DOCS.md](./PRIVACY_SYSTEM_DOCS.md) | Complete technical documentation |
| [PRIVACY_POOL.md](./PRIVACY_POOL.md) | Privacy Pool details |
| [PHASE3_ZK_PRIVACY.md](./PHASE3_ZK_PRIVACY.md) | Commitment/Nullifier system |

## Project Structure

```
├── programs/
│   └── offuscate/
│       └── src/
│           └── lib.rs              # Smart contract
├── frontend/
│   └── app/
│       ├── components/
│       │   ├── WaveMeshBackground.tsx  # Animated privacy visualization
│       │   ├── DonationModal.tsx       # Privacy-aware donations
│       │   └── PrivacyPoolPanel.tsx    # Pool UI
│       ├── lib/
│       │   ├── program/            # Anchor client
│       │   ├── privacy/            # Commitment/nullifier
│       │   └── stealth/            # Stealth addresses (ECDH)
│       └── api/
│           └── relayer/            # Gasless claim endpoints
├── PRIVACY_SYSTEM_DOCS.md          # Full documentation
├── PRIVACY_POOL.md                 # Pool documentation
└── README.md
```

## Tech Stack

**Smart Contract:**
- Anchor Framework (Rust)
- Solana Program Library
- Ed25519 signature verification on-chain

**Frontend:**
- Next.js 16
- @solana/web3.js
- @coral-xyz/anchor
- @noble/hashes (SHA256, ed25519)
- @noble/curves (x25519 ECDH)
- TailwindCSS

**Privacy Libraries:**
- Custom stealth address implementation (ECDH curve25519)
- Commitment/nullifier scheme (SHA256-based, Tornado-inspired)

## Usage Examples

### Private Donation

```typescript
import { useProgram } from './lib/program';

const { poolDeposit } = useProgram();

// Deposit to Privacy Pool (commitment generated automatically)
const { signature, note } = await privateDeposit(0.5);
// note saved to localStorage - REQUIRED for withdrawal
```

### Gasless Withdrawal

```typescript
const { privateWithdrawRelayed, getUnspentPrivateNotes } = useProgram();

// Get saved notes
const notes = await getUnspentPrivateNotes();

// Withdraw via relayer (no gas needed)
const result = await privateWithdrawRelayed(notes[0], stealthKeypair);
console.log(`Relayer paid gas: ${result.relayer}`);
```

## Security Considerations

1. **Backup Notes**: Private notes in localStorage - backup regularly
2. **Anonymity Set**: More users = stronger privacy
3. **Wait Before Withdrawing**: More time = more mixing
4. **Use Stealth Addresses**: Always use as recipient
5. **Use Relayer**: Never pay gas with stealth address

## Visual Effects

The UI includes an animated wave mesh background that triggers an "offuscation" effect when transactions complete, visually representing the privacy protection. Connections dynamically disconnect and reconnect, symbolizing the unlinkability of transactions.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/relayer/claim` | GET | Check relayer status |
| `/api/relayer/claim` | POST | Gasless claim from pool |
| `/api/relayer/private-claim` | POST | Gasless claim with commitment |

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## License

MIT

## Acknowledgments

- Tornado Cash (commitment/nullifier inspiration)
- Light Protocol (ZK compression concepts)
- Solana Foundation
- Helius (RPC infrastructure)

---

*Privacy Hackathon SOL 2025*
*Program ID: `5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq`*
