/**
 * TransactionResult Component
 *
 * Displays transaction results with fee breakdown for privacy transfers.
 * Shows both TX signatures when using the two-transaction fee model.
 *
 * Used after privateTransferWithFee() completes.
 */

'use client';

import React from 'react';
import { CheckCircle, ExternalLink, Copy, Check, Shield, Wallet, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import type { FeeBreakdown } from '../lib/config/relayerFees';

interface TransactionResultProps {
  /** Whether the transfer was successful */
  success: boolean;
  /** TX1 signature (fee to relayer) - only in two-tx model */
  feeSignature?: string;
  /** TX2 signature (amount to recipient) - main transfer */
  transferSignature?: string;
  /** Single signature (for legacy single-tx transfers) */
  signature?: string;
  /** Fee breakdown details */
  feeBreakdown?: FeeBreakdown;
  /** Error message if failed */
  error?: string;
  /** Which step failed (1 = fee tx, 2 = transfer tx) */
  failedStep?: 1 | 2;
  /** Callback when user closes/dismisses the result */
  onClose?: () => void;
  /** Show privacy explanation */
  showPrivacyInfo?: boolean;
}

const EXPLORER_BASE = 'https://explorer.solana.com/tx';
const CLUSTER = 'devnet';

export function TransactionResult({
  success,
  feeSignature,
  transferSignature,
  signature,
  feeBreakdown,
  error,
  failedStep,
  onClose,
  showPrivacyInfo = true,
}: TransactionResultProps) {
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedTx(id);
    setTimeout(() => setCopiedTx(null), 2000);
  };

  const truncateSignature = (sig: string) => {
    return `${sig.slice(0, 8)}...${sig.slice(-8)}`;
  };

  const getExplorerUrl = (sig: string) => {
    return `${EXPLORER_BASE}/${sig}?cluster=${CLUSTER}`;
  };

  // Determine which signature to show as main
  const mainSignature = transferSignature || signature;
  const hasTwoTxModel = !!(feeSignature && transferSignature);

  if (!success) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-red-400 text-lg">!</span>
          </div>
          <div className="flex-1">
            <p className="text-red-400 font-medium">Transaction Failed</p>
            <p className="text-red-400/70 text-sm mt-1">{error}</p>
            {failedStep && (
              <p className="text-red-400/50 text-xs mt-2">
                Failed at step {failedStep}: {failedStep === 1 ? 'Fee transaction' : 'Transfer transaction'}
              </p>
            )}
            {failedStep === 2 && feeSignature && (
              <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-yellow-400/80 text-xs">
                  Note: Fee transaction was successful. Fee was sent to relayer.
                </p>
                <a
                  href={getExplorerUrl(feeSignature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400/60 text-xs hover:text-yellow-400 flex items-center gap-1 mt-1"
                >
                  View fee TX <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.1] rounded-xl">
      {/* Success Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <p className="text-white font-medium">Transfer Complete!</p>
          <p className="text-white/50 text-sm">
            {hasTwoTxModel ? '2 transactions confirmed' : 'Transaction confirmed'}
          </p>
        </div>
      </div>

      {/* Fee Breakdown */}
      {feeBreakdown && (
        <div className="mb-4 p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Fee Breakdown</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-white/60 text-sm">Total sent</span>
              <span className="text-white font-mono">{feeBreakdown.originalAmount.toFixed(4)} SOL</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60 text-sm flex items-center gap-1">
                <Shield className="w-3 h-3" /> Privacy fee ({(feeBreakdown.feePercentage * 100).toFixed(1)}%)
              </span>
              <span className="text-orange-400/80 font-mono">-{feeBreakdown.feeAmount.toFixed(4)} SOL</span>
            </div>
            <div className="border-t border-white/[0.05] pt-2 flex justify-between items-center">
              <span className="text-white/80 text-sm font-medium">Recipient receives</span>
              <span className="text-green-400 font-mono font-medium">{feeBreakdown.recipientAmount.toFixed(4)} SOL</span>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Links */}
      <div className="space-y-2">
        <p className="text-white/40 text-xs uppercase tracking-wider">Transaction{hasTwoTxModel ? 's' : ''}</p>

        {/* Two-TX Model: Show both transactions */}
        {hasTwoTxModel && (
          <>
            {/* TX1: Fee */}
            <div className="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <span className="text-orange-400 text-xs font-bold">1</span>
                </div>
                <div>
                  <p className="text-white/70 text-xs">Fee to Relayer</p>
                  <code className="text-white/50 text-xs font-mono">{truncateSignature(feeSignature!)}</code>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(feeSignature!, 'fee')}
                  className="p-1.5 rounded hover:bg-white/[0.05] transition-colors"
                >
                  {copiedTx === 'fee' ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-white/40" />
                  )}
                </button>
                <a
                  href={getExplorerUrl(feeSignature!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded hover:bg-white/[0.05] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
                </a>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="w-4 h-4 text-white/20 rotate-90" />
            </div>

            {/* TX2: Transfer */}
            <div className="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-green-500/20">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <span className="text-green-400 text-xs font-bold">2</span>
                </div>
                <div>
                  <p className="text-white/70 text-xs">Transfer to Recipient</p>
                  <code className="text-white/50 text-xs font-mono">{truncateSignature(transferSignature!)}</code>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(transferSignature!, 'transfer')}
                  className="p-1.5 rounded hover:bg-white/[0.05] transition-colors"
                >
                  {copiedTx === 'transfer' ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-white/40" />
                  )}
                </button>
                <a
                  href={getExplorerUrl(transferSignature!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded hover:bg-white/[0.05] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
                </a>
              </div>
            </div>
          </>
        )}

        {/* Single-TX Model: Show one transaction */}
        {!hasTwoTxModel && mainSignature && (
          <div className="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-green-500/20">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              </div>
              <div>
                <p className="text-white/70 text-xs">Transaction</p>
                <code className="text-white/50 text-xs font-mono">{truncateSignature(mainSignature)}</code>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleCopy(mainSignature, 'main')}
                className="p-1.5 rounded hover:bg-white/[0.05] transition-colors"
              >
                {copiedTx === 'main' ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-white/40" />
                )}
              </button>
              <a
                href={getExplorerUrl(mainSignature)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded hover:bg-white/[0.05] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Privacy Info */}
      {showPrivacyInfo && hasTwoTxModel && (
        <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-blue-400 mt-0.5" />
            <div>
              <p className="text-blue-400/90 text-xs font-medium">Full Privacy Mode</p>
              <p className="text-blue-400/60 text-xs mt-1">
                Your identity is protected. The relayer paid the gas fees, hiding your wallet from the transaction.
                A small fee ({feeBreakdown ? (feeBreakdown.feePercentage * 100).toFixed(1) : '0.5'}%) was deducted to sustain the privacy service.
              </p>
            </div>
          </div>
        </div>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 bg-white/[0.05] hover:bg-white/[0.08] text-white/80 rounded-lg text-sm transition-colors"
        >
          Done
        </button>
      )}
    </div>
  );
}

export default TransactionResult;
