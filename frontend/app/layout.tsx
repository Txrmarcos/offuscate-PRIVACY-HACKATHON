import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Header } from './components/Header';
import { WaveMeshBackground } from './components/WaveMeshBackground';
import { AppShell } from './components/AppShell';
import { Providers } from './providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Offuscate - Privacy Infrastructure for Solana',
  description: 'The simplest way to send, receive, and manage private payments on-chain. Built for the next billion users.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#0a0a0a] text-white antialiased`}
      >
        <Providers>
          <AppShell>
            <WaveMeshBackground />
            <Header />
            <main className="relative z-10 pt-24">{children}</main>
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
