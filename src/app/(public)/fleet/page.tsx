import type { Metadata } from 'next';
import Image from 'next/image';
import ClientLogos from '@/components/ClientLogos';
import { FleetPhotoGallery } from '@/components/public/FleetPhotoGallery';
import { RevealOnScroll } from '@/components/public/RevealOnScroll';

export const metadata: Metadata = {
  title: 'Fleet',
  description:
    'Photo gallery and specs: GPS-tracked reefers, Bolero last-mile units, and branded fleet — G K Enterprise, Navi Mumbai.',
};

const vehicleTypes = [
  {
    src: '/images/fleet/reefer-truck-side.jpg',
    alt: 'Refrigerated Eicher truck',
    title: 'Refrigerated trucks (reefer)',
    lines: [
      'Temperature range: -25°C to +25°C',
      'Capacity: 2 ton to 15 ton',
      'GPS tracked with temperature sensors',
    ],
  },
  {
    src: '/images/fleet/bolero-reefer-side.jpg',
    alt: 'Mahindra Bolero reefer',
    title: 'LCV & container operations',
    lines: ['Heavy-duty and mid-size freight', 'Last-mile and urban routes', 'Pan-India and Maharashtra coverage'],
  },
  {
    src: '/images/fleet/reefer-interior.jpg',
    alt: 'Reefer interior cooling unit',
    title: 'Temperature integrity',
    lines: ['Real-time temperature monitoring', 'Carrier-grade cooling', 'FSSAI-aligned cold chain'],
  },
] as const;

const highlights = [
  'All vehicles GPS tracked',
  'Real-time temperature monitoring',
  'Regular maintenance schedule',
  'PUC, insurance, and fitness — always current',
  'Experienced, trained drivers',
];

export default function FleetPage() {
  return (
    <div className="pt-20 pb-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <RevealOnScroll className="text-center max-w-2xl mx-auto">
          <h1 className="font-gk-bebas text-5xl md:text-6xl text-[#0D2847] tracking-wide">Our Fleet</h1>
          <p className="font-gk-rajdhani text-lg text-[#1A4A7A] mt-4">
            15+ vehicles ready for your logistics needs — see our lineup below.
          </p>
        </RevealOnScroll>

        <RevealOnScroll className="mt-14">
          <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0] text-center md:text-left">
            Vehicle types
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mt-8">
            {vehicleTypes.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-[#E0E8F0] bg-white overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="relative h-44 bg-[#E0E8F0]">
                  <Image src={v.src} alt={v.alt} fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" loading="lazy" />
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

        <RevealOnScroll className="mt-16">
          <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0] mb-8 text-center md:text-left">
            Fleet gallery
          </h2>
          <FleetPhotoGallery />
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
      </div>

      <ClientLogos />
    </div>
  );
}
