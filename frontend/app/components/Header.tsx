'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Circle, Wallet, Building2, User, Settings } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useRole } from '../lib/role';

// Links por role
const employerLinks = [
  { href: '/explore', label: 'Payroll' },
  { href: '/mixer', label: 'Treasury' },
  { href: '/pool', label: 'Pool' },
  { href: '/dashboard', label: 'Dashboard' },
];

const recipientLinks = [
  { href: '/mixer', label: 'Treasury' },
  { href: '/pool', label: 'Pool' },
  { href: '/dashboard', label: 'Dashboard' },
];

const defaultLinks = [
  { href: '/pool', label: 'Pool' },
];

export function Header() {
  const pathname = usePathname();
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { role } = useRole();

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

  // Escolher links baseado no role
  const navLinks = role === 'employer'
    ? employerLinks
    : role === 'recipient'
    ? recipientLinks
    : defaultLinks;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 p-4">
      <div className="max-w-4xl mx-auto bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/[0.06] rounded-full px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Circle className="w-5 h-5 text-white" strokeWidth={1.5} />
          <span className="text-white font-medium text-lg">Offuscate</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? 'text-white'
                  : 'text-white/35 hover:text-white/60'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* Role indicator */}
          {role && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-white/[0.03] rounded-full border border-white/[0.06] text-white/50">
              {role === 'employer' ? (
                <Building2 className="w-3 h-3" />
              ) : (
                <User className="w-3 h-3" />
              )}
              <span className="uppercase tracking-wider">
                {role === 'employer' ? 'Company' : 'Recipient'}
              </span>
            </div>
          )}

          <span className="px-2 py-1 text-[10px] text-yellow-400/80 bg-yellow-500/10 rounded-full border border-yellow-500/20">
            devnet
          </span>

          <button
            onClick={handleConnectClick}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
              connected
                ? "bg-white/[0.03] text-white hover:bg-white/[0.06] border border-white/[0.06]"
                : "bg-white text-black hover:bg-white/90"
            }`}
          >
            <Wallet className="w-4 h-4" />
            {connected ? shortAddress : 'Connect'}
          </button>
        </div>
      </div>
    </header>
  );
}
