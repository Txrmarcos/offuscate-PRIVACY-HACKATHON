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
} from 'lucide-react';
import { useProgram } from '../lib/program';
import { InviteData } from '../lib/program/client';

interface InviteManagerProps {
  campaignId: string;
  campaignTitle: string;
  onClose?: () => void;
}

export function InviteManager({ campaignId, campaignTitle, onClose }: InviteManagerProps) {
  const { createInvite, listInvitesByBatch, revokeInvite } = useProgram();

  const [invites, setInvites] = useState<InviteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Load invites
  useEffect(() => {
    async function loadInvites() {
      setLoading(true);
      try {
        const data = await listInvitesByBatch(campaignId);
        setInvites(data);
      } catch (err) {
        console.error('Failed to load invites:', err);
      } finally {
        setLoading(false);
      }
    }

    loadInvites();
  }, [campaignId, listInvitesByBatch]);

  const handleCreateInvite = async () => {
    setCreating(true);
    setError('');

    try {
      const result = await createInvite(campaignId);

      // Reload invites
      const data = await listInvitesByBatch(campaignId);
      setInvites(data);

      // Try to copy the new invite link (may fail due to browser restrictions)
      try {
        const link = `${window.location.origin}/invite/${result.inviteCode}`;
        await navigator.clipboard.writeText(link);
        setCopiedCode(result.inviteCode);
        setTimeout(() => setCopiedCode(null), 3000);
      } catch {
        // Clipboard failed, user can manually copy
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
      const data = await listInvitesByBatch(campaignId);
      setInvites(data);
    } catch (err: any) {
      console.error('Failed to revoke invite:', err);
      setError(err.message || 'Failed to revoke invite');
    }
  };

  const pendingInvites = invites.filter(i => i.status === 'Pending');
  const acceptedInvites = invites.filter(i => i.status === 'Accepted');

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
              <h2 className="text-xl font-semibold text-white">Manage Recipients</h2>
              <p className="text-sm text-white/40 mt-1">{campaignTitle}</p>
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
          {/* Create Invite Button */}
          <button
            onClick={handleCreateInvite}
            disabled={creating}
            className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Generate Invite Link
              </>
            )}
          </button>

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
                <span className="text-xs">Pending</span>
              </div>
              <p className="text-2xl font-semibold text-white">{pendingInvites.length}</p>
            </div>
            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
              <div className="flex items-center gap-2 text-white/40 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs">Recipients</span>
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
                No invites yet. Generate an invite link to add recipients.
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
                        <code className="text-sm text-white font-mono">
                          {invite.inviteCode}
                        </code>
                        <p className="text-xs text-white/30 mt-0.5">
                          {invite.status === 'Accepted' ? (
                            <>Accepted by {invite.recipient.toBase58().slice(0, 8)}...</>
                          ) : invite.status === 'Revoked' ? (
                            'Revoked'
                          ) : (
                            'Pending'
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
            Share invite links with recipients. They'll need to connect a wallet and accept the invite.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
