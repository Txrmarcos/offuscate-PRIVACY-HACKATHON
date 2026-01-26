'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Lock,
  Zap,
  Eye,
  EyeOff,
  ArrowRight,
  Briefcase,
  Building2,
  Users,
  Wallet,
  ArrowLeftRight,
  Binary,
  CheckCircle,
  FileText,
  TrendingUp,
  DollarSign,
  Link as LinkIcon,
} from 'lucide-react';
import { Globe } from './components/ui/Globe';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useRole } from './lib/role';

const rotatingWords = ['Private', 'Confidential', 'Protected', 'Secure'];

export default function Home() {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [showUserMessage, setShowUserMessage] = useState(false);
  const [pendingCompanyRedirect, setPendingCompanyRedirect] = useState(false);

  const router = useRouter();
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { setRole } = useRole();

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % rotatingWords.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleCompanyClick = () => {
    if (connected) {
      setRole('employer');
      router.push('/explore');
    } else {
      setPendingCompanyRedirect(true);
      setVisible(true);
    }
  };

  // Redirect to explore after connecting (if company button was clicked)
  useEffect(() => {
    if (connected && pendingCompanyRedirect) {
      setPendingCompanyRedirect(false);
      setRole('employer');
      router.push('/explore');
    }
  }, [connected, pendingCompanyRedirect, router, setRole]);

  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, #050505 0%, #080808 50%, #050505 100%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 min-h-screen">
        {/* Globe Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="blur-[1px] opacity-20 scale-110">
            {mounted && <Globe size={800} />}
          </div>
        </div>

        {/* Content */}
        <motion.div
          className="relative z-20 text-center max-w-5xl mx-auto w-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs text-white/50 uppercase tracking-widest">
              Enterprise Privacy Infrastructure
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            className="text-4xl md:text-6xl font-bold leading-tight mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-white">Private Payroll & Payments</span>
            <br />
            <span className="text-white/60">on Solana</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg text-white/40 max-w-2xl mx-auto mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Pay employees, contributors and suppliers without exposing salaries,
            payouts or treasury activity on-chain.
          </motion.p>

          {/* Two Round Buttons */}
          <motion.div
            className="flex flex-col items-center gap-6 mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center justify-center gap-4">
              {/* Company - White Button */}
              <button
                onClick={handleCompanyClick}
                className="w-14 h-14 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition-all hover:scale-110 active:scale-95"
                title="Company"
              >
                <Building2 className="w-6 h-6 text-black" />
              </button>

              {/* User - Gray Button */}
              <button
                onClick={() => setShowUserMessage(true)}
                className="w-14 h-14 rounded-full bg-white/[0.1] border border-white/[0.15] flex items-center justify-center hover:bg-white/[0.2] transition-all hover:scale-110 active:scale-95"
                title="User"
              >
                <Users className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* User Message */}
            <AnimatePresence>
              {showUserMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.1]"
                >
                  <LinkIcon className="w-4 h-4 text-white/50" />
                  <span className="text-sm text-white/60">
                    Recipients enter via invite link from employer
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Quick explanation */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <p className="text-white/25 text-sm max-w-xl mx-auto">
              Financial privacy is a business necessity, not a luxury.
              Protect your competitive advantage.
            </p>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <div className="w-6 h-10 rounded-full border-2 border-white/10 flex items-start justify-center p-2 mx-auto">
              <motion.div
                className="w-1 h-2 rounded-full bg-white/30"
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Why Companies Need Financial Privacy */}
      <section className="relative z-10 px-6 py-24 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Why Companies Need Financial Privacy
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              On-chain transparency creates real business risks
            </p>
          </motion.div>

          {/* Risk Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: Users,
                title: 'Salary Exposure',
                description: 'Public payroll data enables poaching, creates internal conflicts, and violates employee privacy.',
              },
              {
                icon: TrendingUp,
                title: 'Competitive Intelligence',
                description: 'Competitors can track your vendor relationships, spending patterns, and business strategy.',
              },
              {
                icon: DollarSign,
                title: 'Treasury Vulnerability',
                description: 'Visible treasury balances make you a target for attacks and manipulation.',
              },
            ].map((risk, index) => (
              <motion.div
                key={risk.title}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <risk.icon className="w-8 h-8 text-white/60 mb-4" />
                <h3 className="text-white font-semibold mb-2">{risk.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{risk.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What Data Stays Hidden */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              What Data Stays Hidden
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Cryptographic privacy, not just obscurity
            </p>
          </motion.div>

          {/* Comparison */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Standard Transaction */}
            <motion.div
              className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center">
                  <Eye className="w-5 h-5 text-white/30" />
                </div>
                <div>
                  <h3 className="text-white/60 font-medium">Standard On-Chain Payment</h3>
                  <p className="text-xs text-white/25">Fully transparent</p>
                </div>
              </div>

              <div className="space-y-3 font-mono text-sm">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-white/30">Sender</span>
                  <span className="text-white/50">Company Treasury - Exposed</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-white/30">Recipient</span>
                  <span className="text-white/50">Employee Wallet - Exposed</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-white/30">Amount</span>
                  <span className="text-white/50">$15,000 - Exposed</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-white/30">Timing</span>
                  <span className="text-white/50">Monthly pattern - Exposed</span>
                </div>
              </div>
            </motion.div>

            {/* Private Payment */}
            <motion.div
              className="p-6 rounded-2xl bg-white/[0.04] border border-white/[0.12]"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-white/[0.08] flex items-center justify-center">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-medium">Private Payroll Payment</h3>
                  <p className="text-xs text-white/40">Cryptographically protected</p>
                </div>
              </div>

              <div className="space-y-3 font-mono text-sm">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                  <span className="text-white/40">Sender</span>
                  <span className="text-white">Payroll Pool - Unlinkable</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                  <span className="text-white/40">Recipient</span>
                  <span className="text-white">Stealth Address - Private</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                  <span className="text-white/40">Amount</span>
                  <span className="text-white">Hidden - ZK Protected</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                  <span className="text-white/40">Timing</span>
                  <span className="text-white">Batched - Pattern broken</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Privacy Microcopy */}
          <motion.div
            className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <p className="text-white/50 text-sm">
              Recipients and amounts are not linkable on-chain.
              Only the recipient can prove they received payment.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="relative z-10 px-6 py-24 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Built For
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Organizations that value financial confidentiality
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Building2,
                title: 'DAOs & Protocols',
                items: ['Core team compensation', 'Grant disbursements', 'Contributor payouts'],
              },
              {
                icon: Briefcase,
                title: 'Web3 Startups',
                items: ['Employee payroll', 'Contractor payments', 'Investor distributions'],
              },
              {
                icon: FileText,
                title: 'Enterprises',
                items: ['Vendor settlements', 'Treasury operations', 'Cross-border payments'],
              },
            ].map((segment, index) => (
              <motion.div
                key={segment.title}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <segment.icon className="w-10 h-10 text-white/60 mb-4" />
                <h3 className="text-white font-semibold text-lg mb-4">{segment.title}</h3>
                <ul className="space-y-2">
                  {segment.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-white/40">
                      <CheckCircle className="w-4 h-4 text-white/30" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack / Trust Section */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Enterprise-Grade Privacy Infrastructure
            </h2>
            <p className="text-white/40 text-sm">
              Cryptographic guarantees, not promises
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Binary, name: 'Light Protocol', desc: 'ZK Compression' },
              { icon: EyeOff, name: 'Stealth Addresses', desc: 'One-time recipients' },
              { icon: Shield, name: 'Payroll Pool', desc: 'Batch settlement' },
              { icon: Zap, name: 'Solana Speed', desc: 'Sub-second finality' },
            ].map((tech, index) => (
              <motion.div
                key={tech.name}
                className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <tech.icon className="w-7 h-7 text-white/60 mx-auto mb-3" />
                <div className="text-white text-sm font-medium">{tech.name}</div>
                <div className="text-white/30 text-xs mt-1">{tech.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative z-10 px-6 py-24">
        <motion.div
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="p-10 rounded-3xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.08]">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                Get Started
              </h2>
              <p className="text-white/40">
                Choose how you want to use private payments
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Link
                href="/explore"
                className="group flex items-center gap-4 p-5 rounded-2xl bg-white hover:bg-white/90 transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-black/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-black/70" />
                </div>
                <div className="flex-1">
                  <div className="text-black font-semibold">Run Payroll</div>
                  <div className="text-black/50 text-sm">Pay teams privately</div>
                </div>
                <ArrowRight className="w-5 h-5 text-black/40 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/mixer"
                className="group flex items-center gap-4 p-5 rounded-2xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-white/[0.08] flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white/70" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold">Treasury Operations</div>
                  <div className="text-white/50 text-sm">Move funds privately</div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/40 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold">Offuscate</span>
          </div>
          <div className="text-white/30 text-sm">
            Private Payroll Infrastructure for Web3
          </div>
          <div className="flex items-center gap-4 text-white/30 text-sm">
            <span>Built on Solana</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
