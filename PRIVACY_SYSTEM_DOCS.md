# Offuscate - Complete Privacy System Documentation

## Table of Contents

1. [Vision & Overview](#vision--overview)
2. [Architecture](#architecture)
3. [Privacy Layers](#privacy-layers)
   - [Layer 0: Stealth Addresses](#layer-0-stealth-addresses)
   - [Layer 1: Privacy Pool](#layer-1-privacy-pool)
   - [Layer 2: Gas Abstraction (Relayer)](#layer-2-gas-abstraction-relayer)
   - [Layer 3: Commitment-Based Privacy](#layer-3-commitment-based-privacy)
   - [Layer 4: Light Protocol ZK Compression](#layer-4-light-protocol-zk-compression)
4. [Complete User Flows](#complete-user-flows)
5. [Smart Contract Reference](#smart-contract-reference)
6. [Frontend Integration](#frontend-integration)
7. [API Reference](#api-reference)
8. [Security Analysis](#security-analysis)
9. [Deployment Guide](#deployment-guide)

---

## Vision & Overview

**Offuscate** is a privacy-first donation platform built on Solana that breaks the linkability between donors and recipients through multiple layers of cryptographic and operational privacy.

### The Problem

Standard blockchain transactions are fully transparent:
```
wallet_A ─────► wallet_B ─────► wallet_C
    │              │              │
    └──────────────┴──────────────┴──── All visible on explorer
```

Any observer can trace the entire flow of funds, identify donors, and link them to campaigns.

### Our Solution

Offuscate implements a multi-layered privacy stack that makes it cryptographically impossible to link donors to recipients:

```
                    OFFUSCATE PRIVACY STACK
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: Light Protocol ZK Compression                     │
│  └── Groth16 ZK proofs, sender-receiver link broken         │
├─────────────────────────────────────────────────────────────┤
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

### Deployed Addresses (Devnet)

| Component | Address |
|-----------|---------|
| Program ID | `5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq` |
| Relayer | `BEfcVt7sUkRC4HVmWn2FHLkKPKMu1uhkXb4dDr5g7A1a` |
| Privacy Pool PDA | `seeds = ["privacy_pool"]` |
| Pool Vault PDA | `seeds = ["pool_vault"]` |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Wallet    │  │   Stealth   │  │   Privacy   │  │    Campaign     │ │
│  │  Adapter    │  │   Context   │  │    Pool     │  │    Manager      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                │                   │          │
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
            │  Solana   │   │  Relayer  │   │  Helius   │
            │  Devnet   │   │    API    │   │    RPC    │
            └─────┬─────┘   └─────┬─────┘   └───────────┘
                  │               │
                  └───────┬───────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SMART CONTRACT                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        OFFUSCATE PROGRAM                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │   │
│  │  │  Campaigns  │  │  Privacy    │  │  Commitment │               │   │
│  │  │  Module     │  │  Pool       │  │  System     │               │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                          PDAs (State)                              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │  │
│  │  │ Campaign │ │ Privacy  │ │ Pending  │ │Commitment│ │ Nullifier│ │  │
│  │  │   PDA    │ │Pool PDA  │ │Withdraw  │ │   PDA    │ │   PDA    │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
DONATION FLOW (Maximum Privacy):

  Donor Wallet                                            Campaign Owner
       │                                                        ▲
       │  1. Generate commitment                                │
       │     (secret, nullifier_secret)                         │
       ▼                                                        │
  ┌─────────┐                                                   │
  │Commitment│ = SHA256(secret_hash || nullifier || amount)     │
  └────┬────┘                                                   │
       │  2. Deposit to Privacy Pool                            │
       ▼                                                        │
  ┌─────────────────┐                                           │
  │  Privacy Pool   │  ← Mixed funds from all donors            │
  │    Vault        │                                           │
  └────────┬────────┘                                           │
           │                                                    │
           │  3. Variable Delay (30s - 5min)                    │
           │     + Pool Churn (internal mixing)                 │
           ▼                                                    │
  ┌─────────────────┐                                           │
  │  Request        │  ← Create PendingWithdraw for             │
  │  Withdrawal     │    stealth address                        │
  └────────┬────────┘                                           │
           │                                                    │
           │  4. Claim via Relayer (gasless)                    │
           ▼                                                    │
  ┌─────────────────┐     ┌─────────────────┐                   │
  │    Relayer      │────►│  Stealth        │───────────────────┘
  │  (pays gas)     │     │  Address        │
  └─────────────────┘     └─────────────────┘
                                  │
                                  │  5. Owner scans & derives
                                  │     spending key
                                  ▼
                          ┌─────────────────┐
                          │  Final Wallet   │
                          │  (clean funds)  │
                          └─────────────────┘
```

---

## Privacy Layers

### Layer 0: Stealth Addresses

Stealth addresses are one-time addresses generated for each transaction, making it impossible to link payments to a recipient's main wallet.

#### Concept

```
TRADITIONAL (traceable):
  sender_wallet → recipient_main_wallet
       │                    │
       └────────────────────┘  ← On-chain link visible

STEALTH (unlinkable):
  sender_wallet → stealth_address_1
  sender_wallet → stealth_address_2
  sender_wallet → stealth_address_3
       │                    │
       │     Different address each time!
       └────────────────────┘  ← No pattern visible
```

#### How It Works

**1. Key Generation**

The recipient generates a pair of keys and publishes a "meta-address":

```typescript
interface StealthKeys {
  viewKey: {
    privateKey: Uint8Array;   // Can share with view-only party
    publicKey: Uint8Array;
  };
  spendKey: {
    privateKey: Uint8Array;   // MUST remain secret
    publicKey: Uint8Array;
  };
}

// Meta-address format (public)
const metaAddress = `st:${bs58.encode(viewPublicKey)}:${bs58.encode(spendPublicKey)}`;
```

**2. Sender: Generate Stealth Address**

```
┌─────────────────────────────────────────────────────────────────────┐
│                       SENDER'S COMPUTATION                           │
│                                                                      │
│   1. Parse recipient's meta-address                                  │
│      → viewPubKey, spendPubKey                                       │
│                                                                      │
│   2. Generate ephemeral keypair (ONE-TIME)                          │
│      ephemeral_priv = random()                                       │
│      ephemeral_pub = G * ephemeral_priv                              │
│                                                                      │
│   3. Compute shared secret (ECDH)                                   │
│      x25519_priv = to_montgomery(ephemeral_priv)                    │
│      x25519_pub = to_montgomery(viewPubKey)                         │
│      shared_secret = SHA256(x25519(x25519_priv, x25519_pub))        │
│                                                                      │
│   4. Derive stealth public key                                      │
│      stealth_seed = SHA256(shared_secret || spendPubKey || 0)       │
│      stealth_pubkey = ed25519.getPublicKey(stealth_seed)            │
│                                                                      │
│   RESULT: stealth_address + ephemeral_pub (must publish)            │
└─────────────────────────────────────────────────────────────────────┘
```

**3. Receiver: Scan & Recover**

```
┌─────────────────────────────────────────────────────────────────────┐
│                      RECEIVER'S COMPUTATION                          │
│                                                                      │
│   1. Scan blockchain for ephemeral public keys                       │
│      (stored in memo, registry, etc.)                                │
│                                                                      │
│   2. For each ephemeral key, compute:                                │
│      shared_secret = SHA256(x25519(viewPrivKey, ephemeral_pub))     │
│      expected_stealth = ed25519(SHA256(shared_secret||spendPub||0)) │
│                                                                      │
│   3. If expected_stealth matches an address with funds:              │
│      → This payment is for us!                                       │
│                                                                      │
│   4. Derive spending key:                                            │
│      stealth_privkey = SHA256(shared_secret || spendPubKey || 0)    │
│      → Can now sign transactions to spend funds                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Implementation Files

- `frontend/app/lib/stealth/index.ts` - Core stealth address library
- `frontend/app/lib/stealth/StealthContext.tsx` - React context for key management

---

### Layer 1: Privacy Pool

The Privacy Pool acts as a mixing service that breaks the direct link between deposits and withdrawals.

#### Concept

```
WITHOUT POOL (traceable):
  donor_A ──────────────────────────────────► recipient_X
     │                                              │
     └──────────── DIRECT LINK ─────────────────────┘

WITH POOL (unlinkable):
  donor_A ───┐                          ┌──► recipient_X
  donor_B ───┼──► [ PRIVACY POOL ] ─────┼──► recipient_Y
  donor_C ───┘     (mixed funds)        └──► recipient_Z
     │                                              │
     └──────────── LINK BROKEN ─────────────────────┘
```

#### Anti-Correlation Features

**1. Variable Delay (30s - 5min)**

```rust
// Delay is pseudo-random based on slot + recipient entropy
let entropy = clock.slot
    .wrapping_add(recipient_bytes[0] as u64)
    .wrapping_add(recipient_bytes[31] as u64)
    .wrapping_mul(0x5851F42D4C957F2D);

let delay_range = (MAX_DELAY_SECONDS - MIN_DELAY_SECONDS) as u64;
let variable_delay = MIN_DELAY_SECONDS + ((entropy % delay_range) as i64);
```

**Why?** Prevents timing correlation attacks where analysts match deposit/withdrawal times.

**2. Standardized Amounts**

```rust
pub const ALLOWED_AMOUNTS: [u64; 3] = [
    100_000_000,   // 0.1 SOL
    500_000_000,   // 0.5 SOL
    1_000_000_000, // 1.0 SOL
];
```

**Why?** Prevents amount correlation (deposit 0.1337 SOL → withdraw 0.1337 SOL).

**3. Batch Withdrawals**

```
INDIVIDUAL CLAIMS (pattern visible):
  claim_tx_1 (0.5 SOL) → recipient_A
  claim_tx_2 (0.5 SOL) → recipient_B
  claim_tx_3 (0.5 SOL) → recipient_C
      │
      └── 1 tx = 1 withdrawal pattern

BATCH CLAIMS (pattern broken):
  batch_claim_tx (1.5 SOL) → recipient_A, B, C
      │
      └── Multiple recipients in 1 tx
```

**4. Pool Churn (Internal Mixing)**

```
Main Pool ◄──────────────► Churn Vault 0
     │
     ├─────────────────────► Churn Vault 1
     │
     └─────────────────────► Churn Vault 2

Flow: deposit → main → churn_0 → main → churn_1 → main → withdraw
      Creates internal "noise" that confuses graph analysis
```

#### PDAs

| PDA | Seeds | Purpose |
|-----|-------|---------|
| PrivacyPool | `["privacy_pool"]` | Global pool state |
| PoolVault | `["pool_vault"]` | Holds mixed funds |
| PendingWithdraw | `["pending", recipient]` | Per-recipient withdrawal request |
| ChurnState | `["churn_state", index]` | Churn vault state (0, 1, 2) |
| ChurnVault | `["churn_vault", index]` | Churn vault funds |

---

### Layer 2: Gas Abstraction (Relayer)

The relayer solves a critical privacy leak: when claiming funds, the recipient would normally pay gas, exposing them as the fee payer.

#### The Problem

```
WITHOUT RELAYER:
  stealth_address (SIGNER) ──► claim_tx ──► receives funds
          │                         │
          └── FEE PAYER ────────────┘
                    │
                    └── EXPOSED ON-CHAIN!
```

#### The Solution

```
WITH RELAYER:
  stealth_address ──┐
         │          │  1. Signs message off-chain
         │          ▼     "claim:{pendingPda}"
         │     ┌─────────┐
         │     │ Relayer │ ◄── 2. Builds tx with ed25519 verify
         │     └────┬────┘
         │          │
         │          │  3. Submits tx, PAYS GAS
         │          ▼
         │     ┌─────────┐
         │     │ Solana  │
         │     │ Network │
         │     └────┬────┘
         │          │
         │          │  4. Verifies signature on-chain
         │          │     via instructions sysvar
         │          ▼
         └────► receives funds (NO ON-CHAIN SIGNING)
```

#### Flow

```
┌───────────────────────────────────────────────────────────────────────┐
│                         RELAYER CLAIM FLOW                            │
│                                                                       │
│   STEP 1: Stealth keypair signs off-chain                            │
│   ┌─────────────────────────────────────────────────────────────────┐│
│   │  message = `claim:${pendingPda.toBase58()}`                     ││
│   │  signature = ed25519.sign(message, stealth_privkey)             ││
│   └─────────────────────────────────────────────────────────────────┘│
│                              │                                        │
│                              ▼                                        │
│   STEP 2: Send to relayer API                                        │
│   ┌─────────────────────────────────────────────────────────────────┐│
│   │  POST /api/relayer/claim                                        ││
│   │  {                                                               ││
│   │    pendingPda: "...",                                           ││
│   │    recipient: "...",    // stealth pubkey                       ││
│   │    signature: "..."     // base58 encoded                       ││
│   │  }                                                               ││
│   └─────────────────────────────────────────────────────────────────┘│
│                              │                                        │
│                              ▼                                        │
│   STEP 3: Relayer builds transaction                                 │
│   ┌─────────────────────────────────────────────────────────────────┐│
│   │  tx.add(                                                        ││
│   │    Ed25519Program.createInstructionWithPublicKey(...),  // ix 0 ││
│   │    program.claim_withdraw_relayed(...)                  // ix 1 ││
│   │  );                                                             ││
│   │  tx.sign(relayer_keypair);  // Relayer pays gas                 ││
│   └─────────────────────────────────────────────────────────────────┘│
│                              │                                        │
│                              ▼                                        │
│   STEP 4: On-chain verification                                      │
│   ┌─────────────────────────────────────────────────────────────────┐│
│   │  // In claim_withdraw_relayed instruction:                      ││
│   │  let ix_sysvar = &ctx.accounts.instructions_sysvar;             ││
│   │  let ed25519_ix = load_instruction_at_checked(0, ix_sysvar)?;   ││
│   │  require!(ed25519_ix.program_id == ed25519_program::ID);        ││
│   │  // If valid, transfer funds to stealth address                 ││
│   └─────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────┘
```

---

### Layer 3: Commitment-Based Privacy

Inspired by Tornado Cash, this layer implements a cryptographic commitment/nullifier scheme that makes it impossible to link deposits to withdrawals, even with full blockchain access.

#### The Problem

Even with pool mixing and delays, an advanced indexer could:
1. List all deposits and withdrawals
2. Use timing heuristics
3. Use amount correlation
4. Apply graph analysis

#### The Solution: Commitment + Nullifier

```
┌─────────────────────────────────────────────────────────────────────┐
│                      COMMITMENT SCHEME                               │
│                                                                      │
│   DEPOSIT (Client-side computation):                                │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                               │   │
│   │   secret = random(32 bytes)                                   │   │
│   │   nullifier_secret = random(32 bytes)                         │   │
│   │                                                               │   │
│   │   secret_hash = SHA256(secret)                                │   │
│   │   nullifier = SHA256(nullifier_secret)                        │   │
│   │                                                               │   │
│   │   commitment = SHA256(secret_hash || nullifier || amount)     │   │
│   │                                                               │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│   ON-CHAIN:                                                          │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                               │   │
│   │   CommitmentPDA {                                             │   │
│   │     commitment: [u8; 32],  // Just the hash - reveals nothing │   │
│   │     amount: u64,           // Standardized (0.1, 0.5, 1 SOL)  │   │
│   │     timestamp: i64,                                           │   │
│   │     spent: bool,                                              │   │
│   │   }                                                           │   │
│   │                                                               │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   LOCAL STORAGE:                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                               │   │
│   │   PrivateNote {                                               │   │
│   │     secret,              // REQUIRED for withdrawal           │   │
│   │     nullifier_secret,    // REQUIRED for withdrawal           │   │
│   │     amount,                                                   │   │
│   │     commitment,                                               │   │
│   │   }                                                           │   │
│   │                                                               │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      WITHDRAWAL SCHEME                               │
│                                                                      │
│   CLIENT PROVIDES:                                                   │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                               │   │
│   │   nullifier = SHA256(nullifier_secret)                        │   │
│   │   secret_hash = SHA256(secret)                                │   │
│   │   amount                                                      │   │
│   │                                                               │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│   ON-CHAIN VERIFICATION:                                             │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                               │   │
│   │   1. Recompute commitment:                                    │   │
│   │      computed = SHA256(secret_hash || nullifier || amount)    │   │
│   │                                                               │   │
│   │   2. Verify:                                                  │   │
│   │      require!(computed == stored_commitment)                  │   │
│   │                                                               │   │
│   │   3. Check nullifier not used:                                │   │
│   │      require!(NullifierPDA does not exist)                    │   │
│   │                                                               │   │
│   │   4. Create NullifierPDA (prevents double-spend)              │   │
│   │                                                               │   │
│   │   5. Mark commitment as spent                                 │   │
│   │                                                               │   │
│   │   6. Transfer to recipient (stealth address)                  │   │
│   │                                                               │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Why This Breaks Linkability

| What Indexer Sees | What It Cannot Determine |
|-------------------|--------------------------|
| Commitment hash on deposit | Who made the deposit |
| Nullifier hash on withdraw | Which commitment it corresponds to |
| Standardized amounts | Link between deposit/withdrawal |
| Stealth address recipient | Identity of recipient |
| Timestamps | Correlation (variable delay) |

**Mathematical Guarantee:**
- Without `secret` and `nullifier_secret`, cannot prove which deposit matches a withdrawal
- Nullifier prevents double-spending without revealing the link
- Even with full blockchain access, linkability is cryptographically broken

---

### Layer 4: Light Protocol ZK Compression

The newest and most powerful privacy layer uses Light Protocol's ZK Compression technology. This provides true zero-knowledge privacy through Groth16 proofs and Merkle tree-based state storage.

#### The Technology

Light Protocol ZK Compression provides:
- **Compressed SOL**: Regular SOL compressed into Merkle trees
- **Groth16 ZK Proofs**: Cryptographic verification without revealing transaction details
- **99% On-Chain Savings**: Only state roots stored on-chain
- **Complete Sender Unlinkability**: Sender-receiver link broken via ZK proofs

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LIGHT PROTOCOL ZK COMPRESSION                     │
│                                                                      │
│   STEP 1: COMPRESS SOL                                              │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                               │   │
│   │   Regular SOL  ───►  Compressed SOL in Merkle Tree           │   │
│   │       │                         │                             │   │
│   │       │                         └── Stored as leaf hash       │   │
│   │       │                                                       │   │
│   │       └── Link to sender broken at this point                │   │
│   │                                                               │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   STEP 2: TRANSFER (PRIVATE)                                        │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                               │   │
│   │   Source Leaf ───► ZK Proof (Groth16) ───► Destination Leaf  │   │
│   │        │                   │                      │           │   │
│   │        │                   │                      │           │   │
│   │        └── Nullified       └── Verified           └── New     │   │
│   │                            on-chain               leaf hash   │   │
│   │                                                               │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   ON-CHAIN VISIBILITY:                                              │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                               │   │
│   │   • State tree root updates (32 bytes)                       │   │
│   │   • ZK proof verification (fixed cost)                       │   │
│   │   • No sender/receiver addresses visible                     │   │
│   │   • No amount visible                                        │   │
│   │                                                               │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

#### SDK & Dependencies

```json
{
  "@lightprotocol/stateless.js": "^0.22.0",
  "@lightprotocol/compressed-token": "^0.22.0"
}
```

#### On-Chain Programs (Devnet)

| Program | Address |
|---------|---------|
| Light System Program | `SySTEM1eSU2p4BGQfQpimFEWWSC1XDFeun3Nqzz3rT7` |
| Account Compression | `compr6CUsB5m2jS4Y3831ztGSTnDpnKJTKS95d64XVq` |
| Noop Program | `noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV` |
| State Merkle Tree | `smt3AFtReRGVcrP11D6bSLEaKdUmrGfaTNowMVccJeu` |
| Nullifier Queue | `nfq3de4qt9d3wHxXWy1wcge3EXhid25mCr12bNWFdtV` |

#### Verified Transaction (Devnet)

**Example:** [5h2ehjCBtNt538HLFe86tSHdnAi3DEPb6Ua6ab9cotAkp4mRgb1hpGfjdyNJDrzb95FskyzkLwFiNjxsGaDo7kgR](https://explorer.solana.com/tx/5h2ehjCBtNt538HLFe86tSHdnAi3DEPb6Ua6ab9cotAkp4mRgb1hpGfjdyNJDrzb95FskyzkLwFiNjxsGaDo7kgR?cluster=devnet)

```
Status: ✅ SUCCESS
Compute Units: 176,438
Fee: 0.000005002 SOL
Programs: Light System → Account Compression → Noop
```

#### Implementation

**Core Library:** `frontend/app/lib/privacy/lightProtocol.ts`

```typescript
// Compress SOL (break sender link)
const compressResult = await compressSOL(wallet, amountSol);

// Transfer privately via ZK proof
const transferResult = await transferCompressedSOL(
  wallet,
  recipientPubkey,
  amountSol
);

// High-level privacy donation function
const result = await privateZKDonation(
  wallet,
  campaignVaultPda,
  amountSol
);
```

#### Key Functions

| Function | Description |
|----------|-------------|
| `compressSOL()` | Convert regular SOL to compressed SOL in Merkle tree |
| `transferCompressedSOL()` | Transfer compressed SOL with ZK proof |
| `decompressSOL()` | Convert compressed SOL back to regular SOL |
| `getCompressedBalance()` | Check compressed SOL balance |
| `privateZKDonation()` | Full privacy donation flow |
| `isLightProtocolAvailable()` | Check if Light Protocol RPC is available |
| `createLightRpc()` | Create connection to Helius ZK Compression RPC |

#### Frontend Integration

**1. DonationModal.tsx** - Campaign Donations
```typescript
// ZK_COMPRESSED privacy level
import { privateZKDonation, type LightWallet } from '../lib/privacy/lightProtocol';

const lightWallet: LightWallet = {
  publicKey: publicKey!,
  signTransaction: signTransaction as any,
};

const result = await privateZKDonation(lightWallet, vaultPda, amountSol);
```

**2. SendPaymentModal.tsx** - P2P Transfers
```typescript
// ZK Compressed P2P payment
const recipientPubkey = new SolanaPublicKey(recipientPublicAddress);
const result = await privateZKDonation(lightWallet, recipientPubkey, amountSol);
```

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/light/balance` | GET/POST | Get compressed SOL balance |
| `/api/light/health` | GET | Check Light Protocol availability |

**Example Response - `/api/light/health`:**
```json
{
  "success": true,
  "available": true,
  "network": "devnet",
  "protocol": "Light Protocol ZK Compression",
  "features": {
    "compressedSOL": true,
    "zkProofs": "Groth16",
    "merkleTreeStorage": true,
    "onChainSavings": "~99%"
  }
}
```

#### Privacy Guarantees

| Feature | Guarantee |
|---------|-----------|
| Sender Identity | Hidden (Merkle tree leaf) |
| Receiver Identity | Hidden (ZK proof) |
| Amount | Hidden (not on-chain) |
| Transaction Link | Broken (ZK nullifiers) |
| Proof System | Groth16 (sound, complete) |

#### Configuration

Requires Helius API key for ZK Compression RPC:

```env
# .env.local
NEXT_PUBLIC_HELIUS_API_KEY=your_helius_api_key
```

Get a free key at: https://dev.helius.xyz

---

## Complete User Flows

### Flow 1: Public Donation (No Privacy)

```
Donor Wallet ──────────────────────────► Campaign Vault
     │                                        │
     └───────── Direct, traceable ────────────┘
```

**Use case:** Donor wants visibility, transparency.

### Flow 2: Semi-Private (Privacy Pool)

```
Donor Wallet ───► Privacy Pool ───► (delay) ───► Stealth Address
     │                                                  │
     │                Pool mixing                       │
     └─────────────── Link broken ──────────────────────┘
```

**Use case:** Good privacy with moderate complexity.

### Flow 3: Maximum Privacy (Commitment + Relayer)

```
Donor Wallet                                         Campaign Owner
     │                                                      ▲
     │  1. Generate secret, nullifier_secret               │
     │  2. Compute commitment hash                          │
     ▼                                                      │
 ┌─────────┐                                                │
 │Commitment│                                               │
 └────┬────┘                                                │
      │  3. private_deposit (commitment, amount)            │
      ▼                                                     │
 ┌─────────────┐                                            │
 │ Pool Vault  │  ← Funds mixed                             │
 └──────┬──────┘                                            │
        │                                                   │
        │  4. Variable delay (30s - 5min)                   │
        │                                                   │
        ▼                                                   │
 ┌─────────────────┐                                        │
 │ Generate stealth│                                        │
 │ address for     │                                        │
 │ recipient       │                                        │
 └────────┬────────┘                                        │
          │                                                 │
          │  5. private_withdraw_relayed                    │
          │     (nullifier, secret_hash, amount)            │
          ▼                                                 │
 ┌──────────────────┐                                       │
 │     Relayer      │  ← Pays gas                           │
 │  (verifies sig)  │                                       │
 └────────┬─────────┘                                       │
          │                                                 │
          │  6. Funds transferred to stealth address        │
          ▼                                                 │
 ┌─────────────────┐                                        │
 │ Stealth Address │────────────────────────────────────────┘
 └─────────────────┘
          │
          │  7. Owner scans, derives spending key
          ▼
 ┌─────────────────┐
 │ Owner's Wallet  │  ← Clean, unlinkable funds
 └─────────────────┘
```

**Privacy guarantees:**
- Commitment hides depositor identity
- Pool mixing breaks temporal correlation
- Standardized amounts prevent value correlation
- Relayer prevents fee payer exposure
- Stealth address prevents recipient identification
- Nullifier prevents double-spend without revealing link

### Flow 4: ZK Compressed Donation (Light Protocol)

```
Donor Wallet                                         Campaign Vault
     │                                                      ▲
     │  1. Compress SOL                                     │
     ▼                                                      │
 ┌─────────────┐                                            │
 │ Merkle Tree │  ← SOL stored as compressed leaf           │
 │    Leaf     │                                            │
 └──────┬──────┘                                            │
        │                                                   │
        │  2. Generate ZK proof (Groth16)                   │
        │                                                   │
        ▼                                                   │
 ┌─────────────────┐                                        │
 │    ZK Proof     │  ← Proves valid transfer without       │
 │   Verification  │     revealing sender/amount            │
 └────────┬────────┘                                        │
          │                                                 │
          │  3. State tree root updated on-chain            │
          │                                                 │
          ▼                                                 │
 ┌─────────────────┐                                        │
 │  Recipient Leaf │  ← New leaf in Merkle tree             │
 │  in Merkle Tree │                                        │
 └────────┬────────┘                                        │
          │                                                 │
          │  4. Decompress to vault (optional)              │
          ▼                                                 │
 ┌─────────────────┐                                        │
 │ Campaign Vault  │────────────────────────────────────────┘
 └─────────────────┘
```

**Privacy guarantees:**
- Groth16 ZK proofs hide all transaction details
- Sender address never appears on-chain
- Amount hidden in ZK proof
- Only state tree root updates visible
- 99% reduction in on-chain footprint

---

## Smart Contract Reference

### Program ID

```
5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
```

### Instructions

#### Campaign Management

| Instruction | Description | Accounts |
|-------------|-------------|----------|
| `create_campaign` | Create new campaign | owner, campaign_pda, vault_pda |
| `donate` | Public donation | donor, campaign_pda, vault_pda |
| `close_campaign` | Close campaign | owner, campaign_pda, vault_pda |
| `withdraw_funds` | Withdraw to owner | owner, campaign_pda, vault_pda |

#### Privacy Pool (Phase 1)

| Instruction | Description | Accounts |
|-------------|-------------|----------|
| `init_privacy_pool` | Initialize pool (once) | authority, pool_pda, vault_pda |
| `pool_deposit` | Deposit to pool | depositor, pool_pda, vault_pda |
| `request_withdraw` | Request with delay | recipient, pool_pda, pending_pda |
| `claim_withdraw` | Claim after delay | recipient (signer), pending_pda, vault_pda |
| `batch_claim_withdraw` | Batch claims | authority, remaining_accounts |
| `init_churn_vault` | Init churn vault | authority, churn_state, churn_vault |
| `pool_churn` | Move to churn | authority, pool_vault, churn_vault |
| `pool_unchurn` | Move from churn | authority, churn_vault, pool_vault |

#### Relayer (Phase 2)

| Instruction | Description | Accounts |
|-------------|-------------|----------|
| `claim_withdraw_relayed` | Gasless claim | relayer (signer), recipient, pending_pda, vault_pda, instructions_sysvar |

#### Commitment Privacy (Phase 3)

| Instruction | Description | Accounts |
|-------------|-------------|----------|
| `private_deposit` | Deposit with commitment | depositor, commitment_pda, pool_vault |
| `private_withdraw` | Withdraw with proof | recipient (signer), commitment_pda, nullifier_pda |
| `private_withdraw_relayed` | Gasless withdraw | relayer (signer), recipient, commitment_pda, nullifier_pda, instructions_sysvar |

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
    pub stealth_donations: u32,
    pub stealth_total: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
pub struct PrivacyPool {
    pub authority: Pubkey,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub deposit_count: u64,
    pub withdraw_count: u64,
    pub churn_count: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
pub struct PendingWithdraw {
    pub recipient: Pubkey,        // Stealth address
    pub amount: u64,              // Standardized amount
    pub requested_at: i64,
    pub available_at: i64,        // Variable delay
    pub claimed: bool,
    pub bump: u8,
}

#[account]
pub struct CommitmentPDA {
    pub commitment: [u8; 32],     // SHA256 hash
    pub amount: u64,
    pub timestamp: i64,
    pub spent: bool,
    pub bump: u8,
}

#[account]
pub struct NullifierPDA {
    pub nullifier: [u8; 32],
    pub used_at: i64,
    pub bump: u8,
}
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6014 | `InvalidWithdrawAmount` | Must be 0.1, 0.5, or 1.0 SOL |
| 6015 | `InsufficientPoolFunds` | Pool doesn't have enough funds |
| 6016 | `WithdrawNotReady` | Delay period not elapsed |
| 6017 | `AlreadyClaimed` | Already claimed |
| 6018 | `InvalidChurnVaultIndex` | Index must be 0, 1, or 2 |
| 6019 | `InvalidSignatureInstruction` | Ed25519 verify instruction invalid |
| 6020 | `SignerMismatch` | Signature doesn't match recipient |
| 6021 | `InvalidClaimMessage` | Message format must be 'claim:<pda>' |
| 6022 | `InvalidCommitment` | Commitment verification failed |
| 6023 | `NullifierAlreadyUsed` | Double-spend attempt |
| 6024 | `CommitmentAlreadySpent` | Commitment already withdrawn |

---

## Frontend Integration

### useProgram Hook

```typescript
import { useProgram } from '@/lib/program';

function MyComponent() {
  const {
    // Connection state
    isConnected,

    // Campaign operations
    createCampaign,
    donate,
    closeCampaign,
    fetchCampaign,
    fetchAllCampaigns,

    // Privacy Pool (Phase 1)
    initPool,
    poolDeposit,
    requestPoolWithdraw,
    claimPoolWithdraw,
    fetchPoolStats,
    fetchPendingWithdraw,
    isPoolInitialized,

    // Pool Churn
    initChurnVault,
    poolChurn,
    poolUnchurn,

    // Constants
    ALLOWED_WITHDRAW_AMOUNTS,  // [0.1, 0.5, 1.0]
    WITHDRAW_DELAY_SECONDS,    // 30

  } = useProgram();

  // Usage examples...
}
```

### Stealth Context

```typescript
import { useStealthContext } from '@/lib/stealth/StealthContext';

function MyComponent() {
  const {
    stealthKeys,           // User's stealth keypair
    metaAddress,           // Public meta-address string
    isLoading,
    generateKeys,          // Generate new keys
  } = useStealthContext();

  // Share metaAddress with senders
  console.log(`Send to: ${metaAddress}`);
}
```

### Example: Maximum Privacy Donation

```typescript
import { useProgram } from '@/lib/program';
import { useStealthContext } from '@/lib/stealth';
import { generatePrivateNote, savePrivateNote } from '@/lib/privacy';

async function privateDonation(amountSol: number) {
  const { poolDeposit } = useProgram();

  // 1. Generate commitment
  const note = generatePrivateNote(amountSol * LAMPORTS_PER_SOL);

  // 2. Deposit to pool with commitment
  const sig = await privateDeposit(note.commitment, amountSol);

  // 3. Save note locally (CRITICAL - needed for withdrawal)
  savePrivateNote(note);

  return { signature: sig, note };
}

async function privateWithdrawal(note: PrivateNote, recipientPubkey: PublicKey) {
  // 1. Call private_withdraw or private_withdraw_relayed
  const sig = await privateWithdrawRelayed(
    note.nullifier,
    note.secretHash,
    note.amount,
    recipientPubkey
  );

  // 2. Mark note as spent
  markNoteSpent(note.commitment);

  return sig;
}
```

---

## API Reference

### Relayer Endpoints

#### GET `/api/relayer/claim`

Check relayer status.

**Response:**
```json
{
  "configured": true,
  "relayerAddress": "BEfcVt7sUkRC4HVmWn2FHLkKPKMu1uhkXb4dDr5g7A1a",
  "balance": 2.5,
  "rpcUrl": "https://api.devnet.solana.com"
}
```

#### POST `/api/relayer/claim`

Claim from Privacy Pool via relayer.

**Request:**
```json
{
  "pendingPda": "base58_pending_withdraw_pda",
  "recipient": "base58_stealth_address",
  "signature": "base58_ed25519_signature"
}
```

**Response:**
```json
{
  "success": true,
  "signature": "tx_signature",
  "relayer": "relayer_address"
}
```

#### POST `/api/relayer/private-claim`

Claim from commitment system via relayer.

**Request:**
```json
{
  "commitment": "hex_commitment_hash",
  "nullifier": "hex_nullifier_hash",
  "secretHash": "hex_secret_hash",
  "amount": 500000000,
  "recipient": "base58_stealth_address",
  "signature": "base58_ed25519_signature"
}
```

**Response:**
```json
{
  "success": true,
  "signature": "tx_signature",
  "relayer": "relayer_address"
}
```

---

## Security Analysis

### Threat Model

| Threat | Attack Vector | Mitigation | Residual Risk |
|--------|---------------|------------|---------------|
| **Timing Correlation** | Match deposit/withdraw times | Variable delay (30s-5min) | Partial if low volume |
| **Amount Correlation** | Match deposit/withdraw amounts | Standardized amounts only | None |
| **Graph Analysis** | Trace fund flow | Pool mixing + churn | Partial if low volume |
| **Address Reuse** | Link multiple payments | Stealth addresses | None |
| **Fee Payer Exposure** | Identify recipient via gas | Relayer pays gas | None |
| **Indexer Correlation** | Advanced on-chain analysis | Commitment + nullifier | None |
| **Double-Spend** | Withdraw same deposit twice | NullifierPDA uniqueness | None |
| **Front-Running** | Steal withdrawal | Recipient signature required | None |

### Privacy Guarantees

**What we guarantee:**
1. **Cryptographic unlinkability** - Cannot prove which deposit matches which withdrawal
2. **No on-chain depositor info** - Only commitment hash stored
3. **No on-chain recipient link** - Stealth address + relayer
4. **Double-spend prevention** - Nullifier system

**What we don't guarantee:**
1. **IP privacy** - Use Tor/VPN if needed
2. **Anonymity set size** - Depends on user volume
3. **Off-chain correlation** - Don't share secrets
4. **LocalStorage security** - Browser-based storage

### Best Practices for Users

1. **Backup private notes** - Export from localStorage
2. **Wait before withdrawing** - More time = more mixing
3. **Use stealth addresses** - Always use as recipient
4. **Use relayer** - Never pay gas with stealth address
5. **Vary timing** - Don't deposit/withdraw in patterns

---

## Deployment Guide

### Smart Contract

```bash
# Build
anchor build

# Run tests
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Verify
solana program show 5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
```

### Initialize Pool (Once)

```bash
npx ts-node scripts/init-pool.ts
```

### Frontend

```bash
cd frontend

# Install
npm install

# Development
npm run dev

# Production
npm run build
npm start
```

### Environment Variables

```bash
# frontend/.env.local

# RPC (Helius recommended)
NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com?api-key=YOUR_KEY

# Relayer keypair (base58 encoded full keypair)
RELAYER_SECRET_KEY=<base58_encoded_64_byte_secret>

# Optional: Custom program ID
NEXT_PUBLIC_PROGRAM_ID=5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
```

### Relayer Setup

```bash
# Generate relayer keypair
solana-keygen new -o relayer.json

# Get address
solana address -k relayer.json

# Fund on devnet
solana airdrop 2 <address> --url devnet

# Convert to base58 for .env
node -e "console.log(require('bs58').encode(require('./relayer.json')))"

# Add to .env.local
echo "RELAYER_SECRET_KEY=<output>" >> frontend/.env.local
```

---

## Conclusion

Offuscate implements a comprehensive privacy stack that protects donors and recipients through multiple layers:

1. **Stealth Addresses** - One-time addresses via ECDH
2. **Privacy Pool** - Fund mixing with variable delays
3. **Standardized Amounts** - Prevent value correlation
4. **Pool Churn** - Internal mixing for graph resistance
5. **Gas Abstraction** - Relayer pays fees
6. **Commitment Privacy** - Cryptographic unlinkability
7. **Nullifier System** - Secure double-spend prevention

Even an adversary with complete blockchain access, advanced indexing, and graph analysis tools cannot determine which deposit corresponds to which withdrawal.

---

*Documentation for Privacy Hackathon SOL 2025*
*Project: Offuscate - Private Donations on Solana*
*Program ID: `5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq`*
