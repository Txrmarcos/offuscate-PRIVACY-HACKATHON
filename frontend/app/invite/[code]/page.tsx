'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Shield,
  Check,
  Loader2,
  AlertCircle,
  Wallet,
  ArrowRight,
  Building2,
  Lock,
  User,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useProgram } from '../../lib/program';
import { useStealth } from '../../lib/stealth/StealthContext';
import { useRole } from '../../lib/role';
import { InviteData } from '../../lib/program/client';

type InviteState = 'loading' | 'not_found' | 'already_accepted' | 'revoked' | 'ready' | 'accepting' | 'success';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = params.code as string;

  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { fetchInvite, acceptInvite, fetchCampaignByPda } = useProgram();
  const { stealthKeys, metaAddressString, isLoading: keysLoading, deriveKeysFromWallet } = useStealth();
  const { refreshRole, setPendingInviteCode } = useRole();

  const [state, setState] = useState<InviteState>('loading');
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [batchTitle, setBatchTitle] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Set pending invite code for role context
  useEffect(() => {
    setPendingInviteCode(inviteCode);
    return () => setPendingInviteCode(null);
  }, [inviteCode, setPendingInviteCode]);

  // Load invite data
  useEffect(() => {
    async function loadInvite() {
      setState('loading');

      try {
        const inviteData = await fetchInvite(inviteCode);

        if (!inviteData) {
          setState('not_found');
          return;
        }

        setInvite(inviteData);

        // Check invite status
        if (inviteData.status === 'Accepted') {
          setState('already_accepted');
          return;
        }

        if (inviteData.status === 'Revoked') {
          setState('revoked');
          return;
        }

        // Fetch batch title - batch is the campaign PDA
        const campaignData = await fetchCampaignByPda(inviteData.batch);
        if (campaignData) {
          setBatchTitle(campaignData.title);
        }

        setState('ready');
      } catch (err) {
        console.error('Failed to load invite:', err);
        setState('not_found');
      }
    }

    loadInvite();
  }, [inviteCode, fetchInvite, fetchCampaignByPda]);

  const handleAcceptInvite = async () => {
    if (!connected || !publicKey || !metaAddressString || !invite) {
      return;
    }

    setState('accepting');
    setError('');

    try {
      await acceptInvite(inviteCode, metaAddressString);
      setState('success');

      // Refresh role to pick up the new recipient status
      await refreshRole();

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      console.error('Failed to accept invite:', err);
      setError(err.message || 'Failed to accept invite');
      setState('ready');
    }
  };

  // Render based on state
  const renderContent = () => {
    switch (state) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-white/30 animate-spin" />
            <p className="text-white/40">Loading invite...</p>
          </div>
        );

      case 'not_found':
        return (
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400/60" />
            <h2 className="text-2xl font-semibold text-white mb-2">Invite Not Found</h2>
            <p className="text-white/40 mb-6">
              This invite link is invalid or has expired.
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-white/[0.05] text-white rounded-xl hover:bg-white/[0.1] transition-all"
            >
              Go Home
            </button>
          </div>
        );

      case 'already_accepted':
        return (
          <div className="text-center">
            <Check className="w-16 h-16 mx-auto mb-4 text-green-400" />
            <h2 className="text-2xl font-semibold text-white mb-2">Invite Already Accepted</h2>
            <p className="text-white/40 mb-6">
              This invite has already been accepted.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        );

      case 'revoked':
        return (
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-400/60" />
            <h2 className="text-2xl font-semibold text-white mb-2">Invite Revoked</h2>
            <p className="text-white/40 mb-6">
              This invite has been revoked by the employer.
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-white/[0.05] text-white rounded-xl hover:bg-white/[0.1] transition-all"
            >
              Go Home
            </button>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-400/10 flex items-center justify-center"
            >
              <Check className="w-10 h-10 text-green-400" />
            </motion.div>
            <h2 className="text-2xl font-semibold text-white mb-2">Welcome Aboard!</h2>
            <p className="text-white/40 mb-6">
              You've successfully joined the payroll batch. Redirecting to dashboard...
            </p>
            <Loader2 className="w-6 h-6 mx-auto text-white/30 animate-spin" />
          </div>
        );

      case 'ready':
      case 'accepting':
        return (
          <>
            {/* Invite Info */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/[0.05] flex items-center justify-center">
                <Building2 className="w-8 h-8 text-white/60" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">
                You're Invited!
              </h2>
              <p className="text-white/40">
                You've been invited to receive payments from:
              </p>
              <p className="text-lg font-medium text-white mt-2">
                {batchTitle || 'Payroll Batch'}
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-4 mb-8">
              {/* Step 1: Connect Wallet */}
              <div className={`p-4 rounded-xl border ${
                connected
                  ? 'bg-green-400/5 border-green-400/20'
                  : 'bg-white/[0.02] border-white/[0.06]'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    connected ? 'bg-green-400/10' : 'bg-white/[0.05]'
                  }`}>
                    {connected ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Wallet className="w-4 h-4 text-white/40" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">Connect Wallet</p>
                    <p className="text-white/30 text-xs">
                      {connected
                        ? `Connected: ${publicKey?.toBase58().slice(0, 8)}...`
                        : 'Connect your Solana wallet'}
                    </p>
                  </div>
                  {!connected && (
                    <button
                      onClick={() => setVisible(true)}
                      className="px-4 py-2 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 transition-all"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

              {/* Step 2: Generate Privacy Keys */}
              <div className={`p-4 rounded-xl border ${
                stealthKeys
                  ? 'bg-green-400/5 border-green-400/20'
                  : 'bg-white/[0.02] border-white/[0.06]'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    stealthKeys ? 'bg-green-400/10' : 'bg-white/[0.05]'
                  }`}>
                    {stealthKeys ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Lock className="w-4 h-4 text-white/40" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">Generate Privacy Keys</p>
                    <p className="text-white/30 text-xs">
                      {stealthKeys
                        ? 'Privacy keys ready'
                        : 'Sign a message to generate your private receiving address'}
                    </p>
                  </div>
                  {connected && !stealthKeys && !keysLoading && (
                    <button
                      onClick={deriveKeysFromWallet}
                      className="px-4 py-2 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 transition-all"
                    >
                      Generate
                    </button>
                  )}
                  {keysLoading && (
                    <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
                  )}
                </div>
              </div>

              {/* Step 3: Accept Invite */}
              <div className="p-4 rounded-xl border bg-white/[0.02] border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.05]">
                    <User className="w-4 h-4 text-white/40" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">Accept Invite</p>
                    <p className="text-white/30 text-xs">
                      Join the payroll batch and start receiving private payments
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 bg-red-400/10 border border-red-400/20 rounded-xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Accept Button */}
            <button
              onClick={handleAcceptInvite}
              disabled={!connected || !stealthKeys || state === 'accepting'}
              className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {state === 'accepting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  Accept Invite
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Info */}
            <p className="mt-4 text-center text-white/20 text-xs">
              By accepting, your private receiving address will be registered with the employer's payroll batch.
            </p>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen px-6 py-24 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-3xl p-8">
          {/* Header */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Shield className="w-5 h-5 text-white/40" />
            <span className="text-xs text-white/40 uppercase tracking-widest">
              Private Payroll Invite
            </span>
          </div>

          {renderContent()}
        </div>
      </motion.div>
    </div>
  );
}
