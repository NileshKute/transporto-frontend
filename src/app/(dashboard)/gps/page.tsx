'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '@/lib/api';
import type { GpsVehicle } from '@/components/gps/types';
import { vehicleReg } from '@/components/gps/types';
import { mapThemes, type MapThemeKey } from '@/components/gps/mapThemes';
import { GpsShareLinksPanel } from '@/components/gps/GpsShareLinksPanel';

const GpsLiveMap = dynamic(
  () => import('@/components/gps/GpsLiveMap').then((m) => m.GpsLiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[300px] flex items-center justify-center bg-[#E8EEF4] text-[#7A9AB8] text-sm">
        Loading map…
      </div>
    ),
  }
);

const refreshOptions = [
  { label: '10 sec', value: 10000 },
  { label: '30 sec', value: 30000 },
  { label: '1 min', value: 60000 },
  { label: '5 min', value: 300000 },
  { label: 'Off', value: 0 },
];

function vehicleListKey(v: GpsVehicle, index: number): string {
  return v.regNumber || v.geoTrackerKey || v.registrationNumber || `v-${index}`;
}

type GpsMainTab = 'live' | 'share';

export default function GpsLivePage() {
  const [mainTab, setMainTab] = useState<GpsMainTab>('live');
  const [vehicles, setVehicles] = useState<GpsVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [lastFetched, setLastFetched] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<GpsVehicle | null>(null);
  const [mapTheme, setMapTheme] = useState<MapThemeKey>('standard');
  const [searchTerm, setSearchTerm] = useState('');
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
    if (refreshInterval === 0) return;
    const interval = setInterval(fetchLiveData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchLiveData]);

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

  const filteredVehicles = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return vehicles;
    return vehicles.filter((v) => {
      const reg = (v.regNumber || v.registrationNumber || '').toLowerCase();
      const loc = (v.location || '').toLowerCase();
      return reg.includes(s) || loc.includes(s);
    });
  }, [vehicles, searchTerm]);

  const movingCount = vehicles.filter((v) => v.status === 'MOVING').length;
  const haltedCount = vehicles.filter((v) => v.status === 'HALTED' || v.status === 'LONG_HALT').length;
  const offlineCount = vehicles.filter((v) => v.status === 'OFFLINE').length;
  const idleCount = vehicles.filter((v) => v.status === 'IDLE').length;

  const handleSelectVehicle = (v: GpsVehicle) => {
    setSelectedVehicle(v);
  };

  const isSelected = (v: GpsVehicle) =>
    selectedVehicle != null && vehicleReg(selectedVehicle) === vehicleReg(v);

  return (
    <div className="space-y-4">
      <div className="border-b border-[#E0E8F0]">
        <nav className="flex gap-1 sm:gap-6" aria-label="GPS sections">
          <button
            type="button"
            onClick={() => setMainTab('live')}
            className={`pb-3 px-1 text-sm font-['Barlow_Condensed'] uppercase tracking-wider border-b-2 transition-colors ${
              mainTab === 'live'
                ? 'border-[#1565C0] text-[#1565C0] font-bold'
                : 'border-transparent text-[#64748b] hover:text-[#0D2847]'
            }`}
          >
            Live tracking
          </button>
          <button
            type="button"
            onClick={() => setMainTab('share')}
            className={`pb-3 px-1 text-sm font-['Barlow_Condensed'] uppercase tracking-wider border-b-2 transition-colors ${
              mainTab === 'share'
                ? 'border-[#1565C0] text-[#1565C0] font-bold'
                : 'border-transparent text-[#64748b] hover:text-[#0D2847]'
            }`}
          >
            Share links
          </button>
        </nav>
      </div>

      {mainTab === 'share' ? (
        <GpsShareLinksPanel />
      ) : (
        <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2">
        <div>
          <h1 className="text-xl font-bold text-[#0D2847] font-['Oswald'] tracking-wide uppercase">
            GPS live tracking
          </h1>
          <p className="text-sm text-gray-500 font-['Rajdhani']">
            {vehicles.length} vehicles tracked — Last updated: {lastFetched || '—'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 font-['Rajdhani']">Refresh:</span>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#1565C0] font-['Rajdhani']"
            >
              {refreshOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => fetchLiveData()}
            className="px-4 py-1.5 bg-[#1565C0] text-white text-sm rounded-lg hover:bg-[#0D2847] transition-colors font-['Barlow_Condensed'] uppercase tracking-wider"
          >
            Refresh now
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-['Rajdhani']">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M1 3h15v13H1z" />
                <path d="M16 8h4l3 3v5h-7V8z" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-['Barlow_Condensed'] uppercase tracking-wide">Total</span>
          </div>
          <p className="text-2xl font-bold text-[#0D2847] font-['Oswald']">{loading ? '—' : vehicles.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            </div>
            <span className="text-xs text-gray-500 font-['Barlow_Condensed'] uppercase tracking-wide">Moving</span>
          </div>
          <p className="text-2xl font-bold text-green-600 font-['Oswald']">{loading ? '—' : movingCount}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-red-500" />
            </div>
            <span className="text-xs text-gray-500 font-['Barlow_Condensed'] uppercase tracking-wide">Halted</span>
          </div>
          <p className="text-2xl font-bold text-red-600 font-['Oswald']">{loading ? '—' : haltedCount + idleCount}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
            </div>
            <span className="text-xs text-gray-500 font-['Barlow_Condensed'] uppercase tracking-wide">Offline</span>
          </div>
          <p className="text-2xl font-bold text-gray-500 font-['Oswald']">{loading ? '—' : offlineCount}</p>
        </div>
      </div>

      {loading && vehicles.length === 0 && !error ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-[#7A9AB8] font-['Rajdhani']">
          Loading GPS data…
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-3">
          <div
            ref={mapSectionRef}
            className="relative w-full lg:w-[65%] h-[min(550px,60vh)] lg:h-[550px] rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-[#E8EEF4]"
          >
            <div className="absolute top-3 right-3 z-[1000] flex rounded-lg overflow-hidden border border-white/30 shadow-lg">
              {(Object.entries(mapThemes) as [MapThemeKey, (typeof mapThemes)['standard']][]).map(([key, theme]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMapTheme(key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors font-['Barlow_Condensed'] uppercase tracking-wide ${
                    mapTheme === key ? 'bg-[#1565C0] text-white' : 'bg-white/90 text-gray-700 hover:bg-white'
                  }`}
                >
                  {theme.name}
                </button>
              ))}
            </div>
            <GpsLiveMap
              vehicles={vehicles}
              selectedVehicle={selectedVehicle}
              onMarkerClick={handleSelectVehicle}
              mapTheme={mapTheme}
            />
          </div>

          <div className="w-full lg:w-[35%] h-[min(550px,55vh)] lg:h-[550px] flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-3 py-2 z-10 shrink-0">
              <input
                type="search"
                placeholder="Search vehicle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1565C0] font-['Rajdhani']"
              />
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {vehicles.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#7A9AB8] font-['Rajdhani']">No vehicles to display.</div>
              ) : filteredVehicles.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#7A9AB8] font-['Rajdhani']">No matches for your search.</div>
              ) : (
                filteredVehicles.map((v, index) => (
                  <div
                    key={vehicleListKey(v, index)}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectVehicle(v)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectVehicle(v);
                      }
                    }}
                    className={`p-3 border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-blue-50/50 ${
                      isSelected(v) ? 'bg-blue-50 border-l-4 border-l-[#1565C0]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            v.status === 'MOVING'
                              ? 'bg-green-500 animate-pulse'
                              : v.status === 'HALTED' || v.status === 'LONG_HALT'
                                ? 'bg-red-500'
                                : v.status === 'OFFLINE'
                                  ? 'bg-gray-400'
                                  : 'bg-amber-400'
                          }`}
                        />
                        <span className="font-bold text-sm text-[#0D2847] truncate font-['Barlow_Condensed'] uppercase tracking-wide">
                          {v.regNumber || v.registrationNumber || '—'}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 font-['Rajdhani'] ${
                          v.status === 'MOVING'
                            ? 'bg-green-100 text-green-700'
                            : v.status === 'HALTED' || v.status === 'LONG_HALT'
                              ? 'bg-red-100 text-red-700'
                              : v.status === 'OFFLINE'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {v.status ?? '—'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 font-['Rajdhani']">
                      <span>{Math.round(Number(v.speed) || 0)} km/h</span>
                      {v.temperature != null && (
                        <span
                          className={
                            Number(v.temperature) < 0
                              ? 'text-blue-600 font-semibold'
                              : Number(v.temperature) < 10
                                ? 'text-cyan-600 font-semibold'
                                : 'text-red-600 font-semibold'
                          }
                        >
                          {Number(v.temperature).toFixed(1)}°C
                        </span>
                      )}
                      {v.acOn && <span className="text-cyan-600 font-semibold">AC</span>}
                    </div>

                    <p className="text-[11px] text-gray-400 truncate mt-1 font-['Rajdhani']">{v.location || '—'}</p>

                    <p className="text-[10px] text-gray-400 mt-0.5 font-['Rajdhani']">
                      {v.status === 'MOVING' && v.movingSince ? `Moving ${v.movingSince}` : ''}
                      {(v.status === 'HALTED' || v.status === 'LONG_HALT') && v.haltedSince ? `Halted ${v.haltedSince}` : ''}
                      {v.status === 'OFFLINE' && v.noDataSince ? `No data ${v.noDataSince}` : ''}
                      {v.status === 'IDLE' ? 'Idle' : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
