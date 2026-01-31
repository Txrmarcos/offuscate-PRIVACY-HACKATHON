/**
 * TransactionResult Component
 * Displays transaction results - clean and minimal.
 */

'use client';

import React from 'react';
import { Check, ExternalLink, Copy } from 'lucide-react';
import { useState } from 'react';
import type { FeeBreakdown } from '../lib/config/relayerFees';

interface TransactionResultProps {
  success: boolean;
  feeSignature?: string;
  transferSignature?: string;
  signature?: string;
  feeBreakdown?: FeeBreakdown;
  error?: string;
  failedStep?: 1 | 2;
  onClose?: () => void;
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
}: TransactionResultProps) {
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedTx(id);
    setTimeout(() => setCopiedTx(null), 2000);
  };

  const truncateSig = (sig: string) => `${sig.slice(0, 8)} ... ${sig.slice(-8)}`;
  const getUrl = (sig: string) => `${EXPLORER_BASE}/${sig}?cluster=${CLUSTER}`;

  const mainSignature = transferSignature || signature;
  const hasTwoTx = !!(feeSignature && transferSignature);

  // Error state
  if (!success) {
    return (
      <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.08]">
        <p className="text-white font-medium mb-1">Transfer Failed</p>
        <p className="text-white/50 text-sm">{error}</p>
        {failedStep && (
          <p className="text-white/30 text-xs mt-2">
            Step {failedStep} failed
          </p>
        )}
        {onClose && (
          <button onClick={onClose} className="mt-4 w-full py-2.5 bg-white/[0.05] text-white/60 rounded-lg text-sm hover:bg-white/[0.08] transition-colors">
            Close
          </button>
        )}
      </div>
    );
  }

  // Success state
  return (
    <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.08]">
      {/* Header */}
      <p className="text-white font-medium mb-4">Transfer Complete</p>

      {/* Fee Breakdown */}
      {feeBreakdown && (
        <div className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/40">Sent</span>
            <span className="text-white font-mono">{feeBreakdown.originalAmount.toFixed(4)} SOL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Fee (0.5%)</span>
            <span className="text-white/50 font-mono">-{feeBreakdown.feeAmount.toFixed(4)} SOL</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-white/[0.06]">
            <span className="text-white/60">Recipient gets</span>
            <span className="text-white font-mono">{feeBreakdown.recipientAmount.toFixed(4)} SOL</span>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="space-y-2">
        {hasTwoTx ? (
          <>
            <TxRow
              label="Fee TX"
              sig={feeSignature!}
              url={getUrl(feeSignature!)}
              truncated={truncateSig(feeSignature!)}
              onCopy={() => handleCopy(feeSignature!, 'fee')}
              copied={copiedTx === 'fee'}
            />
            <TxRow
              label="Transfer TX"
              sig={transferSignature!}
              url={getUrl(transferSignature!)}
              truncated={truncateSig(transferSignature!)}
              onCopy={() => handleCopy(transferSignature!, 'transfer')}
              copied={copiedTx === 'transfer'}
            />
          </>
        ) : mainSignature && (
          <TxRow
            label="Transaction"
            sig={mainSignature}
            url={getUrl(mainSignature)}
            truncated={truncateSig(mainSignature)}
            onCopy={() => handleCopy(mainSignature, 'main')}
            copied={copiedTx === 'main'}
          />
        )}
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 bg-white text-black font-medium rounded-lg text-sm hover:bg-white/90 transition-colors"
        >
          Done
        </button>
      )}
    </div>
  );
}

function TxRow({
  label,
  truncated,
  url,
  onCopy,
  copied,
}: {
  label: string;
  sig: string;
  truncated: string;
  url: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-white/40 text-xs">{label}</p>
        <code className="text-white/60 text-xs font-mono">{truncated}</code>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onCopy}
          className="p-1.5 rounded hover:bg-white/[0.05] transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-white/60" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
          )}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded hover:bg-white/[0.05] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
        </a>
      </div>
    </div>
  );
}

export default TransactionResult;
