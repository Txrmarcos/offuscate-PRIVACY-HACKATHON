'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  Copy,
  Check,
  Loader2,
  X,
  Link as LinkIcon,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Trash2,
  DollarSign,
} from 'lucide-react';
import { useProgram } from '../lib/program';
import { InviteData } from '../lib/program/client';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

interface InviteManagerProps {
  batchIndex: number;
  batchTitle: string;
  onClose?: () => void;
  onInviteCreated?: () => void;
}

export function InviteManager({ batchIndex, batchTitle, onClose, onInviteCreated }: InviteManagerProps) {
  const { createInvite, listMyCreatedInvites, revokeInvite, fetchBatch, getMasterVaultPDA, getBatchPDA } = useProgram();

  const [invites, setInvites] = useState<InviteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Salary input for new invites
  const [monthlySalary, setMonthlySalary] = useState('');
  const [showSalaryInput, setShowSalaryInput] = useState(false);

  // Get batch PDA for filtering invites
  const getBatchPda = () => {
    const { masterVaultPda } = getMasterVaultPDA();
    const { batchPda } = getBatchPDA(masterVaultPda, batchIndex);
    return batchPda;
  };

  // Load invites for this batch
  useEffect(() => {
    async function loadInvites() {
      setLoading(true);
      try {
        const allInvites = await listMyCreatedInvites();
        const batchPda = getBatchPda();
        // Filter invites for this batch
        const batchInvites = allInvites.filter(
          (inv) => inv.batch.toBase58() === batchPda.toBase58()
        );
        setInvites(batchInvites);
      } catch (err) {
        console.error('Failed to load invites:', err);
      } finally {
        setLoading(false);
      }
    }

    loadInvites();
  }, [batchIndex, listMyCreatedInvites]);

  const handleCreateInvite = async () => {
    if (!monthlySalary || parseFloat(monthlySalary) <= 0) {
      setError('Please enter a valid monthly salary');
      return;
    }

    setCreating(true);
    setError('');

    try {
      // Create invite with salary - uses the batch PDA as campaignId
      const batchPda = getBatchPda();
      const result = await createInvite(batchPda.toBase58(), parseFloat(monthlySalary));

      // Reload invites
      const allInvites = await listMyCreatedInvites();
      const batchInvites = allInvites.filter(
        (inv) => inv.batch.toBase58() === batchPda.toBase58()
      );
      setInvites(batchInvites);

      // Reset form
      setMonthlySalary('');
      setShowSalaryInput(false);

      // Notify parent
      onInviteCreated?.();

      // Try to copy the new invite link
      try {
        const link = `${window.location.origin}/invite/${result.inviteCode}`;
        await navigator.clipboard.writeText(link);
        setCopiedCode(result.inviteCode);
        setTimeout(() => setCopiedCode(null), 3000);
      } catch {
        console.log('Clipboard access denied, invite created:', result.inviteCode);
      }
    } catch (err: any) {
      console.error('Failed to create invite:', err);
      setError(err.message || 'Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async (inviteCode: string) => {
    const link = `${window.location.origin}/invite/${inviteCode}`;
    await navigator.clipboard.writeText(link);
    setCopiedCode(inviteCode);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const handleRevokeInvite = async (inviteCode: string) => {
    if (!confirm('Are you sure you want to revoke this invite?')) return;

    try {
      await revokeInvite(inviteCode);

      // Reload invites
      const allInvites = await listMyCreatedInvites();
      const batchPda = getBatchPda();
      const batchInvites = allInvites.filter(
        (inv) => inv.batch.toBase58() === batchPda.toBase58()
      );
      setInvites(batchInvites);
    } catch (err: any) {
      console.error('Failed to revoke invite:', err);
      setError(err.message || 'Failed to revoke invite');
    }
  };

  const pendingInvites = invites.filter(i => i.status === 'Pending');
  const acceptedInvites = invites.filter(i => i.status === 'Accepted');

  // Format monthly salary from rate
  const formatMonthlySalary = (salaryRate: number) => {
    const monthly = (salaryRate * 30 * 24 * 60 * 60) / LAMPORTS_PER_SOL;
    return monthly.toFixed(2);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/[0.08] rounded-3xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Add Employees</h2>
              <p className="text-sm text-white/40 mt-1">{batchTitle}</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-white/40 hover:text-white/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Create Invite Section */}
          {!showSalaryInput ? (
            <button
              onClick={() => setShowSalaryInput(true)}
              className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Create Invite Link
            </button>
          ) : (
            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
              <h4 className="text-white text-sm font-medium mb-4">New Employee Invite</h4>

              <div className="mb-4">
                <label className="text-[10px] text-white/30 uppercase tracking-wide block mb-2">
                  Monthly Salary (SOL)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="number"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    placeholder="e.g. 10"
                    step="0.01"
                    min="0"
                    className="w-full pl-10 pr-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-white text-sm placeholder-white/30 focus:border-white/[0.12] transition-colors"
                    autoFocus
                  />
                </div>
                <p className="text-white/30 text-xs mt-2">
                  Employee will see this amount when accepting the invite.
                  Salary streams per second after acceptance.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreateInvite}
                  disabled={creating || !monthlySalary}
                  className="flex-1 h-10 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LinkIcon className="w-4 h-4" />
                  )}
                  {creating ? 'Creating...' : 'Generate Link'}
                </button>
                <button
                  onClick={() => {
                    setShowSalaryInput(false);
                    setMonthlySalary('');
                    setError('');
                  }}
                  className="h-10 px-4 bg-white/[0.05] text-white/60 text-sm font-medium rounded-xl hover:bg-white/[0.08] transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-400/10 border border-red-400/20 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
              <div className="flex items-center gap-2 text-white/40 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs">Pending Invites</span>
              </div>
              <p className="text-2xl font-semibold text-white">{pendingInvites.length}</p>
            </div>
            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
              <div className="flex items-center gap-2 text-white/40 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs">Employees</span>
              </div>
              <p className="text-2xl font-semibold text-white">{acceptedInvites.length}</p>
            </div>
          </div>

          {/* Invite List */}
          {loading ? (
            <div className="mt-6 text-center">
              <Loader2 className="w-6 h-6 mx-auto text-white/30 animate-spin" />
            </div>
          ) : invites.length === 0 ? (
            <div className="mt-6 text-center py-8">
              <LinkIcon className="w-10 h-10 mx-auto mb-3 text-white/20" />
              <p className="text-white/40 text-sm">
                No invites yet. Create an invite link to add employees.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium text-white/60">Invites</h3>

              {invites.map((invite) => (
                <div
                  key={invite.inviteCode}
                  className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        invite.status === 'Accepted'
                          ? 'bg-green-400/10'
                          : invite.status === 'Revoked'
                          ? 'bg-red-400/10'
                          : 'bg-white/[0.05]'
                      }`}>
                        {invite.status === 'Accepted' ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : invite.status === 'Revoked' ? (
                          <XCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-white/40" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <code className="text-sm text-white font-mono">
                            {invite.inviteCode}
                          </code>
                          {invite.salaryRate > 0 && (
                            <span className="px-2 py-0.5 text-[10px] bg-green-400/10 text-green-400 rounded-md">
                              {formatMonthlySalary(invite.salaryRate)} SOL/mo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/30 mt-0.5">
                          {invite.status === 'Accepted' ? (
                            <>Accepted - Employee streaming</>
                          ) : invite.status === 'Revoked' ? (
                            'Revoked'
                          ) : (
                            'Pending acceptance'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {invite.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleCopyLink(invite.inviteCode)}
                            className="p-2 text-white/40 hover:text-white/60 transition-colors"
                            title="Copy invite link"
                          >
                            {copiedCode === invite.inviteCode ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRevokeInvite(invite.inviteCode)}
                            className="p-2 text-white/40 hover:text-red-400 transition-colors"
                            title="Revoke invite"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/[0.06] bg-white/[0.01]">
          <p className="text-xs text-white/30 text-center">
            Share invite links with employees. They'll generate a private key for receiving salary.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
