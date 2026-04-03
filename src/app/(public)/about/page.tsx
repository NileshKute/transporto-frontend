import type { Metadata } from 'next';
import { RevealOnScroll } from '@/components/public/RevealOnScroll';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Since 2019, G K Enterprise has delivered cold chain logistics and fleet management from Navi Mumbai, Maharashtra — mission, values, and leadership.',
};

const values = [
  { emoji: '🎯', title: 'Reliability', text: 'Your cargo is our responsibility.' },
  { emoji: '❄️', title: 'Quality', text: 'Temperature integrity guaranteed.' },
  { emoji: '🔧', title: 'Technology', text: 'GPS tracking and digital management.' },
  { emoji: '👥', title: 'People', text: 'Skilled, trained drivers.' },
];

export default function AboutPage() {
  return (
    <div className="pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <RevealOnScroll>
          <h1 className="font-gk-bebas text-5xl md:text-6xl text-[#0D2847] tracking-wide">About G K Enterprise</h1>
          <p className="font-gk-rajdhani text-lg text-[#1A4A7A] mt-6 leading-relaxed">
            Since 2019, G K Enterprise has been a trusted name in cold chain logistics and fleet management in Navi
            Mumbai, Maharashtra.
          </p>
        </RevealOnScroll>

        <RevealOnScroll className="mt-14">
          <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0]">Our story</h2>
          <p className="font-gk-rajdhani text-[#0D2847] mt-4 leading-relaxed">
            Founded by passionate transporters, G K Enterprise began with a vision to provide dependable
            temperature-controlled transport. From a focused fleet, we have grown to serve major FMCG, pharmaceutical,
            and food companies across Maharashtra and beyond.
          </p>
        </RevealOnScroll>

        <RevealOnScroll className="mt-12">
          <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0]">Our mission</h2>
          <p className="font-gk-rajdhani text-[#0D2847] mt-4 leading-relaxed">
            To deliver every shipment fresh, on time, and at the right temperature — combining technology with
            experienced drivers and rigorous operations.
          </p>
        </RevealOnScroll>

        <RevealOnScroll className="mt-12">
          <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0]">Our values</h2>
          <ul className="mt-6 space-y-4">
            {values.map((v) => (
              <li
                key={v.title}
                className="flex gap-4 rounded-xl border border-[#E0E8F0] bg-white p-5 shadow-sm"
              >
                <span className="text-2xl shrink-0" aria-hidden>
                  {v.emoji}
                </span>
                <div>
                  <p className="font-gk-barlow font-bold text-[#0D2847] uppercase tracking-wide">{v.title}</p>
                  <p className="font-gk-rajdhani text-[#1A4A7A] mt-1">{v.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </RevealOnScroll>

        <RevealOnScroll className="mt-14">
          <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0]">Proprietor</h2>
          <div className="mt-6 rounded-2xl border border-[#E0E8F0] bg-gradient-to-b from-[#F5F7FA] to-white p-8 shadow-sm">
            <p className="font-gk-barlow text-xl font-bold text-[#0D2847] uppercase tracking-wide">Ganesh Kute</p>
            <p className="font-gk-rajdhani text-[#1565C0] font-semibold mt-1">Founder &amp; Proprietor</p>
            <blockquote className="font-gk-rajdhani text-lg text-[#1A4A7A] mt-6 border-l-4 border-[#42A5F5] pl-5 italic">
              Every delivery is a promise. We keep ours.
            </blockquote>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
