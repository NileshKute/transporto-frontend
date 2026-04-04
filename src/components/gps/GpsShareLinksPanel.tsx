'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Check, Copy, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PUBLIC_TRACK_BASE = 'https://www.gkenterprise.in/track/';

export function fullGpsShareUrl(token: string): string {
  return `${PUBLIC_TRACK_BASE}${token.replace(/^\//, '')}`;
}

interface FleetVehicle {
  id: string;
  regNumber?: string;
  registrationNumber?: string;
  make?: string;
  model?: string;
}

interface ClientOpt {
  id: string;
  name: string;
}

export interface GpsShareSession {
  id: string;
  vehicleId: string;
  clientId?: string | null;
  vehicle?: { regNumber?: string; registrationNumber?: string; make?: string; model?: string };
  client?: { name?: string };
  token: string;
  label?: string | null;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt?: string;
}

function regOf(s: GpsShareSession): string {
  const v = s.vehicle;
  return String(v?.regNumber ?? v?.registrationNumber ?? '—');
}

function clientNameOf(s: GpsShareSession): string | null {
  const n = s.client?.name;
  return n && String(n).trim() ? String(n) : null;
}

function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return 'Never expires';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

function isSessionEffectivelyActive(s: GpsShareSession): boolean {
  if (!s.isActive) return false;
  if (!s.expiresAt) return true;
  const t = new Date(s.expiresAt).getTime();
  if (Number.isNaN(t)) return true;
  return t > Date.now();
}

function parseVehiclesResponse(data: unknown): FleetVehicle[] {
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
      } as FleetVehicle;
    })
    .filter((x): x is FleetVehicle => x != null);
}

function parseClientsResponse(data: unknown): ClientOpt[] {
  const raw = Array.isArray(data) ? data : (data as { data?: unknown })?.data;
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((row: Record<string, unknown>) => {
      const id = row.id != null ? String(row.id) : '';
      const name = typeof row.name === 'string' ? row.name : 'Client';
      if (!id) return null;
      return { id, name };
    })
    .filter((x): x is ClientOpt => x != null);
}

type ExpiryChoice = '24' | '48' | '168' | 'never';

export function GpsShareLinksPanel() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [sessions, setSessions] = useState<GpsShareSession[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [clientId, setClientId] = useState('');
  const [label, setLabel] = useState('');
  const [expiryChoice, setExpiryChoice] = useState<ExpiryChoice>('24');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const [stopTarget, setStopTarget] = useState<GpsShareSession | null>(null);
  const [stopLoading, setStopLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await api.get<GpsShareSession[] | { data?: GpsShareSession[] }>('/gps/share/list');
      const raw = res.data;
      const arr = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object' && Array.isArray((raw as { data?: GpsShareSession[] }).data)
          ? (raw as { data: GpsShareSession[] }).data
          : [];
      setSessions(arr);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      toast.error(ax.response?.data?.message ?? 'Failed to load share links');
      setSessions([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const [vRes, cRes] = await Promise.all([
          api.get('/vehicles', { params: { limit: 500, page: 1 } }),
          api.get('/clients'),
        ]);
        if (cancelled) return;
        setVehicles(parseVehiclesResponse(vRes.data));
        setClients(parseClientsResponse(cRes.data));
      } catch {
        if (!cancelled) toast.error('Failed to load vehicles or clients');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const ta = new Date(a.createdAt ?? 0).getTime();
      const tb = new Date(b.createdAt ?? 0).getTime();
      return tb - ta;
    });
  }, [sessions]);

  const activeSessions = useMemo(
    () => sortedSessions.filter((s) => isSessionEffectivelyActive(s)),
    [sortedSessions]
  );
  const inactiveSessions = useMemo(
    () => sortedSessions.filter((s) => !isSessionEffectivelyActive(s)),
    [sortedSessions]
  );

  const vehicleLabel = (v: FleetVehicle) => {
    const reg = v.regNumber || v.registrationNumber || '—';
    const mm = [v.make, v.model].filter(Boolean).join(' ');
    return mm ? `${reg} — ${mm}` : reg;
  };

  const copyUrl = async (token: string, sessionId: string) => {
    const url = fullGpsShareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(sessionId);
      setTimeout(() => setCopiedId((id) => (id === sessionId ? null : id)), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const handleCreate = async () => {
    if (!vehicleId) {
      toast.error('Please select a vehicle');
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { vehicleId };
      if (clientId) body.clientId = clientId;
      if (label.trim()) body.label = label.trim();
      if (expiryChoice !== 'never') body.expiresInHours = Number(expiryChoice);

      const res = await api.post<{ token?: string; shareUrl?: string }>('/gps/share', body);
      const token = res.data?.token;
      if (!token) {
        toast.error('No token in response');
        return;
      }
      const url = fullGpsShareUrl(token);
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Share link created and copied to clipboard');
      } catch {
        toast.success('Share link created');
      }
      setLabel('');
      setClientId('');
      setExpiryChoice('24');
      await fetchList();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      toast.error(ax.response?.data?.message ?? 'Failed to create share link');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmStop = async () => {
    if (!stopTarget) return;
    setStopLoading(true);
    try {
      await api.post(`/gps/share/${stopTarget.id}/stop`);
      toast.success('Share link stopped');
      setStopTarget(null);
      await fetchList();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } } };
      toast.error(ax.response?.data?.message ?? 'Failed to stop link');
    } finally {
      setStopLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-[#0D2847] text-[14px] focus:border-[#1565C0] focus:outline-none font-['Rajdhani']";
  const labelClass =
    "block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#0D2847] font-['Oswald'] tracking-wide uppercase">Share links</h2>
        <p className="text-sm text-gray-500 font-['Rajdhani'] mt-0.5">
          Create public tracking URLs for clients — no login required to view.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
        <h3 className="font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wider text-[#1565C0] mb-4">
          Create new share link
        </h3>
        {loadingMeta ? (
          <div className="flex items-center gap-2 text-[#7A9AB8] text-sm font-['Rajdhani'] py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading form…
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelClass}>Vehicle *</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleLabel(v)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Client (optional)</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={inputClass}
              >
                <option value="">No client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Label (optional)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Zepto daily delivery"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <span className={labelClass}>Expires</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {(
                  [
                    { key: '24' as const, label: '24 hours' },
                    { key: '48' as const, label: '48 hours' },
                    { key: '168' as const, label: '7 days' },
                    { key: 'never' as const, label: 'Never' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setExpiryChoice(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-[13px] font-['Rajdhani'] font-medium border transition-colors ${
                      expiryChoice === opt.key
                        ? 'bg-[#1565C0] text-white border-[#1565C0]'
                        : 'bg-white text-[#475569] border-[#E0E8F0] hover:border-[#1565C0]/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <button
                type="button"
                disabled={submitting || !vehicleId}
                onClick={handleCreate}
                className="px-5 py-2.5 bg-[#1565C0] text-white text-[14px] rounded-lg hover:bg-[#0D2847] transition-colors font-['Barlow_Condensed'] uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create share link
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wider text-[#0D2847]">
            Active share links ({activeSessions.length})
          </h3>
          <button
            type="button"
            onClick={() => fetchList()}
            className="text-xs text-[#1565C0] hover:underline font-['Rajdhani']"
          >
            Refresh list
          </button>
        </div>

        {loadingList ? (
          <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-[#7A9AB8] text-sm font-['Rajdhani']">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading share links…
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E0E8F0] bg-[#F8FAFC] p-8 text-center text-[14px] text-[#64748b] font-['Rajdhani']">
            No share links created yet. Use the form above to create one.
          </div>
        ) : activeSessions.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-6 text-center text-[14px] text-[#64748b] font-['Rajdhani']">
            No active share links. Expired or stopped links are below.
          </div>
        ) : (
          <ul className="space-y-3">
            {activeSessions.map((s) => {
              const url = fullGpsShareUrl(s.token);
              const cn = clientNameOf(s);
              const shortUrl = url.length > 52 ? `${url.slice(0, 40)}…` : url;
              return (
                <li
                  key={s.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 font-['Rajdhani'] text-[14px]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-['Barlow_Condensed'] font-bold text-[#0D2847] uppercase tracking-wide">
                        {regOf(s)}
                        {cn ? (
                          <span className="font-normal text-[#64748b] normal-case">
                            {' '}
                            → {cn}
                          </span>
                        ) : null}
                      </p>
                      {s.label ? (
                        <p className="text-[13px] text-[#475569] mt-1">&quot;{s.label}&quot;</p>
                      ) : null}
                      <p className="text-[12px] text-[#64748b] mt-1">
                        {s.expiresAt ? (
                          <>
                            Expires: {formatExpiry(s.expiresAt)}
                          </>
                        ) : (
                          <>Never expires</>
                        )}
                      </p>
                      <p
                        className="text-[12px] text-[#1565C0] mt-2 truncate font-mono"
                        title={url}
                      >
                        {shortUrl}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyUrl(s.token, s.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0E8F0] text-[13px] text-[#0D2847] hover:bg-[#F4F6F8] font-medium"
                      >
                        {copiedId === s.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-600" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setStopTarget(s)}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-[13px] text-red-600 hover:bg-red-50 font-medium"
                      >
                        Stop
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {inactiveSessions.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowExpired((v) => !v)}
            className="flex items-center gap-2 text-sm font-['Barlow_Condensed'] uppercase tracking-wider text-[#64748b] hover:text-[#0D2847] mb-3"
          >
            {showExpired ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Show expired / stopped links ({inactiveSessions.length})
          </button>
          {showExpired && (
            <ul className="space-y-2">
              {inactiveSessions.map((s) => {
                const cn = clientNameOf(s);
                const stopped = !s.isActive;
                const expiredByTime =
                  s.isActive && s.expiresAt && new Date(s.expiresAt).getTime() <= Date.now();
                const badge = stopped ? 'STOPPED' : expiredByTime ? 'EXPIRED' : 'INACTIVE';
                return (
                  <li
                    key={s.id}
                    className="rounded-xl border border-gray-200 bg-[#F1F5F9] p-3 text-[13px] text-[#64748b] font-['Rajdhani']"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#475569]">
                        {regOf(s)}
                        {cn ? ` → ${cn}` : ''}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                        {badge}
                      </span>
                    </div>
                    {s.label ? <p className="mt-1">&quot;{s.label}&quot;</p> : null}
                    <p className="mt-1 text-[12px]">
                      {s.expiresAt ? `Expired / until: ${formatExpiry(s.expiresAt)}` : 'No expiry set'}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!stopTarget}
        onClose={() => !stopLoading && setStopTarget(null)}
        onConfirm={confirmStop}
        title="Stop share link?"
        message={
          stopTarget
            ? `Stop sharing ${regOf(stopTarget)}${clientNameOf(stopTarget) ? ` with ${clientNameOf(stopTarget)}` : ''}? The tracking link will stop working.`
            : ''
        }
        confirmLabel="Stop sharing"
        loading={stopLoading}
        variant="danger"
      />
    </div>
  );
}
