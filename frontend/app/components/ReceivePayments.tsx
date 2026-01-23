'use client';

import { useState, useCallback } from 'react';
import { X, Search, Download, ExternalLink, Check, Loader2 } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { useStealth } from '../lib/stealth/StealthContext';
import {
  isStealthAddressForUs,
  deriveStealthSpendingKey,
} from '../lib/stealth';

interface StealthPayment {
  signature: string;
  stealthAddress: string;
  ephemeralPubKey: string;
  amount: number;
  timestamp: number;
  canSpend: boolean;
}

interface ReceivePaymentsProps {
  isOpen: boolean;
  onClose: () => void;
}

// Devnet RPC
const DEVNET_RPC = 'https://api.devnet.solana.com';
const devnetConnection = new Connection(DEVNET_RPC, 'confirmed');

// Memo program ID
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

export function ReceivePayments({ isOpen, onClose }: ReceivePaymentsProps) {
  const { publicKey, signTransaction } = useWallet();
  const { stealthKeys, metaAddressString } = useStealth();

  const [isScanning, setIsScanning] = useState(false);
  const [payments, setPayments] = useState<StealthPayment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Look up a specific transaction by signature
  const lookupTransaction = useCallback(async () => {
    if (!stealthKeys) {
      setError('Please set up your stealth keys first');
      return;
    }

    if (!txSignature.trim()) {
      setError('Please enter a transaction signature');
      return;
    }

    setIsLookingUp(true);
    setError(null);

    try {
      const tx = await devnetConnection.getTransaction(txSignature.trim(), {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx?.meta || !tx.transaction.message) {
        throw new Error('Transaction not found or invalid');
      }

      // Look for memo instruction with stealth data
      const accountKeys = tx.transaction.message.staticAccountKeys ||
                         (tx.transaction.message as any).accountKeys || [];


      let found = false;

      // Find memo instruction
      for (const instruction of (tx.transaction.message as any).instructions || []) {
        const programId = accountKeys[instruction.programIdIndex]?.toBase58();

        if (programId === MEMO_PROGRAM_ID && instruction.data) {
          try {
            // Decode memo data (Solana uses base58 encoding for instruction data)
            const memoBytes = bs58.decode(instruction.data);
            const memoData = new TextDecoder().decode(memoBytes);
            const parsed = JSON.parse(memoData);

            if (parsed.type === 'stealth' && parsed.ephemeralPubKey) {
              // Check each account in post balances to find the stealth address
              for (let i = 0; i < accountKeys.length; i++) {
                const address = accountKeys[i];
                const preBalance = tx.meta.preBalances[i] || 0;
                const postBalance = tx.meta.postBalances[i] || 0;
                const received = postBalance - preBalance;

                if (received > 0) {
                  // Check if this stealth address is for us
                  const isOurs = isStealthAddressForUs(
                    address,
                    parsed.ephemeralPubKey,
                    stealthKeys.viewKey.privateKey,
                    stealthKeys.spendKey.publicKey
                  );

                  if (isOurs) {
                    found = true;
                    // Get current balance of stealth address
                    const currentBalance = await devnetConnection.getBalance(address);

                    // Add to payments if not already there
                    setPayments(prev => {
                      const exists = prev.some(p => p.signature === txSignature.trim());
                      if (exists) return prev;
                      return [...prev, {
                        signature: txSignature.trim(),
                        stealthAddress: address.toBase58(),
                        ephemeralPubKey: parsed.ephemeralPubKey,
                        amount: currentBalance / LAMPORTS_PER_SOL,
                        timestamp: tx.blockTime || 0,
                        canSpend: currentBalance > 0,
                      }];
                    });
                  }
                }
              }
            }
          } catch (memoErr) {
            console.error('DEBUG lookup: memo parse error:', memoErr);
          }
        }
      }

      if (!found) {
        setError('This transaction is not a stealth payment for you');
      } else {
        setTxSignature(''); // Clear input on success
      }
    } catch (err) {
      console.error('Lookup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to look up transaction');
    } finally {
      setIsLookingUp(false);
    }
  }, [stealthKeys, txSignature]);

  // Scan blockchain for stealth payments
  const scanForPayments = useCallback(async () => {
    if (!stealthKeys) {
      setError('Please set up your stealth keys first');
      return;
    }

    setIsScanning(true);
    setError(null);
    setPayments([]);

    try {
      // Get recent transactions that used the Memo program
      const signatures = await devnetConnection.getSignaturesForAddress(
        new PublicKey(MEMO_PROGRAM_ID),
        { limit: 20 } // Reduced to avoid rate limits
      );

      const foundPayments: StealthPayment[] = [];
      let errorCount = 0;
      const maxErrors = 5;

      for (const sig of signatures) {
        if (errorCount >= maxErrors) break;

        try {
          const tx = await devnetConnection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx?.meta || !tx.transaction.message) continue;

          const accountKeys = tx.transaction.message.staticAccountKeys ||
                             (tx.transaction.message as any).accountKeys || [];

          // Find memo instruction
          for (const instruction of (tx.transaction.message as any).instructions || []) {
            const programId = accountKeys[instruction.programIdIndex]?.toBase58();

            if (programId === MEMO_PROGRAM_ID && instruction.data) {
              try {
                // Decode memo data (base58)
                const memoBytes = bs58.decode(instruction.data);
                const memoData = new TextDecoder().decode(memoBytes);
                const parsed = JSON.parse(memoData);

                if (parsed.type === 'stealth' && parsed.ephemeralPubKey) {
                  // Check each account that received funds
                  for (let i = 0; i < accountKeys.length; i++) {
                    const address = accountKeys[i];
                    const preBalance = tx.meta.preBalances[i] || 0;
                    const postBalance = tx.meta.postBalances[i] || 0;
                    const received = postBalance - preBalance;

                    if (received > 0) {
                      // Check if this stealth address is for us
                      const isOurs = isStealthAddressForUs(
                        address,
                        parsed.ephemeralPubKey,
                        stealthKeys.viewKey.privateKey,
                        stealthKeys.spendKey.publicKey
                      );

                      if (isOurs) {
                        // Get current balance
                        const currentBalance = await devnetConnection.getBalance(address);

                        // Avoid duplicates
                        if (!foundPayments.some(p => p.signature === sig.signature)) {
                          foundPayments.push({
                            signature: sig.signature,
                            stealthAddress: address.toBase58(),
                            ephemeralPubKey: parsed.ephemeralPubKey,
                            amount: currentBalance / LAMPORTS_PER_SOL,
                            timestamp: sig.blockTime || 0,
                            canSpend: currentBalance > 0,
                          });
                        }
                      }
                    }
                  }
                }
              } catch {
                // Not a valid stealth memo, skip
              }
            }
          }
        } catch {
          errorCount++;
        }
      }

      setPayments(foundPayments);

      if (foundPayments.length === 0) {
        setError('No stealth payments found. Ask someone to send you a payment!');
      }
    } catch (err) {
      console.error('Scan error:', err);
      setError(err instanceof Error ? err.message : 'Failed to scan for payments');
    } finally {
      setIsScanning(false);
    }
  }, [stealthKeys]);

  // Withdraw funds from stealth address
  const withdrawFunds = useCallback(async (payment: StealthPayment) => {
    if (!stealthKeys || !publicKey || !signTransaction) {
      setError('Wallet not connected');
      return;
    }

    setWithdrawing(payment.stealthAddress);
    setError(null);

    try {
      // Derive the spending keypair for this stealth address
      const stealthKeypair = deriveStealthSpendingKey(
        payment.ephemeralPubKey,
        stealthKeys.viewKey.privateKey,
        stealthKeys.spendKey.publicKey
      );

      // Verify the derived address matches
      if (stealthKeypair.publicKey.toBase58() !== payment.stealthAddress) {
        throw new Error('Derived address does not match stealth address');
      }

      // Get balance and calculate amount to send (minus fees)
      const balance = await devnetConnection.getBalance(stealthKeypair.publicKey);
      const fee = 5000; // 0.000005 SOL for fees
      const amountToSend = balance - fee;

      if (amountToSend <= 0) {
        throw new Error('Insufficient balance for fees');
      }

      // Create transaction to send funds to main wallet
      const { Transaction, SystemProgram } = await import('@solana/web3.js');
      const transaction = new Transaction();

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: stealthKeypair.publicKey,
          toPubkey: publicKey,
          lamports: amountToSend,
        })
      );

      // Get blockhash
      const { blockhash, lastValidBlockHeight } = await devnetConnection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = stealthKeypair.publicKey;

      // Sign with stealth keypair (not wallet!)
      transaction.sign(stealthKeypair);

      // Send transaction
      const signature = await devnetConnection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: true,
      });

      // Confirm
      await devnetConnection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      setWithdrawSuccess(signature);

      // Update payment status
      setPayments(prev => prev.map(p =>
        p.stealthAddress === payment.stealthAddress
          ? { ...p, amount: 0, canSpend: false }
          : p
      ));
    } catch (err) {
      console.error('Withdraw error:', err);
      setError(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setWithdrawing(null);
    }
  }, [stealthKeys, publicKey, signTransaction]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#141414] border border-[#262626] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#737373] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold text-white mb-2">Receive Stealth Payments</h2>
        <p className="text-sm text-gray-400 mb-6">
          Scan the blockchain for payments sent to your stealth addresses.
        </p>

        {/* Stealth Meta Address */}
        {metaAddressString && (
          <div className="mb-6 p-3 bg-[#0a0a0a] rounded-lg border border-[#262626]">
            <div className="text-xs text-gray-500 mb-1">Your Stealth Meta Address</div>
            <div className="font-mono text-xs text-purple-400 break-all">
              {metaAddressString}
            </div>
          </div>
        )}

        {/* Manual Transaction Lookup */}
        <div className="mb-6">
          <label className="text-sm text-gray-400 mb-2 block">
            Transaction Signature (from payment you received)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={txSignature}
              onChange={(e) => setTxSignature(e.target.value)}
              placeholder="Paste transaction signature..."
              className="flex-1 bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={lookupTransaction}
              disabled={isLookingUp || !stealthKeys || !txSignature.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
            >
              {isLookingUp ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Cole a assinatura da transação que você recebeu para verificar se é seu
          </p>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#262626]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-[#141414] text-gray-500">ou</span>
          </div>
        </div>

        {/* Scan Button */}
        <button
          onClick={scanForPayments}
          disabled={isScanning || !stealthKeys}
          className="w-full py-3 mb-6 bg-[#262626] hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-full transition-colors flex items-center justify-center gap-2"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning recent transactions...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Scan Recent Transactions
            </>
          )}
        </button>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {withdrawSuccess && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-400 mb-2">Withdrawal successful!</p>
            <a
              href={`https://explorer.solana.com/tx/${withdrawSuccess}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
            >
              View on Explorer <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Payments List */}
        {payments.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white">Found Payments</h3>
            {payments.map((payment) => (
              <div
                key={payment.signature}
                className="p-4 bg-[#0a0a0a] border border-[#262626] rounded-xl"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-semibold text-white">
                    {payment.amount.toFixed(4)} SOL
                  </span>
                  {payment.canSpend ? (
                    <button
                      onClick={() => withdrawFunds(payment)}
                      disabled={withdrawing === payment.stealthAddress}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-full flex items-center gap-1"
                    >
                      {withdrawing === payment.stealthAddress ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      Withdraw
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 bg-gray-600 text-gray-300 text-sm rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Claimed
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-500 mb-1">Stealth Address</div>
                <div className="font-mono text-xs text-gray-400 mb-2 break-all">
                  {payment.stealthAddress}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {payment.timestamp ? new Date(payment.timestamp * 1000).toLocaleString() : 'Unknown time'}
                  </span>
                  <a
                    href={`https://explorer.solana.com/tx/${payment.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    View tx <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isScanning && payments.length === 0 && !error && (
          <div className="text-center py-8 text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Click "Scan for Payments" to find your stealth payments</p>
          </div>
        )}
      </div>
    </div>
  );
}
