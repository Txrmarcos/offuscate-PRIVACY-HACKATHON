'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Clock,
  TrendingUp,
  Loader2,
  Wallet,
  CheckCircle,
  AlertCircle,
  Building2,
  Calendar,
  Shield,
  Zap,
  Key,
  Send,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  EyeOff,
  Eye,
} from 'lucide-react';
import { ReceiptsCard } from '../components/ReceiptsCard';
import { StealthPaymentScanner } from '../components/StealthPaymentScanner';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useProgram } from '../lib/program';
import { LAMPORTS_PER_SOL, Keypair, Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import type { EmployeeData } from '../lib/program/client';
import { useStealth } from '../lib/stealth/StealthContext';
import { generateStealthAddress, parseStealthMetaAddress } from '../lib/stealth';
import { privateZKDonation, type LightWallet } from '../lib/privacy/lightProtocol';
import { triggerOffuscation } from '../components/WaveMeshBackground';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const MIN_BALANCE_FOR_ZK = 0.01; // SOL needed for ZK compression rent

// Circular progress component
function CircularProgress({
  percentage,
  size = 160,
  strokeWidth = 12,
  color = 'white',
  secondaryPercentage,
  secondaryColor = 'rgba(255,255,255,0.3)',
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  secondaryPercentage?: number;
  secondaryColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const secondaryOffset = secondaryPercentage !== undefined
    ? circumference - (secondaryPercentage / 100) * circumference
    : circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Secondary progress (offuscate wallet) */}
      {secondaryPercentage !== undefined && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={secondaryColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={secondaryOffset}
          className="transition-all duration-1000 ease-out"
        />
      )}
      {/* Primary progress (main wallet) */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

interface EmployeeRecord {
  batchIndex: number;
  employeeIndex: number;
  employee: EmployeeData;
}

export default function SalaryPage() {
  const { connected, publicKey, signTransaction, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const { stealthKeys, metaAddressString, deriveKeysFromWallet } = useStealth();
  const {
    findMyEmployeeRecord,
    findEmployeeByStealthPubkey,
    claimSalary,
    claimSalaryWithStealth,
    fetchBatch,
    fetchMasterVault,
  } = useProgram();

  const [record, setRecord] = useState<EmployeeRecord | null>(null);
  const [batchTitle, setBatchTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRecovery, setNeedsRecovery] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [potentialBatches, setPotentialBatches] = useState<number[]>([]);

  // Stealth keypair for streaming salary
  const [stealthKeypair, setStealthKeypair] = useState<Keypair | null>(null);
  const [usingStealth, setUsingStealth] = useState(false);

  // Wallet balances and dashboard state
  const [mainBalance, setMainBalance] = useState(0);
  const [offuscateBalance, setOffuscateBalance] = useState(0);
  const [privateKeypair, setPrivateKeypair] = useState<Keypair | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [refreshingBalances, setRefreshingBalances] = useState(false);

  // Wallet view state
  const [selectedWallet, setSelectedWallet] = useState<'all' | 'main' | 'offuscate'>('all');

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState('0.1');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientType, setRecipientType] = useState<'public' | 'stealth'>('stealth');
  const [sourceWallet, setSourceWallet] = useState<'main' | 'offuscate'>('main');
  const [useZK, setUseZK] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [sentEphemeralKey, setSentEphemeralKey] = useState<string | null>(null);

  // Live time for real-time accrued salary
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate deterministic private keypair for Offuscate wallet
  useEffect(() => {
    const generateKeypair = async () => {
      if (!publicKey) return;
      try {
        const { createHash } = await import('crypto');
        const seed = createHash('sha256')
          .update(publicKey.toBuffer())
          .update('privacy_pool_stealth_v1')
          .digest();
        const keypair = Keypair.fromSeed(seed.slice(0, 32));
        setPrivateKeypair(keypair);
      } catch (err) {
        console.error('Failed to derive private keypair:', err);
      }
    };
    generateKeypair();
  }, [publicKey]);

  // Fetch wallet balances
  const refreshBalances = useCallback(async () => {
    if (!publicKey) return;
    setRefreshingBalances(true);

    const connection = new Connection(RPC_URL, 'confirmed');

    try {
      const balance = await connection.getBalance(publicKey);
      setMainBalance(balance / LAMPORTS_PER_SOL);
    } catch {}

    // Use stealthKeypair (salary wallet) if in stealth mode, otherwise use privateKeypair
    const offuscateKey = stealthKeypair || privateKeypair;
    if (offuscateKey) {
      try {
        const balance = await connection.getBalance(offuscateKey.publicKey);
        setOffuscateBalance(balance / LAMPORTS_PER_SOL);
      } catch {}
    }

    setRefreshingBalances(false);
  }, [publicKey, privateKeypair, stealthKeypair]);

  // Load balances on mount and when keypair changes
  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  // Load stealth keypairs from localStorage
  const loadStealthKeypairs = useCallback((): Keypair[] => {
    if (!publicKey) return [];

    const key = `stealth_keypairs_${publicKey.toBase58()}`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];

    try {
      const keypairs: Record<string, string> = JSON.parse(stored);
      return Object.values(keypairs).map((secretKeyBase58) =>
        Keypair.fromSecretKey(bs58.decode(secretKeyBase58))
      );
    } catch {
      return [];
    }
  }, [publicKey]);

  // Derive SECURE stealth keypair using wallet signature
  // Only the wallet owner can derive this (requires signing)
  const deriveStealthKeypair = useCallback(async (batchIndex: number): Promise<Keypair> => {
    if (!publicKey || !signMessage) throw new Error('No wallet connected');

    // Create the same deterministic message as in invite page
    const message = new TextEncoder().encode(
      `Offuscate Salary Keypair Derivation\nBatch: ${batchIndex}\nWallet: ${publicKey.toBase58()}`
    );

    // Sign the message - only wallet owner can do this
    const signature = await signMessage(message);

    // Derive keypair from signature hash
    const { createHash } = await import('crypto');
    const seed = createHash('sha256')
      .update(Buffer.from(signature))
      .digest();

    return Keypair.fromSeed(seed.slice(0, 32));
  }, [publicKey, signMessage]);

  // Load employee record - first try stealth keypairs, then derive deterministically
  const loadRecord = useCallback(async () => {
    if (!connected || !publicKey) {
      setRecord(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // First, try to find employee using stealth keypairs from localStorage
      const stealthKeypairs = loadStealthKeypairs();

      for (const keypair of stealthKeypairs) {
        const stealthRecord = await findEmployeeByStealthPubkey(keypair.publicKey);
        if (stealthRecord) {
          setRecord(stealthRecord);
          setStealthKeypair(keypair);
          setUsingStealth(true);

          const batch = await fetchBatch(stealthRecord.batchIndex);
          if (batch) {
            setBatchTitle(batch.title);
          }
          setIsLoading(false);
          return;
        }
      }

      // Second, check if there are batches that might have our employee record
      // We'll need a signature to derive the keypair (for privacy)
      console.log('[Salary] localStorage empty, checking for potential batches...');
      const masterVault = await fetchMasterVault();
      if (masterVault && masterVault.batchCount > 0) {
        // Store potential batches - user will need to sign to recover
        const batches: number[] = [];
        for (let i = 0; i < masterVault.batchCount; i++) {
          batches.push(i);
        }
        setPotentialBatches(batches);
        setNeedsRecovery(true);
        setIsLoading(false);
        return;
      }

      // Fallback: try to find with connected wallet (non-stealth flow)
      const myRecord = await findMyEmployeeRecord();
      setRecord(myRecord);
      setUsingStealth(false);
      setStealthKeypair(null);

      if (myRecord) {
        const batch = await fetchBatch(myRecord.batchIndex);
        if (batch) {
          setBatchTitle(batch.title);
        }
      }
    } catch (err) {
      console.error('Failed to load employee record:', err);
    } finally {
      setIsLoading(false);
    }
  }, [connected, publicKey, findMyEmployeeRecord, findEmployeeByStealthPubkey, fetchBatch, loadStealthKeypairs, deriveStealthKeypair, fetchMasterVault]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  // Calculate accrued salary in real-time
  const calculateAccrued = useCallback(() => {
    if (!record || record.employee.status !== 'Active') return 0;
    const elapsed = now - record.employee.lastClaimedAt;
    return (record.employee.salaryRate * elapsed) / LAMPORTS_PER_SOL;
  }, [record, now]);

  // Calculate monthly salary
  const monthlySalary = useCallback(() => {
    if (!record) return 0;
    return (record.employee.salaryRate * 30 * 24 * 60 * 60) / LAMPORTS_PER_SOL;
  }, [record]);

  // Calculate salary per second for display
  const salaryPerSecond = useCallback(() => {
    if (!record) return 0;
    return record.employee.salaryRate / LAMPORTS_PER_SOL;
  }, [record]);

  // Calculate daily salary
  const dailySalary = useCallback(() => {
    if (!record) return 0;
    return (record.employee.salaryRate * 24 * 60 * 60) / LAMPORTS_PER_SOL;
  }, [record]);

  // Recovery function - tries to derive keypair using wallet signature
  const handleRecovery = async () => {
    if (!publicKey || !signMessage || potentialBatches.length === 0) return;

    setIsRecovering(true);
    setError(null);

    try {
      for (const batchIndex of potentialBatches) {
        try {
          console.log('[Salary] Trying to recover keypair for batch', batchIndex);
          const derivedKeypair = await deriveStealthKeypair(batchIndex);
          const stealthRecord = await findEmployeeByStealthPubkey(derivedKeypair.publicKey);

          if (stealthRecord) {
            console.log('[Salary] Found employee via derived keypair for batch', batchIndex);
            setRecord(stealthRecord);
            setStealthKeypair(derivedKeypair);
            setUsingStealth(true);
            setNeedsRecovery(false);

            // Save to localStorage for future use
            const key = `stealth_keypairs_${publicKey.toBase58()}`;
            const keypairs: Record<string, string> = {};
            keypairs[`batch_${batchIndex}`] = bs58.encode(derivedKeypair.secretKey);
            localStorage.setItem(key, JSON.stringify(keypairs));

            const batch = await fetchBatch(stealthRecord.batchIndex);
            if (batch) {
              setBatchTitle(batch.title);
            }
            setIsRecovering(false);
            return;
          }
        } catch (e) {
          console.log('[Salary] No match for batch', batchIndex);
          // Continue to next batch
        }
      }

      // No match found
      setNeedsRecovery(false);
      setError('No salary record found for this wallet. You may need to accept a new invite.');
    } catch (err: any) {
      console.error('[Salary] Recovery failed:', err);
      setError(err.message || 'Recovery failed. Please try again.');
    } finally {
      setIsRecovering(false);
    }
  };

  // Handle claim
  const handleClaim = async () => {
    if (!record) return;

    setIsClaiming(true);
    setError(null);
    setClaimSuccess(false);

    try {
      if (usingStealth && stealthKeypair) {
        // Use stealth keypair for privacy-preserving claim
        await claimSalaryWithStealth(
          record.batchIndex,
          record.employeeIndex,
          stealthKeypair
        );
      } else {
        // Fallback to regular claim (non-stealth flow)
        await claimSalary(record.batchIndex, record.employeeIndex);
      }
      setClaimSuccess(true);
      // Reload to get updated totals
      await loadRecord();
      setTimeout(() => setClaimSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to claim salary:', err);

      // Extract error message from various error formats
      let errMsg = 'Failed to claim salary';

      if (err.logs) {
        // Anchor error with logs
        const errorLog = err.logs.find((log: string) =>
          log.includes('Error') || log.includes('failed') || log.includes('custom program error')
        );
        if (errorLog) errMsg = errorLog;
        console.error('Transaction logs:', err.logs);
      } else if (err.message) {
        errMsg = err.message;
      } else if (typeof err === 'string') {
        errMsg = err;
      }

      // Also log the full error object for debugging
      console.error('Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));

      // Check for InsufficientFunds error
      if (errMsg.includes('InsufficientFunds') || errMsg.includes('insufficient funds') || errMsg.includes('0x1')) {
        setError('Batch vault has insufficient funds. Please contact your employer to fund the payroll batch.');
      } else if (errMsg.includes('Unauthorized') || errMsg.includes('0x1770')) {
        setError('Unauthorized: Your wallet does not match the employee record.');
      } else if (errMsg.includes('simulation failed') || errMsg.includes('Simulation')) {
        setError('Transaction simulation failed. Please check if your stealth keypair matches the employee record.');
      } else {
        setError(errMsg);
      }
    } finally {
      setIsClaiming(false);
    }
  };

  // Format time elapsed
  const formatTimeElapsed = () => {
    if (!record) return '';
    const elapsed = now - record.employee.lastClaimedAt;
    const days = Math.floor(elapsed / 86400);
    const hours = Math.floor((elapsed % 86400) / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Format start date
  const formatStartDate = () => {
    if (!record) return '';
    return new Date(record.employee.startTime * 1000).toLocaleDateString();
  };

  // Copy to clipboard
  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Handle transfer
  const handleTransfer = async () => {
    if (!publicKey || !signTransaction) {
      setVisible(true);
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setTransferError('Invalid amount');
      return;
    }

    if (!recipientAddress) {
      setTransferError('Enter recipient address');
      return;
    }

    const sourceBalance = sourceWallet === 'offuscate' ? offuscateBalance : mainBalance;
    if (amount > sourceBalance) {
      setTransferError('Insufficient balance');
      return;
    }

    setIsTransferring(true);
    setTransferError(null);
    setTransferSuccess(null);
    setTxSignature(null);
    setSentEphemeralKey(null);

    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      // Use stealthKeypair (salary wallet) if available, otherwise privateKeypair
      const offuscateKey = stealthKeypair || privateKeypair;
      const senderKeypair = sourceWallet === 'offuscate' ? offuscateKey : null;
      const senderPubkey = sourceWallet === 'offuscate' ? offuscateKey!.publicKey : publicKey;

      if (recipientType === 'stealth') {
        // Parse stealth meta address
        let stealthMeta;
        try {
          stealthMeta = parseStealthMetaAddress(recipientAddress);
        } catch {
          throw new Error('Invalid stealth address format. Expected: st:<viewPubKey>:<spendPubKey>');
        }

        // Generate one-time stealth address
        const { stealthAddress, ephemeralPubKey } = generateStealthAddress(stealthMeta);

        if (useZK) {
          // MAXIMUM PRIVACY: ZK + Stealth
          const lightWallet: LightWallet = {
            publicKey: sourceWallet === 'offuscate' ? offuscateKey!.publicKey : publicKey,
            signTransaction: sourceWallet === 'offuscate'
              ? async <T extends VersionedTransaction>(tx: T): Promise<T> => {
                  tx.sign([offuscateKey!]);
                  return tx;
                }
              : signTransaction as any,
          };

          // ZK transfer to stealth address
          const result = await privateZKDonation(lightWallet, stealthAddress, amount);

          if (!result.success) {
            throw new Error(result.error || 'ZK payment failed');
          }

          // Send memo with ephemeral pubkey in separate transaction
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          const memoTx = new Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: senderPubkey,
          });

          const memoData = `stealth:${ephemeralPubKey}`;
          memoTx.add(
            new TransactionInstruction({
              keys: [],
              programId: MEMO_PROGRAM_ID,
              data: Buffer.from(memoData, 'utf-8'),
            })
          );

          // Sign and send memo
          let memoSignature: string;
          if (sourceWallet === 'offuscate' && senderKeypair) {
            memoTx.sign(senderKeypair);
            memoSignature = await connection.sendRawTransaction(memoTx.serialize());
          } else {
            const signedMemoTx = await signTransaction(memoTx);
            memoSignature = await connection.sendRawTransaction(signedMemoTx.serialize());
          }

          // Wait for memo to confirm
          await connection.confirmTransaction({ signature: memoSignature, blockhash, lastValidBlockHeight });

          // IMPORTANT: For ZK+Stealth, the memo tx has the ephemeral key - that's what recipient needs!
          setTxSignature(memoSignature);
          setSentEphemeralKey(ephemeralPubKey);
          setTransferSuccess(`Sent ${amount} SOL with MAXIMUM PRIVACY (sender, recipient & amount hidden!)`);
          triggerOffuscation();
        } else {
          // Stealth only (no ZK) - amount visible
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          const tx = new Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: senderPubkey,
          });

          // Transfer to stealth address
          tx.add(
            SystemProgram.transfer({
              fromPubkey: senderPubkey,
              toPubkey: stealthAddress,
              lamports: Math.floor(amount * LAMPORTS_PER_SOL),
            })
          );

          // Add memo with ephemeral public key so recipient can find and claim
          const memoData = `stealth:${ephemeralPubKey}`;
          tx.add(
            new TransactionInstruction({
              keys: [],
              programId: MEMO_PROGRAM_ID,
              data: Buffer.from(memoData, 'utf-8'),
            })
          );

          let signature: string;
          if (sourceWallet === 'offuscate' && senderKeypair) {
            tx.sign(senderKeypair);
            signature = await connection.sendRawTransaction(tx.serialize());
          } else {
            const signedTx = await signTransaction(tx);
            signature = await connection.sendRawTransaction(signedTx.serialize());
          }

          await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

          setTxSignature(signature);
          setSentEphemeralKey(ephemeralPubKey);
          setTransferSuccess(`Sent ${amount} SOL to stealth address (recipient hidden!)`);
          triggerOffuscation();
        }
      } else {
        // Public address
        let recipient: PublicKey;
        try {
          recipient = new PublicKey(recipientAddress);
        } catch {
          throw new Error('Invalid recipient address');
        }

        if (useZK) {
          // ZK compressed transfer - hides sender and amount
          const lightWallet: LightWallet = {
            publicKey: sourceWallet === 'offuscate' ? offuscateKey!.publicKey : publicKey,
            signTransaction: sourceWallet === 'offuscate'
              ? async <T extends VersionedTransaction>(tx: T): Promise<T> => {
                  tx.sign([offuscateKey!]);
                  return tx;
                }
              : signTransaction as any,
          };

          const result = await privateZKDonation(lightWallet, recipient, amount);

          if (!result.success) {
            throw new Error(result.error || 'ZK payment failed');
          }

          setTxSignature(result.signature!);
          setTransferSuccess(`Sent ${amount} SOL with ZK privacy (sender & amount hidden)`);
          triggerOffuscation();
        } else {
          // Direct transfer
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          const tx = new Transaction({
            blockhash,
            lastValidBlockHeight,
            feePayer: senderPubkey,
          });

          tx.add(
            SystemProgram.transfer({
              fromPubkey: senderPubkey,
              toPubkey: recipient,
              lamports: Math.floor(amount * LAMPORTS_PER_SOL),
            })
          );

          let signature: string;
          if (sourceWallet === 'offuscate' && senderKeypair) {
            tx.sign(senderKeypair);
            signature = await connection.sendRawTransaction(tx.serialize());
          } else {
            const signedTx = await signTransaction(tx);
            signature = await connection.sendRawTransaction(signedTx.serialize());
          }

          await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

          setTxSignature(signature);
          setTransferSuccess(`Sent ${amount} SOL`);
        }
      }

      setRecipientAddress('');
      setTransferAmount('0.1');
      await refreshBalances();
    } catch (err: any) {
      const errMsg = err.message || err.toString() || '';

      // Check for insufficient funds errors
      if (errMsg.includes('insufficient lamports') || errMsg.includes('0x1') || errMsg.includes('insufficient funds')) {
        if (useZK) {
          // ZK transfers need extra for compression rent
          setTransferError(`Insufficient SOL for ZK transfer. ZK compression requires ~0.01 SOL minimum in your wallet. Current balance may be too low.`);
        } else {
          setTransferError('Insufficient balance for this transfer.');
        }
      } else if (errMsg.includes('compress') || errMsg.includes('Compress')) {
        setTransferError(`ZK compression failed: Not enough SOL. You need at least 0.01 SOL for ZK transfers.`);
      } else {
        setTransferError(err.message || 'Transfer failed');
      }
    } finally {
      setIsTransferring(false);
    }
  };

  // Not connected state
  if (!connected) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <DollarSign className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Your Salary</h1>
          <p className="text-white/40 text-lg mb-3">
            View and claim your streaming salary in real-time.
          </p>
          <p className="text-white/25 text-sm mb-8">
            Connect your wallet to access your salary dashboard.
          </p>
          <button
            onClick={() => setVisible(true)}
            className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all flex items-center gap-2 mx-auto"
          >
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white/40 mx-auto mb-4" />
          <p className="text-white/40">Loading your salary...</p>
        </div>
      </div>
    );
  }

  // Recovery mode - localStorage cleared but might have salary
  if (needsRecovery && !record) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <Key className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Recover Salary Access</h1>
          <p className="text-white/40 text-lg mb-3">
            Your local data was cleared, but we can recover your salary access.
          </p>
          <p className="text-white/25 text-sm mb-8">
            Sign a message with your wallet to securely re-derive your salary keypair.
          </p>
          <button
            onClick={handleRecovery}
            disabled={isRecovering}
            className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
          >
            {isRecovering ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Recovering...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Sign to Recover
              </>
            )}
          </button>
          {error && (
            <p className="text-red-400 text-sm mt-4">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // No employee record found
  if (!record) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <Building2 className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">No Salary Found</h1>
          <p className="text-white/40 text-lg mb-3">
            You don't have an active salary stream.
          </p>
          <p className="text-white/25 text-sm">
            Ask your employer to add you to a payroll batch.
          </p>
        </div>
      </div>
    );
  }

  const accrued = calculateAccrued();
  const isActive = record.employee.status === 'Active';

  return (
    <div className="min-h-screen px-6 py-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-white/40 text-sm mb-1">{batchTitle || 'Payroll'}</p>
            <h1 className="text-3xl font-bold text-white">Salary Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTransfer(!showTransfer)}
              className={`h-11 px-5 text-sm font-medium rounded-2xl transition-all flex items-center gap-2 ${
                showTransfer
                  ? 'bg-white text-black'
                  : 'bg-white/[0.03] border border-white/[0.06] text-white hover:bg-white/[0.05]'
              }`}
            >
              <Send className="w-4 h-4" />
              Send Payment
            </button>
            <button
              onClick={refreshBalances}
              disabled={refreshingBalances}
              className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.05] transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${refreshingBalances ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Transfer Panel */}
        {showTransfer && (
          <div className="mb-8 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
            <h3 className="text-white font-medium mb-4">Send Payment</h3>

            {/* Source Wallet Selection */}
            <div className="mb-4">
              <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-2">
                From Wallet
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSourceWallet('main')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    sourceWallet === 'main'
                      ? 'bg-white/[0.05] border-white/[0.15]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-white/40" />
                    <span className="text-white font-medium text-sm">Main Wallet</span>
                  </div>
                  <p className="text-white font-mono">{mainBalance.toFixed(4)} SOL</p>
                </button>
                <button
                  onClick={() => setSourceWallet('offuscate')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    sourceWallet === 'offuscate'
                      ? 'bg-white/[0.05] border-white/[0.15]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <EyeOff className="w-4 h-4 text-white/40" />
                    <span className="text-white font-medium text-sm">{usingStealth ? 'Salary Wallet' : 'Offuscate Wallet'}</span>
                  </div>
                  <p className="text-white font-mono">{offuscateBalance.toFixed(4)} SOL</p>
                </button>
              </div>
            </div>

            {/* Recipient Type */}
            <div className="mb-4">
              <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-2">
                Recipient Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setRecipientType('stealth');
                    setRecipientAddress('');
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    recipientType === 'stealth'
                      ? 'bg-white/[0.05] border-white/[0.15]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                  }`}
                >
                  <EyeOff className={`w-5 h-5 mb-2 ${recipientType === 'stealth' ? 'text-white' : 'text-white/30'}`} />
                  <p className="text-white font-medium text-sm">Stealth Address</p>
                  <p className="text-white/40 text-xs">Recipient hidden on-chain</p>
                </button>
                <button
                  onClick={() => {
                    setRecipientType('public');
                    setRecipientAddress('');
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    recipientType === 'public'
                      ? 'bg-white/[0.05] border-white/[0.15]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                  }`}
                >
                  <Eye className={`w-5 h-5 mb-2 ${recipientType === 'public' ? 'text-white' : 'text-white/30'}`} />
                  <p className="text-white font-medium text-sm">Public Address</p>
                  <p className="text-white/40 text-xs">Recipient visible on-chain</p>
                </button>
              </div>
            </div>

            {/* Recipient Address */}
            <div className="mb-4">
              <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-2">
                {recipientType === 'stealth' ? 'Stealth Meta Address' : 'Recipient Address'}
              </label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder={recipientType === 'stealth'
                  ? 'st:viewPubKey:spendPubKey...'
                  : 'Enter Solana address...'}
                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-white/[0.15] transition-colors"
              />
              {recipientType === 'stealth' && (
                <p className="text-white/30 text-xs mt-2">
                  Ask the recipient for their stealth meta address (format: st:viewPubKey:spendPubKey)
                </p>
              )}
            </div>

            {/* Amount */}
            <div className="mb-4">
              <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-2">
                Amount (SOL)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.001"
                  className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-lg font-mono focus:border-white/[0.15] transition-colors"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                  {['0.1', '0.5', '1'].map((val) => (
                    <button
                      key={val}
                      onClick={() => setTransferAmount(val)}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                        transferAmount === val
                          ? 'bg-white text-black'
                          : 'bg-white/[0.05] text-white/40 hover:text-white'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ZK Toggle */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] text-white/30 uppercase tracking-widest">
                  ZK Compression (Hide Sender & Amount)
                </label>
                {(sourceWallet === 'offuscate' ? offuscateBalance : mainBalance) < MIN_BALANCE_FOR_ZK && (
                  <span className="text-[10px] text-white/30">
                    Need {MIN_BALANCE_FOR_ZK} SOL
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  const balance = sourceWallet === 'offuscate' ? offuscateBalance : mainBalance;
                  if (balance >= MIN_BALANCE_FOR_ZK) {
                    setUseZK(!useZK);
                  }
                }}
                disabled={(sourceWallet === 'offuscate' ? offuscateBalance : mainBalance) < MIN_BALANCE_FOR_ZK}
                title={(sourceWallet === 'offuscate' ? offuscateBalance : mainBalance) < MIN_BALANCE_FOR_ZK ? `Need at least ${MIN_BALANCE_FOR_ZK} SOL for ZK compression` : ''}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
                  useZK
                    ? 'bg-white/[0.08] border-white/[0.2]'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                } ${(sourceWallet === 'offuscate' ? offuscateBalance : mainBalance) < MIN_BALANCE_FOR_ZK ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className={`w-5 h-5 ${useZK ? 'text-white' : 'text-white/30'}`} />
                    <div>
                      <p className="text-white font-medium text-sm">
                        {useZK ? 'ZK Enabled' : 'ZK Disabled'}
                      </p>
                      <p className="text-white/40 text-xs">
                        {useZK
                          ? 'Sender & Amount hidden via ZK proof'
                          : 'Sender & Amount visible on-chain'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-all ${
                    useZK ? 'bg-white' : 'bg-white/20'
                  }`}>
                    <div className={`w-4 h-4 mt-1 rounded-full transition-all ${
                      useZK ? 'ml-5 bg-black' : 'ml-1 bg-white'
                    }`} />
                  </div>
                </div>
              </button>
            </div>

            {/* Privacy Summary */}
            <div className={`mb-6 p-4 rounded-xl border transition-all ${
              recipientType === 'stealth' && useZK
                ? 'bg-white/[0.05] border-white/[0.15]'
                : 'bg-white/[0.02] border-white/[0.06]'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <Shield className={`w-5 h-5 ${
                  recipientType === 'stealth' && useZK
                    ? 'text-white'
                    : (sourceWallet === 'offuscate' || useZK) && (recipientType === 'stealth' || useZK)
                    ? 'text-white/70'
                    : 'text-white/40'
                }`} />
                <span className="text-white font-medium text-sm">Privacy Summary</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Sender</span>
                  <span className={
                    sourceWallet === 'offuscate' || useZK
                      ? 'text-white'
                      : 'text-white/30'
                  }>
                    {useZK
                      ? '✓ Hidden (ZK Proof)'
                      : sourceWallet === 'offuscate'
                      ? '✓ Hidden (Offuscate Wallet)'
                      : '✗ Visible'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Recipient</span>
                  <span className={recipientType === 'stealth' ? 'text-white' : 'text-white/30'}>
                    {recipientType === 'stealth'
                      ? '✓ Hidden (Stealth Address)'
                      : '✗ Visible'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40">Amount</span>
                  <span className={useZK ? 'text-white' : 'text-white/30'}>
                    {useZK
                      ? '✓ Hidden (ZK Compressed)'
                      : '✗ Visible'}
                  </span>
                </div>
              </div>

              {/* Privacy Score */}
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                {recipientType === 'stealth' && useZK ? (
                  <p className="text-white text-xs font-medium">
                    MAXIMUM PRIVACY - Sender, Recipient & Amount ALL hidden!
                  </p>
                ) : (sourceWallet === 'offuscate' || useZK) && recipientType === 'stealth' ? (
                  <p className="text-white/70 text-xs font-medium">
                    High Privacy - Sender & Recipient hidden (enable ZK for amount)
                  </p>
                ) : useZK ? (
                  <p className="text-white/70 text-xs font-medium">
                    High Privacy - Sender & Amount hidden (use Stealth for recipient)
                  </p>
                ) : (
                  <p className="text-white/40 text-xs">
                    Enable ZK and/or Stealth Address for better privacy
                  </p>
                )}
              </div>
            </div>

            {/* Pay button */}
            <button
              onClick={handleTransfer}
              disabled={isTransferring || !recipientAddress || parseFloat(transferAmount) <= 0}
              className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isTransferring ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {recipientType === 'stealth'
                    ? 'Generating Stealth Address...'
                    : useZK
                    ? 'Creating ZK Proof...'
                    : 'Processing...'}
                </>
              ) : (
                <>
                  {recipientType === 'stealth' || useZK ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send {transferAmount} SOL
                  {recipientType === 'stealth' || useZK ? ' Privately' : ''}
                </>
              )}
            </button>

            {/* Messages */}
            {transferError && (
              <div className="mt-4 p-3 bg-white/[0.03] border border-white/[0.1] rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-white/60" />
                <p className="text-white/60 text-sm">{transferError}</p>
              </div>
            )}

            {transferSuccess && (
              <div className="mt-4 p-3 bg-white/[0.05] border border-white/[0.15] rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-white" />
                  <p className="text-white text-sm">{transferSuccess}</p>
                </div>
                {txSignature && (
                  <a
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1 mb-2"
                  >
                    View transaction <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {sentEphemeralKey && (
                  <div className="mt-2 pt-2 border-t border-white/[0.06]">
                    <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Share with recipient to claim:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-white/70 bg-white/[0.05] px-2 py-1 rounded font-mono flex-1 overflow-hidden text-ellipsis">
                        {txSignature?.slice(0, 30)}...
                      </code>
                      <button
                        onClick={() => handleCopy(txSignature || '', 'tx')}
                        className="p-1.5 bg-white/[0.05] rounded hover:bg-white/[0.1] transition-all text-white/50 hover:text-white"
                        title="Copy transaction signature"
                      >
                        {copied === 'tx' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-white/30 text-[10px] mt-1">
                      Recipient needs this TX signature to find their stealth payment
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Total Balance Card with Chart */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08]">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-white/40 text-sm mb-1">
                  {selectedWallet === 'all' ? 'Total Balance' : selectedWallet === 'main' ? 'Main Wallet' : 'Offuscate Wallet'}
                </p>
                <h2 className="text-4xl font-bold text-white">
                  {(selectedWallet === 'main' ? mainBalance : selectedWallet === 'offuscate' ? offuscateBalance : mainBalance + offuscateBalance).toFixed(4)}
                  <span className="text-lg text-white/40 ml-2">SOL</span>
                </h2>
              </div>
              <button
                onClick={() => setSelectedWallet('all')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                  selectedWallet === 'all' ? 'bg-white/[0.08] border border-white/[0.15]' : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05]'
                }`}
              >
                <TrendingUp className={`w-3.5 h-3.5 ${selectedWallet === 'all' ? 'text-white' : 'text-white/40'}`} />
                <span className={`text-xs font-medium ${selectedWallet === 'all' ? 'text-white' : 'text-white/40'}`}>View All</span>
              </button>
            </div>

            <div className="flex items-center gap-8">
              {/* Circular Chart */}
              <div className="relative">
                <CircularProgress
                  percentage={selectedWallet === 'offuscate' ? 0 : (mainBalance + offuscateBalance === 0 ? 50 : selectedWallet === 'main' ? 100 : (mainBalance / (mainBalance + offuscateBalance)) * 100)}
                  secondaryPercentage={selectedWallet === 'main' ? undefined : (selectedWallet === 'offuscate' ? 100 : 100)}
                  size={160}
                  strokeWidth={14}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {selectedWallet === 'main' ? <Wallet className="w-6 h-6 text-white/60 mb-1" /> : selectedWallet === 'offuscate' ? <EyeOff className="w-6 h-6 text-white/40 mb-1" /> : <DollarSign className="w-6 h-6 text-white/40 mb-1" />}
                  <span className="text-xs text-white/30">{selectedWallet === 'all' ? 'Total' : selectedWallet === 'main' ? 'Main' : 'Offuscate'}</span>
                </div>
              </div>

              {/* Wallet Cards */}
              <div className="flex-1 space-y-4">
                <button
                  onClick={() => setSelectedWallet(selectedWallet === 'main' ? 'all' : 'main')}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${selectedWallet === 'main' ? 'bg-white/[0.08] ring-2 ring-white/20' : 'bg-white/[0.03] hover:bg-white/[0.05]'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${selectedWallet === 'main' ? 'bg-white' : 'bg-white/60'}`} />
                    <div className="text-left">
                      <p className="text-white font-medium">Main Wallet</p>
                      <p className="text-white/40 text-xs font-mono">{publicKey?.toBase58().slice(0, 8)}...</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="text-white font-mono">{mainBalance.toFixed(4)}</p>
                      <p className="text-white/30 text-xs">SOL</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleCopy(publicKey?.toBase58() || '', 'main'); }} className="text-white/30 hover:text-white/60 p-1">
                      {copied === 'main' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedWallet(selectedWallet === 'offuscate' ? 'all' : 'offuscate')}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${selectedWallet === 'offuscate' ? 'bg-white/[0.08] ring-2 ring-white/20' : 'bg-white/[0.03] hover:bg-white/[0.05]'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${selectedWallet === 'offuscate' ? 'bg-white/60' : 'bg-white/30'}`} />
                    <div className="text-left">
                      <p className="text-white font-medium">{usingStealth ? 'Salary Wallet' : 'Offuscate Wallet'}</p>
                      <p className="text-white/40 text-xs font-mono">
                        {(stealthKeypair || privateKeypair)?.publicKey.toBase58().slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="text-white font-mono">{offuscateBalance.toFixed(4)}</p>
                      <p className="text-white/30 text-xs">SOL</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleCopy((stealthKeypair || privateKeypair)?.publicKey.toBase58() || '', 'private'); }} className="text-white/30 hover:text-white/60 p-1">
                      {copied === 'private' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Salary Streaming Card - Compact */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.1]">
            <div className="flex items-center gap-2 mb-4">
              {isActive && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
              <span className="text-[10px] text-white/40 uppercase tracking-widest">{isActive ? 'Streaming' : record.employee.status}</span>
            </div>

            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Available to Claim</p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-mono font-bold text-white tabular-nums">{accrued.toFixed(6)}</span>
              <span className="text-sm text-white/40">SOL</span>
            </div>

            <div className="flex items-center gap-2 text-white/40 text-xs mb-4">
              <Clock className="w-3 h-3" />
              <span>{formatTimeElapsed()}</span>
            </div>

            {error && (
              <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}

            {claimSuccess && (
              <div className="mb-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-green-400 text-xs">
                <CheckCircle className="w-3 h-3" />
                <span>Claimed!</span>
              </div>
            )}

            <button
              onClick={handleClaim}
              disabled={isClaiming || accrued <= 0 || !isActive}
              className="w-full h-11 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {isClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              {isClaiming ? 'Claiming...' : `Claim ${accrued.toFixed(4)} SOL`}
            </button>
          </div>
        </div>

        {/* Your Stealth Address - Easy Copy Card */}
        <div className="mb-8 p-5 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.1]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
                <Key className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <h3 className="text-white font-medium">Your Stealth Address</h3>
                <p className="text-white/30 text-xs">Share this to receive private payments</p>
              </div>
            </div>
            {!metaAddressString && (
              <button
                onClick={async () => {
                  try {
                    await deriveKeysFromWallet();
                  } catch (e) {
                    console.error('Failed to derive stealth keys:', e);
                  }
                }}
                className="h-9 px-4 bg-white/[0.08] text-white text-sm font-medium rounded-xl hover:bg-white/[0.12] transition-all flex items-center gap-2"
              >
                <Key className="w-4 h-4" />
                Generate
              </button>
            )}
          </div>

          {metaAddressString ? (
            <div className="space-y-3">
              {/* Stealth Meta Address with Copy */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-black/20 border border-white/[0.08]">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Stealth Meta Address</p>
                  <p className="text-white font-mono text-sm break-all">
                    {metaAddressString}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(metaAddressString, 'stealth-meta')}
                  className="flex-shrink-0 h-10 w-10 bg-white text-black rounded-xl hover:bg-white/90 transition-all flex items-center justify-center"
                  title="Copy stealth address"
                >
                  {copied === 'stealth-meta' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              {/* Helper text */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02]">
                <EyeOff className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" />
                <p className="text-white/40 text-xs">
                  Share this address with anyone who wants to send you private payments. They can use it to generate a one-time stealth address that only you can claim.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.1] text-center">
              <EyeOff className="w-8 h-8 mx-auto mb-2 text-white/20" />
              <p className="text-white/40 text-sm mb-1">No stealth address yet</p>
              <p className="text-white/25 text-xs">Click Generate to create your stealth address</p>
            </div>
          )}
        </div>

        {/* Stats Grid - Compact */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-white/30" />
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Monthly</span>
            </div>
            <p className="text-2xl font-bold text-white">{monthlySalary().toFixed(2)}<span className="text-sm text-white/30 ml-1">SOL</span></p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-white/30" />
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Claimed</span>
            </div>
            <p className="text-2xl font-bold text-white">{(record.employee.totalClaimed / LAMPORTS_PER_SOL).toFixed(4)}<span className="text-sm text-white/30 ml-1">SOL</span></p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-white/30" />
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Started</span>
            </div>
            <p className="text-xl font-bold text-white">{formatStartDate()}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 mb-2">
              {usingStealth ? <Key className="w-4 h-4 text-green-400" /> : <Shield className="w-4 h-4 text-white/30" />}
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Privacy</span>
            </div>
            <p className="text-sm font-medium text-white">{usingStealth ? 'Stealth Mode' : 'Standard'}</p>
          </div>
        </div>

        {/* Incoming Stealth Payments Scanner */}
        <div className="mt-6">
          <StealthPaymentScanner salaryWalletKeypair={stealthKeypair || privateKeypair} />
        </div>

        {/* Anonymous Receipts */}
        <div className="mt-6">
          <ReceiptsCard
            employeeRecord={record ? { batchIndex: record.batchIndex, employeeIndex: record.employeeIndex } : null}
            stealthKeypair={stealthKeypair}
            salaryWalletBalance={offuscateBalance}
          />
        </div>
      </div>
    </div>
  );
}
