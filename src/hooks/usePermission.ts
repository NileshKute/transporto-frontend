'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { getPermissionCheckCache } from '@/lib/permission-cache';

export { clearPermissionCache } from '@/lib/permission-cache';

export function usePermission(module: string, action: string): boolean {
  const [allowed, setAllowed] = useState(false);
  const user = typeof window !== 'undefined' ? getUser() : null;
  const role = String(user?.role ?? '');
  const cacheKey = `${role}:${module}:${action}`;

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setAllowed(false);
      return;
    }
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      setAllowed(true);
      return;
    }
    const cache = getPermissionCheckCache();
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      setAllowed(cached);
      return;
    }
    (async () => {
      try {
        const res = await api.post('/permissions/check', { module, action });
        const ok = !!res.data?.allowed;
        cache.set(cacheKey, ok);
        if (!cancelled) setAllowed(ok);
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [module, action, role, cacheKey, user]);

  return allowed;
}
