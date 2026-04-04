import { RevealOnScroll } from '@/components/public/RevealOnScroll';

const clients = [
  { name: 'Anusaya Fresh', industry: 'Fresh Produce', color: '#4CAF50' },
  { name: 'Pluckk', industry: 'Fresh Produce', color: '#8BC34A' },
  { name: "D'Lecta", industry: 'Dairy & Cheese', color: '#FF9800' },
  { name: 'Zepto', industry: 'Quick Commerce', color: '#7C4DFF' },
  { name: 'Sintree India', industry: 'Food & Beverages', color: '#E91E63' },
  { name: 'Cogent Foods', industry: 'Food Products', color: '#00BCD4' },
  { name: 'Fruit FM', industry: 'Fruit Delivery', color: '#FF5722' },
  { name: 'Kisan Konnect', industry: 'Farm to Fork', color: '#66BB6A' },
  { name: 'YC Fresh', industry: 'Fresh Produce', color: '#26A69A' },
  { name: 'Smoor', industry: 'Chocolates & Desserts', color: '#5D4037' },
  { name: 'Lab N Life', industry: 'Health & Nutrition', color: '#1E88E5' },
  { name: 'Suyog Food Products', industry: 'Food Products', color: '#EF5350' },
] as const;

export function TrustedBySection() {
  return (
    <section
      className="py-20 bg-[#0D2847] border-b border-[#1A4A7A]/80"
      aria-labelledby="trusted-by-heading"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2
          id="trusted-by-heading"
          className="font-gk-bebas text-3xl md:text-4xl text-white text-center tracking-wide uppercase"
        >
          Trusted by India&apos;s leading brands
        </h2>
        <p className="font-gk-rajdhani text-center text-gray-400 mt-4 max-w-2xl mx-auto leading-relaxed">
          Cold chain logistics partner for 12+ food, dairy &amp; fresh produce companies
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mt-12">
          {clients.map((client, index) => (
            <RevealOnScroll key={client.name} delayMs={index * 50}>
              <div className="group bg-white/[0.06] border border-white/10 rounded-xl p-6 flex flex-col items-center gap-3 hover:bg-white/[0.12] hover:border-[#42A5F5]/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#42A5F5]/10 transition-all duration-300 cursor-default h-full">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-gk-barlow font-bold group-hover:scale-110 transition-transform duration-300 shrink-0"
                  style={{ backgroundColor: client.color }}
                  aria-hidden
                >
                  {client.name.charAt(0)}
                </div>
                <span className="text-white font-gk-rajdhani font-medium text-sm text-center leading-tight">
                  {client.name}
                </span>
                <span className="text-[#42A5F5] font-gk-rajdhani text-xs tracking-wide text-center">
                  {client.industry}
                </span>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
