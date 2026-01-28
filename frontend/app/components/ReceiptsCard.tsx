'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Shield,
  CheckCircle,
  Copy,
  Download,
  Loader2,
  Eye,
  EyeOff,
  Clock,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProgram } from '../lib/program';
import { PublicKey, Keypair } from '@solana/web3.js';

interface Receipt {
  pubkey: PublicKey;
  receipt: {
    employee: PublicKey;
    batch: PublicKey;
    employer: PublicKey;
    commitment: Uint8Array;
    timestamp: number;
    receiptIndex: number;
  };
}

interface StoredSecret {
  receiptPda: string;
  secret: string;
  timestamp: number;
}

const MIN_BALANCE_FOR_RECEIPT = 0.005; // SOL needed for rent + tx fee

interface ReceiptsCardProps {
  employeeRecord?: {
    batchIndex: number;
    employeeIndex: number;
  } | null;
  stealthKeypair?: Keypair | null;
  salaryWalletBalance?: number; // SOL balance
}

export function ReceiptsCard({ employeeRecord, stealthKeypair, salaryWalletBalance = 0 }: ReceiptsCardProps) {
  const canCreateReceipt = salaryWalletBalance >= MIN_BALANCE_FOR_RECEIPT;
  const { connected, publicKey } = useWallet();
  const { listMyReceipts, createReceipt, createReceiptWithStealth, findMyEmployeeRecord, verifyReceiptBlind } = useProgram();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storedSecrets, setStoredSecrets] = useState<StoredSecret[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, boolean>>({});

  // Load receipts
  const loadReceipts = useCallback(async () => {
    if (!connected || !publicKey) return;

    setIsLoading(true);
    try {
      // Use stealth pubkey if available (for stealth mode receipts)
      const filterWallet = stealthKeypair?.publicKey;
      const myReceipts = await listMyReceipts(filterWallet);
      setReceipts(myReceipts);

      // Load stored secrets from localStorage
      const secretsKey = `receipts_secrets_${publicKey.toBase58()}`;
      const stored = localStorage.getItem(secretsKey);
      if (stored) {
        setStoredSecrets(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load receipts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [connected, publicKey, stealthKeypair, listMyReceipts]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  // Create a new receipt
  const handleCreateReceipt = async () => {
    if (!publicKey) return;

    setIsCreating(true);
    setError(null);
    setCreateSuccess(false);

    try {
      // Use passed employee record or find it
      let record = employeeRecord;
      if (!record) {
        record = await findMyEmployeeRecord();
      }
      if (!record) {
        throw new Error('No employee record found');
      }

      // Create receipt - use stealth version if keypair is provided
      let result: { signature: string; secret: Uint8Array };
      if (stealthKeypair) {
        result = await createReceiptWithStealth(record.batchIndex, record.employeeIndex, stealthKeypair);
      } else {
        result = await createReceipt(record.batchIndex, record.employeeIndex);
      }
      const { signature, secret } = result;

      // Store secret in localStorage
      const secretsKey = `receipts_secrets_${publicKey.toBase58()}`;
      const stored = localStorage.getItem(secretsKey);
      const secrets: StoredSecret[] = stored ? JSON.parse(stored) : [];

      // We'll update with actual receiptPda after reload
      secrets.push({
        receiptPda: signature, // Temporary, will be updated
        secret: Buffer.from(secret).toString('hex'),
        timestamp: Math.floor(Date.now() / 1000),
      });

      localStorage.setItem(secretsKey, JSON.stringify(secrets));

      setCreateSuccess(true);
      await loadReceipts();
      setTimeout(() => setCreateSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to create receipt:', err);

      // Check for insufficient funds error
      const errMsg = err.message || err.toString() || '';
      if (errMsg.includes('insufficient lamports') || errMsg.includes('0x1') || errMsg.includes('insufficient funds') || errMsg.includes('rent')) {
        setError(`Insufficient SOL in Salary Wallet. You need at least ${MIN_BALANCE_FOR_RECEIPT} SOL to create a receipt. Transfer some SOL to your Salary Wallet first.`);
      } else {
        setError(err.message || 'Failed to create receipt');
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Toggle secret visibility
  const toggleSecret = (receiptPda: string) => {
    setShowSecrets((prev) => ({
      ...prev,
      [receiptPda]: !prev[receiptPda],
    }));
  };

  // Copy receipt ID to clipboard
  const copyReceiptId = async (receiptPda: string) => {
    try {
      await navigator.clipboard.writeText(receiptPda);
    } catch {
      // Fallback
    }
  };

  // Export receipt for sharing
  const exportReceipt = (receipt: Receipt) => {
    const data = {
      receiptId: receipt.pubkey.toBase58(),
      employee: receipt.receipt.employee.toBase58(),
      employer: receipt.receipt.employer.toBase58(),
      timestamp: receipt.receipt.timestamp,
      date: new Date(receipt.receipt.timestamp * 1000).toISOString(),
      // Note: secret is NOT included - employee shares this separately
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${receipt.pubkey.toBase58().slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Verify a receipt
  const handleVerify = async (receipt: Receipt) => {
    if (!publicKey) return;

    setVerifying(receipt.pubkey.toBase58());

    try {
      await verifyReceiptBlind(receipt.pubkey, receipt.receipt.employee);
      setVerifyResult((prev) => ({
        ...prev,
        [receipt.pubkey.toBase58()]: true,
      }));
    } catch (err) {
      console.error('Verification failed:', err);
      setVerifyResult((prev) => ({
        ...prev,
        [receipt.pubkey.toBase58()]: false,
      }));
    } finally {
      setVerifying(null);
    }
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!connected || isLoading) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center">
            <FileText className="w-4 h-4 text-white/40" />
          </div>
          <div>
            <h3 className="text-white font-medium">Anonymous Receipts</h3>
            <p className="text-white/30 text-xs">Proof of payment without revealing amount</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!canCreateReceipt && (
            <span className="text-white/30 text-[10px]">
              Need {MIN_BALANCE_FOR_RECEIPT} SOL
            </span>
          )}
          <button
            onClick={handleCreateReceipt}
            disabled={isCreating || !canCreateReceipt}
            title={!canCreateReceipt ? `Need at least ${MIN_BALANCE_FOR_RECEIPT} SOL in Salary Wallet` : ''}
            className="h-9 px-4 bg-white/[0.05] text-white text-xs font-medium rounded-xl hover:bg-white/[0.08] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isCreating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            Create Receipt
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {createSuccess && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>Receipt created! Store the secret safely for future verification.</span>
        </div>
      )}

      {error && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Receipts List */}
      <div className="p-5">
        {receipts.length === 0 ? (
          <div className="py-8 text-center">
            <Shield className="w-10 h-10 mx-auto mb-3 text-white/10" />
            <p className="text-white/30 text-sm mb-1">No receipts yet</p>
            <p className="text-white/20 text-xs">
              Create a receipt after claiming salary to prove payment
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <div
                key={receipt.pubkey.toBase58()}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                      <FileText className="w-4 h-4 text-white/30" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-mono">
                        {receipt.pubkey.toBase58().slice(0, 16)}...
                      </p>
                      <div className="flex items-center gap-2 text-white/30 text-xs">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(receipt.receipt.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {verifyResult[receipt.pubkey.toBase58()] !== undefined && (
                      <span
                        className={`px-2 py-1 text-[10px] font-medium rounded-md ${
                          verifyResult[receipt.pubkey.toBase58()]
                            ? 'bg-green-400/10 text-green-400'
                            : 'bg-red-400/10 text-red-400'
                        }`}
                      >
                        {verifyResult[receipt.pubkey.toBase58()] ? 'VERIFIED' : 'FAILED'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Employer info */}
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-white/[0.02]">
                  <Building2 className="w-3.5 h-3.5 text-white/30" />
                  <span className="text-white/40 text-xs">Employer:</span>
                  <span className="text-white/60 text-xs font-mono">
                    {receipt.receipt.employer.toBase58().slice(0, 16)}...
                  </span>
                </div>

                {/* Privacy notice */}
                <div className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] mb-3">
                  <EyeOff className="w-3.5 h-3.5 text-white/30 mt-0.5 flex-shrink-0" />
                  <p className="text-white/30 text-xs">
                    Amount is hidden. This receipt proves you received payment without revealing how
                    much.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyReceiptId(receipt.pubkey.toBase58())}
                    className="h-8 px-3 bg-white/[0.04] text-white/60 text-xs font-medium rounded-lg hover:bg-white/[0.06] transition-all flex items-center gap-1.5"
                  >
                    <Copy className="w-3 h-3" />
                    Copy ID
                  </button>
                  <button
                    onClick={() => exportReceipt(receipt)}
                    className="h-8 px-3 bg-white/[0.04] text-white/60 text-xs font-medium rounded-lg hover:bg-white/[0.06] transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </button>
                  <button
                    onClick={() => handleVerify(receipt)}
                    disabled={verifying === receipt.pubkey.toBase58()}
                    className="h-8 px-3 bg-white/[0.04] text-white/60 text-xs font-medium rounded-lg hover:bg-white/[0.06] transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {verifying === receipt.pubkey.toBase58() ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3 h-3" />
                    )}
                    Verify
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info footer */}
        <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <h4 className="text-white text-sm font-medium mb-2">How Anonymous Receipts Work</h4>
          <ul className="space-y-1.5 text-white/40 text-xs">
            <li className="flex items-start gap-2">
              <span className="text-white/30">1.</span>
              <span>After claiming salary, create a receipt</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/30">2.</span>
              <span>Share the receipt ID to prove you received payment</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/30">3.</span>
              <span>The amount stays hidden - only you can reveal it</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/30">4.</span>
              <span>Perfect for bank loans, visas, or proving employment</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
