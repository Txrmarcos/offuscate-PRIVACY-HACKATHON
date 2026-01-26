'use client';

import { ReactNode } from 'react';
import { WalletContextProvider } from './lib/wallet/WalletContext';
import { StealthProvider } from './lib/stealth/StealthContext';
import { RoleProvider } from './lib/role';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WalletContextProvider>
      <StealthProvider>
        <RoleProvider>
          {children}
        </RoleProvider>
      </StealthProvider>
    </WalletContextProvider>
  );
}
