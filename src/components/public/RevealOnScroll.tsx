'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function RevealOnScroll({
  className,
  children,
  delayMs = 0,
}: {
  className?: string;
  children: ReactNode;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timeoutId: number | undefined;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        if (delayMs > 0) {
          timeoutId = window.setTimeout(() => setVisible(true), delayMs) as number;
        } else {
          setVisible(true);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -32px 0px' }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [delayMs]);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-out motion-reduce:transition-none',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        className
      )}
    >
      {children}
    </div>
  );
}
