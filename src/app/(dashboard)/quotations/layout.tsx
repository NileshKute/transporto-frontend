'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

/** Mirrors sidebar: `quotations` + `read` (see permissions matrix). */
export default function QuotationsLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const quotationsRead = usePermission('quotations', 'read');
  const allowed =
    authLoading || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || quotationsRead;

  useEffect(() => {
    if (authLoading) return;
    if (!allowed) router.replace('/dashboard');
  }, [allowed, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner text="Loading…" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner text="Redirecting…" />
      </div>
    );
  }

  return <>{children}</>;
}
