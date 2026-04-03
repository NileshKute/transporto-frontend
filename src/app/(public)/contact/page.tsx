import type { Metadata } from 'next';
import Image from 'next/image';
import { RevealOnScroll } from '@/components/public/RevealOnScroll';
import { ContactForm } from '@/components/public/ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact G K Enterprise in Taloja, Navi Mumbai — cold chain and fleet logistics. Phone +91 9324540988, ganesh@gkenterprise.in.',
};

export default function ContactPage() {
  return (
    <div className="pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealOnScroll>
          <h1 className="font-gk-bebas text-5xl md:text-6xl text-[#0D2847] tracking-wide">Contact us</h1>
        </RevealOnScroll>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 mt-12">
          <div className="space-y-10">
            <RevealOnScroll>
              <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0]">
                Get in touch
              </h2>
              <div className="mt-6 space-y-6 font-gk-rajdhani text-[#0D2847]">
                <div>
                  <p className="font-gk-barlow text-xs font-bold uppercase tracking-wider text-[#1A4A7A] mb-2">
                    Address
                  </p>
                  <address className="not italic leading-relaxed text-[#1A4A7A]">
                    Office 402, Shree Ganesh CHS Ltd,
                    <br />
                    Plot No 151, Phase II, Navde,
                    <br />
                    Taloja, Panvel, Navi Mumbai 410208
                    <br />
                    Maharashtra, India
                  </address>
                </div>
                <div>
                  <p className="font-gk-barlow text-xs font-bold uppercase tracking-wider text-[#1A4A7A] mb-2">Phone</p>
                  <a href="tel:+919324540988" className="text-[#1565C0] font-semibold hover:underline">
                    +91 9324540988
                  </a>
                </div>
                <div>
                  <p className="font-gk-barlow text-xs font-bold uppercase tracking-wider text-[#1A4A7A] mb-2">Email</p>
                  <a href="mailto:ganesh@gkenterprise.in" className="text-[#1565C0] font-semibold hover:underline">
                    ganesh@gkenterprise.in
                  </a>
                </div>
                <div>
                  <p className="font-gk-barlow text-xs font-bold uppercase tracking-wider text-[#1A4A7A] mb-2">
                    Website
                  </p>
                  <a
                    href="https://www.gkenterprise.in"
                    className="text-[#1565C0] font-semibold hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    www.gkenterprise.in
                  </a>
                </div>
              </div>
            </RevealOnScroll>

            <RevealOnScroll>
              <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0]">
                Business hours
              </h2>
              <ul className="mt-4 font-gk-rajdhani text-[#1A4A7A] space-y-2">
                <li>Monday – Saturday: 9:00 AM – 8:00 PM</li>
                <li>Sunday: emergency support only</li>
                <li>Operations: 24/7</li>
              </ul>
            </RevealOnScroll>
          </div>

          <RevealOnScroll>
            <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0]">
              Send us a message
            </h2>
            <p className="font-gk-rajdhani text-sm text-[#1A4A7A] mt-2 mb-6">
              Opens your email client with the details filled in.
            </p>
            <div className="relative w-full h-48 rounded-xl overflow-hidden bg-[#E0E8F0] mb-8 shadow-md">
              <Image
                src="/images/fleet/truck-back-branding.jpg"
                alt="G K Enterprise branded reefer"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                loading="lazy"
              />
            </div>
            <ContactForm />
          </RevealOnScroll>
        </div>

        <RevealOnScroll className="mt-16">
          <h2 className="font-gk-barlow text-sm font-bold uppercase tracking-[0.25em] text-[#1565C0] mb-4">
            Find us
          </h2>
          <div className="rounded-2xl overflow-hidden border border-[#E0E8F0] shadow-sm aspect-video bg-[#E0E8F0]">
            <iframe
              src="https://maps.google.com/maps?q=19.051503,73.103799&z=15&output=embed"
              width="100%"
              height="400"
              style={{ border: 0, borderRadius: '12px' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="G K Enterprise Location"
            />
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
