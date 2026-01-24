/**
 * ShadowWire Integration for Private Donations
 *
 * Uses Radr Labs' ShadowWire SDK for zero-knowledge private transfers on Solana.
 * This hides the donation amount using ZK proofs (Bulletproofs).
 *
 * Modes:
 * - 'internal': Amount hidden + sender hidden (maximum privacy)
 * - 'external': Sender hidden, amount visible
 */

import { ShadowWireClient, type DepositResponse, type TransferResponse, type PoolBalance, initWASM } from '@radr/shadowwire';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Initialize client
let shadowWireClient: ShadowWireClient | null = null;
let wasmInitialized = false;

/**
 * Initialize WASM for client-side proof generation
 */
async function ensureWasmInitialized(): Promise<void> {
  if (wasmInitialized) return;

  try {
    // Initialize WASM from public folder
    await initWASM('/wasm/settler_wasm_bg.wasm');
    wasmInitialized = true;
    console.log('[ShadowWire] WASM initialized successfully');
  } catch (error) {
    console.error('[ShadowWire] WASM initialization failed:', error);
    throw new Error('Failed to initialize ZK proof system');
  }
}

export interface ShadowWireWallet {
  publicKey: PublicKey;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: <T>(tx: T) => Promise<T>;
}

export interface PrivateTransferResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface ShadowWireBalance {
  available: number;
  pending: number;
  total: number;
}

/**
 * Get or create ShadowWire client
 */
function getClient(): ShadowWireClient {
  if (!shadowWireClient) {
    shadowWireClient = new ShadowWireClient({
      debug: process.env.NODE_ENV === 'development',
    });
  }
  return shadowWireClient;
}

/**
 * Deposit SOL into ShadowWire for private transfers
 * User needs to deposit first before making private transfers
 */
export async function depositToShadowWire(
  wallet: ShadowWireWallet,
  amountSol: number
): Promise<PrivateTransferResult> {
  try {
    console.log('[ShadowWire] Depositing', amountSol, 'SOL...');

    const client = getClient();

    // Convert SOL to lamports (u64 integer)
    const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const result: DepositResponse = await client.deposit({
      wallet: wallet.publicKey.toBase58(),
      amount: amountLamports,
    });

    console.log('[ShadowWire] Deposit response:', result);

    // The SDK returns an unsigned transaction that needs to be signed
    if (result.unsigned_tx_base64) {
      console.log('[ShadowWire] Transaction needs signing...');
      // For now, return the result as-is
      // TODO: Implement transaction signing flow
    }

    return {
      success: result.success,
      signature: result.pool_address,
    };
  } catch (error: any) {
    console.error('[ShadowWire] Deposit error:', error);
    return {
      success: false,
      error: error.message || 'Deposit failed',
    };
  }
}

/**
 * Make a private transfer using ShadowWire
 * Amount is hidden using zero-knowledge proofs
 *
 * @param wallet - User's wallet
 * @param recipientAddress - Destination address (campaign vault)
 * @param amountSol - Amount in SOL
 * @param transferType - 'internal' for max privacy, 'external' for sender-only privacy
 */
export async function privateTransfer(
  wallet: ShadowWireWallet,
  recipientAddress: string,
  amountSol: number,
  transferType: 'internal' | 'external' = 'internal'
): Promise<PrivateTransferResult> {
  try {
    console.log('[ShadowWire] Private transfer...');
    console.log('  Amount:', amountSol, 'SOL');
    console.log('  Recipient:', recipientAddress);
    console.log('  Type:', transferType);

    // Initialize WASM for ZK proof generation
    await ensureWasmInitialized();

    const client = getClient();

    // Create wallet adapter for signing
    const walletAdapter = {
      signMessage: wallet.signMessage,
    };

    // Convert SOL to lamports (u64 integer)
    const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const result: TransferResponse = await client.transfer({
      sender: wallet.publicKey.toBase58(),
      recipient: recipientAddress,
      amount: amountLamports,
      token: 'SOL',
      type: transferType,
      wallet: walletAdapter,
    });

    console.log('[ShadowWire] Transfer result:', result);

    return {
      success: result.success,
      signature: result.tx_signature,
    };
  } catch (error: any) {
    console.error('[ShadowWire] Transfer error:', error);
    return {
      success: false,
      error: error.message || 'Transfer failed',
    };
  }
}

/**
 * Get ShadowWire balance for a wallet (returns SOL, not lamports)
 */
export async function getShadowWireBalance(
  walletAddress: string
): Promise<ShadowWireBalance> {
  try {
    const client = getClient();
    const balance: PoolBalance = await client.getBalance(walletAddress, 'SOL');

    // Balance from API is in lamports, convert to SOL
    const availableSol = (balance.available || 0) / LAMPORTS_PER_SOL;
    const depositedSol = (balance.deposited || 0) / LAMPORTS_PER_SOL;

    return {
      available: availableSol,
      pending: depositedSol - availableSol,
      total: depositedSol,
    };
  } catch (error: any) {
    console.error('[ShadowWire] Balance error:', error);
    return { available: 0, pending: 0, total: 0 };
  }
}

/**
 * Withdraw from ShadowWire back to regular wallet
 */
export async function withdrawFromShadowWire(
  wallet: ShadowWireWallet,
  amountSol: number
): Promise<PrivateTransferResult> {
  try {
    console.log('[ShadowWire] Withdrawing', amountSol, 'SOL...');

    const client = getClient();

    // Convert SOL to lamports (u64 integer)
    const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const result = await client.withdraw({
      wallet: wallet.publicKey.toBase58(),
      amount: amountLamports,
    });

    console.log('[ShadowWire] Withdraw result:', result);

    return {
      success: result.success,
      signature: result.tx_signature,
    };
  } catch (error: any) {
    console.error('[ShadowWire] Withdraw error:', error);
    return {
      success: false,
      error: error.message || 'Withdraw failed',
    };
  }
}

/**
 * Calculate fee for a transfer (input and output in SOL)
 */
export function calculateFee(amountSol: number): number {
  try {
    const client = getClient();
    const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
    const feeInfo = client.calculateFee(amountLamports, 'SOL');
    // Return fee in SOL
    return (feeInfo.fee || 0) / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('[ShadowWire] Fee calculation error:', error);
    return 0;
  }
}

/**
 * One-step private donation: deposit + transfer in sequence
 * This is the main function for private donations
 */
export async function privateDonation(
  wallet: ShadowWireWallet,
  recipientAddress: string,
  amountSol: number
): Promise<PrivateTransferResult> {
  try {
    console.log('[ShadowWire] === PRIVATE DONATION ===');
    console.log('  Amount:', amountSol, 'SOL');
    console.log('  To:', recipientAddress);

    // Check if user has enough balance in ShadowWire
    const balance = await getShadowWireBalance(wallet.publicKey.toBase58());
    console.log('[ShadowWire] Current balance:', balance.available, 'SOL');

    if (balance.available < amountSol) {
      // Need to deposit first
      const depositAmount = amountSol - balance.available + 0.01; // Add buffer for fees
      console.log('[ShadowWire] Insufficient balance, depositing', depositAmount, 'SOL first...');

      const depositResult = await depositToShadowWire(wallet, depositAmount);
      if (!depositResult.success) {
        return {
          success: false,
          error: depositResult.error || 'Deposit failed - please try again',
        };
      }

      // Wait a bit for deposit to be processed
      console.log('[ShadowWire] Waiting for deposit confirmation...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Now do the private transfer
    const transferResult = await privateTransfer(
      wallet,
      recipientAddress,
      amountSol,
      'internal' // Maximum privacy - hides amount
    );

    return transferResult;
  } catch (error: any) {
    console.error('[ShadowWire] Private donation error:', error);
    return {
      success: false,
      error: error.message || 'Private donation failed',
    };
  }
}
