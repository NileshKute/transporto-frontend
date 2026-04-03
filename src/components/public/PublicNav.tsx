'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/fleet', label: 'Fleet' },
  { href: '/contact', label: 'Contact' },
];

export function PublicNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setOpen(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const isHome = pathname === '/';
  const onHero = isHome && !scrolled;

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        onHero ? 'bg-transparent' : 'bg-white/95 backdrop-blur-md shadow-sm border-b border-[#E0E8F0]'
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 md:h-[4.25rem]">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0D2847] to-[#1A4A7A] flex items-center justify-center border border-[#42A5F5]/40">
            <span className="font-gk-bebas text-xl text-white leading-none">G</span>
            <span className="font-gk-bebas text-xl text-[#42A5F5] leading-none -ml-0.5">K</span>
          </div>
          <div className="hidden sm:block">
            <span
              className={cn(
                'font-gk-bebas text-xl tracking-wide block leading-tight transition-colors',
                onHero ? 'text-white' : 'text-[#0D2847]'
              )}
            >
              G K ENTERPRISE
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-gk-barlow font-semibold uppercase tracking-wider transition-colors',
                  onHero
                    ? active
                      ? 'text-[#64B5F6] bg-white/10'
                      : 'text-white/90 hover:text-white hover:bg-white/10'
                    : active
                      ? 'text-[#1565C0] bg-[#1565C0]/10'
                      : 'text-[#1A4A7A] hover:text-[#1565C0] hover:bg-[#F5F7FA]'
                )}
              >
                {label}
              </Link>
            );
          })}
          <Link
            href="/login"
            className={cn(
              'ml-2 px-4 py-2.5 rounded-lg text-sm font-gk-barlow font-bold uppercase tracking-wider transition-colors',
              onHero
                ? 'bg-[#42A5F5] text-white hover:bg-[#64B5F6]'
                : 'bg-[#1565C0] text-white hover:bg-[#0D2847]'
            )}
          >
            Client Login
          </Link>
        </nav>

        <button
          type="button"
          className={cn(
            'lg:hidden p-2 rounded-lg transition-colors',
            onHero ? 'text-white hover:bg-white/10' : 'text-[#0D2847] hover:bg-[#F5F7FA]'
          )}
          aria-label="Menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-[#E0E8F0] bg-white shadow-lg">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'px-3 py-3 rounded-lg text-sm font-gk-barlow font-semibold uppercase tracking-wider',
                    active ? 'text-[#1565C0] bg-[#1565C0]/10' : 'text-[#0D2847] hover:bg-[#F5F7FA]'
                  )}
                >
                  {label}
                </Link>
              );
            })}
            <Link
              href="/login"
              className="mt-2 text-center px-4 py-3 rounded-lg bg-[#1565C0] text-white font-gk-barlow font-bold uppercase tracking-wider"
            >
              Client Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
