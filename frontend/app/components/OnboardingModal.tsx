'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  User,
  ArrowRight,
  Shield,
  Link as LinkIcon,
  Briefcase,
  Wallet,
  Plus,
} from 'lucide-react';
import { useRole, UserRole } from '../lib/role';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export function OnboardingModal() {
  const router = useRouter();
  const { needsOnboarding, pendingInviteCode, setRole } = useRole();
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [selectedPath, setSelectedPath] = useState<'employer' | 'recipient' | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if user doesn't need onboarding, has a pending invite, or dismissed
  if (!needsOnboarding || pendingInviteCode || dismissed) return null;

  const handleSelectPath = (path: 'employer' | 'recipient') => {
    setSelectedPath(path);
  };

  const handleContinue = () => {
    if (!connected) {
      setVisible(true);
      return;
    }

    if (selectedPath === 'employer') {
      // Set role to employer and redirect to create batch page
      setRole('employer');
      setDismissed(true);
      router.push('/launch');
    } else if (selectedPath === 'recipient') {
      // Show message that they need an invite
      setSelectedPath('recipient');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="relative w-full max-w-2xl"
        >
          <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-3xl p-8 md:p-12">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6">
                <Shield className="w-4 h-4 text-white/40" />
                <span className="text-xs text-white/40 uppercase tracking-widest">
                  Private Payroll Infrastructure
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Welcome to Offuscate
              </h1>
              <p className="text-white/40 text-lg max-w-md mx-auto">
                How will you use the platform?
              </p>
            </div>

            {/* Path Cards */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {/* Employer Card */}
              <button
                onClick={() => handleSelectPath('employer')}
                className={`relative p-6 rounded-2xl border text-left transition-all ${
                  selectedPath === 'employer'
                    ? 'bg-white/[0.08] border-white/[0.2]'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
                  selectedPath === 'employer' ? 'bg-white/[0.15]' : 'bg-white/[0.05]'
                }`}>
                  <Building2 className={`w-7 h-7 ${
                    selectedPath === 'employer' ? 'text-white' : 'text-white/60'
                  }`} />
                </div>

                <h3 className="text-xl font-semibold text-white mb-2">
                  Company / DAO
                </h3>
                <p className="text-white/40 text-sm mb-4">
                  I want to distribute payroll and pay contractors privately.
                </p>

                <div className="space-y-2">
                  {[
                    'Create payroll batches',
                    'Invite recipients',
                    'Private treasury operations',
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-xs text-white/30">
                      <div className="w-1 h-1 rounded-full bg-white/30" />
                      {feature}
                    </div>
                  ))}
                </div>
              </button>

              {/* Recipient Card */}
              <button
                onClick={() => handleSelectPath('recipient')}
                className={`relative p-6 rounded-2xl border text-left transition-all ${
                  selectedPath === 'recipient'
                    ? 'bg-white/[0.08] border-white/[0.2]'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
                  selectedPath === 'recipient' ? 'bg-white/[0.15]' : 'bg-white/[0.05]'
                }`}>
                  <User className={`w-7 h-7 ${
                    selectedPath === 'recipient' ? 'text-white' : 'text-white/60'
                  }`} />
                </div>

                <h3 className="text-xl font-semibold text-white mb-2">
                  Employee / Recipient
                </h3>
                <p className="text-white/40 text-sm mb-4">
                  I have an invite link from a company to receive payments.
                </p>

                <div className="space-y-2">
                  {[
                    'Accept invite from employer',
                    'Receive private payments',
                    'Claim to your wallet',
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-xs text-white/30">
                      <div className="w-1 h-1 rounded-full bg-white/30" />
                      {feature}
                    </div>
                  ))}
                </div>
              </button>
            </div>

            {/* Action based on selection */}
            {selectedPath === 'recipient' ? (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 text-center">
                <LinkIcon className="w-10 h-10 mx-auto mb-4 text-white/30" />
                <h3 className="text-lg font-medium text-white mb-2">
                  You need an invite link
                </h3>
                <p className="text-white/40 text-sm mb-4">
                  Ask your employer to send you an invite link to join their payroll batch.
                </p>
                <p className="text-white/30 text-xs">
                  The link will look like: <code className="bg-white/[0.05] px-2 py-0.5 rounded">offuscate.app/invite/ABC123</code>
                </p>
              </div>
            ) : selectedPath === 'employer' ? (
              <button
                onClick={handleContinue}
                className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2"
              >
                {connected ? (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Your First Payroll Batch
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    Connect Wallet to Continue
                  </>
                )}
              </button>
            ) : (
              <div className="text-center text-white/30 text-sm">
                Select an option above to continue
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
