'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Lock,
  Zap,
  Eye,
  EyeOff,
  ArrowRight,
  Heart,
  Shuffle,
  Send,
  Users,
  Coins,
  Code,
  Binary,
  Wallet,
  ArrowLeftRight,
} from 'lucide-react';
import { Globe } from './components/ui/Globe';

const rotatingWords = ['Untraceable', 'Private', 'Anonymous', 'Protected'];

export default function Home() {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % rotatingWords.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

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
              Privacy Infrastructure on Solana
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            className="text-4xl md:text-6xl font-bold leading-tight mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-white">Your Transactions.</span>
            <br />
            <AnimatePresence mode="wait">
              <motion.span
                key={currentWordIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="inline-block bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent"
              >
                {rotatingWords[currentWordIndex]}.
              </motion.span>
            </AnimatePresence>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg text-white/40 max-w-2xl mx-auto mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Move money without being watched. On Solana.
          </motion.p>

          {/* TWO MAIN PRODUCTS - Clear Cards */}
          <motion.div
            className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {/* DONATE PRIVATELY */}
            <Link href="/explore" className="group block">
              <div className="relative h-full p-8 rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] hover:border-white/[0.15] transition-all hover:scale-[1.02] active:scale-[0.98]">
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-white/[0.08] flex items-center justify-center mb-6 group-hover:bg-white/[0.12] transition-colors">
                  <Heart className="w-8 h-8 text-white" />
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-white mb-2">
                  Donate Privately
                </h2>

                {/* Description */}
                <p className="text-white/50 mb-6 leading-relaxed">
                  Support campaigns and causes without exposing your wallet. Your identity stays hidden.
                </p>

                {/* Features */}
                <div className="space-y-2 mb-6">
                  {[
                    'Fund causes anonymously',
                    'Protect sensitive donations',
                    'ZK proofs hide your identity',
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-white/40">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2 text-white font-medium group-hover:gap-3 transition-all">
                  <span>Browse Campaigns</span>
                  <ArrowRight className="w-4 h-4" />
                </div>

                {/* Badge */}
                <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08]">
                  <span className="text-[10px] text-white/50 uppercase tracking-wider">Crowdfunding</span>
                </div>
              </div>
            </Link>

            {/* TRANSFER PRIVATELY */}
            <Link href="/mixer" className="group block">
              <div className="relative h-full p-8 rounded-3xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06] hover:border-white/[0.12] transition-all hover:scale-[1.02] active:scale-[0.98]">
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-white/[0.05] flex items-center justify-center mb-6 group-hover:bg-white/[0.08] transition-colors">
                  <Shuffle className="w-8 h-8 text-white/80" />
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-white mb-2">
                  Transfer Privately
                </h2>

                {/* Description */}
                <p className="text-white/50 mb-6 leading-relaxed">
                  Move SOL between wallets without leaving a trace. Break the on-chain link.
                </p>

                {/* Features */}
                <div className="space-y-2 mb-6">
                  {[
                    'Wallet to wallet, untraceable',
                    'Mix funds with others',
                    'Stealth addresses included',
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-white/40">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2 text-white/80 font-medium group-hover:gap-3 group-hover:text-white transition-all">
                  <span>Open ShadowMix</span>
                  <ArrowRight className="w-4 h-4" />
                </div>

                {/* Badge */}
                <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">Personal</span>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Quick explanation */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <p className="text-white/25 text-sm max-w-xl mx-auto">
              Privacy isn't about hiding something wrong.
              It's about controlling who sees your financial life.
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

      {/* How It Protects You Section */}
      <section className="relative z-10 px-6 py-24 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              See What's Hidden
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              With Offuscate, your transactions become untraceable
            </p>
          </motion.div>

          {/* Comparison */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Without Offuscate */}
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
                  <h3 className="text-white/60 font-medium">Normal Transfer</h3>
                  <p className="text-xs text-white/25">Everyone can see</p>
                </div>
              </div>

              <div className="space-y-3 font-mono text-sm">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-white/30">From</span>
                  <span className="text-white/50">Your Wallet ❌</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-white/30">To</span>
                  <span className="text-white/50">Recipient ❌</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-white/30">Amount</span>
                  <span className="text-white/50">1.5 SOL ❌</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-white/30">History</span>
                  <span className="text-white/50">Traceable ❌</span>
                </div>
              </div>
            </motion.div>

            {/* With Offuscate */}
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
                  <h3 className="text-white font-medium">With Offuscate</h3>
                  <p className="text-xs text-white/40">Cryptographically hidden</p>
                </div>
              </div>

              <div className="space-y-3 font-mono text-sm">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                  <span className="text-white/40">From</span>
                  <span className="text-white">Hidden ✓</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                  <span className="text-white/40">To</span>
                  <span className="text-white">Hidden ✓</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                  <span className="text-white/40">Amount</span>
                  <span className="text-white">Hidden ✓</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                  <span className="text-white/40">History</span>
                  <span className="text-white">Broken ✓</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Quote */}
          <motion.p
            className="text-center text-white/30 text-lg italic max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            "Some help needs to be visible. Some needs to be silent."
          </motion.p>
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
              Powered by Real Privacy Tech
            </h2>
            <p className="text-white/40 text-sm">
              Not just promises. Cryptographic guarantees.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Binary, name: 'Light Protocol', desc: 'ZK Compression' },
              { icon: EyeOff, name: 'Stealth Addresses', desc: 'One-time wallets' },
              { icon: Shuffle, name: 'Privacy Pool', desc: 'Fund mixing' },
              { icon: Zap, name: 'Solana Speed', desc: 'Sub-second txs' },
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
                What Do You Need?
              </h2>
              <p className="text-white/40">
                Choose your path to privacy
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Link
                href="/explore"
                className="group flex items-center gap-4 p-5 rounded-2xl bg-white hover:bg-white/90 transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-black/10 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-black/70" />
                </div>
                <div className="flex-1">
                  <div className="text-black font-semibold">I want to donate</div>
                  <div className="text-black/50 text-sm">Support causes privately</div>
                </div>
                <ArrowRight className="w-5 h-5 text-black/40 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/mixer"
                className="group flex items-center gap-4 p-5 rounded-2xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-white/[0.08] flex items-center justify-center">
                  <ArrowLeftRight className="w-6 h-6 text-white/70" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold">I want to transfer</div>
                  <div className="text-white/50 text-sm">Move funds untraceably</div>
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
            Privacy Hackathon 2025 - Built on Solana
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/30 hover:text-white transition-colors"
            >
              <Code className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
