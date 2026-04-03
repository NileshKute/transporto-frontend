import type { Metadata } from 'next';
import { HomePageContent } from '@/components/public/HomePageContent';

export const metadata: Metadata = {
  title: 'Home',
  description:
    'Reliable cold chain and fleet solutions from G K Enterprise, Navi Mumbai. Temperature-controlled transport, 15+ vehicles, and 24/7 support.',
};

export default function PublicHomePage() {
  return <HomePageContent />;
}
