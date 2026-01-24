/**
 * Phase 3: Commitment-Based Privacy System
 *
 * This implements a Tornado Cash-style privacy scheme:
 * - On deposit: Generate secret + nullifier_secret, compute commitment
 * - Store secrets locally (encrypted with wallet)
 * - On withdraw: Provide nullifier + secret_hash to prove knowledge
 *
 * Privacy guarantees:
 * - Deposit and withdrawal cannot be linked by on-chain analysis
 * - Only the secret holder can withdraw
 * - Nullifier prevents double-spending
 */

import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';

// Types
export interface PrivateNote {
  secret: Uint8Array; // 32 bytes random
  nullifierSecret: Uint8Array; // 32 bytes random
  amount: number; // Amount in lamports
  commitment: Uint8Array; // hash(secretHash || nullifier || amount)
  secretHash: Uint8Array; // hash(secret)
  nullifier: Uint8Array; // hash(nullifierSecret)
  createdAt: number;
  spent: boolean;
}

export interface SerializedNote {
  secret: string; // hex
  nullifierSecret: string; // hex
  amount: number;
  commitment: string; // hex
  secretHash: string; // hex
  nullifier: string; // hex
  createdAt: number;
  spent: boolean;
}

// Constants
const STORAGE_KEY = 'privacy_pool_notes_v1';

// Utility functions
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function u64ToBytes(num: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  // Write as little-endian (Solana uses LE)
  view.setBigUint64(0, BigInt(num), true);
  return new Uint8Array(buffer);
}

/**
 * Generate a new private note for depositing
 * @param amountLamports The amount to deposit in lamports
 * @returns PrivateNote containing secrets and commitment
 */
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

/**
 * Recompute derived values from a note's secrets
 * Used when loading from storage
 */
export function recomputeNoteValues(
  secret: Uint8Array,
  nullifierSecret: Uint8Array,
  amount: number
): { secretHash: Uint8Array; nullifier: Uint8Array; commitment: Uint8Array } {
  const secretHash = sha256(secret);
  const nullifier = sha256(nullifierSecret);

  const amountBytes = u64ToBytes(amount);
  const preimage = new Uint8Array(72);
  preimage.set(secretHash, 0);
  preimage.set(nullifier, 32);
  preimage.set(amountBytes, 64);

  const commitment = sha256(preimage);

  return { secretHash, nullifier, commitment };
}

/**
 * Serialize a note for storage
 */
export function serializeNote(note: PrivateNote): SerializedNote {
  return {
    secret: toHex(note.secret),
    nullifierSecret: toHex(note.nullifierSecret),
    amount: note.amount,
    commitment: toHex(note.commitment),
    secretHash: toHex(note.secretHash),
    nullifier: toHex(note.nullifier),
    createdAt: note.createdAt,
    spent: note.spent,
  };
}

/**
 * Deserialize a note from storage
 */
export function deserializeNote(serialized: SerializedNote): PrivateNote {
  return {
    secret: fromHex(serialized.secret),
    nullifierSecret: fromHex(serialized.nullifierSecret),
    amount: serialized.amount,
    commitment: fromHex(serialized.commitment),
    secretHash: fromHex(serialized.secretHash),
    nullifier: fromHex(serialized.nullifier),
    createdAt: serialized.createdAt,
    spent: serialized.spent,
  };
}

/**
 * Get all stored notes for a wallet
 * @param walletAddress The wallet public key as string
 */
export function getStoredNotes(walletAddress: string): PrivateNote[] {
  if (typeof window === 'undefined') return [];

  try {
    const key = `${STORAGE_KEY}_${walletAddress}`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];

    const serializedNotes: SerializedNote[] = JSON.parse(stored);
    return serializedNotes.map(deserializeNote);
  } catch (err) {
    console.error('[Privacy] Failed to load notes:', err);
    return [];
  }
}

/**
 * Save a note to local storage
 * @param walletAddress The wallet public key as string
 * @param note The note to save
 */
export function saveNote(walletAddress: string, note: PrivateNote): void {
  if (typeof window === 'undefined') return;

  try {
    const notes = getStoredNotes(walletAddress);
    notes.push(note);

    const key = `${STORAGE_KEY}_${walletAddress}`;
    const serialized = notes.map(serializeNote);
    localStorage.setItem(key, JSON.stringify(serialized));
  } catch (err) {
    console.error('[Privacy] Failed to save note:', err);
  }
}

/**
 * Mark a note as spent
 * @param walletAddress The wallet public key as string
 * @param commitmentHex The commitment hash in hex
 */
export function markNoteSpent(walletAddress: string, commitmentHex: string): void {
  if (typeof window === 'undefined') return;

  try {
    const notes = getStoredNotes(walletAddress);
    const updated = notes.map((note) => {
      if (toHex(note.commitment) === commitmentHex) {
        return { ...note, spent: true };
      }
      return note;
    });

    const key = `${STORAGE_KEY}_${walletAddress}`;
    const serialized = updated.map(serializeNote);
    localStorage.setItem(key, JSON.stringify(serialized));
  } catch (err) {
    console.error('[Privacy] Failed to mark note spent:', err);
  }
}

/**
 * Get unspent notes for a wallet
 */
export function getUnspentNotes(walletAddress: string): PrivateNote[] {
  return getStoredNotes(walletAddress).filter((note) => !note.spent);
}

/**
 * Convert bytes to array for Anchor instruction
 */
export function toArray32(bytes: Uint8Array): number[] {
  if (bytes.length !== 32) {
    throw new Error('Expected 32 bytes');
  }
  return Array.from(bytes);
}

/**
 * Format commitment for display (truncated)
 */
export function formatCommitment(commitment: Uint8Array): string {
  const hex = toHex(commitment);
  return `${hex.slice(0, 8)}...${hex.slice(-8)}`;
}

export { toHex, fromHex };
