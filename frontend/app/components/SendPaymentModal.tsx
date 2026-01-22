'use client';

import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Lock, ArrowRight, Check, Shield } from 'lucide-react';
import { PrivacyLevel } from '../lib/types';

interface SendPaymentModalProps {
  onClose: () => void;
}

type ModalStep = 'form' | 'processing' | 'success';

const privacyOptions: {
  level: PrivacyLevel;
  title: string;
  description: string;
  icon: typeof Eye;
}[] = [
  {
    level: 'PUBLIC',
    title: 'Public',
    description: 'Standard transfer. Fully visible on explorer.',
    icon: Eye,
  },
  {
    level: 'SEMI',
    title: 'Semi-Private',
    description: 'Stealth address relayer. Sender hidden.',
    icon: EyeOff,
  },
  {
    level: 'PRIVATE',
    title: 'Fully Private',
    description: 'Zero-Knowledge. Sender, Receiver, Amount hidden.',
    icon: Lock,
  },
];

const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  PUBLIC: 'Public',
  SEMI: 'Semi-Private',
  PRIVATE: 'Fully Private',
};

function generateHash(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  for (let i = 0; i < 20; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export function SendPaymentModal({ onClose }: SendPaymentModalProps) {
  const [step, setStep] = useState<ModalStep>('form');
  const [selectedPrivacy, setSelectedPrivacy] = useState<PrivacyLevel>('PRIVATE');
  const [recipient, setRecipient] = useState('Save The Children DAO');
  const [amount, setAmount] = useState('10.00');
  const [proofHash, setProofHash] = useState('');
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    if (step === 'processing') {
      setProofHash('');
      let hash = '';
      const interval = setInterval(() => {
        hash += generateHash().slice(0, 3);
        setProofHash(hash + '...');
      }, 200);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        setTxHash('8xF2' + generateHash().slice(0, 4) + '...' + generateHash().slice(0, 4) + '9kLp');
        setStep('success');
      }, 3000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [step]);

  const handleContinue = () => {
    setStep('processing');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-[#141414] border border-[#262626] rounded-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#737373] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step 1: Form */}
        {step === 'form' && (
          <>
            <h2 className="text-xl font-semibold text-white mb-6">
              Select Privacy Level
            </h2>

            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[#737373]">Sending to</span>
              <span className="text-[#737373]">Amount</span>
            </div>
            <div className="flex items-center justify-between mb-6">
              <span className="text-white font-medium">{recipient}</span>
              <span className="text-white font-semibold">{amount} SOL</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {privacyOptions.map((option) => (
                <button
                  key={option.level}
                  onClick={() => setSelectedPrivacy(option.level)}
                  className={`relative p-4 rounded-xl border text-left transition-all h-full ${
                    selectedPrivacy === option.level
                      ? 'border-white bg-[#1a1a1a]'
                      : 'border-[#262626] hover:border-[#404040]'
                  }`}
                >
                  {selectedPrivacy === option.level && (
                    <span className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                  <option.icon
                    className={`w-5 h-5 mb-3 ${
                      selectedPrivacy === option.level
                        ? 'text-white'
                        : 'text-[#737373]'
                    }`}
                  />
                  <div className="text-white font-medium mb-1">{option.title}</div>
                  <p className="text-[#737373] text-xs">{option.description}</p>
                </button>
              ))}
            </div>

            <button
              onClick={handleContinue}
              className="w-full py-4 bg-white text-black font-medium rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="py-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-2 border-[#262626] rounded-full" />
              <div className="absolute inset-0 border-2 border-white rounded-full border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              Generating ZK Proof
            </h2>
            <p className="text-[#737373] text-sm mb-6">
              Constructing zero-knowledge proof to verify
              <br />
              transaction validity without revealing inputs...
            </p>

            <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-4 font-mono text-xs text-[#737373] break-all">
              {proofHash || 'Initializing...'}
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <div className="py-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-[#1a1a1a] rounded-full flex items-center justify-center border-2 border-[#262626]">
              <Check className="w-10 h-10 text-white" />
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              Payment Sent
            </h2>
            <p className="text-[#737373] text-sm mb-6">
              Your transaction has been submitted to the Solana network.
            </p>

            <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                <span className="text-[#737373] text-sm">Status</span>
                <div className="flex items-center gap-2 text-white text-sm">
                  <Lock className="w-4 h-4" />
                  {PRIVACY_LABELS[selectedPrivacy]}
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                <span className="text-[#737373] text-sm">Transaction Hash</span>
                <span className="text-white text-sm font-mono bg-[#1a1a1a] px-2 py-1 rounded">
                  {txHash}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[#737373] text-sm">Block Time</span>
                <span className="text-white text-sm">Just now</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-4 bg-white text-black font-medium rounded-full hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
