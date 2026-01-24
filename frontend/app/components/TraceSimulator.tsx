'use client';

import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Search, Shield, Lock, User, Wallet, ArrowRight, X, Check, AlertTriangle } from 'lucide-react';
import { PrivacyLevel } from '../lib/types';

interface TraceSimulatorProps {
  privacyLevel: PrivacyLevel;
  senderAddress: string;
  onClose?: () => void;
}

// Simulated explorer search
function ExplorerSimulation({ privacyLevel, senderAddress }: { privacyLevel: PrivacyLevel; senderAddress: string }) {
  const [step, setStep] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);

  const shortAddr = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  // Auto-play the simulation
  useEffect(() => {
    const timer1 = setTimeout(() => setIsSearching(true), 500);
    const timer2 = setTimeout(() => {
      setIsSearching(false);
      setSearchComplete(true);
      setStep(1);
    }, 2500);
    const timer3 = setTimeout(() => setStep(2), 4000);
    const timer4 = setTimeout(() => setStep(3), 5500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, []);

  const isProtected = privacyLevel !== 'PUBLIC';

  return (
    <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Fake browser header */}
      <div className="bg-white/[0.02] border-b border-white/[0.06] px-4 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/15" />
          <div className="w-3 h-3 rounded-full bg-white/10" />
        </div>
        <div className="flex-1 bg-white/[0.05] rounded-lg px-3 py-1 text-xs text-white/40 font-mono">
          explorer.solana.com/address/{shortAddr(senderAddress)}
        </div>
      </div>

      {/* Fake explorer content */}
      <div className="p-4">
        {/* Search bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`flex-1 bg-white/[0.02] border rounded-lg px-3 py-2 flex items-center gap-2 ${
            isSearching ? 'border-white/20' : 'border-white/[0.06]'
          }`}>
            <Search className={`w-4 h-4 ${isSearching ? 'text-white animate-pulse' : 'text-white/30'}`} />
            <span className="text-white/60 text-sm font-mono">{shortAddr(senderAddress)}</span>
          </div>
        </div>

        {/* Search animation */}
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-white/40">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <span className="text-sm">Searching blockchain...</span>
            </div>
          </div>
        )}

        {/* Results */}
        {searchComplete && (
          <div className="space-y-3">
            {/* Result header */}
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              isProtected
                ? 'bg-white/[0.05] border border-white/[0.1]'
                : 'bg-white/[0.02] border border-white/[0.06]'
            }`}>
              {isProtected ? (
                <>
                  <Shield className="w-5 h-5 text-white" />
                  <span className="text-white text-sm font-medium">No direct connection found</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-white/50" />
                  <span className="text-white/50 text-sm font-medium">Transaction trace found!</span>
                </>
              )}
            </div>

            {/* Transaction trace visualization */}
            <div className="bg-white/[0.02] rounded-lg p-4">
              <div className="flex items-center justify-between">
                {/* Sender */}
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                    isProtected ? 'bg-white/[0.08] border border-white/[0.15]' : 'bg-white/[0.03] border border-white/[0.06]'
                  }`}>
                    <Wallet className={`w-6 h-6 ${isProtected ? 'text-white' : 'text-white/40'}`} />
                  </div>
                  <span className="text-[10px] text-white/40">Your Wallet</span>
                  <span className={`text-xs font-mono mt-1 ${
                    isProtected ? 'text-white/30 blur-sm' : 'text-white/60'
                  }`}>
                    {shortAddr(senderAddress)}
                  </span>
                </div>

                {/* Connection line */}
                <div className="flex-1 mx-4 relative">
                  <div className={`h-0.5 ${isProtected ? 'bg-white/5' : 'bg-white/20'}`} />

                  {/* Animation dots for public */}
                  {!isProtected && step >= 2 && (
                    <div className="absolute inset-0 flex items-center">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="absolute w-2 h-2 rounded-full bg-white/50"
                          style={{
                            left: `${i * 25}%`,
                            animation: 'pulse 1s ease-in-out infinite',
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Privacy shield for protected */}
                  {isProtected && (
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="w-10 h-10 rounded-full bg-white/[0.08] border border-white/[0.15] flex items-center justify-center">
                        {privacyLevel === 'ZK_COMPRESSED' ? (
                          <Lock className="w-5 h-5 text-white" />
                        ) : (
                          <Shield className="w-5 h-5 text-white" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Arrow */}
                  <ArrowRight className={`absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                    isProtected ? 'text-white/20' : 'text-white/50'
                  }`} />
                </div>

                {/* Receiver */}
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center mb-2">
                    <User className="w-6 h-6 text-white/40" />
                  </div>
                  <span className="text-[10px] text-white/40">Recipient</span>
                  <span className="text-xs font-mono mt-1 text-white/30">
                    {isProtected ? '????' : 'Visible'}
                  </span>
                </div>
              </div>
            </div>

            {/* Explanation */}
            {step >= 3 && (
              <div className={`p-3 rounded-lg text-xs ${
                isProtected
                  ? 'bg-white/[0.03] border border-white/[0.08] text-white/60'
                  : 'bg-white/[0.02] border border-white/[0.06] text-white/40'
              }`}>
                {isProtected ? (
                  privacyLevel === 'ZK_COMPRESSED' ? (
                    <p>
                      <strong className="text-white">ZK Protected:</strong> The transaction uses Light Protocol compression.
                      Searching for your wallet address won't reveal the connection to this transfer because the actual
                      transfer happens in a compressed state with only ZK proofs on-chain.
                    </p>
                  ) : privacyLevel === 'SEMI' ? (
                    <p>
                      <strong className="text-white">Pool Mixed:</strong> Your deposit went into a shared privacy pool.
                      The withdrawal to the recipient comes from the pool, not your wallet. Searching your address
                      only shows a deposit to the pool - not the final destination.
                    </p>
                  ) : (
                    <p>
                      <strong className="text-white">Private:</strong> This transaction uses advanced privacy techniques
                      to hide the connection between your wallet and the recipient.
                    </p>
                  )
                ) : (
                  <p>
                    <strong className="text-white/60">Exposed:</strong> Anyone can search your wallet address on Solana Explorer
                    and see this exact transaction, including the recipient and amount. Your donation is publicly linked to your wallet.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

// Main component with comparison view
export function TraceSimulator({ privacyLevel, senderAddress, onClose }: TraceSimulatorProps) {
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/[0.06] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.06] mb-4">
            <Search className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/60">Trace Simulator</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Can Your Transaction Be Traced?
          </h2>
          <p className="text-white/40 text-sm">
            See how your privacy level affects traceability on the blockchain explorer
          </p>
        </div>

        <ExplorerSimulation privacyLevel={privacyLevel} senderAddress={senderAddress} />

        {/* Toggle comparison */}
        {!showComparison && privacyLevel !== 'PUBLIC' && (
          <button
            onClick={() => setShowComparison(true)}
            className="w-full mt-4 py-2 text-white/40 hover:text-white text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Eye className="w-4 h-4" />
            Show what PUBLIC would look like
          </button>
        )}

        {showComparison && (
          <div className="mt-6 pt-6 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <div className="px-2 py-1 rounded bg-white/[0.05] text-white/50 text-xs">PUBLIC</div>
              <span className="text-white/40 text-sm">For comparison - this is what trackers would see:</span>
            </div>
            <ExplorerSimulation privacyLevel="PUBLIC" senderAddress={senderAddress} />
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline button to trigger the simulator
export function TraceSimulatorButton({
  privacyLevel,
  senderAddress
}: {
  privacyLevel: PrivacyLevel;
  senderAddress: string;
}) {
  const [showSimulator, setShowSimulator] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowSimulator(true)}
        className="inline-flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        <Search className="w-3 h-3" />
        Test traceability
      </button>

      {showSimulator && (
        <TraceSimulator
          privacyLevel={privacyLevel}
          senderAddress={senderAddress}
          onClose={() => setShowSimulator(false)}
        />
      )}
    </>
  );
}
