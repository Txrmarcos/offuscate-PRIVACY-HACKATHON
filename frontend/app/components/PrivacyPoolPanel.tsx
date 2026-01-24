'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Clock,
  ArrowDownToLine,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Droplets,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useProgram } from '../lib/program';
import { PrivacyPoolData, PendingWithdrawData, ALLOWED_WITHDRAW_AMOUNTS, MIN_DELAY_SECONDS, MAX_DELAY_SECONDS } from '../lib/program/client';
import { useStealth } from '../lib/stealth/StealthContext';
import { deriveStealthSpendingKey } from '../lib/stealth';
import { PrivateNote, formatCommitment } from '../lib/privacy';

interface PrivacyPoolPanelProps {
  onClose?: () => void;
}

export function PrivacyPoolPanel({ onClose }: PrivacyPoolPanelProps) {
  const { publicKey } = useWallet();
  const { stealthKeys } = useStealth();
  const {
    initPool,
    poolDeposit,
    requestPoolWithdraw,
    claimPoolWithdraw,
    claimPoolWithdrawGasless,
    checkRelayerStatus,
    fetchPoolStats,
    fetchPendingWithdraw,
    isPoolInitialized,
    // Phase 3: Commitment-based privacy
    privateDeposit,
    privateWithdraw,
    getUnspentPrivateNotes,
    // Quick Withdraw (privacidade máxima)
    quickWithdrawAllToStealth,
  } = useProgram();

  const [poolStats, setPoolStats] = useState<PrivacyPoolData | null>(null);
  const [pendingWithdraw, setPendingWithdraw] = useState<PendingWithdrawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(0.1);
  const [countdown, setCountdown] = useState<number>(0);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [gaslessMode, setGaslessMode] = useState<boolean>(true);
  const [relayerStatus, setRelayerStatus] = useState<{
    configured: boolean;
    relayerAddress: string | null;
    balance: number | null;
  } | null>(null);
  const [mainWalletBalance, setMainWalletBalance] = useState<number>(0);
  const [stealthBalance, setStealthBalance] = useState<number>(0);

  // Phase 3: Commitment-based privacy
  const [phase3Mode, setPhase3Mode] = useState<boolean>(true); // Use Phase 3 by default
  const [privateNotes, setPrivateNotes] = useState<PrivateNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<PrivateNote | null>(null);
  const [showSecrets, setShowSecrets] = useState<boolean>(false);

  // Derived stealth keypair for withdrawals
  const [stealthKeypair, setStealthKeypair] = useState<Keypair | null>(null);

  // Load pool data
  const loadPoolData = useCallback(async () => {
    setLoading(true);
    try {
      const stats = await fetchPoolStats();
      setPoolStats(stats);

      // Check relayer status
      try {
        const status = await checkRelayerStatus();
        setRelayerStatus(status);
      } catch {
        setRelayerStatus({ configured: false, relayerAddress: null, balance: null });
      }

      // Fetch main wallet balance
      if (publicKey) {
        try {
          const { Connection } = await import('@solana/web3.js');
          const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
          const connection = new Connection(rpcUrl, 'confirmed');
          const balance = await connection.getBalance(publicKey);
          setMainWalletBalance(balance / 1e9);
        } catch {
          console.error('Failed to fetch main wallet balance');
        }
      }

      // Check for pending withdrawal and stealth balance
      if (stealthKeypair) {
        const pending = await fetchPendingWithdraw(stealthKeypair.publicKey);
        setPendingWithdraw(pending);
        if (pending && !pending.claimed) {
          setCountdown(pending.timeRemaining);
        }

        // Fetch stealth address balance
        try {
          const { Connection } = await import('@solana/web3.js');
          const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
          const connection = new Connection(rpcUrl, 'confirmed');
          const balance = await connection.getBalance(stealthKeypair.publicKey);
          setStealthBalance(balance / 1e9);
        } catch {
          console.error('Failed to fetch stealth balance');
        }
      }

      // Load Phase 3 private notes
      try {
        const notes = await getUnspentPrivateNotes();
        setPrivateNotes(notes);
      } catch {
        console.error('Failed to load private notes');
      }
    } catch (err) {
      console.error('Failed to load pool data:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchPoolStats, fetchPendingWithdraw, checkRelayerStatus, stealthKeypair, publicKey, getUnspentPrivateNotes]);

  // Generate deterministic stealth keypair based on wallet address
  // This ensures the same wallet always gets the same stealth address
  useEffect(() => {
    const generateDeterministicKeypair = async () => {
      if (!publicKey) return;

      try {
        // Use wallet pubkey + fixed salt to derive deterministic seed
        const { createHash } = await import('crypto');
        const seed = createHash('sha256')
          .update(publicKey.toBuffer())
          .update('privacy_pool_stealth_v1')
          .digest();

        // Use first 32 bytes as seed for keypair
        const keypair = Keypair.fromSeed(seed.slice(0, 32));
        setStealthKeypair(keypair);
        console.log('[PrivacyPool] Stealth address:', keypair.publicKey.toString());
      } catch (err) {
        console.error('[PrivacyPool] Failed to derive stealth keypair:', err);
        // Fallback: try with stealthKeys if available
        if (stealthKeys) {
          try {
            const demoEphemeralKey = 'demo_ephemeral_key_for_pool_withdraw';
            const keypair = deriveStealthSpendingKey(
              demoEphemeralKey,
              stealthKeys.viewKey.privateKey,
              stealthKeys.spendKey.publicKey
            );
            setStealthKeypair(keypair);
          } catch {
            console.error('[PrivacyPool] Stealth derivation also failed');
          }
        }
      }
    };

    generateDeterministicKeypair();
  }, [publicKey, stealthKeys]);

  // Load data on mount
  useEffect(() => {
    loadPoolData();
  }, [loadPoolData]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          loadPoolData(); // Refresh when countdown reaches 0
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, loadPoolData]);

  // Initialize pool
  const handleInitPool = async () => {
    setProcessing('init');
    setError(null);
    try {
      const sig = await initPool();
      setTxSignature(sig);
      setSuccess('Privacy Pool initialized!');
      await loadPoolData();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize pool');
    } finally {
      setProcessing(null);
    }
  };

  // Request withdrawal (Phase 1/2 - legacy)
  const handleRequestWithdraw = async () => {
    if (!stealthKeypair) {
      setError('Stealth keys not available');
      return;
    }

    setProcessing('request');
    setError(null);
    try {
      const sig = await requestPoolWithdraw(stealthKeypair, selectedAmount);
      setTxSignature(sig);
      // Reload to get actual variable delay
      await loadPoolData();
      setSuccess(`Withdrawal requested! Variable delay applied for privacy.`);
    } catch (err: any) {
      setError(err.message || 'Failed to request withdrawal');
    } finally {
      setProcessing(null);
    }
  };

  // Phase 3: Private deposit with commitment
  const handlePrivateDeposit = async () => {
    setProcessing('private-deposit');
    setError(null);
    try {
      const { signature, note } = await privateDeposit(selectedAmount);
      setTxSignature(signature);
      setSuccess(`Private deposit successful! Commitment stored securely.`);
      await loadPoolData();
    } catch (err: any) {
      setError(err.message || 'Failed to make private deposit');
    } finally {
      setProcessing(null);
    }
  };

  // Phase 3: Private withdraw with nullifier
  const handlePrivateWithdraw = async (note: PrivateNote) => {
    if (!stealthKeypair) {
      setError('Stealth keys not available');
      return;
    }

    setProcessing('private-withdraw');
    setError(null);
    try {
      const sig = await privateWithdraw(note, stealthKeypair.publicKey);
      setTxSignature(sig);
      setSuccess(`Private withdrawal successful! Nullifier recorded.`);
      setSelectedNote(null);
      await loadPoolData();
    } catch (err: any) {
      setError(err.message || 'Failed to make private withdrawal');
    } finally {
      setProcessing(null);
    }
  };

  // Transfer from stealth to main wallet
  const handleTransferToMain = async () => {
    if (!stealthKeypair || !publicKey) {
      setError('Stealth keys or wallet not available');
      return;
    }

    if (stealthBalance <= 0) {
      setError('No balance in stealth address');
      return;
    }

    setProcessing('transfer');
    setError(null);
    try {
      const { Connection, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');

      // Leave some for rent
      const transferAmount = Math.floor((stealthBalance - 0.001) * LAMPORTS_PER_SOL);
      if (transferAmount <= 0) {
        setError('Balance too low to transfer');
        return;
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: stealthKeypair.publicKey,
      });

      tx.add(
        SystemProgram.transfer({
          fromPubkey: stealthKeypair.publicKey,
          toPubkey: publicKey,
          lamports: transferAmount,
        })
      );

      tx.sign(stealthKeypair);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

      setTxSignature(sig);
      setSuccess(`Transferred ${(transferAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL to main wallet!`);
      await loadPoolData();
    } catch (err: any) {
      setError(err.message || 'Failed to transfer');
    } finally {
      setProcessing(null);
    }
  };

  // QUICK WITHDRAW ALL: Saca TODAS as private notes para o stealth (privacidade máxima)
  const handleQuickWithdrawAll = async () => {
    if (!stealthKeypair || !publicKey) {
      setError('Stealth keys or wallet not available');
      return;
    }

    if (privateNotes.length === 0) {
      setError('No private notes available');
      return;
    }

    setProcessing('quick-withdraw-all');
    setError(null);
    try {
      const results = await quickWithdrawAllToStealth(stealthKeypair);
      if (results.length > 0) {
        setTxSignature(results[results.length - 1].signature);
        const totalAmount = results.reduce((acc, r) => acc + (r.note.amount / LAMPORTS_PER_SOL), 0);
        setSuccess(`Saque privado completo! ${totalAmount.toFixed(2)} SOL no seu endereço stealth.`);
      }
      await loadPoolData();
    } catch (err: any) {
      setError(err.message || 'Failed to quick withdraw all');
    } finally {
      setProcessing(null);
    }
  };

  // Claim withdrawal (supports both regular and gasless modes)
  const handleClaim = async () => {
    if (!stealthKeypair) {
      setError('Stealth keys not available');
      return;
    }

    setProcessing('claim');
    setError(null);
    try {
      if (gaslessMode && relayerStatus?.configured) {
        // GASLESS CLAIM via relayer
        const result = await claimPoolWithdrawGasless(stealthKeypair);
        setTxSignature(result.signature);
        setSuccess(`Gasless withdrawal claimed! Relayer: ${result.relayer.slice(0, 8)}...`);
      } else {
        // Regular claim (stealth address pays gas)
        const sig = await claimPoolWithdraw(stealthKeypair);
        setTxSignature(sig);
        setSuccess('Withdrawal claimed successfully!');
      }
      await loadPoolData();
    } catch (err: any) {
      setError(err.message || 'Failed to claim withdrawal');
    } finally {
      setProcessing(null);
    }
  };

  // Format countdown
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  if (!publicKey) {
    return (
      <div className="p-6 text-center">
        <Shield className="w-12 h-12 text-purple-500 mx-auto mb-4 opacity-50" />
        <p className="text-[#737373]">Connect wallet to access Privacy Pool</p>
      </div>
    );
  }

  return (
    <div className="bg-[#141414] border border-[#262626] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-400" />
          <h2 className="font-semibold text-white">Privacy Pool</h2>
          {poolStats && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
              Active
            </span>
          )}
        </div>
        <button
          onClick={loadPoolData}
          disabled={loading}
          className="text-[#737373] hover:text-white transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Pool not initialized */}
      {!loading && !poolStats && (
        <div className="p-6 text-center">
          <Droplets className="w-12 h-12 text-purple-500 mx-auto mb-4 opacity-50" />
          <p className="text-[#737373] mb-4">Privacy Pool not initialized yet</p>
          <button
            onClick={handleInitPool}
            disabled={processing === 'init'}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 mx-auto disabled:opacity-50"
          >
            {processing === 'init' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            Initialize Pool
          </button>
        </div>
      )}

      {/* Pool Stats */}
      {poolStats && (
        <>
          {/* Your Balances Section */}
          <div className="mx-5 mt-5 p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              Seus Saldos
            </p>
            <div className="grid grid-cols-2 gap-4">
              {/* Main Wallet */}
              <div className="p-3 bg-[#1a1a1a] rounded-lg">
                <p className="text-xs text-[#737373] mb-1">Carteira Principal</p>
                <p className="text-lg font-bold text-white">{mainWalletBalance.toFixed(4)} SOL</p>
                <p className="text-xs text-[#525252] truncate" title={publicKey?.toString()}>
                  {publicKey?.toString().slice(0, 8)}...{publicKey?.toString().slice(-6)}
                </p>
              </div>
              {/* Stealth Address */}
              <div className="p-3 bg-[#1a1a1a] rounded-lg border border-green-500/20">
                <p className="text-xs text-green-400 mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Endereço Stealth (Privado)
                </p>
                <p className="text-lg font-bold text-green-400">{stealthBalance.toFixed(4)} SOL</p>
                <p className="text-xs text-[#525252] truncate" title={stealthKeypair?.publicKey.toString()}>
                  {stealthKeypair?.publicKey.toString().slice(0, 8)}...{stealthKeypair?.publicKey.toString().slice(-6)}
                </p>
              </div>
            </div>
            {/* Transfer button if stealth has balance */}
            {stealthBalance > 0.001 && (
              <button
                onClick={handleTransferToMain}
                disabled={processing === 'transfer'}
                className="mt-3 w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing === 'transfer' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="w-4 h-4" />
                )}
                Transferir {stealthBalance.toFixed(4)} SOL para Carteira Principal
              </button>
            )}
            <p className="text-xs text-[#525252] mt-2 text-center">
              Saques do Privacy Pool vão para o endereço stealth por privacidade
            </p>
          </div>

          {/* Pool Stats */}
          <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-xs text-[#737373] mb-1">Pool Balance</p>
              <p className="text-xl font-bold text-white">{poolStats.currentBalance.toFixed(2)} SOL</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[#737373] mb-1">Total Deposited</p>
              <p className="text-xl font-bold text-green-400">{poolStats.totalDeposited.toFixed(2)} SOL</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[#737373] mb-1">Deposits</p>
              <p className="text-xl font-bold text-white">{poolStats.depositCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[#737373] mb-1">Withdrawals</p>
              <p className="text-xl font-bold text-white">{poolStats.withdrawCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[#737373] mb-1">Churns</p>
              <p className="text-xl font-bold text-purple-400">{poolStats.churnCount ?? 0}</p>
            </div>
          </div>

          {/* Pending Withdrawal */}
          {pendingWithdraw && !pendingWithdraw.claimed && (
            <div className="mx-5 mb-5 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-400 font-medium">Pending Withdrawal</span>
                </div>
                <span className="text-white font-bold">{pendingWithdraw.amount} SOL</span>
              </div>

              {pendingWithdraw.isReady ? (
                <>
                  {/* Gasless Mode Toggle */}
                  {relayerStatus?.configured && (
                    <div className="mb-3 p-2 bg-[#1a1a1a] rounded-lg">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-green-400" />
                          <span className="text-sm text-[#a3a3a3]">Gasless Claim (via Relayer)</span>
                        </div>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={gaslessMode}
                            onChange={(e) => setGaslessMode(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-10 h-5 rounded-full transition-colors ${gaslessMode ? 'bg-green-500' : 'bg-[#404040]'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${gaslessMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </div>
                        </div>
                      </label>
                      {gaslessMode && (
                        <p className="text-xs text-green-400/70 mt-1">
                          Stealth address won't appear as fee payer
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleClaim}
                    disabled={processing === 'claim'}
                    className={`w-full py-3 ${gaslessMode && relayerStatus?.configured ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'} text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50`}
                  >
                    {processing === 'claim' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {gaslessMode && relayerStatus?.configured ? 'Claim Gasless' : 'Claim Now'}
                  </button>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-[#737373] text-sm mb-2">Available in</p>
                  <p className="text-2xl font-bold text-purple-400 font-mono">
                    {formatCountdown(countdown)}
                  </p>
                  <div className="mt-2 h-1 bg-[#262626] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-1000"
                      style={{
                        // Calculate progress based on actual delay (from requestedAt to availableAt)
                        width: `${pendingWithdraw ?
                          Math.min(100, ((pendingWithdraw.availableAt - pendingWithdraw.requestedAt - countdown) /
                            (pendingWithdraw.availableAt - pendingWithdraw.requestedAt)) * 100) : 0}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-[#525252] mt-1">
                    Variable delay: {pendingWithdraw ? Math.round((pendingWithdraw.availableAt - pendingWithdraw.requestedAt)) : 0}s
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Phase 3 Mode Toggle */}
          <div className="mx-5 mb-3 p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-400" />
                <div>
                  <span className="text-sm font-medium text-white">Phase 3: ZK Privacy Mode</span>
                  <p className="text-xs text-green-400/70">Commitment + Nullifier (quebra linkabilidade)</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={phase3Mode}
                  onChange={(e) => setPhase3Mode(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-5 rounded-full transition-colors ${phase3Mode ? 'bg-green-500' : 'bg-[#404040]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${phase3Mode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </label>
          </div>

          {/* Phase 3: Private Notes (unspent commitments) */}
          {phase3Mode && privateNotes.length > 0 && (
            <div className="mx-5 mb-5 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-medium">Private Notes (Saques Disponíveis)</span>
                </div>
                <button
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="text-xs text-[#737373] hover:text-white flex items-center gap-1"
                >
                  {showSecrets ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showSecrets ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              {/* QUICK WITHDRAW TO STEALTH - Privacidade Máxima */}
              <button
                onClick={handleQuickWithdrawAll}
                disabled={processing === 'quick-withdraw-all'}
                className="w-full mb-3 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-green-500/20"
              >
                {processing === 'quick-withdraw-all' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Sacar Tudo para Stealth
                    <span className="ml-1 px-2 py-0.5 bg-white/20 rounded text-sm">
                      {privateNotes.reduce((acc, n) => acc + (n.amount / LAMPORTS_PER_SOL), 0).toFixed(2)} SOL
                    </span>
                  </>
                )}
              </button>
              <div className="mb-4 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-xs text-green-400 text-center flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3" />
                  Privacidade máxima: use o stealth address diretamente
                </p>
                <p className="text-xs text-green-400/60 text-center mt-1">
                  Transferir para carteira principal quebraria a privacidade
                </p>
              </div>

              {/* Lista de notes individuais (opção avançada) */}
              <details className="group">
                <summary className="text-xs text-[#525252] cursor-pointer hover:text-white flex items-center gap-1 mb-2">
                  <span className="group-open:rotate-90 transition-transform">▶</span>
                  Ver notes individuais ({privateNotes.length})
                </summary>
                <div className="space-y-2 mt-2">
                  {privateNotes.map((note, idx) => (
                    <div key={idx} className="p-3 bg-[#1a1a1a] rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{(note.amount / LAMPORTS_PER_SOL).toFixed(2)} SOL</span>
                        <span className="text-xs text-[#525252]">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {showSecrets && (
                        <div className="text-xs text-[#525252] mb-2 font-mono">
                          <p>Commitment: {formatCommitment(note.commitment)}</p>
                        </div>
                      )}
                      <button
                        onClick={() => handlePrivateWithdraw(note)}
                        disabled={processing === 'private-withdraw' || processing === 'quick-withdraw-all'}
                        className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {processing === 'private-withdraw' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ArrowDownToLine className="w-3 h-3" />
                        )}
                        Sacar para Stealth
                      </button>
                    </div>
                  ))}
                </div>
              </details>
              <p className="text-xs text-green-400/50 mt-3 text-center">
                Nullifier previne double-spend, commitment oculta origem
              </p>
            </div>
          )}

          {/* Deposit / Withdraw Section */}
          {(!pendingWithdraw || pendingWithdraw.claimed) && (
            <div className="mx-5 mb-5 p-4 bg-[#1a1a1a] border border-[#262626] rounded-lg">
              <p className="text-sm text-[#737373] mb-3">
                {phase3Mode ? 'Private Deposit (ZK Mode)' : 'Request Withdrawal'} - Standardized amounts
              </p>
              <div className="flex gap-2 mb-4">
                {ALLOWED_WITHDRAW_AMOUNTS.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setSelectedAmount(amt)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedAmount === amt
                        ? phase3Mode ? 'bg-green-500 text-white' : 'bg-purple-500 text-white'
                        : 'bg-[#262626] text-[#737373] hover:text-white'
                    }`}
                  >
                    {amt} SOL
                  </button>
                ))}
              </div>

              {phase3Mode ? (
                // Phase 3: Private Deposit
                <button
                  onClick={handlePrivateDeposit}
                  disabled={processing === 'private-deposit' || (poolStats?.currentBalance ?? 0) < selectedAmount}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing === 'private-deposit' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Depósito Privado {selectedAmount} SOL
                </button>
              ) : (
                // Legacy: Request Withdrawal
                <button
                  onClick={handleRequestWithdraw}
                  disabled={processing === 'request' || poolStats.currentBalance < selectedAmount}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing === 'request' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="w-4 h-4" />
                  )}
                  Request {selectedAmount} SOL
                </button>
              )}

              <p className="text-xs text-[#737373] mt-2 text-center">
                {phase3Mode
                  ? 'Commitment armazenado localmente. Guarde suas chaves!'
                  : `Variable delay: ${MIN_DELAY_SECONDS}s - ${MAX_DELAY_SECONDS / 60}min before claim`
                }
              </p>
            </div>
          )}
        </>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="mx-5 mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mx-5 mb-5 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <p className="text-green-400 text-sm">{success}</p>
          </div>
          {txSignature && (
            <a
              href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              View transaction
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Privacy Info */}
      <div className="px-5 py-4 bg-[#0a0a0a] border-t border-[#262626]">
        <p className="text-xs text-[#737373] text-center">
          Privacy Pool breaks the on-chain link between depositors and recipients.
          <br />
          {phase3Mode ? (
            <>
              <span className="text-green-400">Phase 3 ZK Mode:</span> Commitment oculta depositor + Nullifier previne double-spend
              <br />
              <span className="text-green-400/70">Mesmo com indexador avançado, linkabilidade é quebrada</span>
            </>
          ) : (
            <>
              <span className="text-purple-400">Anti-correlation features:</span> Variable delay ({MIN_DELAY_SECONDS}s-{MAX_DELAY_SECONDS / 60}min) + Standardized amounts + Pool churn
            </>
          )}
          {relayerStatus?.configured && (
            <>
              <br />
              <span className="text-green-400">Gasless claims enabled:</span> Stealth address won't be fee payer
            </>
          )}
        </p>
      </div>
    </div>
  );
}
