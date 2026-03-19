'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { LoadingSpinner, TableSkeleton } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Truck, Users, Route, Fuel, Wrench, AlertTriangle, Shield, Snowflake } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const CHART_COLORS = {
  primary: '#0D2847',
  secondary: '#1565C0',
  accent: '#42A5F5',
  light: '#64B5F6',
  mid: '#1A4A7A',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
};
const tooltipStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E0E8F0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '12px', fontSize: '13px', fontFamily: 'Rajdhani, sans-serif' };

const weeklyTripData = [{ day: 'Mon', trips: 12 }, { day: 'Tue', trips: 19 }, { day: 'Wed', trips: 8 }, { day: 'Thu', trips: 15 }, { day: 'Fri', trips: 22 }, { day: 'Sat', trips: 10 }, { day: 'Sun', trips: 5 }];
const vehicleStatusData = [
  { name: 'Active', value: 28, color: CHART_COLORS.success },
  { name: 'Maintenance', value: 5, color: CHART_COLORS.warning },
  { name: 'Idle', value: 12, color: CHART_COLORS.mid },
  { name: 'Breakdown', value: 2, color: CHART_COLORS.danger },
];

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-['Oswald'] text-base font-semibold text-[#0D2847]">{title}</h3>
      <Link href={href} className="text-sm text-[#1565C0] hover:text-[#0D2847] font-medium transition-colors font-['Barlow_Condensed'] uppercase tracking-wider">
        View all →
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: sl } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: recent, isLoading: rl } = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () => api.get('/dashboard/recent').then(r => r.data),
  });

  if (sl) return <LoadingSpinner text="Loading dashboard..." />;

  const pendingEmergencies = stats?.emergencies?.pending ?? recent?.emergencies?.filter((e: any) => e.status === 'PENDING' || e.status === 'ACKNOWLEDGED').length ?? 0;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <StatCard icon={Truck} iconColor="blue" title="Total Vehicles" value={stats?.vehicles?.total ?? 0} subtitle={`${stats?.vehicles?.active ?? 0} active`} trend={12} trendDirection="up" />
        <StatCard icon={Users} iconColor="green" title="Active Drivers" value={stats?.drivers?.total ?? 0} subtitle={`${stats?.drivers?.onTrip ?? 0} on trip`} trend={5} trendDirection="up" />
        <StatCard icon={Route} iconColor="purple" title="Today's Trips" value={stats?.trips?.today ?? 0} subtitle="Active today" trend={-3} trendDirection="down" />
        <StatCard icon={Fuel} iconColor="amber" title="Fuel Spend" value={formatCurrency(stats?.fuel?.totalCost)} subtitle="All time" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        {[
          { label: 'Active Maintenance', value: stats?.maintenance?.active ?? 0, icon: Wrench, border: 'border-l-[#F59E0B]', iconClass: 'text-[#F59E0B]', href: '/maintenance' },
          { label: 'Pending Emergencies', value: stats?.emergencies?.pending ?? 0, icon: AlertTriangle, border: 'border-l-[#DC2626]', iconClass: 'text-[#DC2626]', href: '/emergencies' },
          { label: 'Expiring Insurance', value: stats?.insurance?.expiring ?? 0, icon: Shield, border: 'border-l-[#F59E0B]', iconClass: 'text-[#F59E0B]', href: '/insurance' },
          { label: 'Cold Storage Alerts', value: stats?.coldStorage?.alerts ?? 0, icon: Snowflake, border: 'border-l-[#42A5F5]', iconClass: 'text-[#42A5F5]', href: '/cold-storage' },
        ].map(({ label, value, icon: Icon, border, iconClass, href }) => (
          <Link key={label} href={href}>
            <div className={`bg-white rounded-xl border border-[#E0E8F0] border-l-4 ${border} p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all cursor-pointer`}>
              <div className={`p-2.5 rounded-xl ${iconClass} bg-current/10`}><Icon className="w-5 h-5" /></div>
              <div>
                <p className={`font-['Oswald'] text-2xl font-bold ${value > 0 ? iconClass : 'text-[#7A9AB8]'}`}>{value}</p>
                <p className="font-['Barlow_Condensed'] text-xs text-[#7A9AB8] uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-5">
          <h3 className="font-['Oswald'] text-base font-semibold text-[#0D2847] mb-4">Weekly Trip Activity</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weeklyTripData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F4F6F8" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#7A9AB8' }} axisLine={{ stroke: '#E0E8F0' }} />
              <YAxis tick={{ fontSize: 12, fill: '#7A9AB8' }} axisLine={{ stroke: '#E0E8F0' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [`${value}`, name]} />
              <Bar dataKey="trips" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-5">
          <h3 className="font-['Oswald'] text-base font-semibold text-[#0D2847] mb-4">Vehicle Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={vehicleStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                {vehicleStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [`${value}`, name]} />
              <Legend layout="horizontal" align="center" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E0E8F0]">
            <SectionHeader title="Recent Trips" href="/trips" />
          </div>
          {rl ? <TableSkeleton rows={5} cols={4} /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Trip #</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Vehicle</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Route</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E8F0]">
                  {recent?.trips?.slice(0, 5).map((t: any) => (
                    <tr key={t.id} className="hover:bg-[#F4F6F8] transition-colors">
                      <td className="px-4 py-3.5 text-sm text-[#0D2847] font-['Rajdhani']"><span className="font-mono font-bold text-[#1565C0]">{t.tripNumber}</span></td>
                      <td className="px-4 py-3.5 text-sm text-[#0D2847] font-['Rajdhani']"><span className="font-mono">{t.vehicle?.regNumber}</span></td>
                      <td className="px-4 py-3.5 text-sm text-[#0D2847] font-['Rajdhani'] truncate max-w-[160px]">{t.startLocation?.split('(')[0].trim()} → {t.endLocation?.split('(')[0].trim() || '...'}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                  {!recent?.trips?.length && <tr><td colSpan={4} className="text-center py-8 text-[#7A9AB8] text-sm font-['Rajdhani']">No trips yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E0E8F0]">
            <SectionHeader title="Recent Fuel Entries" href="/fuel" />
          </div>
          {rl ? <TableSkeleton rows={5} cols={4} /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Vehicle</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Liters</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Cost</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E8F0]">
                  {recent?.fuelEntries?.slice(0, 5).map((f: any) => (
                    <tr key={f.id} className="hover:bg-[#F4F6F8] transition-colors">
                      <td className="px-4 py-3.5 text-sm text-[#0D2847] font-['Rajdhani'] font-mono font-semibold">{f.vehicle?.regNumber}</td>
                      <td className="px-4 py-3.5 text-sm text-[#0D2847] font-['Rajdhani'] font-mono">{f.liters} L</td>
                      <td className="px-4 py-3.5 text-sm text-[#16A34A] font-['Rajdhani'] font-mono font-semibold">{formatCurrency(f.totalCost)}</td>
                      <td className="px-4 py-3.5 text-sm text-[#7A9AB8] font-['Rajdhani']">{formatDate(f.fuelDate)}</td>
                    </tr>
                  ))}
                  {!recent?.fuelEntries?.length && <tr><td colSpan={4} className="text-center py-8 text-[#7A9AB8] text-sm font-['Rajdhani']">No fuel entries</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {pendingEmergencies > 0 && (
        <AlertBanner
          type="danger"
          title={`${pendingEmergencies} Active Emergency${pendingEmergencies > 1 ? 's' : ''} Require Attention`}
          action={{ label: 'View All', onClick: () => window.location.href = '/emergencies' }}
        />
      )}
    </div>
  );
}
