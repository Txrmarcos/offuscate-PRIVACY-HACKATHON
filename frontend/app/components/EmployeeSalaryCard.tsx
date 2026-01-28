'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Clock,
  TrendingUp,
  Loader2,
  Wallet,
  Play,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProgram } from '../lib/program';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { EmployeeData } from '../lib/program/client';

interface EmployeeRecord {
  batchIndex: number;
  employeeIndex: number;
  employee: EmployeeData;
}

export function EmployeeSalaryCard() {
  const { connected, publicKey } = useWallet();
  const { findMyEmployeeRecord, claimSalary, fetchBatch } = useProgram();

  const [record, setRecord] = useState<EmployeeRecord | null>(null);
  const [batchTitle, setBatchTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live time for real-time accrued salary
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load employee record
  const loadRecord = useCallback(async () => {
    if (!connected || !publicKey) {
      setRecord(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const myRecord = await findMyEmployeeRecord();
      setRecord(myRecord);

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
  }, [connected, publicKey, findMyEmployeeRecord, fetchBatch]);

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

  // Handle claim
  const handleClaim = async () => {
    if (!record) return;

    setIsClaiming(true);
    setError(null);
    setClaimSuccess(false);

    try {
      await claimSalary(record.batchIndex, record.employeeIndex);
      setClaimSuccess(true);
      // Reload to get updated totals
      await loadRecord();
      setTimeout(() => setClaimSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to claim salary:', err);
      setError(err.message || 'Failed to claim salary');
    } finally {
      setIsClaiming(false);
    }
  };

  // Format time elapsed
  const formatTimeElapsed = () => {
    if (!record) return '';
    const elapsed = now - record.employee.lastClaimedAt;
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Not connected or loading
  if (!connected || isLoading) {
    return null;
  }

  // No employee record found
  if (!record) {
    return null;
  }

  const accrued = calculateAccrued();
  const isActive = record.employee.status === 'Active';

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-green-400/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h3 className="text-white font-medium">Streaming Salary</h3>
              <p className="text-white/30 text-xs">{batchTitle || 'Payroll Batch'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActive ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-xs font-medium">STREAMING</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-yellow-400 text-xs font-medium">{record.employee.status.toUpperCase()}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Accrued Amount - Real-time */}
      <div className="p-6 text-center">
        <p className="text-[10px] text-white/25 uppercase tracking-wide mb-2">
          ACCRUED SALARY
        </p>
        <div className="flex items-baseline justify-center gap-2 mb-2">
          <span className="text-4xl font-mono font-bold text-white tabular-nums">
            {accrued.toFixed(6)}
          </span>
          <span className="text-lg text-white/30">SOL</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-white/40 text-xs">
          <Clock className="w-3 h-3" />
          <span>Since last claim: {formatTimeElapsed()}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-px bg-white/[0.05]">
        <div className="p-4 bg-[#0a0a0a]">
          <p className="text-[10px] text-white/25 uppercase tracking-wide mb-1">Monthly Rate</p>
          <p className="font-mono text-white">
            {monthlySalary().toFixed(2)} <span className="text-xs text-white/30">SOL</span>
          </p>
        </div>
        <div className="p-4 bg-[#0a0a0a]">
          <p className="text-[10px] text-white/25 uppercase tracking-wide mb-1">Per Second</p>
          <p className="font-mono text-white">
            {salaryPerSecond().toFixed(8)} <span className="text-xs text-white/30">SOL</span>
          </p>
        </div>
      </div>

      {/* Total Claimed */}
      <div className="p-4 border-t border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-white/30" />
          <span className="text-white/40 text-sm">Total Claimed</span>
        </div>
        <span className="font-mono text-white">
          {(record.employee.totalClaimed / LAMPORTS_PER_SOL).toFixed(4)} SOL
        </span>
      </div>

      {/* Claim Button */}
      <div className="p-4 border-t border-white/[0.06]">
        {error && (
          <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {claimSuccess && (
          <div className="mb-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>Salary claimed successfully!</span>
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={isClaiming || accrued <= 0 || !isActive}
          className="w-full h-12 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isClaiming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Claiming...
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4" />
              Claim {accrued.toFixed(4)} SOL
            </>
          )}
        </button>

        {!isActive && (
          <p className="text-center text-white/30 text-xs mt-2">
            Salary streaming is paused
          </p>
        )}
      </div>
    </div>
  );
}
