'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import api from '@/lib/api';
import type { MapThemeKey } from './mapThemes';
import {
  sortRoutePoints,
  detectHaltEvents,
  computeRouteSummary,
  detectOverspeed,
  buildChartSeries,
  pointTimeMs,
  haltSeverityClass,
  type GpsRoutePoint,
} from './routeHistoryUtils';

const RouteHistoryMap = dynamic(
  () => import('@/components/gps/RouteHistoryMap').then((m) => m.RouteHistoryMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(420px,55vh)] min-h-[280px] flex items-center justify-center bg-[#E8EEF4] text-[#7A9AB8] text-sm">
        Loading map…
      </div>
    ),
  }
);

export interface RouteFleetVehicle {
  id: string;
  regNumber?: string;
  registrationNumber?: string;
  make?: string;
  model?: string;
  iconType?: string;
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function regOf(v: RouteFleetVehicle): string {
  return String(v.regNumber ?? v.registrationNumber ?? '—');
}

function formatClock(iso: string | undefined): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date(ms));
}

export function RouteHistoryPanel({
  fleetVehicles,
  mapTheme,
}: {
  fleetVehicles: RouteFleetVehicle[];
  mapTheme: MapThemeKey;
}) {
  const [vehicleId, setVehicleId] = useState('');
  const [date, setDate] = useState(yesterdayISO);
  const [points, setPoints] = useState<(GpsRoutePoint & { latitude: number; longitude: number })[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMult, setSpeedMult] = useState(1);
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number } | null>(null);

  const sorted = points;
  const halts = useMemo(() => detectHaltEvents(sorted), [sorted]);
  const summary = useMemo(
    () => (sorted.length > 0 ? computeRouteSummary(sorted, halts) : null),
    [sorted, halts]
  );
  const overspeed = useMemo(() => detectOverspeed(sorted, 60), [sorted]);
  const chartData = useMemo(() => buildChartSeries(sorted, 220), [sorted]);
  const hasTemp = useMemo(() => sorted.some((p) => p.temperature != null && !Number.isNaN(Number(p.temperature))), [sorted]);
  const tempChartData = useMemo(() => {
    if (!hasTemp) return [];
    return buildChartSeries(sorted, 220).filter((d) => d.temp != null);
  }, [sorted, hasTemp]);

  const selectedFleet = useMemo(
    () => fleetVehicles.find((v) => v.id === vehicleId),
    [fleetVehicles, vehicleId]
  );

  useEffect(() => {
    if (!flyToTarget) return;
    const t = setTimeout(() => setFlyToTarget(null), 1400);
    return () => clearTimeout(t);
  }, [flyToTarget]);

  useEffect(() => {
    if (!playing || sorted.length === 0) return;
    const ms = Math.max(40, 1000 / speedMult);
    const id = window.setInterval(() => {
      setIndex((i) => {
        if (i >= sorted.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, ms);
    return () => clearInterval(id);
  }, [playing, speedMult, sorted.length]);

  const loadRoute = useCallback(async () => {
    if (!vehicleId) {
      setLoadError('Select a vehicle');
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<GpsRoutePoint[] | { data?: GpsRoutePoint[] }>('/gps/route', {
        params: { vehicleId, date },
      });
      const raw = res.data;
      const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { data?: GpsRoutePoint[] }).data) ? (raw as { data: GpsRoutePoint[] }).data : [];
      const next = sortRoutePoints(arr) as (GpsRoutePoint & { latitude: number; longitude: number })[];
      setPoints(next);
      setIndex(0);
      setPlaying(false);
      if (next.length === 0) setLoadError('No route data for this date.');
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      setLoadError(ax.response?.data?.message ?? 'Failed to load route');
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [vehicleId, date]);

  const current = sorted[Math.min(Math.max(0, index), Math.max(0, sorted.length - 1))];
  const firstMs = sorted[0] ? pointTimeMs(sorted[0]) : 0;
  const lastMs = sorted.length ? pointTimeMs(sorted[sorted.length - 1]) : 0;

  const chartCursor = useMemo(() => {
    if (chartData.length === 0 || !current) return null;
    return chartData.reduce((best, b) =>
      Math.abs(b.index - index) < Math.abs(best.index - index) ? b : best
    );
  }, [chartData, index, current]);

  const handleChartClick = (state: unknown) => {
    const s = state as { activePayload?: { payload?: { index?: number } }[] };
    const idx = s?.activePayload?.[0]?.payload?.index;
    if (typeof idx === 'number') {
      setPlaying(false);
      setIndex(Math.min(Math.max(0, idx), Math.max(0, sorted.length - 1)));
    }
  };

  const yMax = useMemo(() => {
    let m = 40;
    for (const p of sorted) m = Math.max(m, Number(p.speed ?? 0));
    return Math.min(120, Math.ceil(m / 10) * 10 + 10);
  }, [sorted]);

  return (
    <div className="space-y-4 font-['Rajdhani']">
      <div className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-['Barlow_Condensed'] uppercase tracking-wide text-gray-500 mb-1">
            Vehicle
          </label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="text-sm"
          >
            <option value="">Select vehicle…</option>
            {fleetVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {regOf(v)}
                {v.make || v.model ? ` — ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[160px]">
          <label className="block text-xs font-['Barlow_Condensed'] uppercase tracking-wide text-gray-500 mb-1">
            Date
          </label>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void loadRoute()}
          disabled={loading}
          className="px-5 py-2.5 rounded-lg bg-[#1565C0] text-white text-sm font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-60 shrink-0"
        >
          {loading ? 'Loading…' : 'Load route'}
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{loadError}</div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'Distance', value: `${summary.distanceKm.toFixed(1)} km` },
            { label: 'Duration', value: summary.durationLabel },
            { label: 'Max speed', value: `${Math.round(summary.maxSpeed)} km/h` },
            { label: 'Avg speed', value: `${Math.round(summary.avgSpeedMoving)} km/h` },
            { label: 'Stops', value: String(summary.stops) },
            {
              label: 'Avg temp',
              value: summary.avgTemp != null ? `${summary.avgTemp.toFixed(1)}°C` : 'N/A',
            },
          ].map((c) => (
            <div
              key={c.label}
              className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm text-center"
            >
              <p className="text-[10px] font-['Barlow_Condensed'] uppercase tracking-wide text-gray-500">{c.label}</p>
              <p className="text-lg font-bold text-[#0D2847] font-['Oswald'] mt-0.5">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-[#E8EEF4] h-[min(420px,55vh)] min-h-[280px]">
        <RouteHistoryMap
          points={sorted}
          currentIndex={index}
          halts={halts}
          overspeed={overspeed}
          mapTheme={mapTheme}
          vehicleIconType={selectedFleet?.iconType}
          flyToTarget={flyToTarget}
        />
      </div>

      {sorted.length > 0 && (
        <>
          <div className="rounded-xl overflow-hidden border border-[#0D2847] bg-[#0D2847] text-white shadow-md">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#1A4A7A]">
              <button
                type="button"
                aria-label="Step back"
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
                onClick={() => {
                  setPlaying(false);
                  setIndex((i) => Math.max(0, i - 10));
                }}
              >
                ◀◀
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-[#1565C0] hover:bg-[#42A5F5] text-sm font-semibold min-w-[88px]"
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? '❚❚ Pause' : '▶ Play'}
              </button>
              <button
                type="button"
                aria-label="Step forward"
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
                onClick={() => {
                  setPlaying(false);
                  setIndex((i) => Math.min(sorted.length - 1, i + 10));
                }}
              >
                ▶▶
              </button>
              <button
                type="button"
                aria-label="Stop"
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
                onClick={() => {
                  setPlaying(false);
                  setIndex(0);
                }}
              >
                ■ Stop
              </button>
              <span className="text-xs text-[#64B5F6] ml-1 mr-1 hidden sm:inline">Speed</span>
              {([1, 2, 5, 10] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    speedMult === s ? 'bg-white text-[#0D2847]' : 'bg-white/10 hover:bg-white/20'
                  }`}
                  onClick={() => setSpeedMult(s)}
                >
                  {s}x
                </button>
              ))}
            </div>
            <div className="px-3 py-3 space-y-2">
              <div className="flex justify-between text-[11px] text-[#94a3b8]">
                <span>
                  {firstMs ? new Date(firstMs).toLocaleTimeString('en-IN', { hour12: true }) : '—'}
                </span>
                <span>Timeline</span>
                <span>
                  {lastMs ? new Date(lastMs).toLocaleTimeString('en-IN', { hour12: true }) : '—'}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0, sorted.length - 1)}
                value={index}
                onMouseDown={() => setPlaying(false)}
                onTouchStart={() => setPlaying(false)}
                onChange={(e) => setIndex(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#1565C0] bg-[#1A4A7A]"
              />
              {current && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/95 pt-1">
                  <span>📍 {current.location || '—'}</span>
                  <span>🚗 {Math.round(Number(current.speed ?? 0))} km/h</span>
                  <span>
                    🌡️{' '}
                    <span
                      className={
                        current.temperature != null && Number(current.temperature) < 0
                          ? 'text-[#64B5F6]'
                          : current.temperature != null && Number(current.temperature) > 25
                            ? 'text-orange-300'
                            : ''
                      }
                    >
                      {current.temperature != null ? `${Number(current.temperature).toFixed(1)}°C` : '—'}
                    </span>
                  </span>
                  <span>⏱️ {formatClock(current.deviceTimestamp || current.recordedAt)}</span>
                  <span>🔑 Ignition: {current.ignitionOn ? 'ON' : 'OFF'}</span>
                  <span>❄️ AC: {current.acOn ? 'ON' : 'OFF'}</span>
                  <span>Status: {String(current.status ?? '—')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
            <p className="text-xs font-['Barlow_Condensed'] uppercase tracking-wide text-gray-500 mb-2">Speed</p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  onClick={handleChartClick}
                >
                  <XAxis
                    dataKey="timeMs"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(ms) =>
                      new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(
                        new Date(ms)
                      )
                    }
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, yMax]}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <ReferenceArea y1={0} y2={40} fill="#22c55e" fillOpacity={0.07} />
                  <ReferenceArea y1={40} y2={60} fill="#f97316" fillOpacity={0.07} />
                  <ReferenceArea y1={60} y2={yMax} fill="#ef4444" fillOpacity={0.07} />
                  <ReferenceLine y={60} stroke="#64748b" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="speed"
                    stroke="#1565C0"
                    strokeWidth={2}
                    dot={{ r: 2, fill: '#1565C0' }}
                    activeDot={{ r: 5 }}
                  />
                  {chartCursor && (
                    <ReferenceLine
                      x={chartCursor.timeMs}
                      stroke="#0D2847"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Tap the chart to jump to that time.</p>
          </div>

          {hasTemp && tempChartData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
              <p className="text-xs font-['Barlow_Condensed'] uppercase tracking-wide text-gray-500 mb-2">
                Temperature
              </p>
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={tempChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="timeMs"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(ms) =>
                        new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(
                          new Date(ms)
                        )
                      }
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="temp"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                    <ReferenceLine y={-18} stroke="#1565C0" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="temp" stroke="#42A5F5" strokeWidth={2} dot={false} />
                    {chartCursor && chartCursor.temp != null && (
                      <ReferenceLine
                        x={chartCursor.timeMs}
                        stroke="#0D2847"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <details className="bg-white rounded-xl border border-gray-100 shadow-sm group">
            <summary className="px-4 py-3 cursor-pointer font-['Barlow_Condensed'] uppercase tracking-wide text-sm text-[#0D2847] list-none flex items-center justify-between">
              Halt points ({halts.length})
              <span className="text-gray-400 text-xs group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <ul className="border-t border-gray-100 max-h-56 overflow-y-auto">
              {halts.length === 0 ? (
                <li className="px-4 py-3 text-sm text-gray-500">No halts over 2 minutes.</li>
              ) : (
                halts.map((h, i) => {
                  const sev = haltSeverityClass(h.durationMs);
                  const dot =
                    sev === 'long' ? '🔴' : sev === 'medium' ? '🟠' : '🟡';
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50/80 border-b border-gray-50 transition-colors"
                        onClick={() => {
                          setPlaying(false);
                          setIndex(h.startIndex);
                          setFlyToTarget({ lat: h.lat, lng: h.lng });
                        }}
                      >
                        <span className="mr-2">{dot}</span>
                        {new Date(h.startMs).toLocaleTimeString('en-IN', { hour12: true })} –{' '}
                        {new Date(h.endMs).toLocaleTimeString('en-IN', { hour12: true })} (
                        {Math.round(h.durationMs / 60000)} min){' '}
                        <span className="text-gray-500">{h.location}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </details>

          {overspeed.length > 0 && (
            <details className="bg-white rounded-xl border border-gray-100 shadow-sm group">
              <summary className="px-4 py-3 cursor-pointer font-['Barlow_Condensed'] uppercase tracking-wide text-sm text-[#0D2847] list-none flex items-center justify-between">
                Overspeed (&gt;60 km/h) ({overspeed.length})
                <span className="text-gray-400 text-xs group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <ul className="border-t border-gray-100 max-h-48 overflow-y-auto">
                {overspeed.map((o, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50/80 border-b border-gray-50"
                      onClick={() => {
                        setPlaying(false);
                        setIndex(o.index);
                        setFlyToTarget({ lat: o.lat, lng: o.lng });
                      }}
                    >
                      ⚠ {new Date(o.timeMs).toLocaleTimeString('en-IN', { hour12: true })} — {Math.round(o.speed)}{' '}
                      km/h — <span className="text-gray-500">{o.location}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
