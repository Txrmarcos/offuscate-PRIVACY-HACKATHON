'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import idlJson from '../program/idl/offuscate.json';

export type UserRole = 'employer' | 'recipient' | null;

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isLoading: boolean;
  needsOnboarding: boolean;
  pendingInviteCode: string | null;
  setPendingInviteCode: (code: string | null) => void;
  refreshRole: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

const idl = idlJson as Idl;

const ROLE_STORAGE_PREFIX = 'offuscate:role:';

export function RoleProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();

  const [role, setRoleState] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);

  // Helper to get storage key for wallet
  const getStorageKey = (wallet: string) => `${ROLE_STORAGE_PREFIX}${wallet}`;

  // Helper to save role to localStorage
  const saveRoleToStorage = (wallet: string, role: UserRole) => {
    if (typeof window === 'undefined') return;
    if (role) {
      localStorage.setItem(getStorageKey(wallet), role);
    }
  };

  // Helper to load role from localStorage
  const loadRoleFromStorage = (wallet: string): UserRole => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(getStorageKey(wallet));
    if (stored === 'employer' || stored === 'recipient') {
      return stored;
    }
    return null;
  };

  // Wrapper to set role, disable onboarding, and save to localStorage
  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
    if (newRole) {
      setNeedsOnboarding(false);
      if (publicKey) {
        saveRoleToStorage(publicKey.toBase58(), newRole);
      }
    }
  }, [publicKey]);

  // Track last checked wallet to avoid infinite loops
  const lastCheckedWallet = useRef<string | null>(null);
  const isChecking = useRef(false);

  // Check role from on-chain data
  const refreshRole = useCallback(async (force: boolean = true) => {
    // If not connected, reset state
    if (!connected || !publicKey) {
      setRoleState(null);
      setNeedsOnboarding(false);
      setIsLoading(false);
      lastCheckedWallet.current = null;
      return;
    }

    const walletAddress = publicKey.toBase58();

    // Skip if already checking
    if (isChecking.current) {
      return;
    }

    // If not forcing and wallet hasn't changed, don't re-check
    if (!force && lastCheckedWallet.current === walletAddress && role !== null) {
      return;
    }

    // Reset lastCheckedWallet to force re-check
    lastCheckedWallet.current = null;

    isChecking.current = true;
    setIsLoading(true);

    try {
      // Create a minimal program instance for reading
      const dummyWallet = {
        publicKey: Keypair.generate().publicKey,
        signTransaction: async () => { throw new Error('Read-only'); },
        signAllTransactions: async () => { throw new Error('Read-only'); },
      };
      const provider = new AnchorProvider(connection, dummyWallet as any, { commitment: 'confirmed' });
      const program = new Program(idl, provider);

      // Check if user owns any campaigns (employer)
      const campaigns = await (program.account as any).campaign.all();
      const isEmployer = campaigns.some(({ account }: any) =>
        account.owner.toBase58() === walletAddress
      );

      if (isEmployer) {
        setRoleState('employer');
        setNeedsOnboarding(false);
        saveRoleToStorage(walletAddress, 'employer');
        lastCheckedWallet.current = walletAddress;
        setIsLoading(false);
        isChecking.current = false;
        return;
      }

      // Check if user has accepted any invites (recipient)
      try {
        const invites = await (program.account as any).invite.all();
        const isRecipient = invites.some(({ account }: any) => {
          const statusKey = Object.keys(account.status)[0];
          return account.recipient.toBase58() === walletAddress && statusKey === 'accepted';
        });

        if (isRecipient) {
          setRoleState('recipient');
          setNeedsOnboarding(false);
          saveRoleToStorage(walletAddress, 'recipient');
          lastCheckedWallet.current = walletAddress;
          setIsLoading(false);
          isChecking.current = false;
          return;
        }
      } catch (e) {
        // Invite account type might not exist yet
        console.log('No invites found or invite type not initialized');
      }

      // User has no on-chain role yet
      // Check if they have a stored role preference (e.g., selected "employer" in onboarding)
      const storedRole = loadRoleFromStorage(walletAddress);
      lastCheckedWallet.current = walletAddress;

      if (pendingInviteCode) {
        setRoleState(null);
        setNeedsOnboarding(false);
      } else if (storedRole) {
        // Respect localStorage role if user already selected one
        setRoleState(storedRole);
        setNeedsOnboarding(false);
      } else {
        setRoleState(null);
        setNeedsOnboarding(true);
      }
    } catch (err) {
      console.error('Failed to check role:', err);
      setRoleState(null);
      setNeedsOnboarding(true);
    } finally {
      setIsLoading(false);
      isChecking.current = false;
    }
  }, [connected, publicKey, connection, pendingInviteCode, role]);

  // Initial check when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      const walletAddress = publicKey.toBase58();

      // First, try to load from localStorage for instant UI update
      const storedRole = loadRoleFromStorage(walletAddress);
      if (storedRole) {
        setRoleState(storedRole);
        setNeedsOnboarding(false);
        setIsLoading(false);
      }

      // Then verify with on-chain data (in background)
      if (lastCheckedWallet.current !== walletAddress) {
        refreshRole(false); // Don't force on initial load
      }
    } else {
      setRoleState(null);
      setNeedsOnboarding(false);
      setIsLoading(false);
      lastCheckedWallet.current = null;
    }
  }, [connected, publicKey?.toBase58()]);

  // Check for invite code in URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const inviteMatch = path.match(/\/invite\/([A-Za-z0-9]+)/);
      if (inviteMatch) {
        setPendingInviteCode(inviteMatch[1]);
      }
    }
  }, []);

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        isLoading,
        needsOnboarding,
        pendingInviteCode,
        setPendingInviteCode,
        refreshRole,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}

// Helper hooks for common checks
export function useIsEmployer() {
  const { role } = useRole();
  return role === 'employer';
}

export function useIsRecipient() {
  const { role } = useRole();
  return role === 'recipient';
}
