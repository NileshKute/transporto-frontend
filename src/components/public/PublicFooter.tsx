import Link from 'next/link';

const quick = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About Us' },
  { href: '/services', label: 'Services' },
  { href: '/fleet', label: 'Fleet' },
  { href: '/contact', label: 'Contact' },
  { href: '/login', label: 'Client Login' },
];

const services = ['Cold Chain Transport', 'General Fleet', 'Temperature Monitoring', 'Vehicle Management'];

export function PublicFooter() {
  return (
    <footer className="bg-[#0D2847] text-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1A4A7A] to-[#1565C0] flex items-center justify-center border border-[#42A5F5]/30">
                <span className="font-['Bebas_Neue'] text-xl text-white">G</span>
                <span className="font-['Bebas_Neue'] text-xl text-[#42A5F5] -ml-0.5">K</span>
              </div>
            </div>
            <p className="font-['Bebas_Neue'] text-2xl tracking-wide text-white">G K ENTERPRISE</p>
            <p className="font-['Rajdhani'] text-sm text-[#64B5F6] mt-2 leading-relaxed">
              Fleet Owners &amp; Cold Chain Logistics Specialists
            </p>
          </div>

          <div>
            <h3 className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-[#64B5F6] mb-4">
              Quick links
            </h3>
            <ul className="space-y-2">
              {quick.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="font-['Rajdhani'] text-sm text-white/85 hover:text-[#64B5F6] transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-[#64B5F6] mb-4">
              Services
            </h3>
            <ul className="space-y-2">
              {services.map((s) => (
                <li key={s} className="font-['Rajdhani'] text-sm text-white/85">
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-[#64B5F6] mb-4">
              Contact
            </h3>
            <address className="not-italic font-['Rajdhani'] text-sm text-white/85 space-y-3 leading-relaxed">
              <p>
                <span className="text-[#64B5F6] mr-1">📍</span>
                Office 402, Shree Ganesh CHS Ltd, Plot No 151, Phase II, Navde, Taloja, Panvel, Navi Mumbai 410208
              </p>
              <p>
                <span className="text-[#64B5F6] mr-1">📞</span>
                <a href="tel:+919324540988" className="hover:text-[#64B5F6]">
                  +91 9324540988
                </a>
              </p>
              <p>
                <span className="text-[#64B5F6] mr-1">✉️</span>
                <a href="mailto:ganesh@gkenterprise.in" className="hover:text-[#64B5F6]">
                  ganesh@gkenterprise.in
                </a>
              </p>
              <p>
                <span className="text-[#64B5F6] mr-1">🌐</span>
                <a href="https://www.gkenterprise.in" className="hover:text-[#64B5F6]" target="_blank" rel="noopener noreferrer">
                  www.gkenterprise.in
                </a>
              </p>
            </address>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-[#1A4A7A] text-center font-['Rajdhani'] text-xs text-[#7A9AB8]">
          © {new Date().getFullYear()} G K Enterprise. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}
