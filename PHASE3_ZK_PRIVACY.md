# Phase 3: Commitment-Based Privacy (ZK-Like)

## Overview

Phase 3 implements a Tornado Cash-style commitment + nullifier scheme that breaks linkability between deposits and withdrawals, even with advanced blockchain indexers.

## How It Works

### Deposit Flow

1. **Generate Secrets** (client-side):
   - `secret` = 32 bytes random
   - `nullifier_secret` = 32 bytes random

2. **Compute Hashes**:
   - `secret_hash` = SHA256(secret)
   - `nullifier` = SHA256(nullifier_secret)

3. **Compute Commitment**:
   - `commitment` = SHA256(secret_hash || nullifier || amount_bytes)

4. **On-Chain Deposit**:
   - Creates `CommitmentPDA` with commitment hash
   - Transfers SOL to pool vault
   - **NO link to depositor stored on-chain**

5. **Save Secrets Locally**:
   - Private note stored in browser localStorage
   - Only the depositor can withdraw later

### Withdrawal Flow

1. **Load Private Note** (from localStorage)

2. **Provide Proofs**:
   - `nullifier` = SHA256(nullifier_secret)
   - `secret_hash` = SHA256(secret)
   - `amount`

3. **On-Chain Verification**:
   - Reconstructs commitment from provided values
   - Verifies it matches stored CommitmentPDA
   - Checks nullifier hasn't been used

4. **Execute Withdrawal**:
   - Creates `NullifierPDA` (prevents double-spend)
   - Marks CommitmentPDA as spent
   - Transfers to recipient (stealth address)

## Privacy Guarantees

### What Blockchain Analysts See

**On Deposit:**
- A deposit transaction occurred
- A commitment hash (reveals nothing)
- The amount (standardized: 0.1, 0.5, or 1 SOL)

**On Withdrawal:**
- A withdrawal transaction occurred
- A nullifier hash (reveals nothing)
- The recipient address (stealth address)
- The amount

### What They CANNOT Determine

- Which deposit corresponds to which withdrawal
- Who made the original deposit
- Any link between depositor and recipient

## PDAs Created

### CommitmentPDA
- Seeds: `["commitment", commitment_bytes]`
- Stores: commitment hash, amount, timestamp, spent flag

### NullifierPDA
- Seeds: `["nullifier", nullifier_bytes]`
- Stores: nullifier hash, used_at timestamp
- Existence proves nullifier was used

## Security Properties

1. **Hiding**: Commitment hides all deposit details
2. **Binding**: Cannot change commitment after deposit
3. **Non-Replayability**: Nullifier prevents double-spend
4. **Unlinkability**: No correlation between deposit/withdrawal

## Usage in Frontend

### Making a Private Deposit

```typescript
const { signature, note } = await privateDeposit(0.5); // 0.5 SOL
// note is automatically saved to localStorage
```

### Making a Private Withdrawal

```typescript
const notes = await getUnspentPrivateNotes();
const sig = await privateWithdraw(notes[0], stealthKeypair.publicKey);
```

### With Relayer (Gasless)

```typescript
const result = await privateWithdrawRelayed(note, stealthKeypair);
// Relayer pays gas, stealth address receives funds
```

## Program Instructions

### `private_deposit`
- **Inputs**: commitment [u8; 32], amount u64
- **Creates**: CommitmentPDA
- **Transfers**: SOL to pool vault

### `private_withdraw`
- **Inputs**: nullifier [u8; 32], secret_hash [u8; 32], amount u64
- **Verifies**: Commitment matches, nullifier unused
- **Creates**: NullifierPDA
- **Transfers**: SOL to recipient

### `private_withdraw_relayed`
- Same as above but relayer pays gas
- Requires ed25519 signature verification

## Deployed on Devnet

- **Program ID**: `5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq`
- **Relayer**: `BEfcVt7sUkRC4HVmWn2FHLkKPKMu1uhkXb4dDr5g7A1a`

## Comparison with Previous Phases

| Feature | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|
| Time Delay | ✅ Variable 30s-5min | ✅ | ✅ |
| Standardized Amounts | ✅ | ✅ | ✅ |
| Pool Churn | ✅ | ✅ | ✅ |
| Batch Withdrawals | ✅ | ✅ | ✅ |
| Gasless Claims | ❌ | ✅ Relayer | ✅ Relayer |
| Commitment Hiding | ❌ | ❌ | ✅ SHA256 |
| Nullifier Prevention | ❌ | ❌ | ✅ PDA-based |
| Indexer Resistance | Partial | Partial | **Strong** |

## Important Notes

1. **Save Your Secrets**: Private notes are stored in localStorage. If you clear browser data, you lose access to your funds.

2. **Backup Recommended**: Export your private notes for backup.

3. **Standardized Amounts**: Only 0.1, 0.5, or 1.0 SOL to prevent amount correlation.

4. **Stealth Address**: Always use a stealth address as recipient for maximum privacy.
