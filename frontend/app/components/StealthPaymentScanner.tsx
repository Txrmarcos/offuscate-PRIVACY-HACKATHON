'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  Wallet,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  ArrowDownLeft,
  Plus,
  Copy,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { useStealth } from '../lib/stealth/StealthContext';
import {
  deriveStealthSpendingKey,
  isStealthAddressForUs,
  formatStealthMetaAddress,
  getStealthMetaAddress,
} from '../lib/stealth';
import bs58 from 'bs58';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

interface StealthPayment {
  signature: string;
  ephemeralPubKey: string;
  stealthAddress: PublicKey;
  balance: number;
  timestamp: number;
  claimed: boolean;
}

interface StealthPaymentScannerProps {
  salaryWalletKeypair?: Keypair | null;
}

export function StealthPaymentScanner({ salaryWalletKeypair }: StealthPaymentScannerProps) {
  const { connected, publicKey, signTransaction } = useWallet();
  const { stealthKeys } = useStealth();

  const [isScanning, setIsScanning] = useState(false);
  const [payments, setPayments] = useState<StealthPayment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
  const [claimDestination, setClaimDestination] = useState<'main' | 'salary'>('salary');
  const [hasScanned, setHasScanned] = useState(false);

  // Manual lookup state
  const [showManualLookup, setShowManualLookup] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [copiedMeta, setCopiedMeta] = useState(false);
  const [senderAddress, setSenderAddress] = useState('');
  const [isScanningStender, setIsScanningStender] = useState(false);

  // Get current meta address for display
  const myMetaAddress = stealthKeys ? formatStealthMetaAddress(getStealthMetaAddress(stealthKeys)) : null;

  // Scan a specific sender's wallet for stealth memos
  const scanSenderWallet = useCallback(async () => {
    if (!stealthKeys || !senderAddress.trim()) return;

    setIsScanningStender(true);
    setError(null);

    let newPaymentsCount = 0;

    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      let senderPubkey: PublicKey;

      try {
        senderPubkey = new PublicKey(senderAddress.trim());
      } catch {
        throw new Error('Invalid sender address');
      }

      console.log('Scanning sender wallet:', senderPubkey.toBase58());

      // Get recent transactions from sender
      const recentSigs = await connection.getSignaturesForAddress(senderPubkey, { limit: 50 });

      for (const sigInfo of recentSigs) {
        try {
          const tx = await connection.getParsedTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx) continue;

          // Check logs for stealth memo
          let ephemeralPubKey: string | null = null;

          if (tx.meta?.logMessages) {
            for (const log of tx.meta.logMessages) {
              const match = log.match(/stealth:([A-Za-z0-9]+)/);
              if (match) {
                ephemeralPubKey = match[1];
                break;
              }
            }
          }

          // Also check parsed instructions for memo
          if (!ephemeralPubKey && tx.transaction.message.instructions) {
            for (const ix of tx.transaction.message.instructions as any[]) {
              if (ix.parsed && typeof ix.parsed === 'string') {
                const match = ix.parsed.match(/stealth:([A-Za-z0-9]+)/);
                if (match) {
                  ephemeralPubKey = match[1];
                  break;
                }
              }
            }
          }

          if (ephemeralPubKey) {
            // Try to derive stealth address
            try {
              const stealthKeypair = deriveStealthSpendingKey(
                ephemeralPubKey,
                stealthKeys.viewKey.privateKey,
                stealthKeys.spendKey.publicKey
              );
              const stealthAddress = stealthKeypair.publicKey;

              // Check balance
              const balance = await connection.getBalance(stealthAddress);

              if (balance > 0) {
                // Found it!
                cacheEphemeralKey(sigInfo.signature, ephemeralPubKey, stealthAddress.toBase58(), tx.blockTime || 0);

                // Update UI immediately when payment is found
                setPayments(prev => {
                  if (prev.find(p => p.stealthAddress.equals(stealthAddress))) {
                    return prev;
                  }
                  newPaymentsCount++;
                  console.log('Found stealth payment from sender:', stealthAddress.toBase58());
                  return [...prev, {
                    signature: sigInfo.signature,
                    ephemeralPubKey,
                    stealthAddress,
                    balance: balance / LAMPORTS_PER_SOL,
                    timestamp: tx.blockTime || 0,
                    claimed: false,
                  }];
                });
              }
            } catch (e) {
              // Not for us
            }
          }
        } catch (e) {
          // Skip
        }
      }

      if (newPaymentsCount === 0) {
        setError('No new stealth payments found from this sender.');
      } else {
        setClaimSuccess(`Found ${newPaymentsCount} new stealth payment(s)!`);
        setSenderAddress('');
      }
    } catch (err: any) {
      console.error('Sender scan error:', err);
      setError(err.message || 'Failed to scan sender wallet');
    } finally {
      setIsScanningStender(false);
    }
  }, [stealthKeys, senderAddress]);

  // Scan for stealth payments - scans ALL recent memo transactions on devnet
  const scanForPayments = useCallback(async () => {
    if (!stealthKeys || !publicKey) return;

    setIsScanning(true);
    setError(null);
    setClaimSuccess(null);
    setPayments([]); // Clear previous payments

    let totalFound = 0;

    try {
      const connection = new Connection(RPC_URL, 'confirmed');

      console.log('Starting stealth payment scan...');

      // Helper to add payment and update UI immediately
      const addPaymentToUI = (payment: StealthPayment) => {
        setPayments(prev => {
          // Check if already exists
          if (prev.find(p => p.stealthAddress.equals(payment.stealthAddress))) {
            return prev;
          }
          totalFound++;
          console.log('Added payment to UI:', payment.stealthAddress.toBase58());
          return [...prev, payment];
        });
      };

      // 1. Process cached ephemeral keys first (fastest)
      const cachedEphemeralKeys = loadCachedEphemeralKeys();
      for (const cached of cachedEphemeralKeys) {
        try {
          const balance = await connection.getBalance(new PublicKey(cached.stealthAddress));
          if (balance > 0) {
            addPaymentToUI({
              signature: cached.signature,
              ephemeralPubKey: cached.ephemeralPubKey,
              stealthAddress: new PublicKey(cached.stealthAddress),
              balance: balance / LAMPORTS_PER_SOL,
              timestamp: cached.timestamp,
              claimed: false,
            });
          }
        } catch (e) {
          // Skip
        }
      }

      // 2. SCAN ALL RECENT MEMO TRANSACTIONS ON DEVNET
      // Get recent signatures from the Memo Program itself
      const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

      console.log('Scanning recent memo transactions on devnet...');

      try {
        const memoSigs = await connection.getSignaturesForAddress(MEMO_PROGRAM, { limit: 200 });
        console.log(`Found ${memoSigs.length} recent memo transactions`);

        for (const sigInfo of memoSigs) {
          try {
            const tx = await connection.getParsedTransaction(sigInfo.signature, {
              maxSupportedTransactionVersion: 0,
            });

            if (!tx) continue;

            // Check for stealth memo
            let ephemeralPubKey: string | null = null;

            // Check logs
            if (tx.meta?.logMessages) {
              for (const log of tx.meta.logMessages) {
                const match = log.match(/stealth:([A-Za-z0-9]+)/);
                if (match) {
                  ephemeralPubKey = match[1];
                  break;
                }
              }
            }

            // Check parsed instructions
            if (!ephemeralPubKey && tx.transaction.message.instructions) {
              for (const ix of tx.transaction.message.instructions as any[]) {
                if (ix.parsed && typeof ix.parsed === 'string') {
                  const match = ix.parsed.match(/stealth:([A-Za-z0-9]+)/);
                  if (match) {
                    ephemeralPubKey = match[1];
                    break;
                  }
                }
              }
            }

            if (ephemeralPubKey) {
              // Try to derive stealth address and check if it has balance
              try {
                const stealthKeypair = deriveStealthSpendingKey(
                  ephemeralPubKey,
                  stealthKeys.viewKey.privateKey,
                  stealthKeys.spendKey.publicKey
                );
                const stealthAddress = stealthKeypair.publicKey;

                const balance = await connection.getBalance(stealthAddress);

                if (balance > 0) {
                  // Found a payment for us!
                  console.log('Found stealth payment!', stealthAddress.toBase58(), balance / LAMPORTS_PER_SOL, 'SOL');

                  cacheEphemeralKey(sigInfo.signature, ephemeralPubKey, stealthAddress.toBase58(), tx.blockTime || 0);

                  // Update UI immediately when payment is found
                  addPaymentToUI({
                    signature: sigInfo.signature,
                    ephemeralPubKey,
                    stealthAddress,
                    balance: balance / LAMPORTS_PER_SOL,
                    timestamp: tx.blockTime || 0,
                    claimed: false,
                  });
                }
              } catch (e) {
                // Not for us - derivation failed or different keys
              }
            }
          } catch (e) {
            // Skip failed tx fetch
          }
        }
      } catch (e) {
        console.error('Error scanning memo program:', e);
      }

      if (totalFound === 0) {
        setError('No incoming stealth payments found.');
      } else {
        setClaimSuccess(`Found ${totalFound} stealth payment(s)!`);
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setError(err.message || 'Failed to scan for payments');
    } finally {
      setIsScanning(false);
    }
  }, [stealthKeys, publicKey]);

  // Auto-scan on mount
  useEffect(() => {
    if (stealthKeys && publicKey && !hasScanned && !isScanning) {
      setHasScanned(true);
      scanForPayments();
    }
  }, [stealthKeys, publicKey, hasScanned, isScanning, scanForPayments]);

  // Helper function to derive stealth address and add to found payments
  const tryDeriveAndAdd = async (
    ephemeralPubKey: string,
    signature: string,
    timestamp: number,
    foundPayments: StealthPayment[],
    connection: Connection
  ) => {
    if (!stealthKeys) return;

    try {
      // Derive the stealth address using our keys
      const stealthKeypair = deriveStealthSpendingKey(
        ephemeralPubKey,
        stealthKeys.viewKey.privateKey,
        stealthKeys.spendKey.publicKey
      );
      const stealthAddress = stealthKeypair.publicKey;

      // Check if this address has balance
      const balance = await connection.getBalance(stealthAddress);

      if (balance > 0) {
        // This is for us! Cache it
        cacheEphemeralKey(signature, ephemeralPubKey, stealthAddress.toBase58(), timestamp);

        // Check if not already in list
        if (!foundPayments.find(p => p.stealthAddress.equals(stealthAddress))) {
          foundPayments.push({
            signature,
            ephemeralPubKey,
            stealthAddress,
            balance: balance / LAMPORTS_PER_SOL,
            timestamp,
            claimed: false,
          });
          console.log('Found stealth payment:', stealthAddress.toBase58(), balance / LAMPORTS_PER_SOL, 'SOL');
        }
      }
    } catch (e) {
      // Not for us or invalid ephemeral key
    }
  };

  // Manual lookup by transaction signature or ephemeral key
  const manualLookup = useCallback(async () => {
    if (!stealthKeys || !publicKey || !manualInput.trim()) return;

    setIsLookingUp(true);
    setError(null);

    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      const input = manualInput.trim();

      // Check if input looks like a transaction signature (base58, ~88 chars)
      if (input.length > 60) {
        // Likely a transaction signature
        console.log('Looking up transaction:', input);

        const tx = await connection.getParsedTransaction(input, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx) {
          throw new Error('Transaction not found');
        }

        // Look for stealth memo in logs
        let ephemeralPubKey: string | null = null;

        if (tx.meta?.logMessages) {
          for (const log of tx.meta.logMessages) {
            const match = log.match(/stealth:([A-Za-z0-9]+)/);
            if (match) {
              ephemeralPubKey = match[1];
              break;
            }
          }
        }

        // Also check in parsed memo instructions
        if (!ephemeralPubKey && tx.transaction.message.instructions) {
          for (const ix of tx.transaction.message.instructions) {
            // Check parsed memo (for getParsedTransaction)
            if ('parsed' in ix && typeof ix.parsed === 'string') {
              const match = ix.parsed.match(/stealth:([A-Za-z0-9]+)/);
              if (match) {
                ephemeralPubKey = match[1];
                console.log('Found ephemeral key in parsed memo:', ephemeralPubKey);
                break;
              }
            }
            // Check raw data
            if ('data' in ix && typeof ix.data === 'string') {
              try {
                const decoded = Buffer.from(ix.data, 'base64').toString('utf-8');
                const match = decoded.match(/stealth:([A-Za-z0-9]+)/);
                if (match) {
                  ephemeralPubKey = match[1];
                  console.log('Found ephemeral key in raw data:', ephemeralPubKey);
                  break;
                }
              } catch {}
            }
          }
        }

        if (!ephemeralPubKey) {
          throw new Error('No stealth memo found in transaction. This may not be a stealth payment.');
        }

        console.log('Extracted ephemeral key:', ephemeralPubKey);

        // Now derive the stealth address and check balance
        await lookupWithEphemeralKey(ephemeralPubKey, input, tx.blockTime || 0);
      } else {
        // Likely an ephemeral public key
        console.log('Looking up with ephemeral key:', input);
        await lookupWithEphemeralKey(input, 'manual', Date.now() / 1000);
      }
    } catch (err: any) {
      console.error('Manual lookup error:', err);
      setError(err.message || 'Failed to lookup payment');
    } finally {
      setIsLookingUp(false);
    }
  }, [stealthKeys, publicKey, manualInput]);

  // Helper to derive stealth address from ephemeral key and check balance
  const lookupWithEphemeralKey = async (ephemeralPubKey: string, signature: string, timestamp: number) => {
    if (!stealthKeys) return;

    const connection = new Connection(RPC_URL, 'confirmed');

    // Use the library's deriveStealthSpendingKey which properly derives the stealth address
    const stealthKeypair = deriveStealthSpendingKey(
      ephemeralPubKey,
      stealthKeys.viewKey.privateKey,
      stealthKeys.spendKey.publicKey
    );
    const stealthAddress = stealthKeypair.publicKey;

    console.log('Derived stealth address:', stealthAddress.toBase58());
    console.log('Using ephemeral key:', ephemeralPubKey);

    // Check balance
    const balance = await connection.getBalance(stealthAddress);
    console.log('Balance:', balance / LAMPORTS_PER_SOL, 'SOL');

    if (balance > 0) {
      // Cache it
      cacheEphemeralKey(signature, ephemeralPubKey, stealthAddress.toBase58(), timestamp);

      // Add to payments list
      setPayments(prev => {
        const exists = prev.find(p => p.stealthAddress.equals(stealthAddress));
        if (exists) return prev;
        return [...prev, {
          signature,
          ephemeralPubKey,
          stealthAddress,
          balance: balance / LAMPORTS_PER_SOL,
          timestamp,
          claimed: false,
        }];
      });

      setManualInput('');
      setShowManualLookup(false);
      setClaimSuccess(`Found ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL at stealth address!`);
    } else {
      // Show derived address for debugging - this helps identify key mismatch
      setError(`Derived address: ${stealthAddress.toBase58()} has 0 balance. This may mean: 1) Funds already claimed, 2) Your stealth keys don't match the meta address used by sender. Check browser console for details.`);
      console.log('DEBUG - Derived stealth address:', stealthAddress.toBase58());
      console.log('DEBUG - Using view key (first 8):', bs58.encode(stealthKeys.viewKey.publicKey).slice(0, 8));
      console.log('DEBUG - Using spend key (first 8):', bs58.encode(stealthKeys.spendKey.publicKey).slice(0, 8));
    }
  };

  // Cache ephemeral keys for faster future lookups
  const cacheEphemeralKey = (signature: string, ephemeralPubKey: string, stealthAddress: string, timestamp: number) => {
    if (!publicKey) return;

    const key = `stealth_payments_${publicKey.toBase58()}`;
    const cached = localStorage.getItem(key);
    const payments: any[] = cached ? JSON.parse(cached) : [];

    // Check if already cached
    if (!payments.find(p => p.stealthAddress === stealthAddress)) {
      payments.push({ signature, ephemeralPubKey, stealthAddress, timestamp });
      localStorage.setItem(key, JSON.stringify(payments));
    }
  };

  // Load cached ephemeral keys
  const loadCachedEphemeralKeys = (): { signature: string; ephemeralPubKey: string; stealthAddress: string; timestamp: number }[] => {
    if (!publicKey) return [];

    const key = `stealth_payments_${publicKey.toBase58()}`;
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : [];
  };

  // Claim a stealth payment
  const claimPayment = async (payment: StealthPayment) => {
    if (!stealthKeys || !publicKey || !signTransaction) return;

    setClaimingId(payment.stealthAddress.toBase58());
    setClaimSuccess(null);
    setError(null);

    try {
      const connection = new Connection(RPC_URL, 'confirmed');

      // Derive the spending keypair for this stealth address
      const stealthKeypair = deriveStealthSpendingKey(
        payment.ephemeralPubKey,
        stealthKeys.viewKey.privateKey,
        stealthKeys.spendKey.publicKey
      );

      // Verify the keypair matches the stealth address
      if (!stealthKeypair.publicKey.equals(payment.stealthAddress)) {
        throw new Error('Derived keypair does not match stealth address');
      }

      // Get current balance
      const balance = await connection.getBalance(payment.stealthAddress);
      if (balance <= 0) {
        throw new Error('No balance to claim');
      }

      // Calculate amount to send (leave some for rent if needed, but for closing account send all)
      const rentExempt = await connection.getMinimumBalanceForRentExemption(0);
      const txFee = 5000; // Approximate transaction fee
      const amountToSend = balance - txFee;

      if (amountToSend <= 0) {
        throw new Error('Balance too low to cover transaction fee');
      }

      // Create transfer transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: stealthKeypair.publicKey,
      });

      // Determine destination wallet
      const destinationPubkey = claimDestination === 'salary' && salaryWalletKeypair
        ? salaryWalletKeypair.publicKey
        : publicKey;

      tx.add(
        SystemProgram.transfer({
          fromPubkey: stealthKeypair.publicKey,
          toPubkey: destinationPubkey,
          lamports: amountToSend,
        })
      );

      // Sign with stealth keypair
      tx.sign(stealthKeypair);

      // Send transaction
      const signature = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

      // Update payment as claimed
      setPayments(prev =>
        prev.map(p =>
          p.stealthAddress.equals(payment.stealthAddress)
            ? { ...p, claimed: true, balance: 0 }
            : p
        )
      );

      const destName = claimDestination === 'salary' && salaryWalletKeypair ? 'Salary Wallet' : 'Main Wallet';
      setClaimSuccess(`Claimed ${(amountToSend / LAMPORTS_PER_SOL).toFixed(6)} SOL to ${destName}!`);

      // Remove from cache
      if (publicKey) {
        const key = `stealth_payments_${publicKey.toBase58()}`;
        const cached = localStorage.getItem(key);
        if (cached) {
          const payments = JSON.parse(cached).filter(
            (p: any) => p.stealthAddress !== payment.stealthAddress.toBase58()
          );
          localStorage.setItem(key, JSON.stringify(payments));
        }
      }
    } catch (err: any) {
      console.error('Claim error:', err);
      setError(err.message || 'Failed to claim payment');
    } finally {
      setClaimingId(null);
    }
  };

  // Format date
  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!connected || !stealthKeys) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center">
            <ArrowDownLeft className="w-4 h-4 text-white/40" />
          </div>
          <div>
            <h3 className="text-white font-medium">Incoming Stealth Payments</h3>
            <p className="text-white/30 text-xs">Scan for private payments sent to you</p>
          </div>
        </div>

        <button
          onClick={scanForPayments}
          disabled={isScanning}
          className="h-9 px-4 bg-white/[0.05] text-white text-xs font-medium rounded-xl hover:bg-white/[0.08] transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {isScanning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
          {isScanning ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {/* Success Message */}
      {claimSuccess && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-white/[0.05] border border-white/[0.15] flex items-center gap-2 text-white text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{claimSuccess}</span>
        </div>
      )}

      {/* Claim Destination Selector */}
      {payments.length > 0 && payments.some(p => !p.claimed) && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-white/50 text-[10px] uppercase tracking-wider mb-2">Claim Destination</p>
          <div className="flex gap-2">
            <button
              onClick={() => setClaimDestination('salary')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                claimDestination === 'salary'
                  ? 'bg-white/[0.1] text-white border border-white/[0.2]'
                  : 'bg-white/[0.02] text-white/50 border border-white/[0.06] hover:bg-white/[0.05]'
              }`}
            >
              Salary Wallet
            </button>
            <button
              onClick={() => setClaimDestination('main')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                claimDestination === 'main'
                  ? 'bg-white/[0.1] text-white border border-white/[0.2]'
                  : 'bg-white/[0.02] text-white/50 border border-white/[0.06] hover:bg-white/[0.05]'
              }`}
            >
              Main Wallet
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-2 text-white/40 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Manual Lookup Section */}
      <div className="mx-5 mt-4">
        <button
          onClick={() => setShowManualLookup(!showManualLookup)}
          className="flex items-center gap-2 text-white/40 text-xs hover:text-white/60 transition-all"
        >
          <Plus className={`w-3.5 h-3.5 transition-transform ${showManualLookup ? 'rotate-45' : ''}`} />
          <span>Manual Lookup</span>
        </button>

        {showManualLookup && (
          <div className="mt-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            {/* Your Meta Address */}
            {myMetaAddress && (
              <div className="mb-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Your Stealth Meta Address</p>
                <div className="flex items-center gap-2">
                  <code className="text-[10px] text-white/60 font-mono flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {myMetaAddress}
                  </code>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(myMetaAddress);
                      setCopiedMeta(true);
                      setTimeout(() => setCopiedMeta(false), 2000);
                    }}
                    className="p-1 bg-white/[0.05] rounded hover:bg-white/[0.1] transition-all text-white/40 hover:text-white"
                  >
                    {copiedMeta ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <p className="text-white/30 text-[10px] mt-1">
                  Verify the sender used THIS address when sending. If different, funds went elsewhere.
                </p>
              </div>
            )}

            {/* Scan by sender wallet */}
            <div className="mb-4">
              <p className="text-white/50 text-[10px] uppercase tracking-wider mb-2">Scan Sender's Wallet</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={senderAddress}
                  onChange={(e) => setSenderAddress(e.target.value)}
                  placeholder="Sender's wallet address..."
                  className="flex-1 h-10 px-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-all font-mono"
                />
                <button
                  onClick={scanSenderWallet}
                  disabled={isScanningStender || !senderAddress.trim()}
                  className="h-10 px-5 bg-white/[0.08] text-white text-xs font-medium rounded-xl hover:bg-white/[0.12] transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isScanningStender ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  Scan
                </button>
              </div>
              <p className="text-white/30 text-[10px] mt-1">
                Enter the wallet address of who sent you the payment
              </p>
            </div>

            <div className="border-t border-white/[0.04] pt-4 mt-4">
              <p className="text-white/50 text-[10px] uppercase tracking-wider mb-2">Or lookup by TX signature</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Transaction signature..."
                  className="flex-1 h-10 px-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-all font-mono"
                />
                <button
                  onClick={manualLookup}
                  disabled={isLookingUp || !manualInput.trim()}
                  className="h-10 px-5 bg-white/[0.05] text-white text-xs font-medium rounded-xl hover:bg-white/[0.08] transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isLookingUp ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  Lookup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payments List */}
      <div className="p-5">
        {payments.length === 0 ? (
          <div className="py-8 text-center">
            <EyeOff className="w-10 h-10 mx-auto mb-3 text-white/10" />
            <p className="text-white/30 text-sm mb-1">No stealth payments found</p>
            <p className="text-white/20 text-xs">
              Click "Scan" to search for incoming private payments
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.stealthAddress.toBase58()}
                className={`p-4 rounded-xl border transition-all ${
                  payment.claimed
                    ? 'bg-white/[0.01] border-white/[0.03] opacity-60'
                    : 'bg-white/[0.02] border-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      payment.claimed ? 'bg-green-500/10' : 'bg-white/[0.04]'
                    }`}>
                      {payment.claimed ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Wallet className="w-4 h-4 text-white/40" />
                      )}
                    </div>
                    <div>
                      <p className="text-white font-mono text-sm">
                        {payment.balance.toFixed(6)} SOL
                      </p>
                      <p className="text-white/30 text-xs">
                        {formatDate(payment.timestamp)}
                      </p>
                    </div>
                  </div>

                  {payment.claimed ? (
                    <span className="px-2 py-1 text-[10px] font-medium rounded-md bg-green-400/10 text-green-400">
                      CLAIMED
                    </span>
                  ) : (
                    <button
                      onClick={() => claimPayment(payment)}
                      disabled={claimingId === payment.stealthAddress.toBase58()}
                      className="h-8 px-4 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {claimingId === payment.stealthAddress.toBase58() ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Wallet className="w-3 h-3" />
                      )}
                      Claim
                    </button>
                  )}
                </div>

                {/* Stealth address info */}
                <div className="p-2 rounded-lg bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-3 h-3 text-white/20" />
                    <span className="text-white/30 text-xs font-mono">
                      {payment.stealthAddress.toBase58().slice(0, 20)}...
                    </span>
                  </div>
                  <a
                    href={`https://explorer.solana.com/address/${payment.stealthAddress.toBase58()}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/20 hover:text-white/40 transition-all"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info footer */}
        <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <h4 className="text-white text-sm font-medium mb-2">How Stealth Payments Work</h4>
          <ul className="space-y-1.5 text-white/40 text-xs">
            <li className="flex items-start gap-2">
              <span className="text-white/30">1.</span>
              <span>Sender uses your stealth meta address to create a one-time address</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/30">2.</span>
              <span>Funds are sent to this unique stealth address</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/30">3.</span>
              <span>Only you can find and claim these payments using your keys</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/30">4.</span>
              <span>Click "Claim" to transfer funds to your main wallet</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
