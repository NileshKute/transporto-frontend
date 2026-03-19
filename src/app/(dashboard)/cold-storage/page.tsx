'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Thermometer, AlertTriangle, Users, Zap } from 'lucide-react';
import Link from 'next/link';

const tempColor = (status: string) => {
  if (status === 'CRITICAL') return 'text-[#DC2626]';
  if (status === 'WARNING') return 'text-[#F59E0B]';
  return 'text-[#16A34A]';
};
const statusDot = (status: string) => {
  if (status === 'CRITICAL') return 'bg-[#DC2626]';
  if (status === 'WARNING') return 'bg-[#F59E0B] animate-pulse';
  if (status === 'OFFLINE') return 'bg-[#7A9AB8]';
  return 'bg-[#16A34A]';
};

export default function ColdStoragePage() {
  const { data: units, isLoading } = useQuery({
    queryKey: ['cold-storage'],
    queryFn: () => api.get('/cold-storage').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: alerts } = useQuery({
    queryKey: ['cold-storage-alerts'],
    queryFn: () => api.get('/cold-storage/alerts').then(r => r.data),
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Cold Storage</h2>
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">Monitor temperature and storage units</p>
      </div>

      {alerts?.length > 0 && (
        <div className="bg-[#DC2626]/10 border-l-4 border-[#DC2626] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
            <h3 className="font-semibold text-[#DC2626]">{alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}</h3>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between text-sm text-[#0D2847]">
                <span>{a.unit?.name} — {a.alertType.replace(/_/g,' ')}</span>
                <span className="text-xs font-mono">{a.temperature != null ? `${a.temperature}°C` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : !units?.length ? <EmptyState message="No cold storage units" /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {units.map((u: any) => {
            const latestTemp = u.temperatureLogs?.[0]?.temperature;
            const capacityUsed = u.storageClients?.reduce((acc: number, c: any) => acc + (c.spaceUsed || 0), 0) || 0;
            const capacityPct = Math.min(100, u.capacityTotal ? Math.round((capacityUsed / u.capacityTotal) * 100) : 0);
            return (
              <Link key={u.id} href={`/cold-storage/${u.id}`}>
                <div className="bg-white rounded-xl border border-[#E0E8F0] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusDot(u.status)} ${u.status === 'WARNING' || u.status === 'CRITICAL' ? 'animate-pulse' : ''}`} />
                        <h3 className="font-semibold text-[#0D2847]">{u.name}</h3>
                      </div>
                      <span className="text-xs bg-[#F4F6F8] text-[#1A4A7A] px-2 py-0.5 rounded font-medium">{u.type?.replace(/_/g,' ')}</span>
                    </div>
                    <StatusBadge status={u.status} />
                  </div>

                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <p className="text-xs text-[#1A4A7A] mb-1">Current Temp</p>
                      <p className={`text-4xl font-bold font-mono ${tempColor(u.status)}`}>
                        {latestTemp != null ? `${latestTemp > 0 ? '+' : ''}${latestTemp}°` : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#1A4A7A]">Target</p>
                      <p className="text-sm font-semibold text-[#1A4A7A]">{u.targetTemp != null && u.targetTemp > 0 ? '+' : ''}{u.targetTemp}°C</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-[#1A4A7A] mb-1.5">
                      <span>Capacity</span>
                      <span className="font-mono">{capacityUsed} / {u.capacityTotal} {u.capacityUnit || 'Tons'}</span>
                    </div>
                    <div className="h-2 bg-[#F4F6F8] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${capacityPct > 90 ? 'bg-red-500' : capacityPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${capacityPct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#1A4A7A]">
                    <div className="flex items-center gap-1"><Users className="w-3 h-3" />{u.storageClients?.length || 0} active clients</div>
                    <div className="flex items-center gap-1"><Thermometer className="w-3 h-3" /> Sensor: {u.sensorId || 'N/A'}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
