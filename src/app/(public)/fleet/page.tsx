import type { Metadata } from 'next';
import { RevealOnScroll } from '@/components/public/RevealOnScroll';
import { Snowflake, Truck, Package } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Fleet',
  description:
    '15+ GPS-tracked vehicles: refrigerated reefers, container trucks, and LCVs for last-mile and quick commerce — Navi Mumbai.',
};

const vehicles = [
  {
    icon: Snowflake,
    title: 'Refrigerated trucks (reefer)',
    lines: [
      'Temperature range: -25°C to +25°C',
      'Capacity: 2 ton to 15 ton',
      'GPS tracked with temperature sensors',
    ],
    gradientClass: 'bg-gradient-to-br from-[#42A5F5]/30 via-[#1565C0]/20 to-[#0D2847]/40',
  },
  {
    icon: Truck,
    title: 'Container trucks',
    lines: ['Heavy-duty freight transport', 'Capacity: 10 ton to 25 ton', 'Pan-India routes'],
    gradientClass: 'bg-gradient-to-br from-[#1565C0]/30 via-[#1A4A7A]/25 to-[#0D2847]/45',
  },
  {
    icon: Package,
    title: 'Mini trucks (LCV)',
    lines: ['Last-mile delivery', 'Quick commerce operations', 'Urban logistics'],
    gradientClass: 'bg-gradient-to-br from-[#64B5F6]/35 via-[#42A5F5]/20 to-[#0D2847]/40',
  },
] as const;

const highlights = [
  'All vehicles GPS tracked',
  'Real-time temperature monitoring',
  'Regular maintenance schedule',
  'PUC, insurance, and fitness — always current',
  'Experienced, trained drivers',
];

const clients = ['Zepto', 'Blinkit', 'BigBasket', 'Swiggy Instamart'];

export default function FleetPage() {
  return (
    <div className="pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealOnScroll className="text-center max-w-2xl mx-auto">
          <h1 className="font-gk-bebas text-5xl md:text-6xl text-[#0D2847] tracking-wide">Our Fleet</h1>
          <p className="font-gk-rajdhani text-lg text-[#1A4A7A] mt-4">
            15+ vehicles ready for your logistics needs.
          </p>
        </RevealOnScroll>

        <RevealOnScroll className="mt-14">
          <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0] text-center md:text-left">
            Vehicle types
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mt-8">
            {vehicles.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-[#E0E8F0] bg-white overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
              >
                <div
                  className={`h-36 flex items-center justify-center relative ${v.gradientClass}`}
                  aria-hidden
                >
                  <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,white,transparent_55%)]" />
                  <v.icon className="w-16 h-16 text-white/90 relative z-10 drop-shadow-md" strokeWidth={1.25} />
                </div>
                <div className="p-6">
                  <h3 className="font-gk-barlow text-lg font-bold uppercase tracking-wide text-[#0D2847]">{v.title}</h3>
                  <ul className="font-gk-rajdhani text-[#1A4A7A] mt-4 space-y-2">
                    {v.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll className="mt-16 max-w-3xl mx-auto">
          <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0]">
            Fleet highlights
          </h2>
          <ul className="mt-6 space-y-3 font-gk-rajdhani text-[#0D2847]">
            {highlights.map((h) => (
              <li key={h} className="flex gap-2">
                <span className="text-[#1565C0]">✅</span>
                {h}
              </li>
            ))}
          </ul>
        </RevealOnScroll>

        <RevealOnScroll className="mt-16">
          <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0] text-center">
            Our clients
          </h2>
          <p className="font-gk-rajdhani text-center text-[#1A4A7A] mt-3">We serve leading companies in:</p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {clients.map((name) => (
              <span
                key={name}
                className="px-5 py-2.5 rounded-full border border-[#E0E8F0] bg-white font-gk-barlow text-sm font-semibold uppercase tracking-wider text-[#0D2847] shadow-sm"
              >
                {name}
              </span>
            ))}
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
