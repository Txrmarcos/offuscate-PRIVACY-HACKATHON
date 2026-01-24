import Link from 'next/link';
import { Circle, Lock, Zap } from 'lucide-react';

const features = [
  {
    icon: Circle,
    title: 'Stealth',
    description: 'One-time addresses for every transfer.',
  },
  {
    icon: Lock,
    title: 'Private',
    description: 'ZK-Proofs hide transaction data.',
  },
  {
    icon: Zap,
    title: 'Fast',
    description: 'Sub-second privacy on Solana.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <p className="text-[10px] tracking-widest text-white/30 mb-6 uppercase">
          Privacy Infrastructure for Solana
        </p>

        <h1 className="text-5xl md:text-6xl font-semibold text-center leading-tight mb-6 text-white">
          Payments without
          <br />
          traces.
        </h1>

        <p className="text-white/40 text-center max-w-xl mb-10 text-lg">
          The simplest way to send, receive, and manage private payments
          on-chain. Built for the next billion users.
        </p>

        <div className="flex gap-4">
          <Link
            href="/launch"
            className="px-8 py-3.5 bg-white text-black font-medium rounded-full hover:bg-white/90 transition-all active:scale-95"
          >
            Create Campaign
          </Link>
          <Link
            href="/dashboard"
            className="px-8 py-3.5 border border-white/[0.1] text-white font-medium rounded-full hover:bg-white/[0.03] transition-all active:scale-95"
          >
            Enter Dashboard
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all"
            >
              <feature.icon className="w-5 h-5 text-white/30 mb-4" strokeWidth={1.5} />
              <h3 className="text-white font-medium mb-2">{feature.title}</h3>
              <p className="text-white/40 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
