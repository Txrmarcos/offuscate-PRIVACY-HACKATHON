# Offuscate - Architecture Diagrams

This document explains each architectural diagram and how the privacy technologies work together.

---

## Table of Contents

1. [Diagram 1: Derive Stealth Wallet](#diagram-1-derive-stealth-wallet)
2. [Diagram 2: Payroll Flow (Streaming)](#diagram-2-payroll-flow-streaming)
3. [Diagram 3: Transfer Between Users](#diagram-3-transfer-between-users)
4. [Privacy Stack Summary](#privacy-stack-summary)

---

## Diagram 1: Derive Stealth Wallet

![Derive Stealth Wallet](./diagrams/derive-stealth.png)

### What This Diagram Shows

This diagram illustrates how **companies and employees derive stealth wallets** that are cryptographically separated from their main wallets.

### Flow Explanation

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

### Step-by-Step Process

| Step | Action | Technology | Purpose |
|------|--------|------------|---------|
| 1 | User connects wallet | Solana Wallet Adapter | Authenticate user |
| 2 | Sign derivation message | `wallet.signMessage()` | Create deterministic seed |
| 3 | Hash signature | SHA256 | Generate keypair seed |
| 4 | Derive Offuscate Wallet | Ed25519 | Wallet not linked on-chain |
| 5 | Generate View keypair | ECDH (Noble Curves) | For scanning payments |
| 6 | Generate Spend keypair | ECDH (Noble Curves) | For claiming payments |
| 7 | Create Meta Address | String concat | `st:<viewPub>:<spendPub>` |

### Why This Matters

| Without Derived Wallet | With Derived Wallet |
|------------------------|---------------------|
| Main wallet visible on-chain | Offuscate wallet has no link to main |
| All activity traceable to you | Fresh identity for privacy operations |
| Lost keys = lost forever | Recoverable via same signature |
| Single point of failure | Separate wallet for sensitive ops |

### Technologies Used

| Technology | Role |
|------------|------|
| **Wallet Signature** | Creates deterministic, recoverable seed |
| **SHA256** | Hashes signature into keypair seed |
| **Ed25519** | Derives Offuscate wallet keypair |
| **ECDH (Noble Curves)** | Generates view/spend stealth keypairs |

### Use Cases

1. **Employer Payroll Wallet** - Company derives a separate wallet for all payroll operations. Competitors can't link payroll to company's main treasury.

2. **Employee Salary Wallet** - Employee receives salary to derived wallet. Main wallet stays clean and private.

3. **Recovery** - If browser storage is cleared, user signs the same message again → same keypair is derived → access restored.

---

## Diagram 2: Payroll Flow (Streaming)

![Payroll Flow](./diagrams/payroll-flow.png)

### What This Diagram Shows

This diagram illustrates how **salary streams from companies to employees** through batch payments and a shared pool.

### Flow Explanation

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

### Step-by-Step Process

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

### Streaming Calculation

```
Salary Rate: 1000 SOL/month
Per Second:  1000 / (30 * 24 * 60 * 60) = 0.000385 SOL/sec = 385 lamports/sec

After 1 hour:  385 * 3600 = 1,386,000 lamports = 0.00139 SOL
After 1 day:   385 * 86400 = 33,264,000 lamports = 0.033 SOL
After 1 week:  385 * 604800 = 232,848,000 lamports = 0.233 SOL
```

### Why Streaming Matters

| Monthly Lump Sum | Per-Second Streaming |
|------------------|----------------------|
| One big visible payment | Continuous micro-payments |
| Easy to identify salary | Harder to analyze |
| Must wait until payday | Claim anytime |
| Cash flow issues | Real-time liquidity |

### Pool Privacy Enhancement

The **Pool** in the diagram acts as a mixer:

1. Multiple companies deposit to their batches
2. All streaming flows through shared infrastructure
3. Employees claim from a common pool
4. Harder to trace which company paid which employee

### Technologies Used

| Technology | Role |
|------------|------|
| **Anchor Program** | On-chain batch/employee management |
| **PDAs** | Deterministic addresses for batches, invites, employees |
| **Clock Sysvar** | Timestamp for streaming calculation |
| **Stealth Addresses** | Final destination is unlinkable |

### Use Cases

1. **DAO Contributor Payments** - DAO creates batch for contributors. Each person claims when they need funds.

2. **Remote Team Payroll** - Startup pays global team. Each timezone claims at their convenience.

3. **Freelancer Retainer** - Ongoing project with streaming payment. Freelancer claims daily/weekly as needed.

---

## Diagram 3: Transfer Between Users

![Transfer Between Users](./diagrams/transfer-users.png)

### What This Diagram Shows

This diagram illustrates **private transfers between any users** using the full privacy stack: ZK Compression + Stealth Addresses + Relayer.

### Flow Explanation

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

### Step-by-Step Process

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

### Privacy Stack Breakdown

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

### Why Full Stack Matters

| Single Technology | Full Stack (ZK + Stealth + Relayer) |
|-------------------|-------------------------------------|
| Partial privacy | **Complete** privacy |
| Some metadata exposed | All metadata hidden |
| Can be correlated | Correlation impossible |
| Amateur protection | Enterprise-grade privacy |

### Technologies Used

| Technology | Layer | What It Hides |
|------------|-------|---------------|
| **Light Protocol** | ZK Compression | Sender address, Transaction amount |
| **ECDH (Noble Curves)** | Stealth Addresses | Recipient address |
| **Custom Relayer** | Gasless | Fee payer address |
| **Helius RPC** | Infrastructure | Fast, reliable execution |

### Use Cases

1. **Private Bonus Payment** - Company sends bonus to employee. No one knows who received how much.

2. **Inter-Company Transfer** - Business pays vendor. Competitors can't see supplier relationships.

3. **Anonymous Donation** - Donate to cause without public association.

4. **Salary Redistribution** - Employee sends part of salary to family. No trail back to employer.

---

## Privacy Stack Summary

### Complete Privacy Matrix

| What's Hidden | Technology | How It Works |
|---------------|------------|--------------|
| **Sender** | ZK Compression | Zero-knowledge proof validates without revealing source |
| **Amount** | ZK Compression | Value encrypted in proof, verified mathematically |
| **Recipient** | Stealth Addresses | One-time address derived via ECDH, only recipient can spend |
| **Fee Payer** | Relayer | Server wallet pays gas, shared identity across all users |
| **Wallet Link** | Derived Wallets | Signature-based derivation, no on-chain connection |
| **Payment Pattern** | Streaming | Micro-payments instead of identifiable lump sums |

### When to Use Each Layer

| Scenario | Recommended Stack |
|----------|-------------------|
| Basic payment privacy | Stealth Address only |
| Hide payment amounts | ZK Compression |
| Hide who receives | Stealth Address |
| Maximum single-payment privacy | ZK + Stealth |
| Enterprise/paranoid privacy | ZK + Stealth + Relayer |
| Continuous payments | Streaming + Stealth |

### Architecture Overview

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
│                              │    Relayer      │                              │
│                              │   (Gasless)     │                              │
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

## Quick Reference

### Diagram Files

| File | Description |
|------|-------------|
| `derive-stealth.png` | Wallet derivation and stealth key generation |
| `payroll-flow.png` | Streaming salary from companies to employees |
| `transfer-users.png` | Private transfers with full privacy stack |

### Related Documentation

- [README.md](../README.md) - Project overview
- [HELIUS_INTEGRATION.md](../HELIUS_INTEGRATION.md) - Helius API usage
- [PRIVACY_SYSTEM_DOCS.md](../PRIVACY_SYSTEM_DOCS.md) - Privacy implementation details

---

<div align="center">

**Privacy is not about hiding. It's about control.**

</div>
