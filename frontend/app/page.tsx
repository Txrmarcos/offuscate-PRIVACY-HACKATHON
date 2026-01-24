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
  CheckCircle,
  Globe as GlobeIcon,
  Users,
  Coins,
  Code,
  Layers,
  Network,
  Fingerprint,
  Binary,
} from 'lucide-react';
import { Globe } from './components/ui/Globe';

const features = [
  {
    icon: EyeOff,
    title: 'Stealth Addresses',
    description: 'One-time addresses for every transfer. No link between sender and receiver.',
    color: 'text-white',
    bgColor: 'bg-white/10',
  },
  {
    icon: Lock,
    title: 'ZK Compression',
    description: 'Light Protocol integration. Groth16 proofs hide your transactions.',
    color: 'text-white',
    bgColor: 'bg-white/10',
  },
  {
    icon: Shield,
    title: 'Privacy Pool',
    description: 'Mix your funds with others. Break the on-chain trace completely.',
    color: 'text-white',
    bgColor: 'bg-white/10',
  },
  {
    icon: Zap,
    title: 'Sub-second Privacy',
    description: 'Solana speed meets cryptographic privacy. No waiting.',
    color: 'text-white',
    bgColor: 'bg-white/10',
  },
];

const techStack = [
  { name: 'Light Protocol', description: 'ZK Compression', icon: Binary },
  { name: 'Stealth Protocol', description: 'One-time addresses', icon: Fingerprint },
  { name: 'Privacy Pools', description: 'Anonymity sets', icon: Layers },
  { name: 'Helius RPC', description: 'ZK-enabled RPC', icon: Network },
];

const stats = [
  { label: 'Privacy Levels', value: '4' },
  { label: 'On-chain Savings', value: '99%' },
  { label: 'ZK Proof Size', value: '128B' },
];

const rotatingWords = ['Untraceable', 'Private', 'Anonymous', 'Secure'];

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
        {/* Gradient base */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(
                to bottom,
                #050505 0%,
                #050505 20%,
                #080808 40%,
                #0a0a0a 60%,
                #050505 100%
              )
            `,
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
        {/* Radial glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 30%, rgba(255,255,255,0.04) 0%, transparent 50%)',
          }}
        />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 min-h-screen">
        {/* Globe Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="blur-[1px] opacity-25 scale-110">
            {mounted && <Globe size={900} />}
          </div>
        </div>

        {/* Content */}
        <motion.div
          className="relative z-20 text-center max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs text-white/50 uppercase tracking-widest">
              Privacy Infrastructure for Solana
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            className="text-5xl md:text-7xl font-bold leading-tight mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-white">Donations that are</span>
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
                {rotatingWords[currentWordIndex]}
              </motion.span>
            </AnimatePresence>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            The most advanced privacy layer for charitable donations on Solana.
            ZK proofs, stealth addresses, and privacy pools - all in one platform.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Link
              href="/explore"
              className="group px-8 py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Explore Campaigns
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/launch"
              className="px-8 py-4 border border-white/[0.1] text-white font-medium rounded-xl hover:bg-white/[0.03] transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Coins className="w-4 h-4" />
              Create Campaign
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="flex flex-wrap justify-center gap-8 mt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-white">
                  {stat.value}
                </div>
                <div className="text-xs text-white/30 uppercase tracking-wider mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-white/10 flex items-start justify-center p-2">
            <motion.div
              className="w-1 h-2 rounded-full bg-white/30"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Privacy at Every Level
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Choose your privacy level based on your needs. From standard transfers
              to fully anonymous ZK-compressed transactions.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <div
                  className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-4`}
                >
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 px-6 py-24 bg-white/[0.01]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How Offuscate Works
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Three simple steps to make your donations completely private.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Choose Privacy Level',
                description:
                  'Select from Public, Pool, ZK Compressed, or Full Privacy based on your anonymity needs.',
                icon: Shield,
              },
              {
                step: '02',
                title: 'Make Your Donation',
                description:
                  'Send SOL to campaigns or individuals. Your transaction is processed through our privacy layer.',
                icon: Coins,
              },
              {
                step: '03',
                title: 'Verify Anonymity',
                description:
                  'Use our trace simulator to verify your donation cannot be linked back to your wallet.',
                icon: CheckCircle,
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                className="relative"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
              >
                <div className="text-6xl font-bold text-white/[0.03] absolute -top-4 -left-2">
                  {item.step}
                </div>
                <div className="relative p-6">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-white/40 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Built on Cutting-Edge Tech
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Powered by the most advanced privacy technologies on Solana.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {techStack.map((tech, index) => (
              <motion.div
                key={tech.name}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-center hover:border-white/20 transition-all"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                <tech.icon className="w-8 h-8 text-white mx-auto mb-3" />
                <div className="text-white font-medium">{tech.name}</div>
                <div className="text-white/30 text-xs mt-1">{tech.description}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 py-24">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="p-12 rounded-3xl bg-gradient-to-br from-white/[0.03] via-transparent to-white/[0.02] border border-white/[0.08]">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Go Private?
            </h2>
            <p className="text-white/40 max-w-xl mx-auto mb-8">
              Join the privacy revolution. Make your first anonymous donation today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/explore"
                className="group px-8 py-4 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/dashboard"
                className="px-8 py-4 border border-white/[0.1] text-white font-medium rounded-xl hover:bg-white/[0.03] transition-all active:scale-95"
              >
                View Dashboard
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold">Offuscate</span>
          </div>
          <div className="text-white/30 text-sm">
            Privacy Hackathon 2024 - Built on Solana
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
