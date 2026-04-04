'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { Activity, Clock, Gauge, Loader2, Thermometer } from 'lucide-react';

const ShareTrackingMap = dynamic(
  () => import('@/components/gps/ShareTrackingMap').then((m) => m.ShareTrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[240px] flex items-center justify-center bg-[#E8EEF4] text-[#64748b] text-[14px] rounded-xl">
        Loading map…
      </div>
    ),
  }
);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface TrackVehicle {
  regNumber?: string;
  registrationNumber?: string;
  make?: string;
  model?: string;
}

interface TrackLive {
  latitude?: number;
  longitude?: number;
  speed?: number;
  temperature?: number | null;
  ignitionOn?: boolean;
  acOn?: boolean;
  status?: string;
  location?: string;
  haltedSince?: string | null;
  movingSince?: string | null;
  lastSyncAt?: string;
  direction?: number | null;
}

interface TrackPayload {
  vehicle: TrackVehicle;
  client?: { name?: string };
  label?: string;
  live: TrackLive | null;
  expiresAt?: string | null;
}

function vehicleReg(v: TrackVehicle): string {
  return String(v.regNumber ?? v.registrationNumber ?? '—');
}

function formatExpiresAt(iso: string): string {
  const d = parseISO(iso);
  if (!isValid(d)) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

function safeDistanceLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = parseISO(iso);
  if (!isValid(d)) return null;
  return formatDistanceToNow(d, { addSuffix: true });
}

function statusBadgeClass(status: string | undefined): string {
  switch (status) {
    case 'MOVING':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'HALTED':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'LONG_HALT':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'OFFLINE':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    default:
      return 'bg-amber-50 text-amber-900 border-amber-200';
  }
}

function statusSinceLine(live: TrackLive | null): string {
  if (!live) return '';
  const st = live.status;
  if (st === 'MOVING' && live.movingSince) {
    const x = safeDistanceLabel(live.movingSince);
    return x ? `since ${x}` : '';
  }
  if ((st === 'HALTED' || st === 'LONG_HALT') && live.haltedSince) {
    const x = safeDistanceLabel(live.haltedSince);
    return x ? `since ${x}` : '';
  }
  return '';
}

function TrackHeaderBar() {
  return (
    <header className="bg-[#0D2847] px-4 py-2.5 shrink-0 border-b border-[#1A4A7A]">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0D2847] to-[#1A4A7A] border border-[#1A4A7A]">
          <span className="font-['Bebas_Neue'] text-lg leading-none text-white">G</span>
          <span className="font-['Bebas_Neue'] text-lg leading-none text-[#42A5F5]">K</span>
        </div>
        <div className="min-w-0">
          <p className="font-['Barlow_Condensed'] text-[15px] font-bold uppercase tracking-wider text-white leading-tight">
            G K Enterprise
          </p>
          <p className="font-['Rajdhani'] text-[13px] text-[#64B5F6] leading-tight">Your Trusted Cold Chain Partner</p>
        </div>
      </div>
    </header>
  );
}

function TrackFooter() {
  return (
    <footer className="bg-[#F1F5F9] border-t border-[#E2E8F0] py-3 px-4 shrink-0">
      <p className="text-center text-[13px] text-[#64748b] font-['Rajdhani']">
        Powered by{' '}
        <span className="font-semibold text-[#0D2847]">G K Enterprise</span>
        <span className="mx-2 text-[#CBD5E1]">•</span>
        <a
          href="https://www.gkenterprise.in"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1565C0] hover:text-[#0D2847] underline-offset-2 hover:underline"
        >
          gkenterprise.in
        </a>
      </p>
    </footer>
  );
}

export default function PublicTrackPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';
  const [data, setData] = useState<TrackPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const stopPollingRef = useRef(false);

  const fetchTrack = useCallback(async () => {
    if (!token) return;
    setIsRefreshing(true);
    try {
      const url = `${API_BASE.replace(/\/$/, '')}/gps/track/${encodeURIComponent(token)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        const msg =
          typeof json.message === 'string'
            ? json.message
            : typeof json.error === 'string'
              ? json.error
              : 'This tracking link is no longer active';
        throw new Error(msg);
      }

      const vehicle = (json.vehicle as TrackVehicle | undefined) ?? {};

      setLoadError(null);
      setData({
        vehicle,
        client: json.client as TrackPayload['client'],
        label: typeof json.label === 'string' ? json.label : undefined,
        live: (json.live as TrackLive | null | undefined) ?? null,
        expiresAt: (json.expiresAt as string | null | undefined) ?? null,
      });
      stopPollingRef.current = false;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load tracking';
      setLoadError(msg);
      stopPollingRef.current = true;
      setData(null);
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    stopPollingRef.current = false;
    fetchTrack();
  }, [fetchTrack]);

  useEffect(() => {
    if (!token || stopPollingRef.current || loadError) return;
    const id = setInterval(() => {
      if (stopPollingRef.current) return;
      fetchTrack();
    }, 30000);
    return () => clearInterval(id);
  }, [token, loadError, fetchTrack]);

  const live = data?.live ?? null;
  const reg = data ? vehicleReg(data.vehicle) : '—';
  const makeModel = useMemo(() => {
    if (!data?.vehicle) return '';
    const p = [data.vehicle.make, data.vehicle.model].filter(Boolean).join(' ');
    return p;
  }, [data?.vehicle]);

  const lat = live?.latitude ?? null;
  const lng = live?.longitude ?? null;
  const speed = live?.speed ?? 0;
  const temp = live?.temperature ?? null;
  const status = live?.status ?? 'OFFLINE';
  const locationText = live?.location ?? '';
  const hasLivePayload = live != null;
  const hasValidCoords =
    hasLivePayload &&
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const tempColorClass =
    temp != null && !Number.isNaN(Number(temp))
      ? Number(temp) < 0
        ? 'text-blue-600'
        : Number(temp) <= 10
          ? 'text-green-600'
          : 'text-red-600'
      : 'text-gray-500';

  const lastSyncAt = live?.lastSyncAt;
  const lastSyncParsed = lastSyncAt ? parseISO(lastSyncAt) : undefined;
  const lastRelative =
    lastSyncParsed && isValid(lastSyncParsed)
      ? formatDistanceToNow(lastSyncParsed, { addSuffix: true })
      : null;
  const lastAbsolute =
    lastSyncParsed && isValid(lastSyncParsed) ? format(lastSyncParsed, 'dd MMM yyyy, h:mm a') : lastSyncAt ?? '—';

  const expiredOrInvalid = Boolean(loadError);

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <TrackHeaderBar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-[15px] text-[#64748b] font-['Rajdhani']">Invalid tracking link.</p>
          <Link
            href="https://www.gkenterprise.in/contact"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#1565C0] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0D2847] font-['Rajdhani']"
          >
            Contact G K Enterprise
          </Link>
        </main>
        <TrackFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <TrackHeaderBar />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-4 flex flex-col gap-4">
        {initialLoading ? (
          <>
            <div className="h-[60vh] min-h-[280px] rounded-xl bg-[#E2E8F0] animate-pulse border border-[#E0E8F0]" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-white border border-gray-100 shadow-sm animate-pulse" />
              ))}
            </div>
          </>
        ) : expiredOrInvalid ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="text-3xl mb-3" aria-hidden>
              🔗
            </div>
            <h2 className="text-[18px] font-bold text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wide">
              This tracking link has expired
            </h2>
            <p className="mt-2 text-[14px] text-[#64748b] max-w-md font-['Rajdhani'] leading-relaxed">
              {loadError || 'The vehicle tracking session is no longer active. Please contact us for a new link.'}
            </p>
            <Link
              href="https://www.gkenterprise.in/contact"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#1565C0] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0D2847] font-['Rajdhani']"
            >
              Contact G K Enterprise
            </Link>
          </div>
        ) : (
          <>
            <div className="h-[60vh] min-h-[280px] rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-[#E8EEF4]">
              <ShareTrackingMap
                latitude={hasValidCoords ? lat : null}
                longitude={hasValidCoords ? lng : null}
                status={status}
                direction={live?.direction}
                regNumber={reg}
                speed={speed}
                temperature={temp}
                location={locationText}
              />
            </div>

            {(!hasLivePayload || !hasValidCoords) && (
              <p className="text-center text-[14px] text-[#64748b] font-['Rajdhani'] -mt-2">
                Waiting for vehicle data…
              </p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                <div className="flex items-center gap-2 text-[#64748b] mb-1">
                  <Gauge className="w-4 h-4 text-[#1565C0] shrink-0" />
                  <span className="text-[12px] uppercase tracking-wide font-['Barlow_Condensed'] font-semibold">
                    Speed
                  </span>
                </div>
                <p className="text-[20px] font-bold text-[#0D2847] font-['Rajdhani']">
                  {hasLivePayload ? `${Math.round(speed)} km/h` : '—'}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                <div className="flex items-center gap-2 text-[#64748b] mb-1">
                  <Thermometer className="w-4 h-4 text-[#1565C0] shrink-0" />
                  <span className="text-[12px] uppercase tracking-wide font-['Barlow_Condensed'] font-semibold">
                    Temp
                  </span>
                </div>
                <p
                  className={`text-[20px] font-bold font-['Rajdhani'] ${hasLivePayload ? tempColorClass : 'text-gray-400'}`}
                >
                  {hasLivePayload && temp != null && !Number.isNaN(Number(temp))
                    ? `${Number(temp).toFixed(1)}°C`
                    : '—'}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                <div className="flex items-center gap-2 text-[#64748b] mb-1">
                  <Activity className="w-4 h-4 text-[#1565C0] shrink-0" />
                  <span className="text-[12px] uppercase tracking-wide font-['Barlow_Condensed'] font-semibold">
                    Status
                  </span>
                </div>
                <span
                  className={`inline-block mt-0.5 text-[11px] font-bold px-2 py-1 rounded-full border font-['Rajdhani'] ${statusBadgeClass(live?.status)}`}
                >
                  {hasLivePayload ? live?.status ?? '—' : '—'}
                </span>
                {hasLivePayload && live && (
                  <p className="text-[12px] text-[#94a3b8] mt-1 font-['Rajdhani'] leading-tight">
                    {statusSinceLine(live)}
                  </p>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                <div className="flex items-center gap-2 text-[#64748b] mb-1">
                  <Clock className="w-4 h-4 text-[#1565C0] shrink-0" />
                  <span className="text-[12px] uppercase tracking-wide font-['Barlow_Condensed'] font-semibold">
                    Last sync
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isRefreshing && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1565C0]" aria-label="Refreshing" />
                  )}
                  <p
                    className="text-[14px] font-semibold text-[#0D2847] font-['Rajdhani']"
                    title={lastAbsolute}
                  >
                    {hasLivePayload && lastRelative ? lastRelative : '—'}
                  </p>
                </div>
              </div>
            </div>

            <section className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-2 font-['Rajdhani'] text-[14px]">
              <p className="text-[20px] font-bold text-[#0D2847] leading-tight">
                {reg}
                {makeModel ? (
                  <span className="text-[15px] font-semibold text-[#1A4A7A]"> ({makeModel})</span>
                ) : null}
              </p>
              {data?.client?.name ? (
                <p className="text-[#475569]">
                  <span className="text-[#94a3b8]">Client:</span> {data.client.name}
                </p>
              ) : null}
              {data?.label ? (
                <p className="text-[#475569]">
                  <span className="text-[#94a3b8]">Label:</span> {data.label}
                </p>
              ) : null}
              <p className="text-[#475569]">
                <span className="text-[#94a3b8]">Location:</span> {locationText || '—'}
              </p>
              <p className="text-[#475569] pt-1 border-t border-gray-100">
                {data?.expiresAt ? (
                  <>
                    <span className="text-[#94a3b8]">Link expires:</span> {formatExpiresAt(data.expiresAt)}
                  </>
                ) : (
                  <span className="text-[#64748b]">This is a permanent tracking link</span>
                )}
              </p>
            </section>
          </>
        )}
      </main>

      <TrackFooter />
    </div>
  );
}
