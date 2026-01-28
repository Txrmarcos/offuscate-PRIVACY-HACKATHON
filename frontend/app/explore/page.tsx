'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to unified payroll page
export default function ExplorePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/payroll');
  }, [router]);

  return null;
}
