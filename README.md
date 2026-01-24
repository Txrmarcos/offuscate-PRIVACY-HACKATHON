# Offuscate - Private Donations on Solana

> **Privacy-first donation platform** que quebra a linkabilidade entre doadores e destinatários através de múltiplas camadas de privacidade.

![Solana](https://img.shields.io/badge/Solana-Devnet-green)
![Anchor](https://img.shields.io/badge/Anchor-0.31.1-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

## 🎯 Status

**✅ FULLY IMPLEMENTED & DEPLOYED ON DEVNET**

| Feature | Status |
|---------|--------|
| Privacy Pool | ✅ Deployed |
| Variable Delay (30s-5min) | ✅ Working |
| Standardized Amounts | ✅ Working |
| Batch Withdrawals | ✅ Working |
| Pool Churn | ✅ Working |
| Stealth Addresses | ✅ Working |
| Relayer (Gasless) | ✅ Working |
| **Phase 3: ZK Privacy** | ✅ **Working** |

## 📦 Deployed Addresses (Devnet)

```
Program ID:  5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
Relayer:     BEfcVt7sUkRC4HVmWn2FHLkKPKMu1uhkXb4dDr5g7A1a
```

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 OFFUSCATE PRIVACY STACK                  │
├─────────────────────────────────────────────────────────┤
│  PHASE 3: Commitment + Nullifier (ZK-Like)              │
│  └── Quebra linkabilidade mesmo com indexador avançado  │
├─────────────────────────────────────────────────────────┤
│  PHASE 2: Gas Abstraction (Relayer)                     │
│  └── Stealth address NÃO aparece como fee payer         │
├─────────────────────────────────────────────────────────┤
│  PHASE 1: Privacy Pool                                  │
│  └── Variable delay + Standardized amounts + Churn      │
├─────────────────────────────────────────────────────────┤
│  BASE: Stealth Addresses                                │
│  └── One-time addresses derivados via ECDH              │
└─────────────────────────────────────────────────────────┘
```

## 🔐 Como Funciona

### Fluxo de Depósito Privado (Phase 3)

```
1. Gera secrets localmente (secret + nullifier_secret)
2. Computa commitment = SHA256(secret_hash || nullifier || amount)
3. On-chain: cria CommitmentPDA com apenas o hash
4. Salva secrets em localStorage

→ Nenhuma informação sobre o depositor é armazenada on-chain
```

### Fluxo de Saque Privado

```
1. Fornece nullifier + secret_hash + amount
2. On-chain verifica: commitment matches + nullifier unused
3. Cria NullifierPDA (previne double-spend)
4. Transfere para stealth address

→ Impossível correlacionar com o depósito original
```

## 🚀 Quick Start

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
NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com?api-key=<your-key>
RELAYER_SECRET_KEY=<base58-encoded-keypair>
```

## 📖 Documentation

- [**PRIVACY_SYSTEM_DOCS.md**](./PRIVACY_SYSTEM_DOCS.md) - Documentação técnica completa
- [**PHASE3_ZK_PRIVACY.md**](./PHASE3_ZK_PRIVACY.md) - Detalhes do sistema commitment/nullifier
- [**PRIVACY_POOL.md**](./PRIVACY_POOL.md) - Documentação do Privacy Pool

## 🛡 Privacy Guarantees

### O que protegemos:

| Ameaça | Mitigação |
|--------|-----------|
| Timing correlation | Variable delay (30s-5min) |
| Amount correlation | Standardized amounts (0.1, 0.5, 1 SOL) |
| Graph analysis | Pool mixing + churn |
| Address reuse | Stealth addresses |
| Fee payer exposure | Relayer (gasless claims) |
| Indexer correlation | **Commitment + Nullifier** |
| Double-spend | NullifierPDA uniqueness |

### O que um adversário vê:

```
Depósito: [commitment_hash] [amount] [timestamp]
Saque:    [nullifier_hash] [stealth_address] [amount]

❌ Não consegue: linkar depósito → saque
❌ Não consegue: identificar depositor
❌ Não consegue: correlacionar timing/amount específico
```

## 🔧 Tech Stack

**Smart Contract:**
- Anchor Framework
- Solana Program Library
- Ed25519 signature verification

**Frontend:**
- Next.js 16
- @solana/web3.js
- @coral-xyz/anchor
- @noble/hashes (SHA256)
- TailwindCSS

**Privacy Libraries:**
- Custom stealth address implementation (ECDH)
- Commitment/nullifier scheme (SHA256-based)

## 📁 Project Structure

```
├── programs/
│   └── offuscate/
│       └── src/
│           └── lib.rs          # Smart contract
├── frontend/
│   └── app/
│       ├── components/
│       │   └── PrivacyPoolPanel.tsx
│       ├── lib/
│       │   ├── program/        # Anchor client
│       │   ├── privacy/        # Commitment/nullifier
│       │   └── stealth/        # Stealth addresses
│       └── api/
│           └── relayer/        # Gasless endpoints
├── PRIVACY_SYSTEM_DOCS.md      # Full documentation
└── README.md
```

## 🎮 Usage Examples

### Private Deposit

```typescript
import { useProgram } from './lib/program';

const { privateDeposit } = useProgram();

// Deposit 0.5 SOL with commitment privacy
const { signature, note } = await privateDeposit(0.5);
// note is automatically saved to localStorage
```

### Private Withdraw

```typescript
const { privateWithdraw, getUnspentPrivateNotes } = useProgram();

// Get available notes
const notes = await getUnspentPrivateNotes();

// Withdraw to stealth address
await privateWithdraw(notes[0], stealthKeypair.publicKey);
```

### Gasless Withdraw (via Relayer)

```typescript
const { privateWithdrawRelayed } = useProgram();

// Relayer pays gas, stealth address receives funds
const result = await privateWithdrawRelayed(note, stealthKeypair);
console.log(`Relayer: ${result.relayer}`);
```

## ⚠️ Security Considerations

1. **Backup Notes**: Private notes são armazenados em localStorage. Faça backup!
2. **Anonymity Set**: Maior número de usuários = maior privacidade
3. **Timing**: Aguarde antes de sacar para maximizar privacidade
4. **Stealth Address**: Sempre use stealth address como recipient

## 📜 License

MIT

## 🙏 Acknowledgments

- Tornado Cash (commitment/nullifier inspiration)
- Light Protocol (ZK compression concepts)
- Solana Foundation
- Helius (RPC infrastructure)
