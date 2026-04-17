'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Truck, User, Loader2, RefreshCw, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { documentExpiryApi } from '@/lib/api/document-expiry';
import { parseSummaryCounts, type Severity } from '@/lib/document-expiry/summary';
import {
  extractAlertsList,
  normalizeAlertRow,
  type DocAlertRow,
} from '@/lib/document-expiry/alertsList';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

const SEVERITY_BADGE: Record<string, string> = {
  EXPIRED: 'bg-red-100 text-red-800 border-red-300',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
  URGENT: 'bg-orange-100 text-orange-800 border-orange-300',
  WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  INFO: 'bg-blue-100 text-blue-800 border-blue-300',
};

const SUMMARY_KEYS: { key: Severity; label: string; cardClass: string }[] = [
  { key: 'EXPIRED', label: 'EXPIRED', cardClass: 'bg-red-100 border-red-300 text-red-900' },
  { key: 'CRITICAL', label: 'CRITICAL', cardClass: 'bg-red-50 border-red-400 text-red-950' },
  { key: 'URGENT', label: 'URGENT', cardClass: 'bg-orange-100 border-orange-300 text-orange-900' },
  { key: 'WARNING', label: 'WARNING', cardClass: 'bg-yellow-100 border-yellow-300 text-yellow-900' },
  { key: 'INFO', label: 'INFO', cardClass: 'bg-blue-100 border-blue-300 text-blue-900' },
];

function readNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseMeta(body: unknown): { total: number; totalPages: number } {
  if (!body || typeof body !== 'object') return { total: 0, totalPages: 1 };
  const o = body as Record<string, unknown>;
  const inner = (o.data ?? o) as Record<string, unknown>;
  const metaObj = inner.meta && typeof inner.meta === 'object' ? (inner.meta as Record<string, unknown>) : null;
  const total = readNum(inner.total ?? o.total ?? (metaObj ? metaObj.total : undefined));
  const limit = readNum(inner.limit ?? o.limit) || 50;
  const totalPages = Math.max(
    1,
    Math.ceil(total / limit) || readNum(inner.totalPages ?? o.totalPages) || 1,
  );
  return { total: total || extractAlertsList(body).length, totalPages };
}

function daysRemainingClass(days: number | null): string {
  if (days == null || Number.isNaN(days)) return 'text-[#7A9AB8]';
  if (days <= 0) return 'text-red-600 font-bold';
  if (days <= 7) return 'text-orange-600 font-bold';
  if (days <= 15) return 'text-yellow-600';
  return 'text-green-600';
}

const LIMIT = 50;

export default function DocumentAlertsPage() {
  const qc = useQueryClient();
  const [severity, setSeverity] = useState<string>('');
  const [entityType, setEntityType] = useState<string>('');
  const [ackFilter, setAckFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const summaryQuery = useQuery({
    queryKey: ['document-expiry-summary'],
    queryFn: async () => {
      const r = await documentExpiryApi.getSummary();
      return r.data;
    },
  });

  const alertsQuery = useQuery({
    queryKey: ['document-expiry-alerts', severity, entityType, ackFilter, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: LIMIT };
      if (severity) params.severity = severity;
      if (entityType) params.entityType = entityType;
      if (ackFilter === 'false') params.acknowledged = 'false';
      if (ackFilter === 'true') params.acknowledged = 'true';
      const r = await documentExpiryApi.getAlerts(params);
      const list = extractAlertsList(r.data).map(normalizeAlertRow).filter((x): x is DocAlertRow => x != null);
      const meta = parseMeta(r.data);
      return { rows: list, total: meta.total, totalPages: meta.totalPages };
    },
  });

  const summaryCounts = useMemo(() => parseSummaryCounts(summaryQuery.data), [summaryQuery.data]);

  const checkMutation = useMutation({
    mutationFn: () => documentExpiryApi.runCheck(),
    onSuccess: () => {
      toast.success('Document check started');
      void qc.invalidateQueries({ queryKey: ['document-expiry-summary'] });
      void qc.invalidateQueries({ queryKey: ['document-expiry-alerts'] });
      void qc.invalidateQueries({ queryKey: ['document-expiry-alerts-dashboard'] });
    },
    onError: (e: unknown) => {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as any).response?.data?.message : null;
      toast.error(typeof msg === 'string' ? msg : 'Check failed');
    },
  });

  const ackAllMutation = useMutation({
    mutationFn: () => documentExpiryApi.acknowledgeAll(),
    onSuccess: () => {
      toast.success('All alerts acknowledged');
      void qc.invalidateQueries({ queryKey: ['document-expiry-summary'] });
      void qc.invalidateQueries({ queryKey: ['document-expiry-alerts'] });
      void qc.invalidateQueries({ queryKey: ['document-expiry-alerts-dashboard'] });
    },
    onError: (e: unknown) => {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as any).response?.data?.message : null;
      toast.error(typeof msg === 'string' ? msg : 'Failed');
    },
  });

  const ackOneMutation = useMutation({
    mutationFn: (id: string) => documentExpiryApi.acknowledge(id),
    onSuccess: () => {
      toast.success('Acknowledged');
      void qc.invalidateQueries({ queryKey: ['document-expiry-summary'] });
      void qc.invalidateQueries({ queryKey: ['document-expiry-alerts'] });
      void qc.invalidateQueries({ queryKey: ['document-expiry-alerts-dashboard'] });
    },
    onError: (e: unknown) => {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as any).response?.data?.message : null;
      toast.error(typeof msg === 'string' ? msg : 'Failed');
    },
  });

  const rows = alertsQuery.data?.rows ?? [];
  const total = alertsQuery.data?.total ?? rows.length;
  const totalPages = Math.max(
    1,
    alertsQuery.data?.totalPages ?? (Math.ceil(total / LIMIT) || 1),
  );

  return (
    <div className="space-y-6 max-w-[1600px]">
      <div>
        <h1 className="font-['Oswald'] text-2xl font-bold text-[#0D2847] tracking-wide">Document Expiry Alerts</h1>
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-1">
          Vehicle documents and driver licenses — severity, acknowledgement, and manual checks.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {SUMMARY_KEYS.map(({ key, label, cardClass }) => (
          <div
            key={key}
            className={`rounded-xl border p-4 shadow-sm font-['Barlow_Condensed'] uppercase tracking-wider text-center ${cardClass}`}
          >
            <p className="text-xs opacity-90 mb-1">{label}</p>
            <p className="font-['Oswald'] text-3xl font-bold">{summaryCounts[key]}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white border border-[#E0E8F0] rounded-xl p-4 shadow-sm">
        <div>
          <label className="block text-[10px] font-['Barlow_Condensed'] uppercase tracking-wider text-[#7A9AB8] mb-1">
            Severity
          </label>
          <select
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm text-[#0D2847] font-['Rajdhani'] min-w-[140px]"
          >
            <option value="">All</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="URGENT">URGENT</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-['Barlow_Condensed'] uppercase tracking-wider text-[#7A9AB8] mb-1">Type</label>
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm text-[#0D2847] font-['Rajdhani'] min-w-[120px]"
          >
            <option value="">All</option>
            <option value="VEHICLE">VEHICLE</option>
            <option value="DRIVER">DRIVER</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-['Barlow_Condensed'] uppercase tracking-wider text-[#7A9AB8] mb-1">Status</label>
          <select
            value={ackFilter}
            onChange={(e) => {
              setAckFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm text-[#0D2847] font-['Rajdhani'] min-w-[160px]"
          >
            <option value="">All</option>
            <option value="false">Unacknowledged</option>
            <option value="true">Acknowledged</option>
          </select>
        </div>
        <div className="flex gap-2 ml-auto flex-wrap">
          <button
            type="button"
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1565C0] text-[#1565C0] font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#1565C0]/10 disabled:opacity-50"
          >
            {checkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Run Check Now
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Acknowledge all pending document alerts?')) ackAllMutation.mutate();
            }}
            disabled={ackAllMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847] disabled:opacity-50"
          >
            {ackAllMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            Acknowledge All
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#E0E8F0] rounded-xl shadow-sm overflow-hidden">
        {alertsQuery.isLoading ? (
          <div className="py-16 flex justify-center">
            <LoadingSpinner text="Loading alerts…" />
          </div>
        ) : alertsQuery.isError ? (
          <div className="p-8 text-center text-red-600 font-['Rajdhani']">Failed to load alerts.</div>
        ) : rows.length === 0 ? (
          <EmptyState message="No alerts match your filters" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Severity</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Entity</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Document</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Document No</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Expiry</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Days left</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Status</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E8F0]">
                  {rows.map((row) => {
                    const sev = row.severity.toUpperCase();
                    const badge = SEVERITY_BADGE[sev] ?? SEVERITY_BADGE.INFO;
                    const isVehicle =
                      row.entityType === 'VEHICLE' || String(row.entityType).toUpperCase().includes('VEH');
                    const exp = row.expiryDate
                      ? (() => {
                          const d = new Date(row.expiryDate);
                          return Number.isNaN(d.getTime()) ? '—' : format(d, 'dd MMM yyyy');
                        })()
                      : '—';
                    const dr = row.daysRemaining;
                    return (
                      <tr key={row.id} className="hover:bg-[#F4F6F8]/80">
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${badge}`}>{sev}</span>
                        </td>
                        <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#0D2847]">
                          <span className="inline-flex items-center gap-1.5">
                            {isVehicle ? <Truck className="w-4 h-4 text-[#1565C0]" /> : <User className="w-4 h-4 text-[#42A5F5]" />}
                            {row.entityLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#1A4A7A]">{row.documentType}</td>
                        <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#7A9AB8]">{row.documentNo || '—'}</td>
                        <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#7A9AB8]">{exp}</td>
                        <td className={`px-4 py-3 font-['Rajdhani'] text-sm ${daysRemainingClass(dr)}`}>
                          {dr != null && !Number.isNaN(dr) ? dr : '—'}
                        </td>
                        <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#7A9AB8]">
                          {row.acknowledged ? (
                            <span className="text-green-700">Acknowledged ✅</span>
                          ) : (
                            <span>Pending ⏳</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!row.acknowledged ? (
                            <button
                              type="button"
                              onClick={() => ackOneMutation.mutate(row.id)}
                              disabled={ackOneMutation.isPending}
                              className="text-sm px-3 py-1.5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50"
                            >
                              Acknowledge
                            </button>
                          ) : (
                            <span className="text-xs text-[#7A9AB8]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
