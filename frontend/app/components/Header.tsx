'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Circle, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

const navLinks = [
  { href: '/explore', label: 'Explore' },
  { href: '/launch', label: 'Launch' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function Header() {
  const pathname = usePathname();
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const handleConnectClick = () => {
    if (connected) {
      disconnect();
    } else {
      setVisible(true);
    }
  };

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 p-4">
      <div className="max-w-4xl mx-auto bg-[#141414]/80 backdrop-blur-xl border border-[#262626] rounded-full px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Circle className="w-5 h-5 text-white" strokeWidth={1.5} />
          <span className="text-white font-medium text-lg">Offuscate</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'text-sm transition-colors',
                pathname === link.href
                  ? 'text-white'
                  : 'text-[#737373] hover:text-white'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* Network Badge - minimal */}
          <span className="px-2 py-1 text-[10px] text-yellow-400/80 bg-yellow-500/10 rounded-full">
            devnet
          </span>

          <button
            onClick={handleConnectClick}
            className={clsx(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
              connected
                ? "bg-[#1a1a1a] text-white hover:bg-[#262626] border border-[#262626]"
                : "bg-white text-black hover:bg-gray-100"
            )}
          >
            <Wallet className="w-4 h-4" />
            {connected ? shortAddress : 'Connect'}
          </button>
        </div>
      </div>
    </header>
  );
}
