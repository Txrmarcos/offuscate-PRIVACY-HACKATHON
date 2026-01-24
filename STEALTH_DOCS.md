# ShadowDonate - Stealth Addresses Documentation

## Overview

ShadowDonate é uma plataforma de doações privadas na Solana que utiliza **Stealth Addresses** para garantir que doadores permaneçam anônimos e que não haja linkabilidade entre doações e destinatários.

---

## Use Case

### Problema
Doações tradicionais em blockchain são **100% públicas**:
- Qualquer pessoa pode ver quem doou para quem
- Valores são visíveis
- Histórico de doações é rastreável
- Doadores podem ser alvos de phishing/golpes

### Solução
**Stealth Addresses** permitem que cada doação vá para um endereço único e descartável:
- Doador não pode ser linkado à campanha
- Receptor pode identificar e gastar os fundos
- Observador externo não consegue correlacionar transações

### Casos de Uso Reais
1. **Doações políticas** - Apoiar causas sem exposição pública
2. **Crowdfunding sensível** - Causas médicas, legais, whistleblowers
3. **Privacidade financeira** - Direito básico de não expor movimentações
4. **Proteção contra perseguição** - Apoiar causas em regimes autoritários

---

## Arquitetura Técnica

### Stack
```
Frontend: Next.js 16 + React 19 + TypeScript + Tailwind CSS
Wallet:   @solana/wallet-adapter
Crypto:   @noble/curves (ed25519, x25519) + @noble/hashes
Blockchain: Solana Devnet
```

### Fluxo de Stealth Address

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECEIVER (Campaign Owner)                     │
├─────────────────────────────────────────────────────────────────┤
│  1. Conecta wallet                                               │
│  2. Assina mensagem para derivar seed                           │
│  3. Gera viewKey + spendKey (ed25519)                           │
│  4. Publica metaAddress = "st:<viewPubKey>:<spendPubKey>"       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SENDER (Donor)                              │
├─────────────────────────────────────────────────────────────────┤
│  1. Obtém metaAddress do receiver                               │
│  2. Gera ephemeralKeypair (one-time)                            │
│  3. Computa sharedSecret = ECDH(ephemeralPriv, viewPub)         │
│  4. Deriva stealthAddress = hash(sharedSecret || spendPub)      │
│  5. Envia SOL para stealthAddress                               │
│  6. Anexa memo: "stealth:<ephemeralPubKey>"                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RECEIVER (Scanner)                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Escaneia blockchain por memos "stealth:..."                 │
│  2. Para cada memo, extrai ephemeralPubKey                      │
│  3. Computa sharedSecret = ECDH(viewPriv, ephemeralPub)         │
│  4. Deriva expectedAddress = hash(sharedSecret || spendPub)     │
│  5. Se expectedAddress == destinationAddress → É NOSSO!         │
│  6. Deriva spendingKey para gastar os fundos                    │
└─────────────────────────────────────────────────────────────────┘
```

### Criptografia Utilizada

| Componente | Algoritmo | Biblioteca |
|------------|-----------|------------|
| Key Generation | Ed25519 | @noble/curves |
| ECDH | X25519 (Montgomery) | @noble/curves |
| Key Derivation | SHA-256 | @noble/hashes |
| Encoding | Base58 | bs58 |

---

## Código Copiável

### 1. Geração de Stealth Keys

```typescript
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';

// Gerar viewKey e spendKey
export function generateStealthKeys() {
  const viewPrivateKey = ed25519.utils.randomSecretKey();
  const viewPublicKey = ed25519.getPublicKey(viewPrivateKey);

  const spendPrivateKey = ed25519.utils.randomSecretKey();
  const spendPublicKey = ed25519.getPublicKey(spendPrivateKey);

  return {
    viewKey: { privateKey: viewPrivateKey, publicKey: viewPublicKey },
    spendKey: { privateKey: spendPrivateKey, publicKey: spendPublicKey },
  };
}

// Derivar de seed (determinístico)
export function deriveStealthKeysFromSeed(seed: Uint8Array) {
  const viewSeed = sha256(new Uint8Array([...seed, ...new TextEncoder().encode('stealth:view')]));
  const viewPrivateKey = viewSeed.slice(0, 32);
  const viewPublicKey = ed25519.getPublicKey(viewPrivateKey);

  const spendSeed = sha256(new Uint8Array([...seed, ...new TextEncoder().encode('stealth:spend')]));
  const spendPrivateKey = spendSeed.slice(0, 32);
  const spendPublicKey = ed25519.getPublicKey(spendPrivateKey);

  return {
    viewKey: { privateKey: viewPrivateKey, publicKey: viewPublicKey },
    spendKey: { privateKey: spendPrivateKey, publicKey: spendPublicKey },
  };
}
```

### 2. ECDH Shared Secret

```typescript
import { ed25519, x25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';

function computeSharedSecret(
  ed25519PrivateKey: Uint8Array,
  ed25519PublicKey: Uint8Array
): Uint8Array {
  // Convert ed25519 → x25519 (Montgomery form)
  const x25519PrivateKey = ed25519.utils.toMontgomerySecret(ed25519PrivateKey);
  const x25519PublicKey = ed25519.utils.toMontgomery(ed25519PublicKey);

  // ECDH: sharedPoint = privateKey * publicKey
  const sharedPoint = x25519.scalarMult(x25519PrivateKey, x25519PublicKey);

  // Hash for uniform distribution
  return sha256(sharedPoint);
}
```

### 3. Gerar Stealth Address (Sender)

```typescript
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

export function generateStealthAddress(recipientMetaAddress: {
  viewPubKey: string;
  spendPubKey: string;
}) {
  const viewPubKey = bs58.decode(recipientMetaAddress.viewPubKey);
  const spendPubKey = bs58.decode(recipientMetaAddress.spendPubKey);

  // Generate ephemeral keypair (ONE-TIME USE)
  const ephemeralPrivateKey = ed25519.utils.randomSecretKey();
  const ephemeralPublicKey = ed25519.getPublicKey(ephemeralPrivateKey);

  // ECDH: S = ephemeralPrivate * viewPublic
  const sharedSecret = computeSharedSecret(ephemeralPrivateKey, viewPubKey);

  // Derive stealth address
  const stealthInput = new Uint8Array(sharedSecret.length + spendPubKey.length + 1);
  stealthInput.set(sharedSecret);
  stealthInput.set(spendPubKey, sharedSecret.length);
  stealthInput[stealthInput.length - 1] = 0; // index

  const stealthSeed = sha256(stealthInput);
  const stealthPubKey = ed25519.getPublicKey(stealthSeed);

  return {
    stealthAddress: new PublicKey(stealthPubKey),
    ephemeralPubKey: bs58.encode(ephemeralPublicKey),
  };
}
```

### 4. Verificar se Stealth Address é Nossa (Scanner)

```typescript
export function isStealthAddressForUs(
  stealthAddress: PublicKey,
  ephemeralPubKey: string,
  viewPrivateKey: Uint8Array,
  spendPublicKey: Uint8Array
): boolean {
  const ephemeralPubKeyBytes = bs58.decode(ephemeralPubKey);

  // ECDH: S = viewPrivate * ephemeralPublic
  const sharedSecret = computeSharedSecret(viewPrivateKey, ephemeralPubKeyBytes);

  // Derive expected stealth address
  const stealthInput = new Uint8Array(sharedSecret.length + spendPublicKey.length + 1);
  stealthInput.set(sharedSecret);
  stealthInput.set(spendPublicKey, sharedSecret.length);
  stealthInput[stealthInput.length - 1] = 0;

  const stealthSeed = sha256(stealthInput);
  const expectedStealthPubKey = ed25519.getPublicKey(stealthSeed);

  // Compare
  return stealthAddress.toBytes().every((b, i) => b === expectedStealthPubKey[i]);
}
```

### 5. Derivar Spending Key (para gastar)

```typescript
import { Keypair } from '@solana/web3.js';

export function deriveStealthSpendingKey(
  ephemeralPubKey: string,
  viewPrivateKey: Uint8Array,
  spendPublicKey: Uint8Array
): Keypair {
  const ephemeralPubKeyBytes = bs58.decode(ephemeralPubKey);
  const sharedSecret = computeSharedSecret(viewPrivateKey, ephemeralPubKeyBytes);

  const stealthInput = new Uint8Array(sharedSecret.length + spendPublicKey.length + 1);
  stealthInput.set(sharedSecret);
  stealthInput.set(spendPublicKey, sharedSecret.length);
  stealthInput[stealthInput.length - 1] = 0;

  const stealthPrivateKey = sha256(stealthInput);
  const stealthPublicKey = ed25519.getPublicKey(stealthPrivateKey);

  // Solana expects 64-byte secret key (private + public)
  const fullSecretKey = new Uint8Array(64);
  fullSecretKey.set(stealthPrivateKey);
  fullSecretKey.set(stealthPublicKey, 32);

  return Keypair.fromSecretKey(fullSecretKey);
}
```

### 6. Transação com Memo (Sender)

```typescript
import {
  Transaction,
  SystemProgram,
  TransactionInstruction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

async function sendStealthPayment(
  connection: Connection,
  sender: PublicKey,
  signTransaction: Function,
  recipientMetaAddress: string, // "st:<viewPub>:<spendPub>"
  amountSol: number
) {
  // Parse meta address
  const parts = recipientMetaAddress.split(':');
  const metaAddress = { viewPubKey: parts[1], spendPubKey: parts[2] };

  // Generate unique stealth address
  const { stealthAddress, ephemeralPubKey } = generateStealthAddress(metaAddress);

  // Build transaction
  const transaction = new Transaction();

  // 1. Transfer SOL to stealth address
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: stealthAddress,
      lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
    })
  );

  // 2. Add memo with ephemeral pubkey (for receiver to scan)
  transaction.add(
    new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(`stealth:${ephemeralPubKey}`, 'utf-8'),
    })
  );

  // Sign and send
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = sender;

  const signed = await signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize());

  return { signature, stealthAddress: stealthAddress.toBase58(), ephemeralPubKey };
}
```

### 7. Scanner de Pagamentos (Receiver)

```typescript
async function scanForStealthPayments(
  connection: Connection,
  viewPrivateKey: Uint8Array,
  spendPublicKey: Uint8Array
) {
  const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
  const payments = [];

  // Get recent memo transactions
  const signatures = await connection.getSignaturesForAddress(
    new PublicKey(MEMO_PROGRAM_ID),
    { limit: 100 }
  );

  for (const sig of signatures) {
    const tx = await connection.getTransaction(sig.signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx?.meta) continue;

    // Parse memo instructions
    for (const instruction of tx.transaction.message.instructions) {
      // ... extract memo data
      const memoData = /* decoded memo */;

      if (memoData.startsWith('stealth:')) {
        const ephemeralPubKey = memoData.slice(8);

        // Check each address that received SOL
        for (let i = 0; i < tx.meta.postBalances.length; i++) {
          const received = tx.meta.postBalances[i] - tx.meta.preBalances[i];

          if (received > 0) {
            const address = tx.transaction.message.accountKeys[i];

            const isOurs = isStealthAddressForUs(
              address,
              ephemeralPubKey,
              viewPrivateKey,
              spendPublicKey
            );

            if (isOurs) {
              payments.push({
                address: address.toBase58(),
                ephemeralPubKey,
                amount: received / LAMPORTS_PER_SOL,
                signature: sig.signature,
              });
            }
          }
        }
      }
    }
  }

  return payments;
}
```

---

## Estrutura de Arquivos

```
frontend/app/lib/stealth/
├── index.ts              # Core stealth functions
│   ├── generateStealthKeys()
│   ├── deriveStealthKeysFromSeed()
│   ├── getStealthMetaAddress()
│   ├── formatStealthMetaAddress()
│   ├── parseStealthMetaAddress()
│   ├── generateStealthAddress()
│   ├── isStealthAddressForUs()
│   ├── deriveStealthSpendingKey()
│   ├── serializeStealthKeys()
│   └── deserializeStealthKeys()
│
└── StealthContext.tsx    # React Context for key management
    ├── StealthProvider
    ├── useStealth()
    │   ├── stealthKeys
    │   ├── metaAddress
    │   ├── metaAddressString
    │   ├── deriveKeysFromWallet()
    │   ├── clearKeys()
    │   └── exportKeys()
```

---

## Privacidade Garantida

### O que fica ON-CHAIN:
| Dado | Visível? | Linkável ao receiver? |
|------|----------|----------------------|
| Transfer para stealthAddress | ✅ | ❌ |
| Memo com ephemeralPubKey | ✅ | ❌ |
| Valor da transação | ✅ | ❌ |

### O que fica OFF-CHAIN:
| Dado | Onde |
|------|------|
| viewPrivateKey | LocalStorage (encrypted) |
| spendPrivateKey | LocalStorage (encrypted) |
| Relação stealth ↔ receiver | Apenas no client |

### Garantias:
- ✅ Cada pagamento vai para endereço único
- ✅ Observador não consegue linkar pagamentos ao mesmo receiver
- ✅ Só o receiver com viewKey pode identificar pagamentos
- ✅ Só o receiver com spendKey pode gastar
- ✅ Ephemeral key é descartável (one-time use)

---

## Dependências

```json
{
  "@solana/web3.js": "^1.98.0",
  "@solana/wallet-adapter-react": "^0.15.35",
  "@noble/curves": "^1.8.1",
  "@noble/hashes": "^1.7.1",
  "bs58": "^6.0.0"
}
```

---

## Referências

- [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [Monero Stealth Addresses](https://www.getmonero.org/resources/moneropedia/stealthaddress.html)
- [X25519 ECDH (RFC 7748)](https://www.rfc-editor.org/rfc/rfc7748)
- [Ed25519 (RFC 8032)](https://www.rfc-editor.org/rfc/rfc8032)

---

## Status Atual

| Feature | Status |
|---------|--------|
| Key Generation | ✅ Implementado |
| Meta Address | ✅ Implementado |
| Stealth Address Derivation | ✅ Implementado |
| Send to Stealth | ✅ Implementado |
| Blockchain Scanner | ✅ Implementado |
| Spend from Stealth | ✅ Implementado |
| UI Dashboard | ✅ Implementado |
| Confidential Transfers (C-SPL) | 🔜 Próximo passo |
| ZK Proofs (Noir) | 🔜 Futuro |

---

## Como Testar

1. **Setup**
```bash
cd frontend
npm install
npm run dev
```

2. **Conectar Wallet** (Phantom/Solflare em Devnet)

3. **Gerar Stealth Keys** (Dashboard → Generate Stealth Keys)

4. **Copiar Meta Address** (formato: `st:ABC123...:DEF456...`)

5. **Enviar Pagamento** (Send Payment → Stealth mode)

6. **Escanear** (Dashboard → Refresh)

7. **Claim** (Dashboard → Claim button)

---

*Built for Solana Privacy Hackathon 2025*
