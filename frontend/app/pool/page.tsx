'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  ArrowRight,
  Users,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Shuffle,
  CheckCircle,
  Info,
  TrendingUp,
  Activity,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useProgram } from '../lib/program';

export default function PoolPage() {
  const { fetchPoolStats } = useProgram();
  const [poolStats, setPoolStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await fetchPoolStats();
        setPoolStats(stats);
      } catch (err) {
        console.error('Failed to load pool stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [fetchPoolStats]);

  const faqs = [
    {
      question: 'What is the Privacy Pool?',
      answer: 'The Privacy Pool is a shared mixing mechanism that breaks the on-chain link between senders and receivers. When you deposit funds, they get mixed with deposits from other users, making it impossible to trace which deposit corresponds to which withdrawal.',
    },
    {
      question: 'Why is the pool balance global?',
      answer: 'Privacy requires a large "anonymity set". If each company had their own pool, transactions would be easily traceable. By sharing a single pool, all users benefit from increased privacy - the more participants, the harder it is to analyze transaction flows.',
    },
    {
      question: 'Why are there fixed amounts (0.1, 0.5, 1 SOL)?',
      answer: 'Fixed denominations prevent amount-based correlation attacks. If someone deposits exactly 1.337 SOL and later 1.337 SOL is withdrawn, it\'s easy to link them. With fixed amounts, all transactions look identical.',
    },
    {
      question: 'Why is there a delay before withdrawal?',
      answer: 'The variable delay (30s - 5min) prevents timing correlation. If withdrawals happened immediately after deposits, analysts could match them by timestamp. The randomized delay breaks this pattern.',
    },
    {
      question: 'Is this like Tornado Cash?',
      answer: 'Similar concept, but simplified for Solana. We use a delay-based mixing approach instead of ZK proofs. This provides practical privacy for payroll use cases while being simpler to implement and audit.',
    },
    {
      question: 'Can the pool run out of funds?',
      answer: 'The pool operates on a deposit-first model. You can only withdraw what\'s been deposited. If pool balance is low, withdrawals may need to wait for more deposits.',
    },
  ];

  return (
    <div className="min-h-screen px-6 py-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6">
            <Shield className="w-4 h-4 text-white/40" />
            <span className="text-xs text-white/40 uppercase tracking-widest">
              Privacy Infrastructure
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Privacy Pool
          </h1>
          <p className="text-white/40 text-lg max-w-2xl mx-auto">
            A shared mixing pool that breaks the on-chain link between payroll deposits and recipient withdrawals.
          </p>
        </div>

        {/* Pool Stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-white/[0.02] rounded-2xl border border-white/[0.06]"
          >
            <div className="flex items-center gap-2 text-white/40 mb-2">
              <Lock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Pool Balance</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>{poolStats?.currentBalance?.toFixed(2) || '0.00'} <span className="text-lg text-white/40">SOL</span></>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 bg-white/[0.02] rounded-2xl border border-white/[0.06]"
          >
            <div className="flex items-center gap-2 text-white/40 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Total Volume</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>{poolStats?.totalDeposited?.toFixed(2) || '0.00'} <span className="text-lg text-white/40">SOL</span></>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 bg-white/[0.02] rounded-2xl border border-white/[0.06]"
          >
            <div className="flex items-center gap-2 text-white/40 mb-2">
              <Activity className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Operations</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>{(poolStats?.depositCount || 0) + (poolStats?.withdrawCount || 0)}</>
              )}
            </div>
          </motion.div>
        </div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-semibold text-white mb-6">How It Works</h2>

          <div className="relative">
            {/* Flow Diagram */}
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  step: 1,
                  title: 'Deposit',
                  description: 'Company deposits fixed amount (0.1, 0.5, or 1 SOL)',
                  icon: TrendingUp,
                },
                {
                  step: 2,
                  title: 'Mix',
                  description: 'Funds merge with deposits from other users',
                  icon: Shuffle,
                },
                {
                  step: 3,
                  title: 'Wait',
                  description: 'Random delay (30s - 5min) breaks timing correlation',
                  icon: Clock,
                },
                {
                  step: 4,
                  title: 'Withdraw',
                  description: 'Recipient claims to private wallet, unlinked from source',
                  icon: Shield,
                },
              ].map((item, i) => (
                <div key={item.step} className="relative">
                  <div className="p-5 bg-white/[0.02] rounded-2xl border border-white/[0.06] h-full hover:bg-white/[0.04] transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center mb-4">
                      <item.icon className="w-5 h-5 text-white/60" />
                    </div>
                    <div className="text-xs text-white/30 mb-1">Step {item.step}</div>
                    <h3 className="text-white font-medium mb-2">{item.title}</h3>
                    <p className="text-white/40 text-sm">{item.description}</p>
                  </div>
                  {i < 3 && (
                    <div className="absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                      <ArrowRight className="w-4 h-4 text-white/20" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Privacy Guarantees */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-semibold text-white mb-6">Privacy Guarantees</h2>

          <div className="grid grid-cols-2 gap-4">
            {[
              {
                title: 'Amount Privacy',
                description: 'Fixed denominations prevent correlation by transaction size',
                icon: Lock,
              },
              {
                title: 'Timing Privacy',
                description: 'Random delays break temporal correlation between deposit and withdrawal',
                icon: Clock,
              },
              {
                title: 'Sender Anonymity',
                description: 'Deposits from multiple sources are indistinguishable in the pool',
                icon: Users,
              },
              {
                title: 'Receiver Anonymity',
                description: 'Withdrawals to stealth addresses cannot be linked to employers',
                icon: EyeOff,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-5 bg-white/[0.02] rounded-2xl border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-white/60" />
                  </div>
                  <span className="text-xs text-white/60 bg-white/[0.05] px-2 py-1 rounded-full border border-white/[0.06]">
                    Protected
                  </span>
                </div>
                <h3 className="text-white font-medium mb-1">{item.title}</h3>
                <p className="text-white/40 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Visual Explanation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-12 p-6 bg-white/[0.02] rounded-2xl border border-white/[0.06]"
        >
          <h2 className="text-xl font-semibold text-white mb-4">Why Global Pool = Better Privacy</h2>

          <div className="grid grid-cols-2 gap-6">
            {/* Bad: Separate Pools */}
            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
              <div className="flex items-center gap-2 text-white/50 mb-3">
                <Eye className="w-4 h-4" />
                <span className="font-medium">Separate Pools (Traceable)</span>
              </div>
              <div className="font-mono text-xs text-white/40 space-y-1">
                <div>Company A Pool → Employee X</div>
                <div>Company B Pool → Employee Y</div>
                <div className="text-white/30 mt-2">Easy to trace origin</div>
              </div>
            </div>

            {/* Good: Shared Pool */}
            <div className="p-4 bg-white/[0.05] rounded-xl border border-white/[0.1]">
              <div className="flex items-center gap-2 text-white mb-3">
                <EyeOff className="w-4 h-4" />
                <span className="font-medium">Shared Pool (Private)</span>
              </div>
              <div className="font-mono text-xs text-white/60 space-y-1">
                <div>Company A ─┐</div>
                <div>Company B ─┼─► POOL ─► ???</div>
                <div>Company C ─┘</div>
                <div className="text-white/80 mt-2">Origin unknown!</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-2xl font-semibold text-white mb-6">Frequently Asked Questions</h2>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <span className="text-white font-medium">{faq.question}</span>
                  {expandedFaq === i ? (
                    <ChevronUp className="w-4 h-4 text-white/40" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white/40" />
                  )}
                </button>
                {expandedFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-white/50 text-sm">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-12 text-center"
        >
          <a
            href="/mixer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-all"
          >
            Go to Treasury
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>
    </div>
  );
}
