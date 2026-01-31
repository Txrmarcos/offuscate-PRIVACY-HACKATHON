/**
 * Relayer Fee Configuration
 *
 * These fees are deducted from private transfers to sustain the relayer.
 * The fee is taken from the PRIVATE funds being transferred, not from
 * a public wallet - this maintains privacy while funding the relayer.
 *
 * Flow:
 * 1. User sends X SOL privately
 * 2. Fee = X * FEE_PERCENTAGE
 * 3. Recipient receives: X - Fee
 * 4. Relayer receives: Fee (to cover gas costs)
 */

import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// ============================================================================
// Fee Configuration
// ============================================================================

/**
 * Relayer fee as a percentage (0.5% = 0.005)
 * This covers the gas costs the relayer pays on behalf of users
 */
export const RELAYER_FEE_PERCENTAGE = 0.005; // 0.5%

/**
 * Minimum fee in SOL
 * Even for small transactions, we need to cover base gas costs
 */
export const RELAYER_FEE_MIN_SOL = 0.001; // 0.001 SOL

/**
 * Maximum fee in SOL (optional cap for large transactions)
 * Prevents excessive fees on large transfers
 */
export const RELAYER_FEE_MAX_SOL = 0.1; // 0.1 SOL max

/**
 * Minimum fee in lamports
 */
export const RELAYER_FEE_MIN_LAMPORTS = Math.floor(RELAYER_FEE_MIN_SOL * LAMPORTS_PER_SOL);

/**
 * Maximum fee in lamports
 */
export const RELAYER_FEE_MAX_LAMPORTS = Math.floor(RELAYER_FEE_MAX_SOL * LAMPORTS_PER_SOL);

// ============================================================================
// Fee Calculation Functions
// ============================================================================

export interface FeeBreakdown {
  /** Original amount user wants to send (in SOL) */
  originalAmount: number;
  /** Amount recipient will receive (in SOL) */
  recipientAmount: number;
  /** Fee amount for relayer (in SOL) */
  feeAmount: number;
  /** Fee percentage applied */
  feePercentage: number;
  /** Original amount in lamports */
  originalLamports: number;
  /** Recipient amount in lamports */
  recipientLamports: number;
  /** Fee amount in lamports */
  feeLamports: number;
}

/**
 * Calculate the fee breakdown for a given transfer amount
 *
 * @param amountSol - The amount the user wants to send (in SOL)
 * @returns FeeBreakdown with all calculated values
 *
 * @example
 * const breakdown = calculateRelayerFee(1.0);
 * // breakdown.recipientAmount = 0.995 SOL
 * // breakdown.feeAmount = 0.005 SOL
 */
export function calculateRelayerFee(amountSol: number): FeeBreakdown {
  // Calculate percentage-based fee
  let feeAmount = amountSol * RELAYER_FEE_PERCENTAGE;

  // Apply minimum fee
  if (feeAmount < RELAYER_FEE_MIN_SOL) {
    feeAmount = RELAYER_FEE_MIN_SOL;
  }

  // Apply maximum fee cap
  if (feeAmount > RELAYER_FEE_MAX_SOL) {
    feeAmount = RELAYER_FEE_MAX_SOL;
  }

  // Ensure fee doesn't exceed the transfer amount
  if (feeAmount >= amountSol) {
    // If amount is too small, take a smaller fee but warn
    feeAmount = amountSol * 0.1; // Take 10% max for tiny amounts
  }

  const recipientAmount = amountSol - feeAmount;

  return {
    originalAmount: amountSol,
    recipientAmount,
    feeAmount,
    feePercentage: RELAYER_FEE_PERCENTAGE,
    originalLamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
    recipientLamports: Math.floor(recipientAmount * LAMPORTS_PER_SOL),
    feeLamports: Math.floor(feeAmount * LAMPORTS_PER_SOL),
  };
}

/**
 * Format fee breakdown for display in UI
 *
 * @param breakdown - The fee breakdown to format
 * @returns Formatted string for display
 *
 * @example
 * formatFeeBreakdown(breakdown);
 * // "1.000 SOL → 0.995 SOL (fee: 0.005 SOL)"
 */
export function formatFeeBreakdown(breakdown: FeeBreakdown): string {
  return `${breakdown.originalAmount.toFixed(4)} SOL → ${breakdown.recipientAmount.toFixed(4)} SOL (fee: ${breakdown.feeAmount.toFixed(4)} SOL)`;
}

/**
 * Get fee info for API responses
 */
export function getRelayerFeeInfo() {
  return {
    feePercentage: RELAYER_FEE_PERCENTAGE,
    feePercentageDisplay: `${(RELAYER_FEE_PERCENTAGE * 100).toFixed(1)}%`,
    minFeeSol: RELAYER_FEE_MIN_SOL,
    maxFeeSol: RELAYER_FEE_MAX_SOL,
    description: 'Fee deducted from transfer to cover relayer gas costs',
  };
}
