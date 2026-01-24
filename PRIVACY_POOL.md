# Privacy Pool - Technical Documentation

## Overview

The **Privacy Pool** is an on-chain solution to break the linkability between donors and campaigns on Solana. Unlike direct transfers where an observer can easily trace `wallet A -> wallet B`, the Privacy Pool mixes funds from multiple users, making it impossible to prove who paid whom.

```
WITHOUT POOL (traceable):
  wallet_donor ---> stealth_address ---> claim
       |                                    |
       +-------- VISIBLE LINK --------------+

WITH POOL (private):
  wallet_donor ---> [POOL] ---> (delay) ---> stealth_address ---> claim
       |              |                            |
       |     mixed funds                           |
       +-------- LINK BROKEN ---------------------+
```

---

## Deployed Addresses (Devnet)

| Component | Address |
|-----------|---------|
| Program ID | `5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq` |
| Privacy Pool PDA | `seeds = [b"privacy_pool"]` |
| Pool Vault PDA | `seeds = [b"pool_vault"]` |
| Churn Vault 0 | `seeds = [b"churn_vault", 0u8.to_le_bytes()]` |
| Churn Vault 1 | `seeds = [b"churn_vault", 1u8.to_le_bytes()]` |
| Churn Vault 2 | `seeds = [b"churn_vault", 2u8.to_le_bytes()]` |

---

## Features Implemented

### 1. Core Privacy Pool
- **Aggregate-only tracking**: No individual deposit records
- **Standardized amounts**: 0.1, 0.5, 1.0 SOL only
- **Stealth address recipients**: Unlinkable withdrawal destinations

### 2. Variable Delay (30s - 5min)
Instead of a fixed 30-second delay, the pool uses variable delays based on slot + recipient entropy:

```rust
pub const MIN_DELAY_SLOTS: u64 = 75;   // ~30 seconds
pub const MAX_DELAY_SLOTS: u64 = 750;  // ~5 minutes

fn calculate_delay(current_slot: u64, recipient: &Pubkey) -> u64 {
    let entropy = recipient.to_bytes()[0] as u64;
    let range = MAX_DELAY_SLOTS - MIN_DELAY_SLOTS;
    let variable = (current_slot + entropy) % range;
    MIN_DELAY_SLOTS + variable
}
```

### 3. Batch Withdrawals
Process multiple pending withdrawals in a single transaction to break the "1 withdraw = 1 tx" pattern:

```rust
pub fn batch_claim_withdraw<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, BatchClaimWithdraw<'info>>,
) -> Result<()>
```

- Uses `remaining_accounts` for multiple recipients
- Direct lamport manipulation (no CPI) for efficiency
- Up to 5 claims per transaction

### 4. Pool Churn (Internal Mixing)
Micro-movements between vaults to break graph analysis:

```
Main Pool <---> Churn Vault 0
           <---> Churn Vault 1
           <---> Churn Vault 2
```

Instructions:
- `init_churn_vault(vault_index: u8)` - Initialize churn vault (0, 1, or 2)
- `pool_churn(amount: u64)` - Move funds from main pool to churn vault
- `pool_unchurn(amount: u64)` - Move funds back to main pool

### 5. Relayer / Gasless Claims (Phase 2)

**Problem solved**: Until Phase 2, the stealth address had to pay gas to claim, creating a link:
```
stealth_address -> fee payer (TRACEABLE!)
```

**Solution**: A relayer submits the transaction and pays fees. The stealth address only signs a message off-chain.

```
WITHOUT RELAYER:
  stealth_address (signer) --> claim tx --> funds
       |                           |
       +------- FEE PAYER ---------+  (LINKED!)

WITH RELAYER:
  stealth_address (off-chain sign) --> relayer (signer) --> claim tx --> funds
       |                                    |                      |
       |                              FEE PAYER                    |
       +--------------- NO ON-CHAIN LINK --------------------------+
```

**How it works**:
1. Recipient signs message `claim:{pendingPda}` with stealth keypair (off-chain)
2. Relayer creates ed25519 verify instruction + `claim_withdraw_relayed` instruction
3. Relayer submits tx and pays gas
4. Program verifies signature on-chain via instructions sysvar
5. Funds go to stealth address

**New instruction**:
```rust
pub fn claim_withdraw_relayed(ctx: Context<ClaimWithdrawRelayed>) -> Result<()>
```

**Accounts**:
- `relayer`: Signer (pays gas)
- `recipient`: AccountInfo (NOT a signer - proves ownership via ed25519)
- `instructions_sysvar`: For ed25519 verification

---

## Architecture

### On-Chain Components (Anchor)

```
programs/offuscate/src/lib.rs
```

#### Accounts

| Account | Description |
|---------|-------------|
| `PrivacyPool` | Global pool storing aggregated funds. Does NOT store individual deposit info. |
| `PendingWithdraw` | Pending withdrawal with delay timer. Stores only recipient (stealth address). |
| `ChurnVaultState` | State for each churn vault (index, bump, balance tracking). |

#### Instructions

| Instruction | Description | Privacy |
|-------------|-------------|---------|
| `init_privacy_pool` | Initialize pool (once) | - |
| `pool_deposit` | Deposit SOL to pool | Does NOT record sender, receiver, campaign |
| `request_withdraw` | Request withdrawal with delay | Only recipient and amount recorded |
| `claim_withdraw` | Claim after delay | Requires recipient signature |
| `claim_withdraw_relayed` | Claim via relayer (gasless) | Recipient doesn't pay gas or sign tx |
| `batch_claim_withdraw` | Claim multiple withdrawals | Breaks 1:1 tx pattern |
| `init_churn_vault` | Initialize churn vault | - |
| `pool_churn` | Move to churn vault | Internal mixing |
| `pool_unchurn` | Move back from churn | Internal mixing |

### Frontend Components

```
frontend/app/lib/program/client.ts      - Pool functions
frontend/app/lib/program/useProgram.ts  - React hooks
frontend/app/components/PrivacyPoolPanel.tsx - Pool UI
frontend/app/components/DonationModal.tsx - Donation via pool
```

---

## Privacy Mechanisms

### 1. No Deposit Tracking

```rust
pub fn pool_deposit(ctx: Context<PoolDeposit>, amount: u64) -> Result<()> {
    // Transfer SOL from depositor to pool vault
    system_program::transfer(...)?;

    // ONLY aggregate stats - no individual records
    let pool = &mut ctx.accounts.pool;
    pool.total_deposited += amount;
    pool.deposit_count += 1;

    // NOT recorded: sender, receiver, campaign, individual timestamp
    Ok(())
}
```

### 2. Variable Delay

```rust
// Delay varies from 30s to 5min based on slot + recipient entropy
let delay_slots = calculate_delay(current_slot, &recipient.key());
pending.available_at_slot = current_slot + delay_slots;
```

**Why variable delay matters:**
- Prevents temporal correlation (deposit now -> withdraw now)
- Different users have different delays
- Observer cannot predict exact withdrawal timing

### 3. Standardized Amounts

```rust
pub const ALLOWED_AMOUNTS: [u64; 3] = [
    100_000_000,   // 0.1 SOL
    500_000_000,   // 0.5 SOL
    1_000_000_000, // 1.0 SOL
];
```

**Why standardized amounts matter:**
- Prevents amount correlation (deposit 0.1337 -> withdraw 0.1337)
- All withdrawals are "common" values
- Larger anonymity set

### 4. Pool Churn

```rust
pub fn pool_churn(ctx: Context<PoolChurn>, amount: u64) -> Result<()> {
    // Move funds from main pool to churn vault
    // Creates internal "noise" transactions
}
```

**Why churn matters:**
- Breaks graph analysis heuristics
- Creates decoy internal movements
- Path: Main -> Churn A -> Main -> Churn B -> Main -> Withdraw

---

## Data Structures

### PrivacyPool

```rust
#[account]
pub struct PrivacyPool {
    pub authority: Pubkey,      // Pool authority
    pub total_deposited: u64,   // Total deposited (historical)
    pub total_withdrawn: u64,   // Total withdrawn (historical)
    pub deposit_count: u64,     // Number of deposits
    pub withdraw_count: u64,    // Number of withdrawals
    pub bump: u8,               // PDA bump
    pub vault_bump: u8,         // Vault PDA bump
}
```

### PendingWithdraw

```rust
#[account]
pub struct PendingWithdraw {
    pub recipient: Pubkey,         // Stealth address to receive
    pub amount: u64,               // Standardized amount
    pub requested_at_slot: u64,    // Slot when requested
    pub available_at_slot: u64,    // Slot when claimable (variable delay)
    pub claimed: bool,             // Already claimed?
    pub bump: u8,                  // PDA bump
}
```

### ChurnVaultState

```rust
#[account]
pub struct ChurnVaultState {
    pub vault_index: u8,        // 0, 1, or 2
    pub bump: u8,               // State PDA bump
    pub vault_bump: u8,         // Vault PDA bump
    pub total_churned: u64,     // Total moved in
    pub total_unchurned: u64,   // Total moved out
}
```

---

## Frontend Integration

### useProgram Hook

```typescript
import { useProgram } from '../lib/program';

function MyComponent() {
  const {
    // Pool operations
    initPool,
    poolDeposit,
    requestPoolWithdraw,
    claimPoolWithdraw,
    batchClaimPoolWithdraw,
    fetchPoolStats,
    fetchPendingWithdraw,

    // Churn operations
    initChurnVault,
    poolChurn,
    poolUnchurn,

    // Constants
    ALLOWED_WITHDRAW_AMOUNTS, // [0.1, 0.5, 1.0]
  } = useProgram();

  // Deposit to pool
  const deposit = async () => {
    const sig = await poolDeposit(0.5); // 0.5 SOL
  };

  // Request withdrawal (with variable delay)
  const requestWithdraw = async (stealthKeypair: Keypair) => {
    const sig = await requestPoolWithdraw(stealthKeypair, 0.5);
  };

  // Claim after delay
  const claim = async (stealthKeypair: Keypair) => {
    const sig = await claimPoolWithdraw(stealthKeypair);
  };

  // Batch claim multiple
  const batchClaim = async (keypairs: Keypair[]) => {
    const sig = await batchClaimPoolWithdraw(keypairs);
  };
}
```

---

## Complete Flow

### 1. Donor Deposits

```typescript
// Frontend: DonationModal.tsx
const handleDonate = async () => {
  if (selectedPrivacy === 'POOL') {
    // Deposits to pool - NO campaign info
    const sig = await poolDeposit(amountSol);
  }
};
```

### 2. Receiver Requests Withdrawal

```typescript
// Frontend: PrivacyPoolPanel.tsx
const handleRequestWithdraw = async () => {
  // Generate or use existing stealth keypair
  const stealthKeypair = deriveStealthSpendingKey(...);

  // Request withdrawal (delay is variable 30s-5min)
  const sig = await requestPoolWithdraw(stealthKeypair, selectedAmount);
};
```

### 3. Claim After Delay

```typescript
const handleClaim = async () => {
  // Only works after variable delay
  const sig = await claimPoolWithdraw(stealthKeypair);
};
```

---

## PDAs (Program Derived Addresses)

```typescript
const PROGRAM_ID = new PublicKey("5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq");

// Main pool
const [poolPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('privacy_pool')],
  PROGRAM_ID
);

// Pool vault (holds funds)
const [poolVaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('pool_vault')],
  PROGRAM_ID
);

// Pending withdrawal (per recipient)
const [pendingPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('pending'), recipientPubkey.toBuffer()],
  PROGRAM_ID
);

// Churn vault state (index 0, 1, or 2)
const indexBuffer = Buffer.alloc(1);
indexBuffer.writeUInt8(vaultIndex);
const [churnStatePda] = PublicKey.findProgramAddressSync(
  [Buffer.from('churn_state'), indexBuffer],
  PROGRAM_ID
);
const [churnVaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('churn_vault'), indexBuffer],
  PROGRAM_ID
);
```

---

## Initialization Script

```bash
# Run once to initialize pool and churn vaults
npx ts-node scripts/init-pool.ts
```

```typescript
// scripts/init-pool.ts
const [poolPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("privacy_pool")],
  PROGRAM_ID
);

// Init Privacy Pool
await program.methods.initPrivacyPool().accounts({
  authority: wallet.publicKey,
  pool: poolPda,
  poolVault: poolVaultPda,
  systemProgram: SystemProgram.programId,
}).rpc();

// Init Churn Vaults 0, 1, 2
for (let i = 0; i < 3; i++) {
  await program.methods.initChurnVault(i).accounts({
    authority: wallet.publicKey,
    pool: poolPda,
    churnState: churnStatePda,
    churnVault: churnVaultPda,
    systemProgram: SystemProgram.programId,
  }).rpc();
}
```

---

## Relayer Setup (Gasless Claims)

### 1. Generate Relayer Keypair

```bash
# Run setup script
npx ts-node scripts/setup-relayer.ts
```

Or manually:
```bash
# Generate keypair
solana-keygen new -o relayer.json

# Get address
solana address -k relayer.json

# Convert to base58 for .env
node -e "console.log(require('bs58').encode(require('./relayer.json')))"

# Fund on devnet
solana airdrop 2 <relayer_address> --url devnet
```

### 2. Configure Environment

Add to `frontend/.env`:
```
RELAYER_SECRET_KEY=<base58_encoded_private_key>
```

### 3. Verify Setup

```bash
# Check relayer status
curl http://localhost:3000/api/relayer/claim
```

Response:
```json
{
  "configured": true,
  "relayerAddress": "...",
  "balance": 2.0,
  "rpcUrl": "https://api.devnet.solana.com"
}
```

### Relayer API

**POST /api/relayer/claim**

Request:
```json
{
  "pendingPda": "base58_pending_withdraw_pda",
  "recipient": "base58_stealth_address",
  "signature": "base58_ed25519_signature"
}
```

Response:
```json
{
  "success": true,
  "signature": "tx_signature",
  "relayer": "relayer_address"
}
```

---

## Security & Limitations

### What the Pool GUARANTEES:

1. **No on-chain link**: No record of sender->receiver
2. **Variable temporal delay**: Prevents timing correlation
3. **Standardized values**: Prevents amount correlation
4. **Mixed funds**: Pool accumulates from multiple users
5. **Internal churn**: Additional mixing via vault movements
6. **Gasless claims**: Stealth address doesn't appear as fee payer

### What the Pool does NOT guarantee (honest limitations):

1. **No ZK proofs**: Not Tornado Cash / Zcash level
2. **Off-chain analysis**: If only 1 person uses it, still traceable
3. **Metadata leakage**: IP, submission timing, etc.
4. **Anonymity set size**: Depends on how many use it

### Future improvements (post-hackathon):

- [ ] ZK proofs integration (Light Protocol)
- [ ] Merkle tree for commitments
- [x] ~~Relayer for gas abstraction~~ **DONE** (Phase 2)
- [ ] Cross-chain privacy bridges

---

## Error Codes

| Code | Name | Message |
|------|------|---------|
| 6014 | `InvalidWithdrawAmount` | Must be 0.1, 0.5, or 1 SOL |
| 6015 | `InsufficientPoolFunds` | Not enough SOL in pool |
| 6016 | `WithdrawNotReady` | Wait for delay period |
| 6017 | `AlreadyClaimed` | Already claimed |
| 6018 | `InvalidChurnVaultIndex` | Vault index must be 0, 1, or 2 |
| 6019 | `InvalidSignatureInstruction` | ed25519 verify instruction invalid |
| 6020 | `SignerMismatch` | Signature doesn't match recipient |
| 6021 | `InvalidClaimMessage` | Message format must be 'claim:<pda>' |

---

## Hackathon Tracks Covered

| Sponsor | Track | How We Cover It |
|---------|-------|-----------------|
| **Solana Foundation** | Privacy | Privacy Pool with mixing, delays, stealth addresses |
| **Helius** | Best Use of Helius | RPC integration, webhook monitoring |
| **Light Protocol** | Privacy Tooling | Foundation for future ZK integration |

---

## Sequence Diagram

```
Donor           Frontend        Anchor Program       Pool Vault
  |                |                  |                   |
  |-- Donate -->   |                  |                   |
  |                |-- poolDeposit -->|                   |
  |                |                  |-- transfer SOL -->|
  |                |                  |                   |
  |                |<-- tx sig -------|                   |
  |<-- success ----|                  |                   |
  |                |                  |                   |

  ... time passes, funds mix, churn happens ...

Receiver        Frontend        Anchor Program       Pool Vault
  |                |                  |                   |
  |-- Request -->  |                  |                   |
  |                |-- requestWithdraw|                   |
  |                |                  |-- create pending->|
  |                |<-- tx sig -------|                   |
  |<-- countdown --|  (30s - 5min)    |                   |
  |                |                  |                   |
  |    ... wait variable delay ...    |                   |
  |                |                  |                   |
  |-- Claim -->    |                  |                   |
  |                |-- claimWithdraw->|                   |
  |                |                  |<-- transfer SOL --|
  |                |<-- tx sig -------|                   |
  |<-- SOL --------|                  |                   |
```

---

## Code References

### Anchor Program

```
programs/offuscate/src/lib.rs:21-180    - Privacy Pool instructions
programs/offuscate/src/lib.rs:180-280   - Churn instructions
programs/offuscate/src/lib.rs:600-720   - Account structs
```

### Frontend

```
frontend/app/lib/program/useProgram.ts:260-400   - Pool hooks
frontend/app/lib/program/useProgram.ts:400-500   - Churn hooks
frontend/app/components/PrivacyPoolPanel.tsx     - Pool UI
frontend/app/components/DonationModal.tsx        - Donation with pool option
```

---

*Documentation for Privacy Hackathon SOL 2025*
*Project: Offuscate - Private Donations on Solana*
