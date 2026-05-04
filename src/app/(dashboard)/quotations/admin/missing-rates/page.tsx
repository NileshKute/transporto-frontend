'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { quotationsApi } from '@/lib/api/quotations';
import {
  extractQuotationsArrayFromPayload,
  isMonthlyRateMissingRaw,
  readQuoteDateFromRecord,
} from '@/lib/quotations/normalize';
import { displayText } from '@/lib/displayText';
import { formatDate } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

function isAdmin(role: string | undefined) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function clientNameFromRaw(r: Record<string, unknown>): string {
  const c = r.client;
  if (c && typeof c === 'object') {
    const nm = (c as Record<string, unknown>).name;
    if (typeof nm === 'string' && nm.trim()) return nm.trim();
  }
  return displayText(r.clientName ?? r.client_name, '—');
}

function numDraft(v: unknown): string {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '';
}

interface MissingRateQuotation {
  id: string;
  quoteNumber: string;
  clientName: string;
  quoteDateIso: string | null;
  createdAt: string;
}

interface EditableRow extends MissingRateQuotation {
  draftMonthlyRate: string;
  draftFixedKm: string;
  draftAdditionalPerKmRs: string;
  isSaving: boolean;
  isDirty: boolean;
}

function rawToBaseRow(r: Record<string, unknown>): MissingRateQuotation {
  const id = r.id != null ? String(r.id) : '';
  const quoteDateIso = readQuoteDateFromRecord(r) || null;
  return {
    id,
    quoteNumber: displayText(r.quoteNumber ?? r.quote_number ?? r.number, ''),
    clientName: clientNameFromRaw(r),
    quoteDateIso,
    createdAt: String(r.createdAt ?? r.created_at ?? ''),
  };
}

function rawToEditable(r: Record<string, unknown>): EditableRow {
  const base = rawToBaseRow(r);
  return {
    ...base,
    draftMonthlyRate: '',
    draftFixedKm: numDraft(r.fixedKm ?? r.fixed_km),
    draftAdditionalPerKmRs: numDraft(r.additionalPerKmRs ?? r.additional_per_km_rs),
    isSaving: false,
    isDirty: false,
  };
}

export default function MissingRatesAdminPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const [rows, setRows] = useState<EditableRow[]>([]);
  const rowsRef = useRef<EditableRow[]>([]);
  rowsRef.current = rows;

  const { data: listPayload, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['quotations-missing-rates'],
    queryFn: async () => {
      const res = await quotationsApi.list({ limit: 500, missingRate: true } as Record<string, unknown>);
      return res.data;
    },
    enabled: !authLoading && isAdmin(user?.role),
  });

  const missingRawRows = useMemo(() => {
    const arr = extractQuotationsArrayFromPayload(listPayload);
    return arr.filter(isMonthlyRateMissingRaw);
  }, [listPayload]);

  useEffect(() => {
    if (listPayload === undefined) return;
    const next = missingRawRows.map(rawToEditable);
    setRows((prev) => {
      const byId = new Map(prev.map((r) => [r.id, r]));
      return next.map((nr) => {
        const old = byId.get(nr.id);
        if (!old) return nr;
        return {
          ...nr,
          draftMonthlyRate: old.draftMonthlyRate,
          draftFixedKm: old.draftFixedKm,
          draftAdditionalPerKmRs: old.draftAdditionalPerKmRs,
          isDirty: old.isDirty,
          isSaving: false,
        };
      });
    });
  }, [listPayload, missingRawRows]);

  const updateRow = useCallback(
    (id: string, field: 'draftMonthlyRate' | 'draftFixedKm' | 'draftAdditionalPerKmRs', value: string) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value, isDirty: true } : r)),
      );
    },
    [],
  );

  const parseNum = (s: string): number | null => {
    const t = s.replace(/,/g, '').trim();
    if (!t) return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  };

  const saveRow = useCallback(
    async (row: EditableRow) => {
      const monthlyRate = parseNum(row.draftMonthlyRate);
      if (monthlyRate === null || monthlyRate <= 0) {
        toast.error('Enter a valid monthly rate (₹)');
        return;
      }
      const fixedKm = parseNum(row.draftFixedKm);
      const additionalPerKmRs = parseNum(row.draftAdditionalPerKmRs);

      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isSaving: true } : r)));

      try {
        const payload: Record<string, unknown> = { monthlyRate };
        if (fixedKm !== null && fixedKm >= 0) payload.fixedKm = Math.round(fixedKm);
        if (additionalPerKmRs !== null && additionalPerKmRs >= 0) payload.additionalPerKmRs = additionalPerKmRs;

        await quotationsApi.update(row.id, payload);
        toast.success(`Updated ${row.clientName}`);
        qc.invalidateQueries({ queryKey: ['quotations-list'] });
        qc.invalidateQueries({ queryKey: ['quotations-missing-rates'] });
        qc.invalidateQueries({ queryKey: ['quotations-stats'] });
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } catch (e: unknown) {
        const msg =
          e && typeof e === 'object' && 'response' in e
            ? displayText((e as { response?: { data?: { message?: unknown } } }).response?.data?.message, '')
            : '';
        toast.error(msg || 'Save failed');
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isSaving: false } : r)));
      }
    },
    [qc],
  );

  const saveAll = async () => {
    const snapshot = rowsRef.current.filter((r) => r.isDirty && r.draftMonthlyRate.trim());
    if (snapshot.length === 0) {
      toast('No changes to save');
      return;
    }
    for (const row of snapshot) {
      await saveRow(row);
    }
  };

  const tryBlurSaveMonthly = (id: string) => {
    const cur = rowsRef.current.find((r) => r.id === id);
    if (!cur?.isDirty || !cur.draftMonthlyRate.trim()) return;
    const n = parseNum(cur.draftMonthlyRate);
    if (n === null || n <= 0) return;
    void saveRow(cur);
  };

  if (authLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner text="Loading…" />
      </div>
    );
  }

  if (!isAdmin(user?.role)) {
    return (
      <div className="max-w-lg mx-auto rounded-xl border border-[#E0E8F0] bg-white p-8 text-center space-y-4">
        <p className="font-['Oswald'] text-[#0D2847]">Admin only</p>
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">Missing-rate bulk edit is restricted to administrators.</p>
        <Link href="/quotations" className="inline-block text-[#1565C0] font-['Barlow_Condensed'] uppercase hover:underline">
          Back to quotations
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner text="Loading quotations…" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/quotations" className="p-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8]" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Missing monthly rates</h1>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-8 text-center space-y-3 shadow-sm">
          <p className="text-3xl mb-1" aria-hidden>
            🎉
          </p>
          <p className="font-['Oswald'] text-lg text-emerald-900">All quotations have monthly rates</p>
          <p className="font-['Rajdhani'] text-sm text-emerald-800/90">Nothing left to fix here.</p>
          <button
            type="button"
            onClick={() => router.push('/quotations')}
            className="mt-2 inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847]"
          >
            Back to quotations
          </button>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full min-w-0 rounded-lg border border-[#E0E8F0] px-2 py-1.5 text-sm text-[#0D2847] font-[\'Rajdhani\'] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/25 disabled:opacity-50';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/quotations" className="p-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8] shrink-0" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Missing monthly rates</h1>
            <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">
              {rows.length} quotation{rows.length === 1 ? '' : 's'} need a rate (parser could not extract from template)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-2 border-2 border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg hover:bg-[#F4F6F8] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={!rows.some((r) => r.isDirty)}
            className="inline-flex items-center justify-center gap-2 bg-[#1565C0] hover:bg-[#0D2847] text-white font-['Barlow_Condensed'] font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg disabled:opacity-40 disabled:pointer-events-none"
          >
            Save all
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#E0E8F0] rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[880px]">
          <thead>
            <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
              <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Quote no</th>
              <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Date</th>
              <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Client</th>
              <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] w-36">Monthly (₹)</th>
              <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] w-28">Fixed KM</th>
              <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] w-32">Add&apos;l ₹/km</th>
              <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] w-28">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E8F0]">
            {rows.map((row) => (
              <tr key={row.id} className={`hover:bg-[#F4F6F8] ${row.isDirty ? 'bg-amber-50/60' : ''}`}>
                <td className="px-4 py-3 font-['Oswald'] text-sm font-semibold text-[#1565C0]">{row.quoteNumber || '—'}</td>
                <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#0D2847]">
                  {formatDate(row.quoteDateIso || row.createdAt || undefined)}
                </td>
                <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#0D2847] max-w-[220px] truncate" title={row.clientName}>
                  {row.clientName}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 90000"
                    value={row.draftMonthlyRate}
                    onChange={(e) => updateRow(row.id, 'draftMonthlyRate', e.target.value)}
                    onBlur={() => tryBlurSaveMonthly(row.id)}
                    className={inputClass}
                    disabled={row.isSaving}
                    aria-label="Monthly rate"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="3000"
                    value={row.draftFixedKm}
                    onChange={(e) => updateRow(row.id, 'draftFixedKm', e.target.value)}
                    className={inputClass}
                    disabled={row.isSaving}
                    aria-label="Fixed KM"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="20"
                    value={row.draftAdditionalPerKmRs}
                    onChange={(e) => updateRow(row.id, 'draftAdditionalPerKmRs', e.target.value)}
                    className={inputClass}
                    disabled={row.isSaving}
                    aria-label="Additional per km rupees"
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void saveRow(row)}
                    disabled={row.isSaving || !row.draftMonthlyRate.trim()}
                    className="px-3 py-1.5 rounded-lg bg-[#1565C0] text-white text-xs font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-40"
                  >
                    {row.isSaving ? '…' : 'Save'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
