'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { sha256 } from '@noble/hashes/sha2';
import {
  StealthKeys,
  StealthMetaAddress,
  deriveStealthKeysFromSeed,
  getStealthMetaAddress,
  formatStealthMetaAddress,
} from './index';

// Deterministic message for key derivation - same message = same keys
const SIGNATURE_MESSAGE = 'Offuscate Privacy Identity\n\nSign this message to derive your stealth keys.\nThis signature is used locally and never sent to any server.\n\nDomain: offuscate.app';

interface ExportedKeys {
  viewPrivateKey: string;
  viewPublicKey: string;
  spendPrivateKey: string;
  spendPublicKey: string;
  metaAddress: string;
  walletAddress: string | null;
}

interface StealthContextType {
  // State
  stealthKeys: StealthKeys | null;
  metaAddress: StealthMetaAddress | null;
  metaAddressString: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  isDeriving: boolean;
  walletAddress: string | null;

  // Actions
  deriveKeysFromWallet: () => Promise<void>;
  clearKeys: () => void;
  exportKeys: () => ExportedKeys | null;
}

const StealthContext = createContext<StealthContextType | null>(null);

interface StealthProviderProps {
  children: ReactNode;
}

export function StealthProvider({ children }: StealthProviderProps) {
  const { publicKey, signMessage, connected } = useWallet();

  const [stealthKeys, setStealthKeys] = useState<StealthKeys | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeriving, setIsDeriving] = useState(false);

  const walletAddress = publicKey?.toBase58() ?? null;

  // Auto-derive keys when wallet connects, clear when disconnects
  useEffect(() => {
    if (!connected) {
      setStealthKeys(null);
      return;
    }

    // Auto-derive stealth keys when wallet connects
    if (connected && publicKey && signMessage && !stealthKeys && !isDeriving) {
      const autoDeriveKeys = async () => {
        setIsDeriving(true);
        try {
          const message = new TextEncoder().encode(SIGNATURE_MESSAGE);
          const signature = await signMessage(message);
          const seed = sha256(signature);
          const keys = deriveStealthKeysFromSeed(seed);
          setStealthKeys(keys);
        } catch (error) {
          console.error('Failed to auto-derive stealth keys:', error);
        } finally {
          setIsDeriving(false);
        }
      };

      autoDeriveKeys();
    }
  }, [connected, publicKey, signMessage, stealthKeys, isDeriving]);

  // Derived values
  const metaAddress = stealthKeys ? getStealthMetaAddress(stealthKeys) : null;
  const metaAddressString = metaAddress ? formatStealthMetaAddress(metaAddress) : null;
  const isInitialized = stealthKeys !== null;

  // Derive stealth keys from wallet signature
  // Keys are NEVER stored - derived fresh each session
  const deriveKeysFromWallet = useCallback(async () => {
    if (!publicKey || !signMessage) {
      throw new Error('Wallet not connected or does not support signing');
    }

    setIsDeriving(true);
    try {
      // Create the message to sign (deterministic)
      const message = new TextEncoder().encode(SIGNATURE_MESSAGE);

      // Request signature from wallet
      // Same wallet + same message = same signature = same keys
      const signature = await signMessage(message);

      // Hash the signature to get a 32-byte seed
      const seed = sha256(signature);

      // Derive stealth keys from the seed (deterministic)
      const keys = deriveStealthKeysFromSeed(seed);

      // Store in memory only - NEVER in localStorage
      setStealthKeys(keys);
    } catch (error) {
      console.error('Failed to derive stealth keys:', error);
      throw error;
    } finally {
      setIsDeriving(false);
    }
  }, [publicKey, signMessage]);

  const clearKeys = useCallback(() => {
    setStealthKeys(null);
  }, []);

  const exportKeys = useCallback((): ExportedKeys | null => {
    if (!stealthKeys || !metaAddressString) return null;

    const toHex = (bytes: Uint8Array) =>
      Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

    return {
      viewPrivateKey: toHex(stealthKeys.viewKey.privateKey),
      viewPublicKey: toHex(stealthKeys.viewKey.publicKey),
      spendPrivateKey: toHex(stealthKeys.spendKey.privateKey),
      spendPublicKey: toHex(stealthKeys.spendKey.publicKey),
      metaAddress: metaAddressString,
      walletAddress,
    };
  }, [stealthKeys, metaAddressString, walletAddress]);

  const value: StealthContextType = {
    stealthKeys,
    metaAddress,
    metaAddressString,
    isInitialized,
    isLoading,
    isDeriving,
    walletAddress,
    deriveKeysFromWallet,
    clearKeys,
    exportKeys,
  };

  return (
    <StealthContext.Provider value={value}>
      {children}
    </StealthContext.Provider>
  );
}

export function useStealth(): StealthContextType {
  const context = useContext(StealthContext);
  if (!context) {
    throw new Error('useStealth must be used within a StealthProvider');
  }
  return context;
}
