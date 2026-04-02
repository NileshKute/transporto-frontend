'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

export function usePermission(module: string, action: string): boolean {
  const [allowed, setAllowed] = useState(false);
  const user = getUser();

  const check = useCallback(async () => {
    if (!user) {
      setAllowed(false);
      return;
    }
    const role = user.role as string;
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      setAllowed(true);
      return;
    }
    try {
      const res = await api.post('/permissions/check', { module, action });
      setAllowed(Boolean(res.data?.allowed));
    } catch {
      setAllowed(false);
    }
  }, [module, action, user?.role]);

  useEffect(() => {
    check();
  }, [check]);

  return allowed;
}
