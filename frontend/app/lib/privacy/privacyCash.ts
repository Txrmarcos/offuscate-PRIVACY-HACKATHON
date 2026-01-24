/**
 * Privacy.cash Integration for Browser
 *
 * This module calls the server-side API routes that run the Privacy.cash SDK.
 * The SDK requires Node.js environment, so we use API routes as a bridge.
 *
 * Flow:
 * 1. User signs a message with their wallet
 * 2. Signature is sent to server
 * 3. Server derives a "privacy keypair" from signature
 * 4. Server executes Privacy.cash operations
 * 5. Results returned to frontend
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

// Message to sign for privacy operations
const PRIVACY_SIGN_MESSAGE = 'Privacy.cash Authorization\n\nSign this message to authorize private transactions.\nThis creates a secure privacy wallet linked to your signature.';

export interface PrivacyWallet {
  publicKey: PublicKey;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export interface PrivacyDepositResult {
  success: boolean;
  tx: string;
  privacyWallet: string;
}

export interface PrivacyWithdrawResult {
  success: boolean;
  tx: string;
  recipient: string;
  amount_in_lamports: number;
  fee_in_lamports: number;
  isPartial: boolean;
}

export interface PrivacyBalanceResult {
  success: boolean;
  lamports: number;
  sol: number;
  privacyWallet: string;
}

// Cache the signature to avoid re-signing
let cachedSignature: string | null = null;
let cachedWalletAddress: string | null = null;

/**
 * Get or request signature for privacy operations
 */
async function getPrivacySignature(wallet: PrivacyWallet): Promise<string> {
  const walletAddress = wallet.publicKey.toBase58();

  // Return cached signature if same wallet
  if (cachedSignature && cachedWalletAddress === walletAddress) {
    return cachedSignature;
  }

  // Request new signature
  const messageBytes = new TextEncoder().encode(PRIVACY_SIGN_MESSAGE);
  const signatureBytes = await wallet.signMessage(messageBytes);
  const signature = bs58.encode(signatureBytes);

  // Cache it
  cachedSignature = signature;
  cachedWalletAddress = walletAddress;

  return signature;
}

/**
 * Deposit SOL into the privacy pool
 * @param wallet - Wallet with signing capabilities
 * @param amountSol - Amount in SOL to deposit
 * @returns Transaction signature and privacy wallet address
 */
export async function privateDeposit(
  wallet: PrivacyWallet,
  amountSol: number
): Promise<PrivacyDepositResult> {
  console.log('[Privacy.cash] Initiating private deposit...');
  console.log('[Privacy.cash] Amount:', amountSol, 'SOL');

  // Get signature for authorization
  const signature = await getPrivacySignature(wallet);

  // Call server API
  const response = await fetch('/api/privacy/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signature,
      amountSol,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Deposit failed');
  }

  console.log('[Privacy.cash] Deposit successful:', data.tx);
  return data;
}

/**
 * Withdraw SOL from the privacy pool
 * @param wallet - Wallet with signing capabilities
 * @param amountSol - Amount in SOL to withdraw
 * @param recipientAddress - Address to receive funds (optional, defaults to privacy wallet)
 */
export async function privateWithdraw(
  wallet: PrivacyWallet,
  amountSol: number,
  recipientAddress?: string
): Promise<PrivacyWithdrawResult> {
  console.log('[Privacy.cash] Initiating private withdrawal...');
  console.log('[Privacy.cash] Amount:', amountSol, 'SOL');
  console.log('[Privacy.cash] Recipient:', recipientAddress || 'self');

  const signature = await getPrivacySignature(wallet);

  const response = await fetch('/api/privacy/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signature,
      amountSol,
      recipientAddress,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Withdraw failed');
  }

  console.log('[Privacy.cash] Withdraw successful:', data.tx);
  return data;
}

/**
 * Get private balance in the privacy pool
 * @param wallet - Wallet with signing capabilities
 * @returns Balance in lamports and SOL
 */
export async function getPrivateBalance(
  wallet: PrivacyWallet
): Promise<PrivacyBalanceResult> {
  console.log('[Privacy.cash] Checking private balance...');

  const signature = await getPrivacySignature(wallet);

  const response = await fetch('/api/privacy/balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to get balance');
  }

  console.log('[Privacy.cash] Balance:', data.sol, 'SOL');
  return data;
}

/**
 * Clear cached signature (call on wallet disconnect)
 */
export function clearPrivacySession(): void {
  cachedSignature = null;
  cachedWalletAddress = null;
}

/**
 * Check if privacy session is initialized
 */
export function isPrivacySessionActive(): boolean {
  return cachedSignature !== null;
}
