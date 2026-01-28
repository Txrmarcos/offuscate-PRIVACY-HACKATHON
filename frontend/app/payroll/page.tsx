'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Loader2,
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  Building2,
  Wallet,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Play,
  UserPlus,
  Banknote,
  Shield,
  Key,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useProgram } from '../lib/program';
import { useRole } from '../lib/role';
import { useStealth } from '../lib/stealth/StealthContext';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { InviteManager } from '../components/InviteManager';
import type { PayrollBatchData, EmployeeData } from '../lib/program/client';

export default function PayrollPage() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { role, setRole } = useRole();
  const { stealthKeys, isLoading: keysLoading, deriveKeysFromWallet } = useStealth();
  const {
    isMasterVaultInitialized,
    initMasterVault,
    createBatch,
    listMyBatches,
    listBatchEmployees,
    fundBatch,
  } = useProgram();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [masterVaultInitialized, setMasterVaultInitialized] = useState(false);
  const [initializingVault, setInitializingVault] = useState(false);
  const [batches, setBatches] = useState<PayrollBatchData[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);
  const [batchEmployees, setBatchEmployees] = useState<Record<number, EmployeeData[]>>({});
  const [loadingEmployees, setLoadingEmployees] = useState<number | null>(null);

  // Create batch state
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [newBatchTitle, setNewBatchTitle] = useState('');
  const [creatingBatch, setCreatingBatch] = useState(false);

  // Invite manager state
  const [inviteManagerBatch, setInviteManagerBatch] = useState<{ index: number; title: string } | null>(null);

  // Fund batch state
  const [fundingBatch, setFundingBatch] = useState<number | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [processingFund, setProcessingFund] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);


  // Live time for accrued salary
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Update time every second for real-time salary display
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load initial data
  const loadData = useCallback(async () => {
    if (!connected || !publicKey) return;

    setIsLoading(true);
    try {
      // Check if master vault is initialized
      const initialized = await isMasterVaultInitialized();
      setMasterVaultInitialized(initialized);

      if (initialized) {
        // Fetch user's batches
        const myBatches = await listMyBatches();
        setBatches(myBatches);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [connected, publicKey, isMasterVaultInitialized, listMyBatches]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize master vault
  const handleInitMasterVault = async () => {
    setInitializingVault(true);
    try {
      await initMasterVault();
      setMasterVaultInitialized(true);
      await loadData();
    } catch (err) {
      console.error('Failed to initialize master vault:', err);
    } finally {
      setInitializingVault(false);
    }
  };

  // Create batch
  const handleCreateBatch = async () => {
    if (!newBatchTitle.trim()) return;

    setCreatingBatch(true);
    try {
      await createBatch(newBatchTitle.trim());
      setNewBatchTitle('');
      setShowCreateBatch(false);
      await loadData();
    } catch (err) {
      console.error('Failed to create batch:', err);
    } finally {
      setCreatingBatch(false);
    }
  };

  // Load employees for a batch
  const loadBatchEmployees = async (batchIndex: number) => {
    setLoadingEmployees(batchIndex);
    try {
      const employees = await listBatchEmployees(batchIndex);
      setBatchEmployees((prev) => ({ ...prev, [batchIndex]: employees }));
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoadingEmployees(null);
    }
  };

  // Toggle batch expansion
  const toggleBatch = async (batchIndex: number) => {
    if (expandedBatch === batchIndex) {
      setExpandedBatch(null);
    } else {
      setExpandedBatch(batchIndex);
      if (!batchEmployees[batchIndex]) {
        await loadBatchEmployees(batchIndex);
      }
    }
  };

  // Fund batch
  const handleFundBatch = async (batchIndex: number) => {
    if (!fundAmount) return;

    setProcessingFund(true);
    setFundError(null);
    try {
      const amountLamports = parseFloat(fundAmount) * LAMPORTS_PER_SOL;
      await fundBatch(batchIndex, amountLamports);
      setFundAmount('');
      setFundingBatch(null);
      await loadData();
    } catch (err: any) {
      // Extract the actual error message from Anchor errors
      let errorMessage = 'Unknown error';
      const logs = err?.logs?.join?.('\n') || err?.error?.logs?.join?.('\n') || '';

      // Check for insufficient balance error
      if (logs.includes('insufficient lamports') || err?.message?.includes('insufficient lamports')) {
        errorMessage = 'Insufficient balance. Please add more SOL to your wallet.';
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (err?.error?.message) {
        errorMessage = err.error.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      console.error('Failed to fund batch:', errorMessage);
      if (logs) {
        console.error('Transaction logs:', logs);
      }
      setFundError(errorMessage);
    } finally {
      setProcessingFund(false);
    }
  };

  // Calculate accrued salary for an employee
  const calculateAccrued = (employee: EmployeeData) => {
    if (employee.status !== 'Active') return 0;
    const elapsed = now - employee.lastClaimedAt;
    return (employee.salaryRate * elapsed) / LAMPORTS_PER_SOL;
  };

  // Calculate monthly salary from rate
  const monthlyFromRate = (rate: number) => {
    return (rate * 30 * 24 * 60 * 60) / LAMPORTS_PER_SOL;
  };

  // Format SOL
  const formatSol = (lamports: number) => {
    return (lamports / LAMPORTS_PER_SOL).toFixed(4);
  };

  // Not connected state
  if (!connected) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <Building2 className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Private Payroll</h1>
          <p className="text-white/40 text-lg mb-3">
            Pay employees in real-time with streaming salaries.
          </p>
          <p className="text-white/25 text-sm mb-8">
            Connect your wallet to set up private payroll for your team.
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
  if (isLoading || keysLoading) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white/40 mx-auto mb-4" />
          <p className="text-white/40">Loading payroll...</p>
        </div>
      </div>
    );
  }

  // Setup stealth keys
  if (!stealthKeys && !keysLoading) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <Shield className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Setup Privacy</h1>
          <p className="text-white/40 text-lg mb-8">
            Generate cryptographic keys for private payroll operations.
          </p>
          <button
            onClick={deriveKeysFromWallet}
            className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all"
          >
            Generate Keys
          </button>
        </div>
      </div>
    );
  }

  // Master vault not initialized
  if (!masterVaultInitialized) {
    return (
      <div className="min-h-screen px-6 py-24 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-[2.25rem] bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <Play className="w-10 h-10 text-white/60" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Initialize Payroll</h1>
          <p className="text-white/40 text-lg mb-3">
            Set up the master vault to start streaming payments.
          </p>
          <p className="text-white/25 text-sm mb-8">
            This is a one-time setup that creates the infrastructure for private payroll.
          </p>
          <button
            onClick={handleInitMasterVault}
            disabled={initializingVault}
            className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
          >
            {initializingVault ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            {initializingVault ? 'Initializing...' : 'Initialize Payroll System'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-3">
              <Shield className="w-3.5 h-3.5 text-white/40" />
              <span className="text-[10px] text-white/40 uppercase tracking-widest">
                Private Streaming
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">Payroll</h1>
            <p className="text-white/40 text-sm">
              Pay employees continuously with full privacy - salary accrues every second
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.05] transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowCreateBatch(true)}
              className="h-11 px-5 bg-white text-black text-sm font-medium rounded-2xl hover:bg-white/90 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Batch
            </button>
          </div>
        </div>

        {/* Privacy Info Banner */}
        <div className="mb-8 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-400/10 flex items-center justify-center flex-shrink-0">
              <Key className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-white font-medium mb-1">Privacy-First Payroll</h3>
              <p className="text-white/40 text-sm">
                Employees generate a stealth keypair when accepting invites. Their main wallet is
                never linked to salary payments on-chain. Only the employee can claim their salary
                using their private key.
              </p>
            </div>
          </div>
        </div>

        {/* Stats - Based on user's own batches */}
        {(() => {
          const userStats = {
            totalEmployees: batches.reduce((sum, b) => sum + b.employeeCount, 0),
            totalBatches: batches.length,
            totalFunded: batches.reduce((sum, b) => sum + b.totalBudget, 0),
            totalPaid: batches.reduce((sum, b) => sum + b.totalPaid, 0),
          };
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                  <Users className="w-4 h-4 text-white/30" />
                </div>
                <p className="text-[10px] text-white/25 uppercase tracking-wide mb-1">Employees</p>
                <p className="text-2xl font-mono text-white">{userStats.totalEmployees}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                  <Building2 className="w-4 h-4 text-white/30" />
                </div>
                <p className="text-[10px] text-white/25 uppercase tracking-wide mb-1">Batches</p>
                <p className="text-2xl font-mono text-white">{userStats.totalBatches}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                  <DollarSign className="w-4 h-4 text-white/30" />
                </div>
                <p className="text-[10px] text-white/25 uppercase tracking-wide mb-1">Total Funded</p>
                <p className="text-2xl font-mono text-white">
                  {formatSol(userStats.totalFunded)} <span className="text-sm text-white/30">SOL</span>
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                  <TrendingUp className="w-4 h-4 text-white/30" />
                </div>
                <p className="text-[10px] text-white/25 uppercase tracking-wide mb-1">Total Paid</p>
                <p className="text-2xl font-mono text-white">
                  {formatSol(userStats.totalPaid)} <span className="text-sm text-white/30">SOL</span>
                </p>
              </div>
            </div>
          );
        })()}

        {/* Batches */}
        <div className="space-y-4">
          {batches.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <Building2 className="w-10 h-10 mx-auto mb-3 text-white/10" />
              <p className="text-white/30 text-sm mb-2">No payroll batches yet</p>
              <p className="text-white/20 text-xs mb-6">Create your first batch to start adding employees</p>
              <button
                onClick={() => setShowCreateBatch(true)}
                className="px-6 py-3 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create First Batch
              </button>
            </div>
          ) : (
            batches.map((batch) => (
              <div
                key={batch.index}
                className="rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden"
              >
                {/* Batch Header */}
                <div
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-all"
                  onClick={() => toggleBatch(batch.index)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-white/30" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium">{batch.title}</p>
                        <span
                          className={`px-2 py-0.5 text-[9px] font-medium rounded-md ${
                            batch.status === 'Active'
                              ? 'bg-green-400/10 text-green-400'
                              : batch.status === 'Paused'
                              ? 'bg-yellow-400/10 text-yellow-400'
                              : 'bg-white/[0.08] text-white/40'
                          }`}
                        >
                          {batch.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-white/30 text-xs">
                        {batch.employeeCount} employees • Budget: {formatSol(batch.totalBudget)} SOL
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono text-white">
                        {formatSol(batch.totalBudget - batch.totalPaid)}{' '}
                        <span className="text-xs text-white/30">SOL remaining</span>
                      </p>
                    </div>
                    {expandedBatch === batch.index ? (
                      <ChevronUp className="w-5 h-5 text-white/30" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-white/30" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedBatch === batch.index && (
                  <div className="border-t border-white/[0.05] p-5">
                    {/* Actions */}
                    <div className="flex items-center gap-3 mb-6">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInviteManagerBatch({ index: batch.index, title: batch.title });
                        }}
                        className="h-9 px-4 bg-white/[0.05] text-white text-xs font-medium rounded-xl hover:bg-white/[0.08] transition-all flex items-center gap-2"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Add Employee
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFundingBatch(fundingBatch === batch.index ? null : batch.index);
                          setFundError(null);
                        }}
                        className="h-9 px-4 bg-white/[0.05] text-white text-xs font-medium rounded-xl hover:bg-white/[0.08] transition-all flex items-center gap-2"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        Fund Batch
                      </button>
                    </div>

                    {/* Fund Batch Form */}
                    {fundingBatch === batch.index && (
                      <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                        <h4 className="text-white text-sm font-medium mb-4">Fund Batch</h4>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex-1">
                            <label className="text-[10px] text-white/30 uppercase tracking-wide block mb-2">
                              Amount (SOL)
                            </label>
                            <input
                              type="number"
                              value={fundAmount}
                              onChange={(e) => setFundAmount(e.target.value)}
                              placeholder="e.g. 100"
                              step="0.01"
                              className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-white text-sm placeholder-white/30 focus:border-white/[0.12] transition-colors"
                            />
                          </div>
                        </div>
                        {fundError && (
                          <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.1]">
                            <p className="text-white/60 text-sm">{fundError}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleFundBatch(batch.index)}
                            disabled={processingFund || !fundAmount}
                            className="h-10 px-5 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-all disabled:opacity-50 flex items-center gap-2"
                          >
                            {processingFund ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Banknote className="w-4 h-4" />
                            )}
                            Fund Batch
                          </button>
                          <button
                            onClick={() => {
                              setFundingBatch(null);
                              setFundError(null);
                            }}
                            className="h-10 px-5 bg-white/[0.05] text-white/60 text-sm font-medium rounded-xl hover:bg-white/[0.08] transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Employees List */}
                    <div>
                      <h4 className="text-[10px] text-white/25 uppercase tracking-wide mb-3">
                        Employees
                      </h4>

                      {loadingEmployees === batch.index ? (
                        <div className="py-8 text-center">
                          <Loader2 className="w-6 h-6 animate-spin text-white/30 mx-auto" />
                        </div>
                      ) : !batchEmployees[batch.index] ||
                        batchEmployees[batch.index].length === 0 ? (
                        <div className="py-8 text-center rounded-xl bg-white/[0.01] border border-white/[0.03]">
                          <Users className="w-8 h-8 mx-auto mb-2 text-white/10" />
                          <p className="text-white/30 text-sm mb-2">No employees yet</p>
                          <p className="text-white/20 text-xs">
                            Click "Add Employee" to generate an invite link
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {batchEmployees[batch.index].map((employee) => (
                            <div
                              key={employee.index}
                              className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.04] flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    employee.status === 'Active'
                                      ? 'bg-green-400/10'
                                      : 'bg-white/[0.04]'
                                  }`}
                                >
                                  <Key
                                    className={`w-4 h-4 ${
                                      employee.status === 'Active'
                                        ? 'text-green-400'
                                        : 'text-white/30'
                                    }`}
                                  />
                                </div>
                                <div>
                                  <p className="text-white text-sm font-mono">
                                    Stealth #{employee.index + 1}
                                  </p>
                                  <p className="text-white/30 text-xs">
                                    {monthlyFromRate(employee.salaryRate).toFixed(2)} SOL/month
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="flex items-center gap-2">
                                  {employee.status === 'Active' && (
                                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                  )}
                                  <p className="font-mono text-white">
                                    {calculateAccrued(employee).toFixed(6)}{' '}
                                    <span className="text-xs text-white/30">SOL accrued</span>
                                  </p>
                                </div>
                                <p className="text-white/30 text-xs">
                                  Total claimed: {formatSol(employee.totalClaimed)} SOL
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Create Batch Modal */}
        {showCreateBatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md p-6 rounded-2xl bg-[#0a0a0a] border border-white/[0.08]">
              <h3 className="text-xl font-bold text-white mb-4">Create Payroll Batch</h3>
              <p className="text-white/40 text-sm mb-6">
                A batch groups employees for easier management. You can add employees via invite links
                after creation.
              </p>

              <div className="mb-6">
                <label className="text-[10px] text-white/30 uppercase tracking-wide block mb-2">
                  Batch Name
                </label>
                <input
                  type="text"
                  value={newBatchTitle}
                  onChange={(e) => setNewBatchTitle(e.target.value)}
                  placeholder="e.g. Engineering Team"
                  className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-white text-sm placeholder-white/30 focus:border-white/[0.12] transition-colors"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreateBatch}
                  disabled={creatingBatch || !newBatchTitle.trim()}
                  className="flex-1 h-11 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creatingBatch ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create Batch
                </button>
                <button
                  onClick={() => {
                    setShowCreateBatch(false);
                    setNewBatchTitle('');
                  }}
                  className="h-11 px-5 bg-white/[0.05] text-white/60 text-sm font-medium rounded-xl hover:bg-white/[0.08] transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invite Manager Modal */}
        {inviteManagerBatch && (
          <InviteManager
            batchIndex={inviteManagerBatch.index}
            batchTitle={inviteManagerBatch.title}
            onClose={() => setInviteManagerBatch(null)}
            onInviteCreated={() => loadBatchEmployees(inviteManagerBatch.index)}
          />
        )}
      </div>
    </div>
  );
}
