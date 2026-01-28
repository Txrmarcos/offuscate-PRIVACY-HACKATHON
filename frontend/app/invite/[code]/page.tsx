'use client';

import { useState, useEffect, useCallback } from 'react';
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
  DollarSign,
  Key,
  Copy,
  Eye,
  EyeOff,
  Download,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { useProgram } from '../../lib/program';
import { useStealth } from '../../lib/stealth/StealthContext';
import { useRole } from '../../lib/role';
import { InviteData } from '../../lib/program/client';

type InviteState =
  | 'loading'
  | 'not_found'
  | 'already_accepted'
  | 'revoked'
  | 'ready'
  | 'accepting'
  | 'success'
  | 'show_key'; // New state to show the stealth private key

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = params.code as string;

  const { connected, publicKey, wallets, select } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const {
    fetchInvite,
    acceptInvite,
    acceptInviteStreaming,
    fetchCampaignByPda,
    fetchBatch,
    fetchMasterVault,
    getMasterVaultPDA,
    getBatchPDA,
  } = useProgram();
  const { stealthKeys, metaAddressString, isLoading: keysLoading, deriveKeysFromWallet } = useStealth();
  const { refreshRole, setPendingInviteCode } = useRole();

  const [state, setState] = useState<InviteState>('loading');
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [batchTitle, setBatchTitle] = useState<string>('');
  const [batchIndex, setBatchIndex] = useState<number | null>(null);
  const [error, setError] = useState<string>('');

  // Stealth keypair for streaming (generated locally)
  const [stealthKeypair, setStealthKeypair] = useState<Keypair | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyBackedUp, setKeyBackedUp] = useState(false);

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

        // Try to fetch batch data - the invite.batch now points to a PayrollBatch PDA
        try {
          // Fetch all batches and find the one matching the invite's batch PDA
          const { masterVaultPda } = getMasterVaultPDA();
          const masterVault = await fetchMasterVault();

          if (masterVault) {
            // Find the batch that matches the invite's batch PDA
            for (let i = 0; i < masterVault.batchCount; i++) {
              const { batchPda } = getBatchPDA(masterVaultPda, i);
              if (batchPda.toBase58() === inviteData.batch.toBase58()) {
                const batchData = await fetchBatch(i);
                if (batchData) {
                  setBatchTitle(batchData.title);
                  setBatchIndex(i);
                }
                break;
              }
            }
          }
        } catch (err) {
          console.log('Could not fetch batch data:', err);
          // Fallback: try as campaign PDA (for backwards compatibility)
          const campaignData = await fetchCampaignByPda(inviteData.batch);
          if (campaignData) {
            setBatchTitle(campaignData.title);
          }
        }

        setState('ready');
      } catch (err) {
        console.error('Failed to load invite:', err);
        setState('not_found');
      }
    }

    loadInvite();
  }, [inviteCode, fetchInvite, fetchCampaignByPda]);

  // Generate stealth keypair when connected and invite has salary
  const generateStealthKeypair = useCallback(() => {
    const keypair = Keypair.generate();
    setStealthKeypair(keypair);
    return keypair;
  }, []);

  // Wallet selection handler
  const handleWalletSelect = async (walletName: string) => {
    const wallet = wallets.find(w => w.adapter.name === walletName);
    if (wallet) {
      select(wallet.adapter.name);
      setShowWalletModal(false);
    }
  };

  // Filter installed wallets
  const installedWallets = wallets.filter(w => w.readyState === 'Installed');

  // Format monthly salary
  const formatMonthlySalary = (salaryRate: number) => {
    const monthly = (salaryRate * 30 * 24 * 60 * 60) / LAMPORTS_PER_SOL;
    return monthly.toFixed(2);
  };

  // Copy private key to clipboard
  const copyPrivateKey = async () => {
    if (!stealthKeypair) return;

    try {
      const privateKeyBase58 = bs58.encode(stealthKeypair.secretKey);
      await navigator.clipboard.writeText(privateKeyBase58);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Download private key as file
  const downloadPrivateKey = () => {
    if (!stealthKeypair) return;

    const privateKeyBase58 = bs58.encode(stealthKeypair.secretKey);
    const data = {
      publicKey: stealthKeypair.publicKey.toBase58(),
      privateKey: privateKeyBase58,
      inviteCode,
      batchTitle,
      createdAt: new Date().toISOString(),
      warning: 'KEEP THIS FILE SECURE! Anyone with this key can claim your salary.',
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stealth-key-${inviteCode}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setKeyBackedUp(true);
  };

  // Save stealth keypair to localStorage
  const saveStealthKeypair = (keypair: Keypair) => {
    if (!publicKey) return;

    const key = `stealth_keypairs_${publicKey.toBase58()}`;
    const existing = localStorage.getItem(key);
    const keypairs: Record<string, string> = existing ? JSON.parse(existing) : {};

    keypairs[inviteCode] = bs58.encode(keypair.secretKey);
    localStorage.setItem(key, JSON.stringify(keypairs));
  };

  const handleAcceptInvite = async () => {
    if (!connected || !publicKey || !metaAddressString || !invite) {
      return;
    }

    setState('accepting');
    setError('');

    try {
      const hasStreaming = invite.salaryRate > 0;

      if (hasStreaming && batchIndex !== null) {
        // Use streaming flow with stealth keypair
        let keypair = stealthKeypair;
        if (!keypair) {
          keypair = generateStealthKeypair();
        }

        await acceptInviteStreaming(
          inviteCode,
          metaAddressString,
          keypair,
          batchIndex
        );

        // Save stealth keypair locally
        saveStealthKeypair(keypair);
        setStealthKeypair(keypair);

        // Show the key backup screen
        setState('show_key');
      } else {
        // Regular accept without streaming
        await acceptInvite(inviteCode, metaAddressString);
        setState('success');

        // Refresh role and redirect
        await refreshRole();
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Failed to accept invite:', err);
      setError(err.message || 'Failed to accept invite');
      setState('ready');
    }
  };

  const handleContinueAfterBackup = async () => {
    if (!keyBackedUp) {
      setError('Please backup your private key first!');
      return;
    }

    setState('success');
    await refreshRole();

    setTimeout(() => {
      router.push('/salary');
    }, 2000);
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
              onClick={() => router.push('/salary')}
              className="px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all"
            >
              Go to Salary
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

      case 'show_key':
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-yellow-400/10 flex items-center justify-center">
              <Key className="w-8 h-8 text-yellow-400" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">Backup Your Private Key</h2>
            <p className="text-white/40 mb-6">
              This key is required to claim your salary. Store it safely!
            </p>

            {/* Private Key Display */}
            <div className="mb-6 p-4 bg-white/[0.02] border border-white/[0.08] rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40 uppercase tracking-wide">Stealth Private Key</span>
                <button
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className="text-white/40 hover:text-white transition-all"
                >
                  {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="font-mono text-sm text-white break-all">
                {showPrivateKey
                  ? bs58.encode(stealthKeypair?.secretKey || new Uint8Array())
                  : '••••••••••••••••••••••••••••••••••••••••••••'}
              </p>
            </div>

            {/* Backup Actions */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={copyPrivateKey}
                className="flex-1 py-3 bg-white/[0.05] text-white rounded-xl hover:bg-white/[0.08] transition-all flex items-center justify-center gap-2"
              >
                {keyCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {keyCopied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={downloadPrivateKey}
                className="flex-1 py-3 bg-white/[0.05] text-white rounded-xl hover:bg-white/[0.08] transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>

            {/* Confirm Backup */}
            <label className="flex items-center gap-3 mb-6 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={keyBackedUp}
                onChange={(e) => setKeyBackedUp(e.target.checked)}
                className="w-5 h-5 rounded border-white/20 bg-white/[0.05] text-green-400 focus:ring-green-400"
              />
              <span className="text-white/60 text-sm">
                I have securely backed up my private key
              </span>
            </label>

            {/* Warning */}
            <div className="mb-6 p-4 bg-red-400/10 border border-red-400/20 rounded-xl">
              <p className="text-red-400 text-sm">
                If you lose this key, you will NOT be able to claim your salary!
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-400/10 border border-red-400/20 rounded-xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleContinueAfterBackup}
              disabled={!keyBackedUp}
              className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue to Salary Dashboard
              <ArrowRight className="w-4 h-4" />
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
              You've successfully joined. Redirecting...
            </p>
            <Loader2 className="w-6 h-6 mx-auto text-white/30 animate-spin" />
          </div>
        );

      case 'ready':
      case 'accepting':
        const hasStreaming = invite && invite.salaryRate > 0;

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
                You've been invited to join:
              </p>
              <p className="text-lg font-medium text-white mt-2">
                {batchTitle || 'Payroll Batch'}
              </p>

              {/* Show salary if configured */}
              {hasStreaming && (
                <div className="mt-4 p-4 bg-green-400/10 border border-green-400/20 rounded-xl">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <DollarSign className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-semibold text-lg">
                      {formatMonthlySalary(invite!.salaryRate)} SOL/month
                    </span>
                  </div>
                  <p className="text-green-400/60 text-xs">
                    Streaming salary - accrues every second
                  </p>
                </div>
              )}
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
                      onClick={() => setShowWalletModal(true)}
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
                      {hasStreaming
                        ? 'Start receiving streaming salary'
                        : 'Join the payroll batch'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy Notice for Streaming */}
            {hasStreaming && (
              <div className="mb-6 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-white/40 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium text-sm mb-1">Enhanced Privacy</p>
                    <p className="text-white/40 text-xs">
                      A unique stealth keypair will be generated for your salary.
                      Your main wallet will NOT be linked to your payments on-chain.
                    </p>
                  </div>
                </div>
              </div>
            )}

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
              {hasStreaming
                ? 'You will be asked to backup your stealth private key after accepting.'
                : 'Your private receiving address will be registered with the employer.'}
            </p>
          </>
        );
    }
  };

  return (
    <>
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

      {/* Custom Wallet Connect Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowWalletModal(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-sm mx-4 bg-[#0a0a0a] border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-4 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white/60" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-1">Connect Wallet</h2>
              <p className="text-white/40 text-sm">Select a wallet to continue</p>
            </div>

            {/* Wallet List */}
            <div className="px-4 pb-6 space-y-2">
              {installedWallets.length > 0 ? (
                installedWallets.map((wallet) => (
                  <button
                    key={wallet.adapter.name}
                    onClick={() => handleWalletSelect(wallet.adapter.name)}
                    className="w-full px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all flex items-center gap-4"
                  >
                    {wallet.adapter.icon && (
                      <img
                        src={wallet.adapter.icon}
                        alt={wallet.adapter.name}
                        className="w-8 h-8 rounded-lg"
                      />
                    )}
                    <span className="text-white font-medium text-sm flex-1 text-left">
                      {wallet.adapter.name}
                    </span>
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">
                      Detected
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/40 text-sm mb-4">No wallets detected</p>
                  <a
                    href="https://phantom.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] text-white/60 hover:text-white hover:bg-white/[0.08] transition-all text-sm"
                  >
                    Install Phantom
                  </a>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowWalletModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
