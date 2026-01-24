# Offuscate - Sistema de Privacidade para Doações

## Visão Geral

O **Offuscate** é uma plataforma de doações privadas construída na Solana que quebra a linkabilidade entre doadores e destinatários através de múltiplas camadas de privacidade.

### Program ID (Devnet)
```
5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
```

### Relayer (Devnet)
```
BEfcVt7sUkRC4HVmWn2FHLkKPKMu1uhkXb4dDr5g7A1a
```

---

## Arquitetura de Privacidade

```
┌─────────────────────────────────────────────────────────────────┐
│                    OFFUSCATE PRIVACY STACK                       │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 3: ZK-Like Privacy (Commitment + Nullifier)              │
│  ├── Commitment oculta depositor                                │
│  ├── Nullifier previne double-spend                             │
│  └── Quebra linkabilidade mesmo com indexador avançado          │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 2: Gas Abstraction (Relayer)                             │
│  ├── Stealth address NÃO paga gas                               │
│  ├── Relayer submete tx e paga fees                             │
│  └── Ed25519 signature verification on-chain                    │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 1: Privacy Pool                                          │
│  ├── Variable delay (30s - 5min)                                │
│  ├── Standardized amounts (0.1, 0.5, 1 SOL)                     │
│  ├── Batch withdrawals                                          │
│  └── Pool churn (internal mixing)                               │
├─────────────────────────────────────────────────────────────────┤
│  BASE: Stealth Addresses                                        │
│  ├── One-time addresses para cada doação                        │
│  ├── Derivação ECDH (curva ed25519)                             │
│  └── Meta-address público, spending key privado                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Privacy Pool

### Conceito

O Privacy Pool funciona como um "mixer" que quebra o link direto entre depósitos e saques:

```
Depositor A ──┐
Depositor B ──┼──→ [PRIVACY POOL] ──┬──→ Recipient X
Depositor C ──┘     (mixing pot)   ├──→ Recipient Y
                                   └──→ Recipient Z
```

### Features Anti-Correlação

#### 1. Variable Delay (30s - 5min)
```rust
// Delay pseudo-aleatório baseado em slot + recipient
let entropy = clock.slot
    .wrapping_add(recipient_bytes[0] as u64)
    .wrapping_add(recipient_bytes[31] as u64)
    .wrapping_mul(0x5851F42D4C957F2D);

let delay_range = (MAX_DELAY_SECONDS - MIN_DELAY_SECONDS) as u64;
let variable_delay = MIN_DELAY_SECONDS + ((entropy % delay_range) as i64);
```

**Por quê?** Timing attacks correlacionam depósitos e saques pelo tempo.

#### 2. Standardized Amounts
```rust
pub const ALLOWED_AMOUNTS: [u64; 3] = [
    100_000_000,   // 0.1 SOL
    500_000_000,   // 0.5 SOL
    1_000_000_000, // 1.0 SOL
];
```

**Por quê?** Amount correlation é a técnica mais usada por chain analysts.

#### 3. Batch Withdrawals
```rust
pub fn batch_claim_withdraw(ctx: Context<BatchClaimWithdraw>) -> Result<()>
```

**Por quê?** Quebra o padrão "1 withdraw = 1 tx".

#### 4. Pool Churn
```rust
pub fn pool_churn(ctx: Context<PoolChurn>, amount: u64) -> Result<()>
pub fn pool_unchurn(ctx: Context<PoolUnchurn>, amount: u64) -> Result<()>
```

**Por quê?** Cria transações internas que confundem graph analysis.

### Instructions

| Instruction | Descrição |
|-------------|-----------|
| `init_privacy_pool` | Inicializa o pool (uma vez) |
| `pool_deposit` | Deposita SOL no pool |
| `request_withdraw` | Solicita saque com delay |
| `claim_withdraw` | Resgata após delay |
| `batch_claim_withdraw` | Resgata múltiplos de uma vez |
| `init_churn_vault` | Inicializa vault de churn |
| `pool_churn` | Move fundos para churn vault |
| `pool_unchurn` | Retorna fundos do churn vault |

### PDAs

```
Pool PDA:        seeds = ["privacy_pool"]
Pool Vault:      seeds = ["pool_vault"]
Pending:         seeds = ["pending", recipient_pubkey]
Churn State:     seeds = ["churn_state", vault_index]
Churn Vault:     seeds = ["churn_vault", vault_index]
```

---

## Phase 2: Gas Abstraction (Relayer)

### Problema

Mesmo com stealth addresses, o fee payer aparece na transação:
```
Transaction:
  Fee Payer: StealthAddress123...  ← EXPOSTO!
  Instruction: claim_withdraw
```

### Solução: Relayer

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│   Stealth    │     │    Relayer    │     │   Solana     │
│   Keypair    │     │    Server     │     │   Network    │
└──────┬───────┘     └───────┬───────┘     └──────┬───────┘
       │                     │                    │
       │ 1. Sign message     │                    │
       │    "claim:{pda}"    │                    │
       │────────────────────>│                    │
       │                     │                    │
       │                     │ 2. Build tx with   │
       │                     │    ed25519 verify  │
       │                     │    + claim ix      │
       │                     │───────────────────>│
       │                     │                    │
       │                     │ 3. Relayer pays    │
       │                     │    gas fees        │
       │                     │<───────────────────│
       │                     │                    │
       │ 4. Funds arrive at  │                    │
       │    stealth address  │                    │
       │<────────────────────│                    │
```

### Verificação On-Chain

```rust
pub fn claim_withdraw_relayed(ctx: Context<ClaimWithdrawRelayed>) -> Result<()> {
    // Verify ed25519 signature exists in the transaction
    let ix_sysvar = &ctx.accounts.instructions_sysvar;
    let ed25519_ix = load_instruction_at_checked(0, ix_sysvar)?;

    require!(
        ed25519_ix.program_id == ed25519_program::ID,
        ErrorCode::InvalidSignatureInstruction
    );

    // ... transfer funds
}
```

### API Endpoint

**POST** `/api/relayer/claim`

```typescript
interface ClaimRequest {
  pendingPda: string;      // PDA do pending withdraw
  recipient: string;       // Stealth address public key
  signature: string;       // Base58 ed25519 signature
}
```

### Configuração

```bash
# .env.local
RELAYER_SECRET_KEY=<base58_encoded_secret_key>
```

---

## Phase 3: Commitment-Based Privacy (ZK-Like)

### Problema

Mesmo com todas as proteções anteriores, um indexador avançado pode:
1. Listar todos os depósitos e saques
2. Correlacionar por timing aproximado
3. Correlacionar por valor (mesmo padronizado)
4. Usar heurísticas de graph analysis

### Solução: Commitment + Nullifier

Inspirado no Tornado Cash, usamos um esquema criptográfico:

```
DEPÓSITO:
┌─────────────────────────────────────────────────────────┐
│  secret = random(32 bytes)                              │
│  nullifier_secret = random(32 bytes)                    │
│                                                         │
│  secret_hash = SHA256(secret)                           │
│  nullifier = SHA256(nullifier_secret)                   │
│                                                         │
│  commitment = SHA256(secret_hash || nullifier || amount)│
│                                                         │
│  On-chain: apenas commitment (32 bytes hash)            │
│  Local: salva secret + nullifier_secret                 │
└─────────────────────────────────────────────────────────┘

SAQUE:
┌─────────────────────────────────────────────────────────┐
│  Fornece: nullifier, secret_hash, amount                │
│                                                         │
│  On-chain verifica:                                     │
│    1. commitment == SHA256(secret_hash||nullifier||amt) │
│    2. nullifier não foi usado antes                     │
│                                                         │
│  Cria NullifierPDA (marca como usado)                   │
│  Transfere para recipient                               │
└─────────────────────────────────────────────────────────┘
```

### Por que isso quebra linkabilidade?

| O que o indexador vê | O que ele NÃO consegue |
|---------------------|------------------------|
| Commitment hash no depósito | Quem depositou |
| Nullifier hash no saque | Qual depósito corresponde |
| Valores padronizados | Link entre deposit/withdraw |
| Stealth address recipient | Identidade do destinatário |

### Fluxo Completo

```
                    DEPÓSITO
                        │
    ┌───────────────────┼───────────────────┐
    │                   ▼                   │
    │   ┌─────────────────────────────┐    │
    │   │  Generate:                   │    │
    │   │  - secret (32 bytes)         │    │
    │   │  - nullifier_secret (32 b)   │    │
    │   └─────────────┬───────────────┘    │
    │                 ▼                     │
    │   ┌─────────────────────────────┐    │
    │   │  Compute:                    │    │
    │   │  - secret_hash = H(secret)   │    │
    │   │  - nullifier = H(null_sec)   │    │
    │   │  - commitment = H(sh||n||a)  │    │
    │   └─────────────┬───────────────┘    │
    │                 ▼                     │
    │   ┌─────────────────────────────┐    │
    │   │  On-Chain:                   │    │
    │   │  - Create CommitmentPDA      │    │
    │   │  - Transfer SOL to pool      │    │
    │   └─────────────┬───────────────┘    │
    │                 ▼                     │
    │   ┌─────────────────────────────┐    │
    │   │  Local Storage:              │    │
    │   │  - Save PrivateNote          │    │
    │   │  - (secret, null_secret,     │    │
    │   │     amount, commitment)      │    │
    │   └─────────────────────────────┘    │
    │                                       │
    └───────────────────────────────────────┘

                    SAQUE
                        │
    ┌───────────────────┼───────────────────┐
    │                   ▼                   │
    │   ┌─────────────────────────────┐    │
    │   │  Load PrivateNote from       │    │
    │   │  localStorage                │    │
    │   └─────────────┬───────────────┘    │
    │                 ▼                     │
    │   ┌─────────────────────────────┐    │
    │   │  On-Chain Verification:      │    │
    │   │  1. Recompute commitment     │    │
    │   │  2. Check matches stored     │    │
    │   │  3. Check nullifier unused   │    │
    │   └─────────────┬───────────────┘    │
    │                 ▼                     │
    │   ┌─────────────────────────────┐    │
    │   │  Execute:                    │    │
    │   │  - Create NullifierPDA       │    │
    │   │  - Mark commitment spent     │    │
    │   │  - Transfer to stealth addr  │    │
    │   └─────────────────────────────┘    │
    │                                       │
    └───────────────────────────────────────┘
```

### Instructions

| Instruction | Descrição |
|-------------|-----------|
| `private_deposit` | Depósito com commitment |
| `private_withdraw` | Saque com nullifier |
| `private_withdraw_relayed` | Saque gasless via relayer |

### PDAs Phase 3

```
CommitmentPDA:   seeds = ["commitment", commitment_bytes]
NullifierPDA:    seeds = ["nullifier", nullifier_bytes]
```

### Estruturas de Dados

```rust
#[account]
pub struct CommitmentPDA {
    pub commitment: [u8; 32],  // Hash do commitment
    pub amount: u64,           // Valor depositado
    pub timestamp: i64,        // Quando depositou
    pub spent: bool,           // Já foi sacado?
    pub bump: u8,
}

#[account]
pub struct NullifierPDA {
    pub nullifier: [u8; 32],   // Hash do nullifier
    pub used_at: i64,          // Quando foi usado
    pub bump: u8,
}
```

### Frontend: Geração de Commitment

```typescript
// /lib/privacy/index.ts

export function generatePrivateNote(amountLamports: number): PrivateNote {
  // Generate random secrets
  const secret = randomBytes(32);
  const nullifierSecret = randomBytes(32);

  // Compute derived values
  const secretHash = sha256(secret);
  const nullifier = sha256(nullifierSecret);

  // Compute commitment = hash(secretHash || nullifier || amount)
  const amountBytes = u64ToBytes(amountLamports);
  const preimage = new Uint8Array(72);
  preimage.set(secretHash, 0);
  preimage.set(nullifier, 32);
  preimage.set(amountBytes, 64);

  const commitment = sha256(preimage);

  return {
    secret,
    nullifierSecret,
    amount: amountLamports,
    commitment,
    secretHash,
    nullifier,
    createdAt: Date.now(),
    spent: false,
  };
}
```

### Frontend: Uso

```typescript
// Depósito privado
const { signature, note } = await privateDeposit(0.5); // 0.5 SOL
// note é salvo automaticamente em localStorage

// Listar notes disponíveis
const notes = await getUnspentPrivateNotes();

// Saque privado
const sig = await privateWithdraw(notes[0], stealthKeypair.publicKey);

// Saque privado via relayer (gasless)
const result = await privateWithdrawRelayed(notes[0], stealthKeypair);
```

---

## Stealth Addresses

### Meta-Address

O recipient publica um "meta-address" que permite que qualquer pessoa gere endereços únicos para ele:

```
st:<view_public_key>:<spend_public_key>
```

### Geração de Stealth Address

```typescript
// Donor side
function generateStealthAddress(metaAddress: string) {
  const { viewPub, spendPub } = parseMetaAddress(metaAddress);

  // Generate ephemeral keypair
  const ephemeral = Keypair.generate();

  // ECDH: shared secret
  const sharedSecret = x25519(ephemeral.secretKey, viewPub);

  // Derive stealth public key
  const stealthPub = pointAdd(spendPub, hashToPoint(sharedSecret));

  return {
    stealthAddress: stealthPub,
    ephemeralPubKey: ephemeral.publicKey, // publish this
  };
}
```

### Recuperação pelo Recipient

```typescript
// Recipient side
function deriveStealthSpendingKey(ephemeralPubKey, viewPriv, spendPriv) {
  // ECDH with ephemeral
  const sharedSecret = x25519(viewPriv, ephemeralPubKey);

  // Derive spending key
  const stealthPriv = scalarAdd(spendPriv, hashToScalar(sharedSecret));

  return Keypair.fromSecretKey(stealthPriv);
}
```

---

## Segurança

### Ameaças Mitigadas

| Ameaça | Mitigação |
|--------|-----------|
| Timing correlation | Variable delay (30s-5min) |
| Amount correlation | Standardized amounts |
| Graph analysis | Pool mixing + churn |
| Address reuse | Stealth addresses |
| Fee payer exposure | Relayer gasless |
| Indexer correlation | Commitment + nullifier |
| Double-spend | NullifierPDA uniqueness |

### Limitações Conhecidas

1. **localStorage**: Private notes são armazenados no browser. Se limpar dados, perde acesso.
2. **Anonymity Set**: Quanto mais usuários, maior a privacidade.
3. **Timing Heuristics**: Delays muito curtos ainda podem ser correlacionados.
4. **Standardized Amounts**: Limita flexibilidade (0.1, 0.5, 1 SOL apenas).

### Recomendações

1. **Backup**: Exporte suas private notes regularmente
2. **Aguarde**: Não saque imediatamente após depositar
3. **Stealth**: Sempre use stealth address como recipient
4. **Gasless**: Use relayer para máxima privacidade

---

## API Reference

### Privacy Pool

```typescript
// Inicializar pool
await initPool();

// Depositar (Phase 1 - legacy)
await poolDeposit(1.0); // 1 SOL

// Solicitar saque (Phase 1)
await requestPoolWithdraw(stealthKeypair, 0.5);

// Resgatar (Phase 1)
await claimPoolWithdraw(stealthKeypair);

// Resgatar gasless (Phase 2)
await claimPoolWithdrawGasless(stealthKeypair);
```

### Phase 3 Privacy

```typescript
// Depósito privado
const { signature, note } = await privateDeposit(0.5);

// Listar notes
const notes = await getUnspentPrivateNotes();

// Saque privado
await privateWithdraw(note, recipientPubkey);

// Saque privado gasless
await privateWithdrawRelayed(note, recipientKeypair);
```

### Relayer API

```typescript
// Check status
GET /api/relayer/claim

// Claim (Phase 2)
POST /api/relayer/claim
{
  pendingPda: string,
  recipient: string,
  signature: string
}

// Private claim (Phase 3)
POST /api/relayer/private-claim
{
  commitment: string,
  nullifier: string,
  secretHash: string,
  amount: number,
  recipient: string,
  signature: string
}
```

---

## Deployment

### Smart Contract

```bash
# Build
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Program ID
5rCqTBfEUrTdZFcNCjMHGJjkYzGHGxBZXUhekoTjc1iq
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Development
npm run dev

# Production build
npm run build
npm start
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com?api-key=<key>
RELAYER_SECRET_KEY=<base58_encoded_keypair>
```

---

## Conclusão

O Offuscate implementa um sistema de privacidade em camadas que protege doadores e destinatários através de:

1. **Pool Mixing** - Fundos de múltiplos usuários misturados
2. **Temporal Obfuscation** - Delays variáveis quebram timing
3. **Amount Standardization** - Valores fixos impedem correlação
4. **Stealth Addresses** - Endereços únicos por transação
5. **Gas Abstraction** - Fee payer não expõe recipient
6. **Commitment Privacy** - Hash criptográfico oculta depositor
7. **Nullifier System** - Previne double-spend sem revelar link

Mesmo um adversário com acesso completo à blockchain e indexadores avançados não consegue determinar qual depósito corresponde a qual saque.
