import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for G K Enterprise — how we collect, use, and protect information in our cold chain logistics and fleet operations.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto py-12 px-6">
        <p className="mb-8">
          <Link
            href="/"
            className="text-sm text-[#1565C0] hover:text-[#0D2847] hover:underline font-medium"
          >
            ← Back to home
          </Link>
        </p>

        <h1 className="text-3xl sm:text-4xl font-bold text-[#0D2847] tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          <span className="font-medium text-gray-600">G K Enterprise</span>
          {' · '}
          Effective date: April 11, 2026
        </p>

        <div className="mt-10 space-y-1 text-gray-700 leading-relaxed text-[15px] sm:text-base">
          <section>
            <h2 className="text-xl font-semibold text-[#0D2847] mt-8 mb-3">1. Introduction</h2>
            <p>
              This Privacy Policy describes how <strong>G K Enterprise</strong> (“we,” “us,” or “our”)
              collects, uses, and protects information when you use our services. G K Enterprise provides{' '}
              <strong>cold chain logistics</strong>, temperature-controlled transport, fleet management, and
              related operations based in Navi Mumbai, India. By using our websites, applications, or
              services, you agree to the practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#0D2847] mt-8 mb-3">2. Information We Collect</h2>
            <p>We may collect the following categories of information, depending on how you interact with us:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong>Driver and personnel data</strong> — including phone numbers and identifiers used for
                scheduling, communication, and fleet operations.
              </li>
              <li>
                <strong>Vehicle and asset data</strong> — registration details, maintenance records, and
                operational identifiers.
              </li>
              <li>
                <strong>Location and GPS data</strong> — vehicle locations and routes for tracking, safety,
                and delivery management.
              </li>
              <li>
                <strong>Trip and logistics data</strong> — routes, loads, timestamps, and status related to
                shipments and cold chain handling.
              </li>
              <li>
                <strong>Customer and business contact information</strong> — names, phone numbers, email
                addresses, and billing or delivery details as needed to fulfil contracts.
              </li>
              <li>
                <strong>WhatsApp messages</strong> — messages you send to our official WhatsApp business
                number, including content and metadata required to deliver replies and maintain conversation
                history as permitted by applicable terms.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#0D2847] mt-8 mb-3">3. How We Use Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Operate and manage our fleet and cold chain logistics;</li>
              <li>Track trips, vehicles, and deliveries for operational and safety purposes;</li>
              <li>Communicate with drivers, customers, and partners regarding services and support;</li>
              <li>Prepare and manage invoicing, accounts, and business records;</li>
              <li>Meet legal, regulatory, and contractual compliance obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#0D2847] mt-8 mb-3">4. WhatsApp Business API</h2>
            <p>
              We use the <strong>Meta WhatsApp Business Platform</strong> (WhatsApp Business API) to
              communicate with drivers and customers regarding logistics, updates, and support. Messages
              sent to our business number are received and processed by our backend systems and service
              integrations as needed to respond and maintain service quality. Use of WhatsApp is also
              subject to Meta’s and WhatsApp’s terms and policies. Where applicable,{' '}
              <strong>customers may opt out</strong> of marketing or non-essential messages by contacting
              us at the details below or by following instructions we provide in those messages, subject to
              operational or legal requirements to retain certain records.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#0D2847] mt-8 mb-3">5. Data Sharing</h2>
            <p>
              We <strong>do not sell</strong> your personal information. We may share data only as needed for
              legitimate business operations with service providers and platforms that help us run our
              business, including where applicable:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Cloud and hosting providers (e.g. Railway, Vercel);</li>
              <li>Meta (WhatsApp Business Platform) for messaging;</li>
              <li>Telematics and GPS partners (e.g. GeoTrackers);</li>
              <li>Fuel and fleet partners such as BPCL where relevant to fuel or card programs;</li>
              <li>Toll and payment infrastructure such as Kotak FASTag for operational toll management;</li>
              <li>Other vendors strictly for processing on our instructions and subject to appropriate safeguards.</li>
            </ul>
            <p className="mt-3">
              We may also disclose information if required by law, court order, or to protect our rights, users,
              or the public.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#0D2847] mt-8 mb-3">6. Data Retention</h2>
            <p>
              We retain personal and operational data for as long as necessary to provide our services,
              maintain business records, resolve disputes, and comply with legal, tax, accounting, and
              regulatory requirements. Retention periods may vary by data type and jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#0D2847] mt-8 mb-3">7. Your Rights</h2>
            <p>
              Depending on applicable law, you may have rights to access, correct, or request deletion of
              certain personal information we hold, subject to legal exceptions. To exercise these rights or
              ask questions, contact us at{' '}
              <a href="mailto:admin@gkenterprise.in" className="text-[#1565C0] hover:text-[#0D2847] underline">
                admin@gkenterprise.in
              </a>
              . We will respond in line with applicable regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#0D2847] mt-8 mb-3">8. Children&apos;s Privacy</h2>
            <p>
              Our services are <strong>not intended for individuals under 18</strong>. We do not knowingly
              collect personal information from children. If you believe we have collected such information,
              please contact us and we will take appropriate steps to delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#0D2847] mt-8 mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. The <strong>latest version</strong> will
              always be posted at this URL (
              <Link href="/privacy" className="text-[#1565C0] hover:text-[#0D2847] underline">
                /privacy
              </Link>
              ). The effective date at the top will be revised when material changes are made. Continued use
              of our services after changes constitutes acceptance of the updated policy where permitted by
              law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#0D2847] mt-8 mb-3">10. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or our data practices, contact:</p>
            <address className="not-italic mt-3 space-y-1">
              <p className="font-semibold text-[#0D2847]">G K Enterprise</p>
              <p>
                Office 402, Shree Ganesh CHS Ltd, Plot No 151, Phase II, Navde, Taloja, Panvel, Navi Mumbai
                410208
              </p>
              <p>
                Email:{' '}
                <a href="mailto:admin@gkenterprise.in" className="text-[#1565C0] hover:text-[#0D2847] underline">
                  admin@gkenterprise.in
                </a>
              </p>
              <p>
                Phone:{' '}
                <a href="tel:+919324540988" className="text-[#1565C0] hover:text-[#0D2847] underline">
                  +91 9324540988
                </a>
              </p>
            </address>
          </section>
        </div>
      </div>
    </div>
  );
}
