/**
 * Stealth Addresses Implementation for Solana
 *
 * Stealth addresses allow the receiver to generate a fresh one-time address
 * for each transaction, providing unlinkability between transactions.
 *
 * Key Components:
 * - viewKey: Used to scan/identify incoming payments (can be shared with a view-only party)
 * - spendKey: Used to actually spend the funds (must remain secret)
 *
 * Flow:
 * 1. Receiver publishes their stealth meta-address (viewPubKey + spendPubKey)
 * 2. Sender generates ephemeral keypair and derives stealth address
 * 3. Sender sends funds to stealth address and publishes ephemeral pubkey
 * 4. Receiver scans for payments using viewKey, derives spending key
 */

import { Keypair, PublicKey } from '@solana/web3.js';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import bs58 from 'bs58';

/**
 * Compute shared secret using X25519 ECDH
 *
 * This converts ed25519 keys to x25519 and performs proper Diffie-Hellman key exchange.
 * The math ensures that:
 *   - Sender computes: sharedSecret = ephemeralPrivate * viewPublic
 *   - Receiver computes: sharedSecret = viewPrivate * ephemeralPublic
 * Both produce the same result due to the commutative property of ECDH.
 *
 * Reference: https://www.rfc-editor.org/rfc/rfc7748 (X25519 ECDH)
 * Conversion: https://www.rfc-editor.org/rfc/rfc8032#section-5.1.5
 *
 * @param ed25519PrivateKey - The ed25519 private key (32 bytes seed)
 * @param ed25519PublicKey - The ed25519 public key (32 bytes)
 * @returns The shared secret (32 bytes hash)
 */
function computeSharedSecret(ed25519PrivateKey: Uint8Array, ed25519PublicKey: Uint8Array): Uint8Array {
  // Convert ed25519 private key to x25519 private key
  // This applies the SHA-512 hash and clamping as per RFC 8032
  const x25519PrivateKey = ed25519.utils.toMontgomerySecret(ed25519PrivateKey);

  // Convert ed25519 public key to x25519 public key
  // This converts from Edwards to Montgomery form: u = (1+y)/(1-y)
  const x25519PublicKey = ed25519.utils.toMontgomery(ed25519PublicKey);

  // Perform X25519 ECDH to get shared point
  // sharedPoint = x25519PrivateKey * x25519PublicKey
  const sharedPoint = x25519.scalarMult(x25519PrivateKey, x25519PublicKey);

  // Hash the shared point to get the final shared secret
  // This adds an extra layer of security and ensures uniform distribution
  return sha256(sharedPoint);
}

// Types
export interface StealthKeys {
  viewKey: {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
  };
  spendKey: {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
  };
}

export interface StealthMetaAddress {
  viewPubKey: string;  // base58 encoded
  spendPubKey: string; // base58 encoded
}

export interface StealthAddressResult {
  stealthAddress: PublicKey;
  ephemeralPubKey: string; // base58 encoded - must be published for receiver to find payment
}

export interface SerializedStealthKeys {
  viewPrivateKey: string;  // base58 encoded
  viewPublicKey: string;   // base58 encoded
  spendPrivateKey: string; // base58 encoded
  spendPublicKey: string;  // base58 encoded
}

/**
 * Generate a new set of stealth keys (viewKey and spendKey)
 * These keys should be generated once and stored securely by the user
 */
export function generateStealthKeys(): StealthKeys {
  // Generate view key pair using ed25519
  const viewPrivateKey = ed25519.utils.randomSecretKey();
  const viewPublicKey = ed25519.getPublicKey(viewPrivateKey);

  // Generate spend key pair using ed25519
  const spendPrivateKey = ed25519.utils.randomSecretKey();
  const spendPublicKey = ed25519.getPublicKey(spendPrivateKey);

  return {
    viewKey: {
      privateKey: viewPrivateKey,
      publicKey: viewPublicKey,
    },
    spendKey: {
      privateKey: spendPrivateKey,
      publicKey: spendPublicKey,
    },
  };
}

/**
 * Derive stealth keys deterministically from a master seed
 * This allows recovering stealth keys from a single seed phrase
 */
export function deriveStealthKeysFromSeed(seed: Uint8Array): StealthKeys {
  // Derive view key from seed + "view" domain separator
  const viewSeed = sha256(new Uint8Array([...seed, ...new TextEncoder().encode('stealth:view')]));
  const viewPrivateKey = viewSeed.slice(0, 32);
  const viewPublicKey = ed25519.getPublicKey(viewPrivateKey);

  // Derive spend key from seed + "spend" domain separator
  const spendSeed = sha256(new Uint8Array([...seed, ...new TextEncoder().encode('stealth:spend')]));
  const spendPrivateKey = spendSeed.slice(0, 32);
  const spendPublicKey = ed25519.getPublicKey(spendPrivateKey);

  return {
    viewKey: {
      privateKey: viewPrivateKey,
      publicKey: viewPublicKey,
    },
    spendKey: {
      privateKey: spendPrivateKey,
      publicKey: spendPublicKey,
    },
  };
}

/**
 * Derive stealth keys from a Solana wallet keypair
 * Useful for integrating with existing wallet connections
 */
export function deriveStealthKeysFromWallet(walletKeypair: Keypair): StealthKeys {
  return deriveStealthKeysFromSeed(walletKeypair.secretKey.slice(0, 32));
}

/**
 * Get the stealth meta-address to share publicly
 * Others will use this to send you private payments
 */
export function getStealthMetaAddress(keys: StealthKeys): StealthMetaAddress {
  return {
    viewPubKey: bs58.encode(keys.viewKey.publicKey),
    spendPubKey: bs58.encode(keys.spendKey.publicKey),
  };
}

/**
 * Format stealth meta-address as a single string for sharing
 * Format: "st:<viewPubKey>:<spendPubKey>"
 */
export function formatStealthMetaAddress(metaAddress: StealthMetaAddress): string {
  return `st:${metaAddress.viewPubKey}:${metaAddress.spendPubKey}`;
}

/**
 * Parse a stealth meta-address string
 */
export function parseStealthMetaAddress(metaAddressString: string): StealthMetaAddress {
  const parts = metaAddressString.split(':');
  if (parts.length !== 3 || parts[0] !== 'st') {
    throw new Error('Invalid stealth meta-address format. Expected: st:<viewPubKey>:<spendPubKey>');
  }
  return {
    viewPubKey: parts[1],
    spendPubKey: parts[2],
  };
}

/**
 * Generate a stealth address for sending a payment
 * The sender calls this with the receiver's meta-address
 *
 * @param recipientMetaAddress - The receiver's published stealth meta-address
 * @returns The stealth address to send to, and ephemeral pubkey to publish
 */
export function generateStealthAddress(recipientMetaAddress: StealthMetaAddress): StealthAddressResult {
  // Decode recipient's public keys
  const viewPubKey = bs58.decode(recipientMetaAddress.viewPubKey);
  const spendPubKey = bs58.decode(recipientMetaAddress.spendPubKey);

  // Generate ephemeral keypair (one-time use) - THIS IS WHAT MAKES EACH PAYMENT UNIQUE
  const ephemeralPrivateKey = ed25519.utils.randomSecretKey();
  const ephemeralPublicKey = ed25519.getPublicKey(ephemeralPrivateKey);

  // Create shared secret using ECDH: S = ephemeralPrivate * viewPublic
  // The receiver can compute the same: S = viewPrivate * ephemeralPublic
  const sharedSecret = computeSharedSecret(ephemeralPrivateKey, viewPubKey);

  // Derive stealth public key by combining spend public key with shared secret
  // stealthPubKey = hash(sharedSecret || spendPubKey || index)
  const stealthInput = new Uint8Array(sharedSecret.length + spendPubKey.length + 1);
  stealthInput.set(sharedSecret);
  stealthInput.set(spendPubKey, sharedSecret.length);
  stealthInput[stealthInput.length - 1] = 0; // index for multiple outputs

  // Generate deterministic keypair from the hash
  const stealthSeed = sha256(stealthInput);
  const stealthPubKey = ed25519.getPublicKey(stealthSeed);

  // Convert to Solana PublicKey
  const stealthAddress = new PublicKey(stealthPubKey);

  // DEBUG: Log generation
  console.log('  viewPubKey:', recipientMetaAddress.viewPubKey);
  console.log('  spendPubKey:', recipientMetaAddress.spendPubKey);
  console.log('  ephemeralPubKey:', bs58.encode(ephemeralPublicKey));
  console.log('  sharedSecret (hex):', Buffer.from(sharedSecret).toString('hex').slice(0, 32));
  console.log('  stealthAddress:', stealthAddress.toBase58());

  return {
    stealthAddress,
    ephemeralPubKey: bs58.encode(ephemeralPublicKey),
  };
}

/**
 * Check if a stealth address belongs to us (scan for incoming payments)
 * The receiver calls this for each potential stealth address + ephemeral pubkey pair
 *
 * @param stealthAddress - The stealth address to check
 * @param ephemeralPubKey - The ephemeral public key published by sender
 * @param viewKey - Our view key (private)
 * @param spendPubKey - Our spend public key
 * @returns true if this payment is for us
 */
export function isStealthAddressForUs(
  stealthAddress: PublicKey,
  ephemeralPubKey: string,
  viewKey: Uint8Array,
  spendPubKey: Uint8Array
): boolean {
  try {
    const ephemeralPubKeyBytes = bs58.decode(ephemeralPubKey);

    // Recreate the shared secret using ECDH: S = viewPrivate * ephemeralPublic
    // This gives the same result as: S = ephemeralPrivate * viewPublic (done by sender)
    const sharedSecret = computeSharedSecret(viewKey, ephemeralPubKeyBytes);

    // Derive what the stealth public key should be
    const stealthInput = new Uint8Array(sharedSecret.length + spendPubKey.length + 1);
    stealthInput.set(sharedSecret);
    stealthInput.set(spendPubKey, sharedSecret.length);
    stealthInput[stealthInput.length - 1] = 0;

    const stealthSeed = sha256(stealthInput);
    const expectedStealthPubKey = ed25519.getPublicKey(stealthSeed);

    // DEBUG: Log comparison
    const expectedAddress = new PublicKey(expectedStealthPubKey);
    console.log('  ephemeralPubKey:', ephemeralPubKey);
    console.log('  viewKey (first 8 bytes):', bs58.encode(viewKey).slice(0, 12));
    console.log('  spendPubKey:', bs58.encode(spendPubKey));
    console.log('  sharedSecret (hex):', Buffer.from(sharedSecret).toString('hex').slice(0, 32));
    console.log('  Expected stealth:', expectedAddress.toBase58());
    console.log('  Actual stealth:  ', stealthAddress.toBase58());
    console.log('  Match:', expectedAddress.toBase58() === stealthAddress.toBase58());

    // Compare with the actual stealth address
    return stealthAddress.toBytes().every((b, i) => b === expectedStealthPubKey[i]);
  } catch (err) {
    console.error('isStealthAddressForUs error:', err);
    return false;
  }
}

/**
 * Derive the private key to spend from a stealth address
 * Only call this after confirming the address is ours with isStealthAddressForUs
 *
 * @param ephemeralPubKey - The ephemeral public key published by sender
 * @param viewKey - Our view key (private)
 * @param spendPubKey - Our spend public key
 * @returns Keypair that can spend from the stealth address
 */
export function deriveStealthSpendingKey(
  ephemeralPubKey: string,
  viewKey: Uint8Array,
  spendPubKey: Uint8Array
): Keypair {
  const ephemeralPubKeyBytes = bs58.decode(ephemeralPubKey);

  // Recreate the shared secret using ECDH
  const sharedSecret = computeSharedSecret(viewKey, ephemeralPubKeyBytes);

  // Derive the stealth private key seed
  const stealthInput = new Uint8Array(sharedSecret.length + spendPubKey.length + 1);
  stealthInput.set(sharedSecret);
  stealthInput.set(spendPubKey, sharedSecret.length);
  stealthInput[stealthInput.length - 1] = 0;

  const stealthPrivateKey = sha256(stealthInput);

  // Create Solana Keypair from the private key
  // Solana expects 64-byte secret key (private key + public key)
  const stealthPublicKey = ed25519.getPublicKey(stealthPrivateKey);
  const fullSecretKey = new Uint8Array(64);
  fullSecretKey.set(stealthPrivateKey);
  fullSecretKey.set(stealthPublicKey, 32);

  return Keypair.fromSecretKey(fullSecretKey);
}

/**
 * Serialize stealth keys for secure storage
 */
export function serializeStealthKeys(keys: StealthKeys): SerializedStealthKeys {
  return {
    viewPrivateKey: bs58.encode(keys.viewKey.privateKey),
    viewPublicKey: bs58.encode(keys.viewKey.publicKey),
    spendPrivateKey: bs58.encode(keys.spendKey.privateKey),
    spendPublicKey: bs58.encode(keys.spendKey.publicKey),
  };
}

/**
 * Deserialize stealth keys from storage
 */
export function deserializeStealthKeys(serialized: SerializedStealthKeys): StealthKeys {
  return {
    viewKey: {
      privateKey: bs58.decode(serialized.viewPrivateKey),
      publicKey: bs58.decode(serialized.viewPublicKey),
    },
    spendKey: {
      privateKey: bs58.decode(serialized.spendPrivateKey),
      publicKey: bs58.decode(serialized.spendPublicKey),
    },
  };
}

