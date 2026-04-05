import { redirect } from 'next/navigation';

export default function DailyTripLogLegacyPage() {
  redirect('/trips?tab=daily');
}
