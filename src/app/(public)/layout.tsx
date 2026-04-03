import type { Metadata } from 'next';
import { PublicNav } from '@/components/public/PublicNav';
import { PublicFooter } from '@/components/public/PublicFooter';

export const metadata: Metadata = {
  title: {
    default: 'G K Enterprise — Cold Chain & Fleet Logistics | Navi Mumbai',
    template: '%s | G K Enterprise',
  },
  description:
    'G K Enterprise: fleet owners and cold chain logistics specialists in Navi Mumbai. Temperature-controlled transport, GPS tracking, and reliable deliveries across India since 2019.',
  openGraph: {
    siteName: 'G K Enterprise',
  },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA]">
      <PublicNav />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
