'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Gauge, Phone, Snowflake, Truck } from 'lucide-react';
import { getToken } from '@/lib/auth';
import { RevealOnScroll } from '@/components/public/RevealOnScroll';
import { cn } from '@/lib/utils';

function useAnimatedInt(target: number, durationMs: number, active: boolean) {
  const [value, setValue] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (!active || done.current) return;
    done.current = true;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(step);
      else setValue(target);
    };
    requestAnimationFrame(step);
  }, [active, target, durationMs]);

  return value;
}

function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setActive(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const y7 = useAnimatedInt(7, 1400, active);
  const y15 = useAnimatedInt(15, 1600, active);
  const y500 = useAnimatedInt(500, 2000, active);

  const items = [
    { top: `${y7}+`, line1: 'Years', line2: 'Experience' },
    { top: `${y15}+`, line1: 'Vehicles', line2: 'in Fleet' },
    { top: `${y500}+`, line1: 'Deliveries', line2: 'Monthly' },
    { top: '24/7', line1: 'Support', line2: 'Available' },
  ];

  return (
    <section ref={ref} className="py-14 md:py-20 bg-white border-y border-[#E0E8F0]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {items.map((item) => (
            <div
              key={item.line1 + item.line2}
              className="text-center p-6 rounded-2xl bg-gradient-to-b from-[#F5F7FA] to-white border border-[#E0E8F0] shadow-sm hover:shadow-md hover:border-[#42A5F5]/40 transition-all duration-300"
            >
              <p className="font-gk-bebas text-4xl md:text-5xl text-[#0D2847] tracking-wide">{item.top}</p>
              <p className="font-gk-barlow text-sm font-semibold uppercase tracking-wider text-[#1565C0] mt-2">
                {item.line1}
              </p>
              <p className="font-gk-rajdhani text-sm text-[#1A4A7A]/90 mt-0.5">{item.line2}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const whyItems = [
  'Temperature controlled — -25°C to +25°C range',
  'GPS tracked — real-time vehicle monitoring',
  'Experienced — 7+ years in cold chain logistics',
  'Reliable — 99% on-time delivery record',
  'Compliant — all vehicles PUC, insurance, and fitness certified',
  'Technology driven — digital fleet management system',
];

export function HomePageContent() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoggedIn(!!getToken());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <section className="relative min-h-[88vh] flex flex-col justify-center pt-24 pb-16 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #0D2847 0%, #1A4A7A 50%, #1565C0 100%), radial-gradient(ellipse 80% 55% at 75% 15%, rgba(66, 165, 245, 0.22), transparent)',
          }}
        />
        <div className="absolute inset-0 gk-hero-pattern opacity-40 pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 w-full">
          <RevealOnScroll>
            {loggedIn && (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-lg bg-white/15 border border-white/25 text-white font-gk-barlow text-sm font-semibold uppercase tracking-wider hover:bg-white/25 transition-colors"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <p className="font-gk-bebas text-5xl sm:text-6xl md:text-7xl text-white tracking-[0.08em] drop-shadow-sm">
              G K ENTERPRISE
            </p>
            <p className="font-gk-barlow text-lg sm:text-xl md:text-2xl font-semibold uppercase tracking-[0.2em] text-[#64B5F6] mt-3">
              Fleet Owners &amp; Cold Chain Logistics Specialists
            </p>
            <p className="font-gk-barlow text-xl sm:text-2xl md:text-3xl font-semibold text-white/95 mt-8 max-w-3xl leading-snug">
              Reliable cold chain &amp; fleet solutions for your business
            </p>
            <p className="font-gk-rajdhani text-base sm:text-lg text-white/85 mt-4 max-w-2xl leading-relaxed">
              Trusted temperature-controlled transport across India. Your cargo, our commitment — delivered fresh,
              every time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <Link
                href="/services"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg bg-[#42A5F5] text-white font-gk-barlow font-bold uppercase tracking-wider hover:bg-[#64B5F6] shadow-lg shadow-[#0D2847]/30 transition-transform hover:-translate-y-0.5"
              >
                Our Services
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg border-2 border-white/80 text-white font-gk-barlow font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      <StatsSection />

      <section className="py-16 md:py-24 bg-[#F5F7FA]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <RevealOnScroll>
            <h2 className="font-gk-bebas text-4xl md:text-5xl text-[#0D2847] tracking-wide text-center">
              What We Do
            </h2>
            <p className="font-gk-rajdhani text-center text-[#1A4A7A] mt-2 max-w-2xl mx-auto">
              End-to-end logistics built for perishables, freight, and digital operations.
            </p>
          </RevealOnScroll>
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            {[
              {
                icon: Snowflake,
                title: 'Cold Chain Transport',
                body: 'Temperature-controlled logistics for perishable goods, pharmaceuticals, and frozen products.',
                accent: 'from-[#42A5F5]/20 to-transparent',
              },
              {
                icon: Truck,
                title: 'General Fleet Transport',
                body: 'Reliable freight services across Maharashtra and pan-India routes.',
                accent: 'from-[#1565C0]/15 to-transparent',
              },
              {
                icon: Gauge,
                title: 'Fleet Management',
                body: 'Real-time GPS tracking, temperature monitoring, and digital operations.',
                accent: 'from-[#64B5F6]/25 to-transparent',
              },
            ].map((card, i) => (
              <RevealOnScroll key={card.title} delayMs={i * 80}>
                <div
                  className={cn(
                    'h-full rounded-2xl border border-[#E0E8F0] bg-white p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group'
                  )}
                >
                  <div
                    className={cn(
                      'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
                      card.accent
                    )}
                  />
                  <div className="relative">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0D2847] to-[#1565C0] flex items-center justify-center text-white mb-5">
                      <card.icon className="w-7 h-7" aria-hidden />
                    </div>
                    <h3 className="font-gk-barlow text-xl font-bold uppercase tracking-wide text-[#0D2847]">
                      {card.title}
                    </h3>
                    <p className="font-gk-rajdhani text-[#1A4A7A] mt-3 leading-relaxed">{card.body}</p>
                  </div>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <RevealOnScroll>
            <h2 className="font-gk-bebas text-4xl md:text-5xl text-[#0D2847] tracking-wide text-center">
              Why Choose G K Enterprise?
            </h2>
          </RevealOnScroll>
          <ul className="mt-12 grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {whyItems.map((text, i) => (
              <RevealOnScroll key={text} delayMs={i * 50}>
                <li className="flex gap-3 items-start rounded-xl border border-[#E0E8F0] bg-[#F5F7FA]/80 px-5 py-4 hover:border-[#42A5F5]/50 transition-colors">
                  <span className="text-lg shrink-0" aria-hidden>
                    ✅
                  </span>
                  <span className="font-gk-rajdhani text-[#0D2847] leading-relaxed">{text}</span>
                </li>
              </RevealOnScroll>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-16 md:py-20 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #0D2847 0%, #1A4A7A 45%, #1565C0 100%)',
          }}
        />
        <div className="absolute inset-0 gk-hero-pattern opacity-40 pointer-events-none" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <RevealOnScroll>
            <h2 className="font-gk-bebas text-4xl md:text-5xl text-white tracking-wide">Ready to Ship?</h2>
            <p className="font-gk-rajdhani text-lg text-white/90 mt-4">
              Get a quote for your cold chain logistics needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg bg-[#42A5F5] text-white font-gk-barlow font-bold uppercase tracking-wider hover:bg-[#64B5F6] transition-colors"
              >
                Contact Us
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="tel:+919324540988"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg border-2 border-white/80 text-white font-gk-barlow font-bold uppercase tracking-wider hover:bg-white/10"
              >
                <Phone className="w-5 h-5" />
                +91 9324540988
              </a>
            </div>
          </RevealOnScroll>
        </div>
      </section>
    </>
  );
}
