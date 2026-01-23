'use client';

import { ReactNode } from 'react';
import { WalletContextProvider } from './lib/wallet/WalletContext';
import { StealthProvider } from './lib/stealth/StealthContext';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WalletContextProvider>
      <StealthProvider>
        {children}
      </StealthProvider>
    </WalletContextProvider>
  );
}
