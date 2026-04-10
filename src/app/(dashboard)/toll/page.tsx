'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { tollApi, type TollTransactionsParams } from '@/lib/api/toll';
import api from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatInrTwoDecimals, formatNumber } from '@/lib/utils';
import {
  IndianRupee,
  ListOrdered,
  MapPin,
  Truck,
  Search,
  Download,
  ChevronDown,
  X,
  Upload,
  FileSpreadsheet,
  History,
  ChevronUp,
  Trash2,
  FilterX,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';

const LIMIT = 50;

const inputClass =
  'h-10 rounded-lg border border-[#E0E8F0] text-sm text-[#0D2847] px-3 font-["Rajdhani"] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20';

/** UI label → API `txnType` */
const TYPE_TO_API: Record<string, string> = {
  '': '',
  'Toll Txn': 'TOLL',
  'Non-fin': 'NON_FIN',
  'SD-Debit': 'SD_DEBIT',
};

const API_TO_LABEL: Record<string, string> = {
  TOLL: 'Toll Txn',
  NON_FIN: 'Non-fin',
  SD_DEBIT: 'SD-Debit',
  OTHER: 'Other',
};

type ViewTab = 'transactions' | 'by-vehicle' | 'by-plaza' | 'by-month';

function defaultDateRange() {
  const end = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 6);
  from.setDate(1);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { start: fmt(from), end: fmt(end) };
}

function allTimeRange() {
  const end = new Date();
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { start: '2000-01-01', end: fmt(end) };
}

function fmtYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function indianFYRange(ref: Date): { start: string; end: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const fyStartYear = m >= 3 ? y : y - 1;
  const start = new Date(fyStartYear, 3, 1);
  const end = new Date();
  return { start: fmtYmd(start), end: fmtYmd(end) };
}

function dateRangeForPreset(preset: string): { start: string; end: string } {
  const now = new Date();
  const end = fmtYmd(now);
  switch (preset) {
    case 'today':
      return { start: end, end };
    case 'this-week': {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      return { start: fmtYmd(d), end };
    }
    case 'this-month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: fmtYmd(s), end };
    }
    case 'last-month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: fmtYmd(s), end: fmtYmd(e) };
    }
    case 'this-fy':
      return indianFYRange(now);
    case 'all':
      return allTimeRange();
    default:
      return defaultDateRange();
  }
}

function safeStr(v: unknown, fallback = '—'): string {
  if (v == null) return fallback;
  const t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean') return String(v);
  return fallback;
}

function safeNum(v: unknown, fallback = 0): number {
  if (v == null || v === '') return fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isoDateFrom(v: unknown): string {
  if (v == null || v === '') return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString();
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString();
  if (typeof v === 'string') return v;
  return '';
}

function formatTxnDateTime(isoOrEmpty: string): string {
  if (!isoOrEmpty) return '—';
  const d = new Date(isoOrEmpty);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface TollTxnRow {
  id: string;
  dateIso: string;
  typeRaw: string;
  plazaName: string;
  plazaCode: string;
  debit: number;
  balance: number;
}

function normalizeTxn(row: Record<string, unknown>): TollTxnRow {
  const d = row.transactionDateTime ?? row.txnDate ?? row.date ?? row.createdAt;
  const idRaw = row.id ?? `${isoDateFrom(d)}-${safeStr(row.uniqueTxnId, '')}`;
  const typeRaw = safeStr(
    row.transactionType ?? row.txnType ?? row.type ?? '',
  );
  return {
    id: safeStr(idRaw, `txn-${Math.random().toString(36).slice(2)}`),
    dateIso: isoDateFrom(d),
    typeRaw,
    plazaName: safeStr(row.plazaName ?? row.plaza ?? ''),
    plazaCode: safeStr(row.plazaCode ?? ''),
    debit: safeNum(row.debitAmt ?? row.debit ?? row.amount),
    balance: safeNum(row.closingBalance ?? row.balance),
  };
}

function typeLabel(raw: string): string {
  if (!raw) return '—';
  return API_TO_LABEL[raw] ?? raw;
}

function parseListPayload(resData: unknown) {
  const root = (resData ?? {}) as Record<string, unknown>;
  const body = root.data !== undefined && root.data !== null ? root.data : root;
  const nestedRows =
    typeof body === 'object' && body && !Array.isArray(body)
      ? (body as Record<string, unknown>).data ?? (body as Record<string, unknown>).items
      : undefined;
  const rowsRaw: Record<string, unknown>[] = Array.isArray(body)
    ? (body as Record<string, unknown>[])
    : Array.isArray(nestedRows)
      ? (nestedRows as Record<string, unknown>[])
      : [];
  const nestedTotal =
    typeof body === 'object' && body && !Array.isArray(body)
      ? (body as Record<string, unknown>).total
      : undefined;
  const rawTotal = root.total ?? nestedTotal;
  const total = safeNum(rawTotal, rowsRaw.length);
  return { rowsRaw, total };
}

function parseSummary(resData: unknown) {
  const root = (resData ?? {}) as Record<string, unknown>;
  const s =
    (root.summary as Record<string, unknown>) ??
    (typeof root.data === 'object' && root.data && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root);

  const latestMonthDebit = safeNum(
    s.latestMonthDebit ?? s.latest_month_debit ?? s.thisMonthDebit ?? s.this_month_debit,
    0,
  );
  const latestMonthCount = safeNum(
    s.latestMonthCount ?? s.latest_month_count ?? s.thisMonthTxnCount ?? s.this_month_txn_count,
    0,
  );
  const latestMonthLabel = safeStr(
    s.latestMonthLabel ?? s.latest_month_label ?? '',
    '',
  );

  const topPlazaRaw = s.topPlaza ?? s.top_plaza;
  let topPlazaName = '—';
  let topPlazaAmount = 0;
  if (topPlazaRaw && typeof topPlazaRaw === 'object' && !Array.isArray(topPlazaRaw)) {
    const o = topPlazaRaw as Record<string, unknown>;
    topPlazaName = safeStr(o.name ?? o.plazaName ?? '', '—');
    topPlazaAmount = safeNum(o.totalDebit ?? o.total_debit, 0);
  }

  const vehRaw = s.highestSpendVehicle ?? s.highest_spend_vehicle;
  let highVehicle = '—';
  let highVehicleDebit: number | undefined;
  if (vehRaw && typeof vehRaw === 'object' && !Array.isArray(vehRaw)) {
    const o = vehRaw as Record<string, unknown>;
    highVehicle = safeStr(o.regNumber ?? o.vehicle ?? '', '—');
    highVehicleDebit = safeNum(o.totalDebit ?? o.total_debit, NaN);
    if (!Number.isFinite(highVehicleDebit)) highVehicleDebit = undefined;
  }

  return {
    latestMonthDebit,
    latestMonthCount,
    latestMonthLabel,
    topPlazaName,
    topPlazaAmount,
    highVehicle,
    highVehicleDebit,
  };
}

function VehicleMultiSelect({
  options,
  selected,
  onChange,
  id,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const allMode = selected.length === 0;

  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };

  const remove = (v: string, e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onChange(selected.filter((x) => x !== v));
  };

  return (
    <div className="relative flex-1 min-w-[200px]" ref={rootRef}>
      <label
        htmlFor={id}
        className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1"
      >
        Vehicle number
      </label>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputClass} w-full min-h-[40px] h-auto py-1.5 text-left inline-flex flex-wrap gap-1.5 items-center justify-between`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex flex-wrap gap-1.5 items-center flex-1 min-w-0">
          {allMode ? (
            <span className="text-[#7A9AB8] text-sm">All vehicles</span>
          ) : (
            selected.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-0.5 pl-2 pr-1 py-0.5 rounded-md bg-[#E3F2FD] text-[#1565C0] text-xs font-mono max-w-full"
              >
                <span className="truncate">{v}</span>
                <button
                  type="button"
                  className="p-0.5 rounded hover:bg-[#BBDEFB] shrink-0"
                  aria-label={`Remove ${v}`}
                  onClick={(e) => remove(v, e)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))
          )}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-[#7A9AB8] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute z-[100] mt-1 left-0 right-0 max-h-64 overflow-y-auto rounded-lg border border-[#E0E8F0] bg-white shadow-lg py-1"
          role="listbox"
        >
          <label className="flex items-center gap-2 px-3 py-2 hover:bg-[#F4F6F8] cursor-pointer border-b border-[#E0E8F0]">
            <input
              type="checkbox"
              className="rounded border-[#E0E8F0]"
              checked={allMode}
              onChange={() => onChange([])}
            />
            <span className="text-sm font-['Rajdhani'] text-[#0D2847] font-medium">All vehicles</span>
          </label>
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[#7A9AB8]">No vehicles in list yet</div>
          ) : (
            options.map((v) => (
              <label key={v} className="flex items-center gap-2 px-3 py-2 hover:bg-[#F4F6F8] cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-[#E0E8F0]"
                  checked={selected.includes(v)}
                  onChange={() => toggle(v)}
                />
                <span className="text-sm font-mono text-[#0D2847]">{v}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-10 flex-1 bg-[#E0E8F0] rounded-lg" />
          <div className="h-10 w-24 bg-[#E0E8F0] rounded-lg" />
          <div className="h-10 flex-1 bg-[#E0E8F0] rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default function TollManagementPage() {
  const qc = useQueryClient();
  const dr = defaultDateRange();
  const [draft, setDraft] = useState({
    vehicleNumbers: [] as string[],
    plazaInput: '',
    typeUi: '' as '' | 'Toll Txn' | 'Non-fin' | 'SD-Debit',
    startDate: dr.start,
    endDate: dr.end,
  });
  const [applied, setApplied] = useState(draft);
  const [viewTab, setViewTab] = useState<ViewTab>('transactions');
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [importDrag, setImportDrag] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    duplicates: number;
    skipped: number;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const txnParams: TollTransactionsParams = useMemo(() => {
    const p: TollTransactionsParams = {
      page,
      limit: LIMIT,
      sortBy: 'date',
      sortDir,
      from: applied.startDate,
      to: applied.endDate,
    };
    if (applied.vehicleNumbers.length > 0) {
      p.vehicleNumber = applied.vehicleNumbers.join(',');
    }
    if (applied.plazaInput.trim()) p.plaza = applied.plazaInput.trim();
    const apiType = TYPE_TO_API[applied.typeUi];
    if (apiType) p.txnType = apiType;
    return p;
  }, [applied, page, sortDir]);

  const { data: vehiclesRaw } = useQuery({
    queryKey: ['toll-page-vehicles'],
    queryFn: async () => {
      const res = await api.get('/vehicles', { params: { limit: 500, page: 1 } });
      const raw = res.data?.data ?? res.data;
      return Array.isArray(raw) ? raw : [];
    },
  });

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['toll-summary'],
    queryFn: async () => {
      const res = await tollApi.getSummary();
      return parseSummary(res.data);
    },
  });

  const { data: txRes, isLoading: txLoading, isFetching: txFetching } = useQuery({
    queryKey: ['toll-transactions', txnParams],
    enabled: viewTab === 'transactions',
    queryFn: async () => {
      const res = await tollApi.getTransactions(txnParams);
      const { rowsRaw, total } = parseListPayload(res.data);
      const rows = rowsRaw.map((r) => normalizeTxn(r));
      const totalPages = Math.max(1, Math.ceil(total / LIMIT));
      return { rows, total, totalPages };
    },
  });

  const { data: byVehicleRaw, isLoading: byVLoading } = useQuery({
    queryKey: ['toll-by-vehicle'],
    enabled: viewTab === 'by-vehicle',
    queryFn: async () => {
      const res = await tollApi.getByVehicle();
      if (Array.isArray(res.data)) return res.data as Record<string, unknown>[];
      const raw = parseListPayload(res.data).rowsRaw;
      return raw;
    },
  });

  const { data: byPlazaRaw, isLoading: byPLoading } = useQuery({
    queryKey: ['toll-by-plaza'],
    enabled: viewTab === 'by-plaza',
    queryFn: async () => {
      const res = await tollApi.getByPlaza();
      if (Array.isArray(res.data)) return res.data as Record<string, unknown>[];
      const raw = parseListPayload(res.data).rowsRaw;
      return raw;
    },
  });

  const { data: byMonthRaw, isLoading: byMLoading } = useQuery({
    queryKey: ['toll-by-month'],
    enabled: viewTab === 'by-month',
    queryFn: async () => {
      const res = await tollApi.getByMonth();
      if (Array.isArray(res.data)) return res.data as Record<string, unknown>[];
      const raw = parseListPayload(res.data).rowsRaw;
      return raw;
    },
  });

  const { data: plazaNames } = useQuery({
    queryKey: ['toll-plaza-autocomplete'],
    queryFn: async () => {
      const res = await tollApi.getByPlaza();
      const rows = parseListPayload(res.data).rowsRaw;
      const list = rows.length ? rows : (Array.isArray(res.data) ? res.data : []);
      const names = new Set<string>();
      for (const r of list as Record<string, unknown>[]) {
        const n = safeStr(r.plazaName ?? r.plaza, '');
        if (n) names.add(n);
      }
      return [...names].sort((a, b) => a.localeCompare(b));
    },
  });

  const { data: historyRaw, isLoading: historyLoading } = useQuery({
    queryKey: ['toll-import-history'],
    queryFn: async () => {
      const res = await tollApi.getImportHistory();
      if (Array.isArray(res.data)) return res.data;
      const o = res.data as Record<string, unknown> | undefined;
      if (o && Array.isArray(o.data)) return o.data;
      if (o && Array.isArray(o.items)) return o.items;
      return [];
    },
  });

  const vehicleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of vehiclesRaw ?? []) {
      const r = (row as Record<string, unknown>).regNumber ?? (row as Record<string, unknown>).registrationNumber;
      if (r != null && String(r).trim()) set.add(String(r).trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
  }, [vehiclesRaw]);

  const summary = summaryRes ?? {
    latestMonthDebit: 0,
    latestMonthCount: 0,
    latestMonthLabel: '',
    topPlazaName: '—',
    topPlazaAmount: 0,
    highVehicle: '—',
    highVehicleDebit: undefined as number | undefined,
  };

  const rows = txRes?.rows ?? [];
  const total = safeNum(txRes?.total, 0);
  const totalPages = safeNum(txRes?.totalPages, 1);

  const applySearch = () => {
    setApplied({ ...draft });
    setPage(1);
  };

  const clearFilters = () => {
    const next = {
      vehicleNumbers: [] as string[],
      plazaInput: '',
      typeUi: '' as const,
      startDate: dr.start,
      endDate: dr.end,
    };
    setDraft(next);
    setApplied(next);
    setPage(1);
  };

  const applyQuickPreset = (preset: string) => {
    const r = dateRangeForPreset(preset);
    setDraft((d) => ({ ...d, startDate: r.start, endDate: r.end }));
    setApplied((a) => ({ ...a, startDate: r.start, endDate: r.end }));
    setPage(1);
  };

  const toggleDateSort = () => {
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    setPage(1);
  };

  const handleImport = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx')) {
      toast.error('Please choose an Excel .xlsx file');
      return;
    }
    setImportLoading(true);
    setImportResult(null);
    setUploadPct(0);
    try {
      const res = await tollApi.importExcel(file, (pct) => setUploadPct(pct));
      const data = res.data as Record<string, unknown>;
      setImportResult({
        imported: safeNum(data.imported ?? data.importedRows, 0),
        duplicates: safeNum(data.duplicates ?? data.duplicateRows, 0),
        skipped: safeNum(data.skipped ?? data.skippedRows, 0),
      });
      setUploadPct(100);
      qc.invalidateQueries({ queryKey: ['toll-summary'] });
      qc.invalidateQueries({ queryKey: ['toll-transactions'] });
      qc.invalidateQueries({ queryKey: ['toll-by-vehicle'] });
      qc.invalidateQueries({ queryKey: ['toll-by-plaza'] });
      qc.invalidateQueries({ queryKey: ['toll-by-month'] });
      qc.invalidateQueries({ queryKey: ['toll-import-history'] });
      qc.invalidateQueries({ queryKey: ['toll-plaza-autocomplete'] });
      toast.success('Import complete');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: unknown } } };
      const msg = e?.response?.data;
      const text =
        typeof msg === 'object' && msg && 'message' in msg
          ? String((msg as { message: unknown }).message)
          : 'Import failed';
      toast.error(text);
    } finally {
      setImportLoading(false);
    }
  };

  const deleteBatch = async (id: string) => {
    if (!window.confirm('Delete this import batch and its transactions?')) return;
    setDeletingId(id);
    try {
      await tollApi.deleteBatch(id);
      toast.success('Batch deleted');
      qc.invalidateQueries({ queryKey: ['toll-import-history'] });
      qc.invalidateQueries({ queryKey: ['toll-summary'] });
      qc.invalidateQueries({ queryKey: ['toll-transactions'] });
      qc.invalidateQueries({ queryKey: ['toll-by-vehicle'] });
      qc.invalidateQueries({ queryKey: ['toll-by-plaza'] });
      qc.invalidateQueries({ queryKey: ['toll-by-month'] });
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      if (viewTab === 'transactions') {
        const res = await tollApi.getTransactions({ ...txnParams, page: 1, limit: 100_000 });
        const { rowsRaw } = parseListPayload(res.data);
        const list = rowsRaw.map((r) => normalizeTxn(r));
        const ws = XLSX.utils.aoa_to_sheet([
          ['Date & Time', 'Type', 'Plaza Name', 'Plaza Code', 'Debit (₹)', 'Balance After'],
          ...list.map((t) => [
            formatTxnDateTime(t.dateIso),
            typeLabel(t.typeRaw),
            t.plazaName,
            t.plazaCode,
            t.debit,
            t.balance,
          ]),
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
        XLSX.writeFile(wb, `Toll_Transactions_${new Date().toISOString().slice(0, 10)}.xlsx`);
      } else if (viewTab === 'by-vehicle') {
        const res = await tollApi.getByVehicle();
        const raw = parseListPayload(res.data).rowsRaw;
        const list = raw.length ? raw : (Array.isArray(res.data) ? res.data : []);
        const ws = XLSX.utils.aoa_to_sheet([
          ['Vehicle', 'Trip count', 'Total debit (₹)'],
          ...(list as Record<string, unknown>[]).map((r) => [
            safeStr(r.regNumber ?? r.vehicle, 'Unassigned'),
            safeNum(r.txnCount ?? r.count, 0),
            safeNum(r.totalDebit, 0),
          ]),
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'By vehicle');
        XLSX.writeFile(wb, `Toll_By_Vehicle_${new Date().toISOString().slice(0, 10)}.xlsx`);
      } else if (viewTab === 'by-plaza') {
        const res = await tollApi.getByPlaza();
        const raw = parseListPayload(res.data).rowsRaw;
        const list = raw.length ? raw : (Array.isArray(res.data) ? res.data : []);
        const ws = XLSX.utils.aoa_to_sheet([
          ['Plaza name', 'Visit count', 'Total debit (₹)'],
          ...(list as Record<string, unknown>[]).map((r) => [
            safeStr(r.plazaName ?? r.plaza, '—'),
            safeNum(r.txnCount ?? r.count, 0),
            safeNum(r.totalDebit, 0),
          ]),
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'By plaza');
        XLSX.writeFile(wb, `Toll_By_Plaza_${new Date().toISOString().slice(0, 10)}.xlsx`);
      } else {
        const res = await tollApi.getByMonth();
        const raw = parseListPayload(res.data).rowsRaw;
        const list = raw.length ? raw : (Array.isArray(res.data) ? res.data : []);
        const ws = XLSX.utils.aoa_to_sheet([
          ['Month', 'Txn count', 'Total debit (₹)'],
          ...(list as Record<string, unknown>[]).map((r) => {
            const m = r.month ? new Date(String(r.month)) : null;
            const label =
              m && !Number.isNaN(m.getTime())
                ? m.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                : '—';
            return [label, safeNum(r.txnCount, 0), safeNum(r.totalDebit, 0)];
          }),
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'By month');
        XLSX.writeFile(wb, `Toll_By_Month_${new Date().toISOString().slice(0, 10)}.xlsx`);
      }
      toast.success('Export started');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const monthChartSorted = useMemo(() => {
    const raw = (byMonthRaw ?? []) as Record<string, unknown>[];
    return [...raw]
      .map((r) => {
        const m = r.month ? new Date(String(r.month)) : null;
        const label =
          m && !Number.isNaN(m.getTime())
            ? m.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
            : '—';
        return {
          label,
          totalDebit: safeNum(r.totalDebit, 0),
          txnCount: safeNum(r.txnCount, 0),
          month: r.month,
        };
      })
      .sort((a, b) => {
        const ta = new Date(String(a.month ?? 0)).getTime();
        const tb = new Date(String(b.month ?? 0)).getTime();
        return ta - tb;
      });
  }, [byMonthRaw]);

  const tabBusy =
    viewTab === 'transactions'
      ? txLoading || txFetching
      : viewTab === 'by-vehicle'
        ? byVLoading
        : viewTab === 'by-plaza'
          ? byPLoading
          : byMLoading;

  const DateSortHead = ({ children }: { children: ReactNode }) => (
    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] whitespace-nowrap">
      <button
        type="button"
        onClick={toggleDateSort}
        className="inline-flex items-center gap-1 hover:text-[#1565C0] font-['Barlow_Condensed']"
      >
        {children}
        {sortDir === 'asc' ? (
          <ChevronUp className="w-3.5 h-3.5 text-[#42A5F5]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[#42A5F5]" />
        )}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">
            Toll Management
          </h2>
          <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">
            FASTag toll debits — filter, analyze, and import Kotak statements
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setImportOpen(true);
            setImportResult(null);
            setUploadPct(0);
          }}
          className="inline-flex items-center gap-2 border border-[#E0E8F0] bg-white text-[#0D2847] hover:bg-[#F4F6F8] font-medium px-4 py-2.5 rounded-lg transition-colors font-['Barlow_Condensed'] uppercase tracking-wider text-sm"
        >
          <Upload className="w-4 h-4 text-[#1565C0]" /> Import
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          <div className="col-span-full py-8 flex justify-center">
            <LoadingSpinner text="Loading summary…" />
          </div>
        ) : (
          <>
            <StatCard
              icon={IndianRupee}
              iconColor="amber"
              title="Latest month debit"
              value={formatInrTwoDecimals(summary.latestMonthDebit)}
              subtitle={summary.latestMonthLabel ? summary.latestMonthLabel : undefined}
            />
            <StatCard
              icon={ListOrdered}
              iconColor="blue"
              title="Latest month txn count"
              value={String(formatNumber(summary.latestMonthCount))}
              subtitle={summary.latestMonthLabel ? summary.latestMonthLabel : undefined}
            />
            <StatCard
              icon={MapPin}
              iconColor="cyan"
              title="Top plaza"
              value={summary.topPlazaName}
              subtitle={
                summary.topPlazaName !== '—'
                  ? formatInrTwoDecimals(summary.topPlazaAmount)
                  : undefined
              }
            />
            <StatCard
              icon={Truck}
              iconColor="green"
              title="Highest spend vehicle"
              value={summary.highVehicle === '' || summary.highVehicle === '—' ? '—' : summary.highVehicle}
              subtitle={
                summary.highVehicleDebit != null && Number.isFinite(summary.highVehicleDebit)
                  ? formatInrTwoDecimals(summary.highVehicleDebit)
                  : undefined
              }
            />
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <VehicleMultiSelect
          id="toll-vehicle-multiselect"
          options={vehicleOptions}
          selected={draft.vehicleNumbers}
          onChange={(vehicleNumbers) => setDraft((d) => ({ ...d, vehicleNumbers }))}
        />
        <div>
          <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">
            From
          </label>
          <input
            type="date"
            className={inputClass}
            value={draft.startDate}
            onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">
            To
          </label>
          <input
            type="date"
            className={inputClass}
            value={draft.endDate}
            onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
          />
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <span className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#7A9AB8] mb-1">
              Quick presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['today', 'Today'],
                  ['this-week', 'This Week'],
                  ['this-month', 'This Month'],
                  ['last-month', 'Last Month'],
                  ['this-fy', 'This FY'],
                  ['all', 'All'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyQuickPreset(key)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#E0E8F0] text-xs font-['Rajdhani'] text-[#1A4A7A] hover:bg-[#E3F2FD] hover:border-[#42A5F5]/40 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">
            Plaza search
          </label>
          <input
            type="search"
            className={`${inputClass} w-full`}
            placeholder="Search plaza…"
            value={draft.plazaInput}
            onChange={(e) => setDraft((d) => ({ ...d, plazaInput: e.target.value }))}
            list="toll-plaza-suggestions"
          />
          <datalist id="toll-plaza-suggestions">
            {(plazaNames ?? []).map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">
            Type
          </label>
          <select
            className={`${inputClass} min-w-[140px]`}
            value={draft.typeUi}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                typeUi: e.target.value as '' | 'Toll Txn' | 'Non-fin' | 'SD-Debit',
              }))
            }
          >
            <option value="">All</option>
            <option value="Toll Txn">Toll Txn</option>
            <option value="Non-fin">Non-fin</option>
            <option value="SD-Debit">SD-Debit</option>
          </select>
        </div>
        <button
          type="button"
          onClick={applySearch}
          className="h-10 inline-flex items-center gap-2 px-5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847]"
        >
          <Search className="w-4 h-4" /> Search
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="h-10 inline-flex items-center gap-2 px-4 rounded-lg border border-[#E0E8F0] text-[#1A4A7A] font-['Rajdhani'] text-sm hover:bg-[#F4F6F8]"
        >
          <FilterX className="w-4 h-4" /> Clear
        </button>
        <button
          type="button"
          disabled={exporting || tabBusy}
          onClick={() => void exportExcel()}
          className="h-10 inline-flex items-center gap-2 px-4 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8] disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-[#1565C0]" />{' '}
          {exporting ? 'Exporting…' : 'Export Excel'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[#E0E8F0] pb-0">
        {(
          [
            ['transactions', 'Transactions'],
            ['by-vehicle', 'By Vehicle'],
            ['by-plaza', 'By Plaza'],
            ['by-month', 'By Month'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setViewTab(id);
              setPage(1);
            }}
            className={`px-4 py-2.5 rounded-t-lg font-['Barlow_Condensed'] uppercase tracking-wider text-sm border border-b-0 transition-colors ${
              viewTab === id
                ? 'bg-white text-[#1565C0] border-[#E0E8F0] font-semibold'
                : 'bg-[#F4F6F8] text-[#7A9AB8] border-transparent hover:text-[#0D2847]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl rounded-tl-none border border-[#E0E8F0] border-t-0 shadow-sm overflow-hidden -mt-px min-h-[200px]">
        {viewTab === 'transactions' && (
          <>
            {txLoading ? (
              <TableSkeleton />
            ) : rows.length === 0 ? (
              <EmptyState message="No toll transactions for these filters" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                        <DateSortHead>Date &amp; Time</DateSortHead>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] whitespace-nowrap">
                          Type
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] whitespace-nowrap">
                          Plaza Name
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] whitespace-nowrap">
                          Plaza Code
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] whitespace-nowrap">
                          Debit (₹)
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] whitespace-nowrap">
                          Balance After
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E8F0]">
                      {rows.map((t, idx) => (
                        <tr key={String(t.id)} className={idx % 2 === 1 ? 'bg-[#F8F9FA]' : ''}>
                          <td className="px-4 py-3 text-sm font-['Rajdhani'] text-[#0D2847] whitespace-nowrap">
                            {formatTxnDateTime(t.dateIso)}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#0D2847]">{typeLabel(t.typeRaw)}</td>
                          <td className="px-4 py-3 text-sm text-[#0D2847] max-w-[220px] truncate">
                            {t.plazaName || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-[#1A4A7A]">{t.plazaCode || '—'}</td>
                          <td className="px-4 py-3 text-sm font-mono font-semibold text-[#DC2626] tabular-nums">
                            {formatInrTwoDecimals(t.debit)}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono tabular-nums text-[#0D2847]">
                            {formatInrTwoDecimals(t.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
              </>
            )}
          </>
        )}

        {viewTab === 'by-vehicle' && (
          <>
            {byVLoading ? (
              <div className="p-12 flex justify-center">
                <LoadingSpinner text="Loading vehicles…" />
              </div>
            ) : !byVehicleRaw?.length ? (
              <EmptyState message="No vehicle aggregates yet" />
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(byVehicleRaw as Record<string, unknown>[]).map((r, i) => {
                  const reg = safeStr(r.regNumber, 'Unassigned');
                  const txnCount = safeNum(r.txnCount ?? r.count, 0);
                  const debit = safeNum(r.totalDebit, 0);
                  return (
                    <div
                      key={`${reg}-${i}`}
                      className="rounded-xl border border-[#E0E8F0] bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <p className="font-['Oswald'] text-lg font-bold text-[#0D2847] tracking-wide font-mono">
                        {reg}
                      </p>
                      <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-1">
                        Trip count:{' '}
                        <span className="text-[#1A4A7A] font-semibold">{formatNumber(txnCount)}</span>
                      </p>
                      <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">
                        Total debit:{' '}
                        <span className="text-[#DC2626] font-semibold">{formatInrTwoDecimals(debit)}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {viewTab === 'by-plaza' && (
          <>
            {byPLoading ? (
              <div className="p-12 flex justify-center">
                <LoadingSpinner text="Loading plazas…" />
              </div>
            ) : !byPlazaRaw?.length ? (
              <EmptyState message="No plaza aggregates yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Plaza name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">
                        Visit count
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">
                        Total debit (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E8F0]">
                    {(byPlazaRaw as Record<string, unknown>[]).map((r, idx) => (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-[#F8F9FA]' : ''}>
                        <td className="px-4 py-3 text-sm text-[#0D2847]">{safeStr(r.plazaName, '—')}</td>
                        <td className="px-4 py-3 text-sm tabular-nums">{formatNumber(safeNum(r.txnCount, 0))}</td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-[#DC2626] tabular-nums">
                          {formatInrTwoDecimals(safeNum(r.totalDebit, 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {viewTab === 'by-month' && (
          <>
            {byMLoading ? (
              <div className="p-12 flex justify-center">
                <LoadingSpinner text="Loading months…" />
              </div>
            ) : !byMonthRaw?.length ? (
              <EmptyState message="No monthly aggregates yet" />
            ) : (
              <div className="p-4 space-y-6">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthChartSorted} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E0E8F0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#1A4A7A' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#1A4A7A' }} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip
                        formatter={(value) => [
                          formatInrTwoDecimals(safeNum(value, 0)),
                          'Debit',
                        ]}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #E0E8F0',
                          fontFamily: 'Rajdhani, sans-serif',
                        }}
                      />
                      <Bar dataKey="totalDebit" fill="#1565C0" radius={[4, 4, 0, 0]} name="Total debit" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Month</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">
                          Txn count
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">
                          Total debit (₹)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E8F0]">
                      {monthChartSorted.map((row, idx) => (
                        <tr key={row.label + String(idx)} className={idx % 2 === 1 ? 'bg-[#F8F9FA]' : ''}>
                          <td className="px-4 py-3 text-sm text-[#0D2847]">{row.label}</td>
                          <td className="px-4 py-3 text-sm">{formatNumber(row.txnCount)}</td>
                          <td className="px-4 py-3 text-sm font-mono font-semibold text-[#DC2626]">
                            {formatInrTwoDecimals(row.totalDebit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-[#E0E8F0] bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          className="w-full px-5 py-3 flex items-center justify-between gap-2 border-b border-[#E0E8F0] hover:bg-[#F8F9FA] transition-colors"
        >
          <span className="flex items-center gap-2 font-['Barlow_Condensed'] text-sm font-semibold uppercase tracking-wider text-[#1A4A7A]">
            <History className="w-4 h-4 text-[#1565C0]" />
            Import history
          </span>
          <ChevronDown
            className={`w-5 h-5 text-[#7A9AB8] transition-transform ${historyOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {historyOpen && (
          <div>
            {historyLoading ? (
              <div className="p-8 flex justify-center">
                <LoadingSpinner text="Loading history…" />
              </div>
            ) : !(historyRaw as unknown[])?.length ? (
              <p className="p-6 text-sm text-[#7A9AB8] font-['Rajdhani']">No imports yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-['Rajdhani']">
                  <thead>
                    <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Filename</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Period</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Imported</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Duplicates</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Uploaded</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E8F0]">
                    {(historyRaw as Record<string, unknown>[]).map((h) => {
                      const id = safeStr(h.id, '');
                      const uploaded = h.uploadedAt ?? h.createdAt;
                      const uploadedStr =
                        uploaded instanceof Date
                          ? uploaded.toLocaleString('en-IN')
                          : typeof uploaded === 'string'
                            ? new Date(uploaded).toLocaleString('en-IN')
                            : '—';
                      return (
                        <tr key={id} className="hover:bg-[#F8F9FA]">
                          <td className="px-4 py-2 font-mono text-xs text-[#0D2847] max-w-[200px] truncate">
                            {safeStr(h.fileName ?? h.file_name, '—')}
                          </td>
                          <td className="px-4 py-2 text-[#1A4A7A]">{safeStr(h.statementPeriod, '—')}</td>
                          <td className="px-4 py-2">{formatNumber(safeNum(h.importedRows ?? h.imported, 0))}</td>
                          <td className="px-4 py-2">{formatNumber(safeNum(h.duplicateRows ?? h.duplicates, 0))}</td>
                          <td className="px-4 py-2 text-xs text-[#7A9AB8]">{uploadedStr}</td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              disabled={deletingId === id}
                              onClick={() => void deleteBatch(id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                              aria-label="Delete batch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {importOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal>
          <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-['Oswald'] text-lg font-bold text-[#0D2847] tracking-wide uppercase">
                  Import toll data
                </h3>
                <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-1">Kotak FASTag statement (.xlsx only)</p>
              </div>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="p-2 rounded-lg hover:bg-[#F4F6F8] text-[#7A9AB8]"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setImportDrag(true);
              }}
              onDragLeave={() => setImportDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setImportDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void handleImport(f);
              }}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                importDrag ? 'border-[#1565C0] bg-[#1565C0]/5' : 'border-[#E0E8F0]'
              }`}
            >
              {importLoading ? (
                <div className="space-y-4">
                  <LoadingSpinner text="Uploading…" />
                  <div className="w-full h-2 bg-[#E0E8F0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1565C0] transition-all duration-300 rounded-full"
                      style={{ width: `${uploadPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#7A9AB8] font-['Rajdhani']">{uploadPct}%</p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="w-10 h-10 text-[#1565C0] mx-auto mb-3" />
                  <p className="font-['Barlow_Condensed'] text-sm uppercase tracking-wider text-[#1A4A7A] mb-2">
                    Drag &amp; drop .xlsx
                  </p>
                  <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm cursor-pointer hover:bg-[#0D2847] transition-colors">
                    <Upload className="w-4 h-4" />
                    Choose file
                    <input
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImport(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </>
              )}
            </div>
            {importResult && !importLoading && (
              <div className="rounded-lg border border-[#E0E8F0] bg-[#F8F9FA] p-4 font-['Rajdhani'] text-sm text-[#0D2847] space-y-1">
                <p className="font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Result</p>
                <p>Imported: {formatNumber(importResult.imported)}</p>
                <p>Duplicates: {formatNumber(importResult.duplicates)}</p>
                <p>Skipped: {formatNumber(importResult.skipped)}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="flex-1 min-w-[120px] py-2.5 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#F4F6F8]"
              >
                Close
              </button>
              <button
                type="button"
                disabled={importLoading}
                onClick={() => {
                  setImportResult(null);
                  setUploadPct(0);
                }}
                className="flex-1 min-w-[120px] py-2.5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847] disabled:opacity-50"
              >
                Import another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
