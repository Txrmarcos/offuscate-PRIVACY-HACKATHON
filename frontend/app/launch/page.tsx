'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to unified payroll page
// Batches are now created directly in /payroll
export default function LaunchPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/payroll');
  }, [router]);

  return null;
}
