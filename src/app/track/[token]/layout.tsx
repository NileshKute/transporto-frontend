import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: 'Live Vehicle Tracking — G K Enterprise',
    description:
      'Track your vehicle in real-time with G K Enterprise cold chain logistics',
    openGraph: {
      title: 'Live Vehicle Tracking — G K Enterprise',
      description: 'Real-time GPS tracking for your delivery',
      type: 'website',
    },
  };
}

export default function TrackTokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
