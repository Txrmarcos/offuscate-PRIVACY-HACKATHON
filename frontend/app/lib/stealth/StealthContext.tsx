'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { sha256 } from '@noble/hashes/sha2';
import {
  StealthKeys,
  StealthMetaAddress,
  SerializedStealthKeys,
  deriveStealthKeysFromSeed,
  getStealthMetaAddress,
  formatStealthMetaAddress,
  serializeStealthKeys,
  deserializeStealthKeys,
} from './index';

const STORAGE_KEY_PREFIX = 'offuscate:stealth-keys:';
const SIGNATURE_MESSAGE = 'Offuscate Privacy Identity\n\nSign this message to derive your stealth keys.\nThis signature is used locally and never sent to any server.\n\nDomain: offuscate.app';

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
  exportKeys: () => SerializedStealthKeys | null;
}

const StealthContext = createContext<StealthContextType | null>(null);

interface StealthProviderProps {
  children: ReactNode;
}

export function StealthProvider({ children }: StealthProviderProps) {
  const { publicKey, signMessage, connected } = useWallet();

  const [stealthKeys, setStealthKeys] = useState<StealthKeys | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeriving, setIsDeriving] = useState(false);

  const walletAddress = publicKey?.toBase58() ?? null;
  const storageKey = walletAddress ? `${STORAGE_KEY_PREFIX}${walletAddress}` : null;

  // Load keys from localStorage when wallet connects
  useEffect(() => {
    if (!storageKey) {
      setStealthKeys(null);
      setIsLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const serialized = JSON.parse(stored) as SerializedStealthKeys;
        const keys = deserializeStealthKeys(serialized);
        setStealthKeys(keys);
      } else {
        setStealthKeys(null);
      }
    } catch (error) {
      console.error('Failed to load stealth keys from storage:', error);
      localStorage.removeItem(storageKey);
      setStealthKeys(null);
    } finally {
      setIsLoading(false);
    }
  }, [storageKey]);

  // Save keys to localStorage whenever they change
  useEffect(() => {
    if (stealthKeys && storageKey) {
      const serialized = serializeStealthKeys(stealthKeys);
      localStorage.setItem(storageKey, JSON.stringify(serialized));
    }
  }, [stealthKeys, storageKey]);

  // Clear keys when wallet disconnects
  useEffect(() => {
    if (!connected) {
      setStealthKeys(null);
    }
  }, [connected]);

  // Derived values
  const metaAddress = stealthKeys ? getStealthMetaAddress(stealthKeys) : null;
  const metaAddressString = metaAddress ? formatStealthMetaAddress(metaAddress) : null;
  const isInitialized = stealthKeys !== null;

  // Derive stealth keys from wallet signature
  const deriveKeysFromWallet = useCallback(async () => {
    if (!publicKey || !signMessage) {
      throw new Error('Wallet not connected or does not support signing');
    }

    setIsDeriving(true);
    try {
      // Create the message to sign
      const message = new TextEncoder().encode(SIGNATURE_MESSAGE);

      // Request signature from wallet
      const signature = await signMessage(message);

      // Use the signature as a seed for deterministic key derivation
      // Hash the signature to get a 32-byte seed
      const seed = sha256(signature);

      // Derive stealth keys from the seed
      const keys = deriveStealthKeysFromSeed(seed);
      setStealthKeys(keys);
    } catch (error) {
      console.error('Failed to derive stealth keys:', error);
      throw error;
    } finally {
      setIsDeriving(false);
    }
  }, [publicKey, signMessage]);

  const exportKeys = useCallback((): SerializedStealthKeys | null => {
    if (!stealthKeys) return null;
    return serializeStealthKeys(stealthKeys);
  }, [stealthKeys]);

  const clearKeys = useCallback(() => {
    setStealthKeys(null);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

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
