'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Circle, Wallet, Building2, User, LogOut, Copy, Check, ExternalLink, ChevronDown } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRole } from '../lib/role';

// Links por role
const employerLinks = [
  { href: '/mixer', label: 'Treasury' },
  { href: '/payroll', label: 'Payroll' },
  { href: '/dashboard', label: 'Activity' },
  { href: '/pool', label: 'Pool' },
];

const recipientLinks = [
  { href: '/salary', label: 'Salary' },
  { href: '/dashboard', label: 'Activity' },
  { href: '/pool', label: 'Pool' },
];

const defaultLinks = [
  { href: '/pool', label: 'Pool' },
];

export function Header() {
  const pathname = usePathname();
  const { connected, publicKey, disconnect, wallets, select, connecting } = useWallet();
  const { role } = useRole();

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowConnectModal(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnectClick = () => {
    if (connected) {
      setShowDropdown(!showDropdown);
    } else {
      setShowConnectModal(true);
    }
  };

  const handleWalletSelect = async (walletName: string) => {
    const wallet = wallets.find(w => w.adapter.name === walletName);
    if (wallet) {
      select(wallet.adapter.name);
      setShowConnectModal(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
  };

  const handleCopyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  const fullAddress = publicKey?.toBase58() || '';

  // Escolher links baseado no role
  const navLinks = role === 'employer'
    ? employerLinks
    : role === 'recipient'
    ? recipientLinks
    : defaultLinks;

  // Filter installed wallets
  const installedWallets = wallets.filter(w => w.readyState === 'Installed');

  return (
    <>
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

            {/* Wallet Button with Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={handleConnectClick}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  connected
                    ? "bg-white/[0.03] text-white hover:bg-white/[0.06] border border-white/[0.06]"
                    : "bg-white text-black hover:bg-white/90"
                }`}
              >
                <Wallet className="w-4 h-4" />
                {connecting ? 'Connecting...' : connected ? shortAddress : 'Connect'}
                {connected && <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />}
              </button>

              {/* Dropdown Menu */}
              {showDropdown && connected && (
                <div className="absolute right-0 mt-2 w-64 bg-[#0a0a0a] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden z-50">
                  {/* Address Section */}
                  <div className="p-4 border-b border-white/[0.06]">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Connected Wallet</p>
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-mono flex-1 truncate">
                        {fullAddress.slice(0, 12)}...{fullAddress.slice(-8)}
                      </p>
                      <button
                        onClick={handleCopyAddress}
                        className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <a
                        href={`https://explorer.solana.com/address/${fullAddress}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Disconnect Button */}
                  <div className="p-2">
                    <button
                      onClick={handleDisconnect}
                      className="w-full px-4 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/[0.05] transition-all flex items-center gap-3 text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Custom Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConnectModal(false)}
          />

          {/* Modal */}
          <div
            ref={modalRef}
            className="relative w-full max-w-sm mx-4 bg-[#0a0a0a] border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 pb-4 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white/60" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-1">Connect Wallet</h2>
              <p className="text-white/40 text-sm">Select a wallet to continue</p>
            </div>

            {/* Wallet List */}
            <div className="px-4 pb-6 space-y-2">
              {installedWallets.length > 0 ? (
                installedWallets.map((wallet) => (
                  <button
                    key={wallet.adapter.name}
                    onClick={() => handleWalletSelect(wallet.adapter.name)}
                    className="w-full px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all flex items-center gap-4"
                  >
                    {wallet.adapter.icon && (
                      <img
                        src={wallet.adapter.icon}
                        alt={wallet.adapter.name}
                        className="w-8 h-8 rounded-lg"
                      />
                    )}
                    <span className="text-white font-medium text-sm flex-1 text-left">
                      {wallet.adapter.name}
                    </span>
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">
                      Detected
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/40 text-sm mb-4">No wallets detected</p>
                  <a
                    href="https://phantom.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] text-white/60 hover:text-white hover:bg-white/[0.08] transition-all text-sm"
                  >
                    Install Phantom
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowConnectModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
