'use client';

import { useState, useEffect, useCallback } from 'react';
import { Key, Copy, Check, Eye, EyeOff, Download, Trash2, Shield, AlertTriangle, Wallet, Fingerprint } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useStealth } from '../lib/stealth/StealthContext';
import { SerializedStealthKeys } from '../lib/stealth';
import clsx from 'clsx';

type ViewLevel = 'simple' | 'advanced' | 'expert';

interface StealthSetupProps {
  isOpen: boolean;
  onClose: () => void;
}

// Auto-hide timer for private keys (30 seconds)
const PRIVATE_KEY_VISIBILITY_TIMEOUT = 30000;

export function StealthSetup({ isOpen, onClose }: StealthSetupProps) {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const {
    metaAddress,
    metaAddressString,
    isInitialized,
    isLoading,
    isDeriving,
    walletAddress,
    deriveKeysFromWallet,
    clearKeys,
    exportKeys,
  } = useStealth();

  const [viewLevel, setViewLevel] = useState<ViewLevel>('simple');
  const [showPrivateKeys, setShowPrivateKeys] = useState(false);
  const [privateKeyConfirmed, setPrivateKeyConfirmed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [privateKeyTimer, setPrivateKeyTimer] = useState<number>(0);

  // Auto-hide private keys after timeout
  useEffect(() => {
    if (!showPrivateKeys) {
      setPrivateKeyTimer(0);
      return;
    }

    const interval = setInterval(() => {
      setPrivateKeyTimer((prev) => {
        const newValue = prev + 1000;
        if (newValue >= PRIVATE_KEY_VISIBILITY_TIMEOUT) {
          setShowPrivateKeys(false);
          setPrivateKeyConfirmed(false);
          return 0;
        }
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showPrivateKeys]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowPrivateKeys(false);
      setPrivateKeyConfirmed(false);
      setPrivateKeyTimer(0);
      setError(null);
    }
  }, [isOpen]);

  const handleCopy = useCallback(async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleExport = useCallback(() => {
    const keys = exportKeys();
    if (keys) {
      const data = JSON.stringify(keys, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stealth-keys-${walletAddress?.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [exportKeys, walletAddress]);

  const handleClearKeys = useCallback(() => {
    if (confirm('Are you sure? This will delete your stealth keys from this browser. You can always re-derive them by signing again with the same wallet.')) {
      clearKeys();
    }
  }, [clearKeys]);

  const handleRevealPrivateKeys = useCallback(() => {
    if (!privateKeyConfirmed) {
      setPrivateKeyConfirmed(true);
      return;
    }
    setShowPrivateKeys(true);
    setPrivateKeyTimer(0);
  }, [privateKeyConfirmed]);

  const hidePrivateKeys = useCallback(() => {
    setShowPrivateKeys(false);
    setPrivateKeyConfirmed(false);
    setPrivateKeyTimer(0);
  }, []);

  const handleConnectWallet = useCallback(() => {
    setWalletModalVisible(true);
  }, [setWalletModalVisible]);

  const handleDeriveKeys = useCallback(async () => {
    setError(null);
    try {
      await deriveKeysFromWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to derive keys. Please try again.');
    }
  }, [deriveKeysFromWallet]);

  if (!isOpen) return null;

  const serializedKeys = exportKeys();
  const remainingTime = Math.ceil((PRIVATE_KEY_VISIBILITY_TIMEOUT - privateKeyTimer) / 1000);
  const shortWalletAddress = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#262626] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[#262626]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Privacy Identity</h2>
                <p className="text-sm text-gray-400">Derived from your wallet</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <span className="sr-only">Close</span>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-400 mt-4">Loading...</p>
            </div>
          ) : !connected ? (
            /* Wallet not connected */
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium mb-2">Connect Your Wallet</h3>
                <p className="text-sm text-gray-400 max-w-sm mx-auto">
                  Connect your Solana wallet to derive your unique privacy identity.
                  Your stealth keys are deterministically generated from your wallet.
                </p>
              </div>

              <button
                onClick={handleConnectWallet}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>

              <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#262626]">
                <p className="text-xs text-gray-500 text-center">
                  Supported: Phantom, Solflare, and other Solana wallets
                </p>
              </div>
            </div>
          ) : !isInitialized ? (
            /* Wallet connected but keys not derived */
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <Fingerprint className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-lg font-medium mb-2">Create Privacy Identity</h3>
                <p className="text-sm text-gray-400 max-w-sm mx-auto">
                  Sign a message to derive your stealth keys.
                  Same wallet = same keys, always recoverable.
                </p>
              </div>

              {/* Connected wallet info */}
              <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#262626]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Wallet Connected</p>
                    <p className="text-xs text-gray-500 font-mono">{shortWalletAddress}</p>
                  </div>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Disconnect
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleDeriveKeys}
                disabled={isDeriving}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isDeriving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Sign to Derive Keys
                  </>
                )}
              </button>

              <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#262626]">
                <p className="text-xs text-gray-500 text-center">
                  The signature never leaves your device. It&apos;s used locally to derive your unique stealth keys.
                </p>
              </div>
            </div>
          ) : (
            /* Keys initialized - show keys and management options */
            <div className="space-y-6">
              {/* Connected wallet badge */}
              <div className="flex items-center justify-between p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-xs text-green-400 font-mono">{shortWalletAddress}</span>
                </div>
                <span className="text-xs text-green-400">Identity Active</span>
              </div>

              {/* View Level Selector - Progressive Disclosure */}
              <div className="flex gap-1 p-1 bg-[#0a0a0a] rounded-lg">
                {(['simple', 'advanced', 'expert'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setViewLevel(level)}
                    className={clsx(
                      'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                      viewLevel === level
                        ? 'bg-[#262626] text-white'
                        : 'text-gray-500 hover:text-gray-300'
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>

              {/* Stealth Meta Address - Always visible */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Stealth Meta Address</label>
                  <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">Public - share freely</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Share this to receive private payments. Each payment generates a unique one-time address - impossible to link.
                </p>
                <div className="relative">
                  <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3 pr-12 font-mono text-xs break-all">
                    {metaAddressString}
                  </div>
                  <button
                    onClick={() => handleCopy(metaAddressString!, 'meta')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-[#262626] rounded-md transition-colors"
                  >
                    {copied === 'meta' ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Advanced View - Public Keys */}
              {(viewLevel === 'advanced' || viewLevel === 'expert') && (
                <>
                  {/* View Public Key */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-400">View Public Key</label>
                      <span className="text-xs text-gray-500">Scans incoming payments</span>
                    </div>
                    <div className="relative">
                      <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3 pr-12 font-mono text-xs break-all">
                        {metaAddress?.viewPubKey}
                      </div>
                      <button
                        onClick={() => handleCopy(metaAddress!.viewPubKey, 'viewPub')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-[#262626] rounded-md transition-colors"
                      >
                        {copied === 'viewPub' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Spend Public Key */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-400">Spend Public Key</label>
                      <span className="text-xs text-gray-500">Derives one-time addresses</span>
                    </div>
                    <div className="relative">
                      <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3 pr-12 font-mono text-xs break-all">
                        {metaAddress?.spendPubKey}
                      </div>
                      <button
                        onClick={() => handleCopy(metaAddress!.spendPubKey, 'spendPub')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-[#262626] rounded-md transition-colors"
                      >
                        {copied === 'spendPub' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Expert View - Private Keys */}
              {viewLevel === 'expert' && (
                <div className="border border-red-500/20 rounded-lg overflow-hidden bg-red-500/5">
                  {!showPrivateKeys ? (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">Private Keys</span>
                      </div>

                      {!privateKeyConfirmed ? (
                        <>
                          <p className="text-xs text-gray-400">
                            Private keys give full control over funds sent to your stealth addresses.
                            You can always re-derive them by signing with the same wallet.
                          </p>
                          <button
                            onClick={handleRevealPrivateKeys}
                            className="w-full px-4 py-2.5 border border-red-500/30 hover:bg-red-500/10 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Reveal Private Keys
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-xs text-red-300 font-medium mb-2">
                              I understand that:
                            </p>
                            <ul className="text-xs text-red-300/80 space-y-1 list-disc list-inside">
                              <li>Anyone with these keys can spend my stealth funds</li>
                              <li>I can re-derive them anytime with my wallet</li>
                              <li>Keys will auto-hide after 30 seconds</li>
                            </ul>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPrivateKeyConfirmed(false)}
                              className="flex-1 px-4 py-2.5 border border-[#262626] rounded-lg text-sm font-medium hover:bg-[#1a1a1a] transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleRevealPrivateKeys}
                              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              I Understand, Reveal
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-400">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm font-medium">Private Keys Revealed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400 font-mono">
                            Auto-hide in {remainingTime}s
                          </span>
                          <button
                            onClick={hidePrivateKeys}
                            className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                          >
                            <EyeOff className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>

                      {serializedKeys && (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs text-gray-500">View Private Key</label>
                            <div className="relative">
                              <div className="bg-[#141414] border border-red-500/30 rounded-lg p-3 pr-12 font-mono text-xs break-all text-red-300">
                                {serializedKeys.viewPrivateKey}
                              </div>
                              <button
                                onClick={() => handleCopy(serializedKeys.viewPrivateKey, 'viewPriv')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-[#262626] rounded-md transition-colors"
                              >
                                {copied === 'viewPriv' ? (
                                  <Check className="w-4 h-4 text-green-400" />
                                ) : (
                                  <Copy className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-gray-500">Spend Private Key</label>
                            <div className="relative">
                              <div className="bg-[#141414] border border-red-500/30 rounded-lg p-3 pr-12 font-mono text-xs break-all text-red-300">
                                {serializedKeys.spendPrivateKey}
                              </div>
                              <button
                                onClick={() => handleCopy(serializedKeys.spendPrivateKey, 'spendPriv')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-[#262626] rounded-md transition-colors"
                              >
                                {copied === 'spendPriv' ? (
                                  <Check className="w-4 h-4 text-green-400" />
                                ) : (
                                  <Copy className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#262626]">
                <button
                  onClick={handleExport}
                  className="px-4 py-2.5 border border-[#262626] hover:bg-[#1a1a1a] rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Backup Keys
                </button>
                <button
                  onClick={handleClearKeys}
                  className="px-4 py-2.5 border border-red-500/30 hover:bg-red-500/10 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Cache
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        {isInitialized && (
          <div className="px-6 pb-6">
            <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#262626]">
              <p className="text-xs text-gray-500 text-center">
                Every payment you receive goes to a unique one-time address.
                Only you can detect and spend these funds using your view &amp; spend keys.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact display component for the header
export function StealthKeysBadge({ onClick }: { onClick: () => void }) {
  const { connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { isInitialized, isLoading, metaAddress } = useStealth();

  const handleClick = useCallback(() => {
    if (!connected) {
      // Open Phantom/wallet modal directly
      setWalletModalVisible(true);
    } else {
      // Open stealth setup modal
      onClick();
    }
  }, [connected, onClick, setWalletModalVisible]);

  if (isLoading) {
    return (
      <button
        disabled
        className="px-3 py-1.5 bg-[#1a1a1a] rounded-full text-sm flex items-center gap-2"
      >
        <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
      </button>
    );
  }

  if (!connected) {
    return (
      <button
        onClick={handleClick}
        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
      >
        <Wallet className="w-4 h-4" />
        Connect
      </button>
    );
  }

  if (!isInitialized) {
    return (
      <button
        onClick={handleClick}
        className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
      >
        <Key className="w-4 h-4" />
        Setup Privacy
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={clsx(
        "px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
        "bg-green-500/20 text-green-400 hover:bg-green-500/30"
      )}
    >
      <Shield className="w-4 h-4" />
      {metaAddress?.viewPubKey.slice(0, 4)}...{metaAddress?.viewPubKey.slice(-4)}
    </button>
  );
}
