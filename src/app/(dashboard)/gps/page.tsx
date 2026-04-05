'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { GpsVehicle } from '@/components/gps/types';
import { vehicleReg } from '@/components/gps/types';
import { mapThemes, type MapThemeKey } from '@/components/gps/mapThemes';
import { GpsShareLinksPanel } from '@/components/gps/GpsShareLinksPanel';
import { normalizeTruckIconType, pickerPreviewSvg, type TruckIconType } from '@/components/gps/truckIcons';
import { VehicleIconPickerModal } from '@/components/gps/VehicleIconPickerModal';

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

const RouteHistoryPanel = dynamic(
  () => import('@/components/gps/RouteHistoryPanel').then((m) => m.RouteHistoryPanel),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-[#7A9AB8] text-sm font-['Rajdhani']">
        Loading route history…
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

type GpsMainTab = 'live' | 'share' | 'history';

interface FleetRow {
  id: string;
  regNumber?: string;
  registrationNumber?: string;
  make?: string;
  model?: string;
  iconType?: string;
}

function normalizeRegKey(s: string): string {
  return s.replace(/[\s-]/g, '').toUpperCase();
}

function regOfFleet(f: FleetRow): string {
  return String(f.regNumber ?? f.registrationNumber ?? '');
}

function parseFleetVehicles(data: unknown): FleetRow[] {
  const d = data as { data?: unknown };
  const arr = Array.isArray(d?.data) ? d.data : Array.isArray(data) ? data : [];
  return arr
    .map((row: Record<string, unknown>) => {
      const id = row.id != null ? String(row.id) : '';
      if (!id) return null;
      return {
        id,
        regNumber: typeof row.regNumber === 'string' ? row.regNumber : undefined,
        registrationNumber: typeof row.registrationNumber === 'string' ? row.registrationNumber : undefined,
        make: typeof row.make === 'string' ? row.make : undefined,
        model: typeof row.model === 'string' ? row.model : undefined,
        iconType: typeof row.iconType === 'string' ? row.iconType : undefined,
      } as FleetRow;
    })
    .filter((x): x is FleetRow => x != null);
}

export default function GpsLivePage() {
  const [mainTab, setMainTab] = useState<GpsMainTab>('live');
  const [vehicles, setVehicles] = useState<GpsVehicle[]>([]);
  const [fleetRows, setFleetRows] = useState<FleetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [lastFetched, setLastFetched] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<GpsVehicle | null>(null);
  const [mapTheme, setMapTheme] = useState<MapThemeKey>('standard');
  const [searchTerm, setSearchTerm] = useState('');
  const [iconModalOpen, setIconModalOpen] = useState(false);
  const [savingIcon, setSavingIcon] = useState(false);
  const mapSectionRef = useRef<HTMLDivElement>(null);

  const fetchLiveData = useCallback(async () => {
    try {
      const res = await api.get<{ vehicles?: Record<string, unknown>[] }>('/gps/live');
      const raw = res.data.vehicles ?? [];
      const mapped: GpsVehicle[] = raw.map((row) => {
        const v = row.vehicle as Record<string, unknown> | undefined;
        const assignments = v?.assignments as Record<string, unknown>[] | undefined;
        const first = assignments?.[0];
        const drv = first?.driver as Record<string, unknown> | undefined;
        const assignedDriverName =
          drv?.name != null && String(drv.name).trim() ? String(drv.name) : undefined;
        const assignedDriverNickname =
          drv?.nickname != null && String(drv.nickname).trim()
            ? String(drv.nickname)
            : undefined;
        return {
          ...(row as GpsVehicle),
          assignedDriverName,
          assignedDriverNickname,
        };
      });
      setVehicles(mapped);
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
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/vehicles', { params: { limit: 500, page: 1 } });
        if (!cancelled) setFleetRows(parseFleetVehicles(res.data));
      } catch {
        if (!cancelled) setFleetRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedVehicle) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    if (mq.matches) {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedVehicle]);

  const mergedVehicles = useMemo(() => {
    const byReg = new Map<string, FleetRow>();
    for (const f of fleetRows) {
      const k = normalizeRegKey(regOfFleet(f));
      if (k) byReg.set(k, f);
    }
    return vehicles.map((v) => {
      const k = normalizeRegKey(vehicleReg(v));
      const f = byReg.get(k);
      if (!f) return v;
      return {
        ...v,
        id: f.id,
        iconType: f.iconType ?? v.iconType,
        make: f.make ?? v.make,
        model: f.model ?? v.model,
      };
    });
  }, [vehicles, fleetRows]);

  const filteredVehicles = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return mergedVehicles;
    return mergedVehicles.filter((v) => {
      const reg = (v.regNumber || v.registrationNumber || '').toLowerCase();
      const loc = (v.location || '').toLowerCase();
      const dn = (v.assignedDriverName || '').toLowerCase();
      const nick = (v.assignedDriverNickname || '').toLowerCase();
      return reg.includes(s) || loc.includes(s) || dn.includes(s) || nick.includes(s);
    });
  }, [mergedVehicles, searchTerm]);

  const movingCount = mergedVehicles.filter((v) => v.status === 'MOVING').length;
  const haltedCount = mergedVehicles.filter((v) => v.status === 'HALTED' || v.status === 'LONG_HALT').length;
  const offlineCount = mergedVehicles.filter((v) => v.status === 'OFFLINE').length;
  const idleCount = mergedVehicles.filter((v) => v.status === 'IDLE').length;

  const handleSelectVehicle = (v: GpsVehicle) => {
    setSelectedVehicle(v);
  };

  const isSelected = (v: GpsVehicle) =>
    selectedVehicle != null && vehicleReg(selectedVehicle) === vehicleReg(v);

  const updateVehicleIcon = useCallback(
    async (iconType: TruckIconType) => {
      if (!selectedVehicle) return;
      const k = normalizeRegKey(vehicleReg(selectedVehicle));
      const fleetMatch = fleetRows.find((f) => normalizeRegKey(regOfFleet(f)) === k);
      const id = selectedVehicle.id ?? fleetMatch?.id;
      if (!id) {
        toast.error('Could not resolve vehicle id. Open Vehicles and ensure this truck is registered.');
        throw new Error('no id');
      }
      try {
        await api.put(`/vehicles/${id}`, { iconType });
        setFleetRows((rows) => rows.map((r) => (r.id === id ? { ...r, iconType } : r)));
        setSelectedVehicle((s) => (s ? { ...s, id, iconType } : s));
        toast.success('Icon updated');
      } catch (e: unknown) {
        const ax = e as { response?: { data?: { message?: string } } };
        toast.error(ax.response?.data?.message ?? 'Failed to update icon');
        throw e;
      }
    },
    [selectedVehicle, fleetRows]
  );

  const handleIconModalSave = async (type: TruckIconType) => {
    setSavingIcon(true);
    try {
      await updateVehicleIcon(type);
      setIconModalOpen(false);
    } catch {
      /* errors toasted in updateVehicleIcon */
    } finally {
      setSavingIcon(false);
    }
  };

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
          <button
            type="button"
            onClick={() => setMainTab('history')}
            className={`pb-3 px-1 text-sm font-['Barlow_Condensed'] uppercase tracking-wider border-b-2 transition-colors ${
              mainTab === 'history'
                ? 'border-[#1565C0] text-[#1565C0] font-bold'
                : 'border-transparent text-[#64748b] hover:text-[#0D2847]'
            }`}
          >
            Route history
          </button>
        </nav>
      </div>

      {mainTab === 'share' ? (
        <GpsShareLinksPanel />
      ) : mainTab === 'history' ? (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[#0D2847] font-['Oswald'] tracking-wide uppercase">
                Route history
              </h1>
              <p className="text-sm text-gray-500 font-['Rajdhani']">
                Replay a day&apos;s GPS trail with speed, halts, and charts.
              </p>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 shadow-sm shrink-0">
              {(Object.entries(mapThemes) as [MapThemeKey, (typeof mapThemes)['standard']][]).map(([key, theme]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMapTheme(key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors font-['Barlow_Condensed'] uppercase tracking-wide ${
                    mapTheme === key ? 'bg-[#1565C0] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>
          <RouteHistoryPanel fleetVehicles={fleetRows} mapTheme={mapTheme} />
        </div>
      ) : (
        <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2">
        <div>
          <h1 className="text-xl font-bold text-[#0D2847] font-['Oswald'] tracking-wide uppercase">
            GPS live tracking
          </h1>
          <p className="text-sm text-gray-500 font-['Rajdhani']">
            {mergedVehicles.length} vehicles tracked — Last updated: {lastFetched || '—'}
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
          <p className="text-2xl font-bold text-[#0D2847] font-['Oswald']">{loading ? '—' : mergedVehicles.length}</p>
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

      {loading && mergedVehicles.length === 0 && !error ? (
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
              vehicles={mergedVehicles}
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
              {mergedVehicles.length === 0 ? (
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

                    {(v.assignedDriverNickname || v.assignedDriverName) && (
                      <p className="text-xs text-[#1A4A7A] font-['Rajdhani'] mb-1 truncate">
                        {v.assignedDriverNickname
                          ? `${v.assignedDriverNickname}${
                              v.assignedDriverName ? ` (${v.assignedDriverName})` : ''
                            }`
                          : v.assignedDriverName}
                      </p>
                    )}
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
            {selectedVehicle && (
              <div className="border-t border-gray-200 bg-slate-50/90 px-3 py-3 shrink-0">
                <p className="text-[11px] font-['Barlow_Condensed'] uppercase tracking-wide text-gray-500 mb-2">
                  Map icon
                </p>
                <button
                  type="button"
                  onClick={() => setIconModalOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left shadow-sm hover:border-[#1565C0] hover:bg-blue-50/30 transition-colors"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100"
                    dangerouslySetInnerHTML={{
                      __html: pickerPreviewSvg(normalizeTruckIconType(selectedVehicle.iconType), 36),
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wide truncate">
                      {vehicleReg(selectedVehicle)}
                    </p>
                    <p className="text-xs text-[#1565C0] font-semibold mt-0.5">Change icon</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}

      <VehicleIconPickerModal
        open={iconModalOpen && selectedVehicle != null}
        onClose={() => setIconModalOpen(false)}
        vehicleRegLabel={selectedVehicle ? vehicleReg(selectedVehicle) : ''}
        currentIconType={selectedVehicle?.iconType}
        saving={savingIcon}
        onSave={handleIconModalSave}
      />
    </div>
  );
}
