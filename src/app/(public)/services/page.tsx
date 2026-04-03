import type { Metadata } from 'next';
import { RevealOnScroll } from '@/components/public/RevealOnScroll';

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Cold chain transport, general fleet (FTL/PTL), and Transporto fleet technology — FSSAI-compliant reefer trucks, GPS, and 24/7 operations.',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-gk-barlow text-lg font-bold uppercase tracking-[0.2em] text-[#1565C0] border-b border-[#E0E8F0] pb-3">
      {children}
    </h2>
  );
}

export default function ServicesPage() {
  return (
    <div className="pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <RevealOnScroll>
          <h1 className="font-gk-bebas text-5xl md:text-6xl text-[#0D2847] tracking-wide">Our Services</h1>
        </RevealOnScroll>

        <RevealOnScroll className="mt-12 space-y-4">
          <SectionTitle>Cold chain transport</SectionTitle>
          <p className="font-gk-rajdhani text-[#1A4A7A]">Temperature-controlled logistics for:</p>
          <ul className="font-gk-rajdhani text-[#0D2847] list-disc pl-5 space-y-2">
            <li>Frozen foods (-25°C to -18°C)</li>
            <li>Chilled products (2°C to 8°C)</li>
            <li>Pharmaceuticals (controlled temperature)</li>
            <li>Dairy and fresh produce</li>
            <li>Quick commerce (Zepto, Blinkit, and similar partners)</li>
          </ul>
          <p className="font-gk-barlow font-semibold uppercase tracking-wide text-[#0D2847] mt-6">Features</p>
          <ul className="font-gk-rajdhani text-[#1A4A7A] space-y-2">
            <li>✅ Reefer trucks with real-time temperature monitoring</li>
            <li>✅ GPS-tracked vehicles</li>
            <li>✅ FSSAI-compliant transport</li>
            <li>✅ 24/7 cold chain operations</li>
          </ul>
        </RevealOnScroll>

        <RevealOnScroll className="mt-14 space-y-4">
          <SectionTitle>General fleet transport</SectionTitle>
          <p className="font-gk-rajdhani text-[#1A4A7A]">Reliable freight services:</p>
          <ul className="font-gk-rajdhani text-[#0D2847] list-disc pl-5 space-y-2">
            <li>Full truck load (FTL)</li>
            <li>Part truck load (PTL)</li>
            <li>Inter-city and intra-city routes</li>
            <li>Maharashtra-wide coverage</li>
          </ul>
        </RevealOnScroll>

        <RevealOnScroll className="mt-14 space-y-4">
          <SectionTitle>Fleet management technology</SectionTitle>
          <p className="font-gk-rajdhani text-[#0D2847] leading-relaxed">
            Our in-house Transporto ERP system supports day-to-day operations with:
          </p>
          <ul className="font-gk-rajdhani text-[#1A4A7A] list-disc pl-5 space-y-2">
            <li>Real-time GPS tracking</li>
            <li>Temperature monitoring alerts</li>
            <li>Digital driver management</li>
            <li>Automated invoicing</li>
            <li>WhatsApp-based coordination</li>
          </ul>
        </RevealOnScroll>

        <RevealOnScroll className="mt-14 space-y-4">
          <SectionTitle>Serving industries</SectionTitle>
          <ul className="font-gk-rajdhani text-[#0D2847] space-y-3">
            <li>🛒 FMCG &amp; retail</li>
            <li>💊 Pharmaceuticals</li>
            <li>🥛 Dairy</li>
            <li>🧊 Frozen foods</li>
            <li>🛵 Quick commerce</li>
            <li>🏭 Manufacturing</li>
          </ul>
        </RevealOnScroll>
      </div>
    </div>
  );
}
