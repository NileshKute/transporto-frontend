'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { Truck, Activity, PauseCircle, WifiOff, RefreshCw, MapPin } from 'lucide-react';
import type { GpsVehicle } from '@/components/gps/types';
import { vehicleReg } from '@/components/gps/types';

const GpsLiveMap = dynamic(
  () => import('@/components/gps/GpsLiveMap').then((m) => m.GpsLiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[300px] flex items-center justify-center bg-[#E0E8F0] rounded-xl text-[#7A9AB8] text-sm font-['Rajdhani']">
        Loading map…
      </div>
    ),
  }
);

function tempListClass(t: number): string {
  if (t < -15) return 'text-blue-600';
  if (t < 0) return 'text-cyan-600';
  if (t < 10) return 'text-green-600';
  return 'text-red-600';
}

function vehicleStatusLine(v: GpsVehicle): string {
  switch (v.status) {
    case 'MOVING':
      return v.movingSince ? `Moving: ${v.movingSince}` : 'Moving';
    case 'HALTED':
    case 'LONG_HALT':
      return v.haltedSince ? `Halted: ${v.haltedSince}` : 'Halted';
    case 'OFFLINE':
      return v.noDataSince ? `Offline: ${v.noDataSince}` : 'Offline';
    case 'IDLE':
      return 'Idle';
    default:
      return v.status ? String(v.status) : '—';
  }
}

export default function GpsLivePage() {
  const [vehicles, setVehicles] = useState<GpsVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetched, setLastFetched] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<GpsVehicle | null>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);

  const fetchLiveData = useCallback(async () => {
    try {
      const res = await api.get<{ vehicles?: GpsVehicle[] }>('/gps/live');
      setVehicles(res.data.vehicles ?? []);
      setLastFetched(new Date().toLocaleTimeString('en-IN'));
      setError(null);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message ?? 'Failed to fetch GPS data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveData();
  }, [fetchLiveData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLiveData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLiveData]);

  useEffect(() => {
    api.get('/gps/sync').catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedVehicle) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    if (mq.matches) {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedVehicle]);

  const movingCount = vehicles.filter((v) => v.status === 'MOVING').length;
  const haltedCount = vehicles.filter((v) => v.status === 'HALTED' || v.status === 'LONG_HALT').length;
  const offlineCount = vehicles.filter((v) => v.status === 'OFFLINE').length;
  const idleCount = vehicles.filter((v) => v.status === 'IDLE').length;
  const haltedIdleCount = haltedCount + idleCount;

  const summaryCards = [
    {
      label: 'Total vehicles',
      value: vehicles.length,
      icon: Truck,
      iconBg: 'bg-[#1565C0]/15',
      iconColor: 'text-[#1565C0]',
    },
    {
      label: 'Moving',
      value: movingCount,
      icon: Activity,
      iconBg: 'bg-green-500/15',
      iconColor: 'text-green-600',
    },
    {
      label: 'Halted / idle',
      value: haltedIdleCount,
      icon: PauseCircle,
      iconBg: 'bg-orange-500/15',
      iconColor: 'text-orange-600',
    },
    {
      label: 'Offline',
      value: offlineCount,
      icon: WifiOff,
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-8 h-8 text-[#1565C0] flex-shrink-0" />
          <div>
            <h1 className="font-['Oswald'] text-2xl font-bold text-[#0D2847] tracking-wide uppercase">
              GPS live tracking
            </h1>
            <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">Live fleet positions · refreshes every 30s when on</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-['Rajdhani'] text-sm text-[#7A9AB8]">
            Last updated: {lastFetched || '—'}
          </span>
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`font-['Barlow_Condensed'] uppercase tracking-wider text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
              autoRefresh
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => fetchLiveData()}
            className="font-['Barlow_Condensed'] uppercase tracking-wider text-xs px-3 py-1.5 rounded-full bg-[#1565C0] text-white hover:bg-[#0D2847] transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh now
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-['Rajdhani'] text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {summaryCards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-[#E0E8F0] bg-white p-4 shadow-sm flex items-center gap-3"
          >
            <div className={`rounded-lg p-2.5 ${c.iconBg}`}>
              <c.icon className={`w-5 h-5 ${c.iconColor}`} />
            </div>
            <div>
              <p className="font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#7A9AB8]">
                {c.label}
              </p>
              <p className="font-['Oswald'] text-2xl text-[#0D2847]">{loading ? '—' : c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {loading && vehicles.length === 0 && !error ? (
        <div className="rounded-xl border border-[#E0E8F0] bg-white p-12 text-center font-['Rajdhani'] text-[#7A9AB8]">
          Loading GPS data…
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">
          <div
            ref={mapSectionRef}
            className="w-full lg:w-[65%] h-[min(500px,55vh)] lg:h-[500px] rounded-xl overflow-hidden shadow border border-[#E0E8F0] bg-[#E0E8F0]"
          >
            <GpsLiveMap
              vehicles={vehicles}
              selectedVehicle={selectedVehicle}
              onMarkerClick={(v) => setSelectedVehicle(v)}
            />
          </div>

          <div className="w-full lg:w-[35%] h-[min(400px,50vh)] lg:h-[500px] overflow-y-auto rounded-xl border border-[#E0E8F0] bg-white shadow">
            {vehicles.length === 0 ? (
              <div className="p-8 text-center font-['Rajdhani'] text-sm text-[#7A9AB8]">No vehicles to display.</div>
            ) : (
              vehicles.map((v) => {
                const reg = vehicleReg(v);
                const isSel = selectedVehicle && vehicleReg(selectedVehicle) === reg;
                return (
                  <button
                    type="button"
                    key={reg}
                    onClick={() => setSelectedVehicle(v)}
                    className={`w-full text-left p-4 border-b border-[#E0E8F0] cursor-pointer hover:bg-[#F4F6F8] transition-colors ${
                      isSel ? 'bg-blue-50 border-l-4 border-l-[#1565C0] pl-3' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          v.status === 'MOVING'
                            ? 'bg-green-500 animate-pulse'
                            : v.status === 'HALTED' || v.status === 'LONG_HALT'
                              ? 'bg-red-500'
                              : v.status === 'OFFLINE'
                                ? 'bg-gray-400'
                                : 'bg-orange-400'
                        }`}
                      />
                      <span className="font-['Barlow_Condensed'] font-bold text-sm text-[#0D2847] uppercase tracking-wide">
                        {reg}
                      </span>
                    </div>
                    <p className="font-['Rajdhani'] text-xs text-[#1A4A7A]">
                      Speed: <span className="font-medium text-[#0D2847]">{v.speed ?? '—'} km/h</span>
                    </p>
                    {v.temperature != null && (
                      <p className="font-['Rajdhani'] text-xs text-[#1A4A7A]">
                        Temp:{' '}
                        <span className={`font-medium ${tempListClass(Number(v.temperature))}`}>
                          {v.temperature}°C
                        </span>
                      </p>
                    )}
                    <p className="font-['Rajdhani'] text-xs text-[#1A4A7A]">{vehicleStatusLine(v)}</p>
                    <p className="font-['Rajdhani'] text-xs text-[#7A9AB8] truncate mt-1">{v.location || '—'}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {v.acOn && (
                        <span className="text-[10px] bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-['Rajdhani'] font-medium">
                          AC ON
                        </span>
                      )}
                      {v.ignitionOn && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-['Rajdhani'] font-medium">
                          IGN ON
                        </span>
                      )}
                      {v.doorOpen && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-['Rajdhani'] font-medium">
                          DOOR OPEN
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
