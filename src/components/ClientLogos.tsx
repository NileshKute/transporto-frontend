'use client';

const clients = [
  { name: 'Zepto', url: 'https://www.zeptonow.com', color: '#7B2D8E' },
  { name: 'Pluckk', url: 'https://pluckk.in', color: '#4CAF50' },
  { name: "D'Lecta", url: 'https://dlecta.com', color: '#E53935' },
  { name: 'Kisan Konnect', url: 'https://www.kisankonnect.in', color: '#FF9800' },
  { name: 'Cogent Foods', url: 'https://cogentfoods.in', color: '#1565C0' },
  { name: 'Fruit FM', url: 'https://www.fruitfm.com', color: '#4CAF50' },
  { name: 'Sintree India', url: '#', color: '#0D2847' },
  { name: 'Anusaya Fresh', url: 'http://anusayafresh.com', color: '#2E7D32' },
  { name: 'YC Fresh', url: 'https://www.ycfresh.com', color: '#F57C00' },
  { name: 'Smoor', url: 'https://smoor.in', color: '#5D4037' },
  { name: 'Lab N Life', url: 'https://labnlife.com', color: '#00838F' },
  { name: 'Suyog Food Products', url: 'https://www.suyogfoodproducts.com', color: '#D84315' },
];

function ClientCard({ client }: { client: (typeof clients)[number] }) {
  const inner = (
    <>
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-gk-barlow font-bold text-lg mb-2 shrink-0"
        style={{ backgroundColor: client.color }}
        aria-hidden
      >
        {client.name.charAt(0)}
      </div>
      <span className="text-xs font-gk-barlow font-semibold text-gray-600 text-center group-hover:text-[#1565C0] transition-colors leading-tight">
        {client.name}
      </span>
    </>
  );

  if (client.url === '#') {
    return (
      <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-white border border-gray-100 shadow-sm opacity-90">
        {inner}
      </div>
    );
  }

  return (
    <a
      href={client.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center justify-center p-4 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-[#42A5F5] transition-all duration-300 group"
    >
      {inner}
    </a>
  );
}

export default function ClientLogos() {
  return (
    <section className="py-16 bg-gray-50 border-t border-[#E0E8F0]" aria-labelledby="trusted-clients-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2
          id="trusted-clients-heading"
          className="text-3xl md:text-4xl font-gk-bebas text-center text-[#0D2847] mb-2 tracking-wide uppercase"
        >
          Our trusted clients
        </h2>
        <p className="text-center font-gk-rajdhani text-gray-500 mb-10 max-w-2xl mx-auto">
          Serving leading brands in food, dairy, fresh produce, and quick commerce
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {clients.map((client) => (
            <ClientCard key={client.name} client={client} />
          ))}
        </div>
      </div>
    </section>
  );
}
