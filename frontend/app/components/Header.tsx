'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Circle } from 'lucide-react';
import { clsx } from 'clsx';

const navLinks = [
  { href: '/explore', label: 'Explore' },
  { href: '/launch', label: 'Launch' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 p-4">
      <div className="max-w-4xl mx-auto bg-[#141414] border border-[#262626] rounded-full px-6 h-14 flex items-center justify-between">
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

        <button className="px-5 py-2 bg-white text-black text-sm font-medium rounded-full hover:bg-gray-100 transition-colors">
          Connect
        </button>
      </div>
    </header>
  );
}
