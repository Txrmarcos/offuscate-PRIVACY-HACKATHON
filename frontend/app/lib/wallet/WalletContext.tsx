'use client';

import { ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletContextProviderProps {
  children: ReactNode;
}

/**
 * Get the RPC endpoint - PRIORITIZES HELIUS for enhanced features:
 * - Enhanced transaction parsing
 * - Priority fee estimation
 * - Better reliability and lower latency
 * - Webhook support
 */
function getEndpoint(): string {
  const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

  // Priority 1: Helius RPC (if API key configured)
  if (heliusApiKey) {
    return `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  }

  // Priority 2: Custom RPC URL
  if (process.env.NEXT_PUBLIC_RPC_URL) {
    return process.env.NEXT_PUBLIC_RPC_URL;
  }

  // Fallback: Default Solana devnet
  return 'https://api.devnet.solana.com';
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  // Use Helius RPC with priority (enhanced features, better reliability)
  const endpoint = useMemo(() => getEndpoint(), []);

  // Let the adapter auto-detect wallets (avoids duplicates)
  // Standard Wallet API wallets (Phantom, Solflare, etc.) are detected automatically
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
