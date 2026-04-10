'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import api from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatBpclDate, formatInrTwoDecimals, formatNumber } from '@/lib/utils';
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
} from 'lucide-react';
import toast from 'react-hot-toast';

const LIMIT = 50;

type ViewTab = 'transactions' | 'by-vehicle' | 'by-plaza' | 'by-month';
type TxnTypeFilter = '' | 'TOLL' | 'NON_FIN' | 'SD_DEBIT';
type SortKey = 'date' | 'type' | 'plaza' | 'debit' | 'balance';
type SortDir = 'asc' | 'desc';

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

function fmtYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Indian FY Apr–Mar: This FY = Apr 1 (start) through today or Mar 31 */
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
    default:
      return defaultDateRange();
  }
}

interface TollTxRow {
  id: string;
  date: string;
  type: string;
  plaza: string;
  debit: number;
  balance: number;
  vehicle: string;
}

function safeStr(v: unknown, fallback = '—'): string {
  if (v == null) return fallback;
  const t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean') return String(v);
  if (t === 'object') {
    if (Array.isArray(v)) {
      const parts = v.map((x) => safeStr(x, '')).filter(Boolean);
      return parts.length ? parts.join(', ') : fallback;
    }
    const o = v as Record<string, unknown>;
    if (o.regNumber != null) return safeStr(o.regNumber, fallback);
    if (o.reg_number != null) return safeStr(o.reg_number, fallback);
    return fallback;
  }
  return String(v);
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

function renderTxnDate(isoOrEmpty: string): string {
  if (!isoOrEmpty) return '—';
  const d = new Date(isoOrEmpty);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

function normalizeTollTx(row: Record<string, unknown>): TollTxRow {
  const d = row.txnDate ?? row.date ?? row.transactionDate ?? row.createdAt;
  const idRaw = row.id ?? `${isoDateFrom(d)}-${safeStr(row.plaza, '')}`;
  const typeRaw =
    row.txnType ?? row.type ?? row.transactionType ?? row.category ?? row.entryType ?? '';
  const veh = row.vehicleReg ?? row.vehicleNumber ?? row.regNumber ?? row.vehicle;
  const vehicle =
    veh != null
      ? safeStr(veh)
      : row.vehicle && typeof row.vehicle === 'object'
        ? safeStr((row.vehicle as Record<string, unknown>).regNumber ?? (row.vehicle as Record<string, unknown>).reg_number)
        : '';
  return {
    id: safeStr(idRaw, `txn-${Math.random().toString(36).slice(2)}`),
    date: isoDateFrom(d),
    type: safeStr(typeRaw),
    plaza: safeStr(row.plaza ?? row.plazaName ?? row.tollPlaza ?? row.station),
    debit: safeNum(row.debit ?? row.amount ?? row.debitAmount ?? row.totalDebit),
    balance: safeNum(row.balance ?? row.closingBalance ?? row.cardBalance),
    vehicle,
  };
}

function parseTollListPayload(resData: unknown) {
  const root = (resData ?? {}) as Record<string, unknown>;
  const body = root.data !== undefined && root.data !== null ? root.data : root;
  const nestedRows =
    typeof body === 'object' && body && !Array.isArray(body)
      ? ((body as Record<string, unknown>).data ?? (body as Record<string, unknown>).items)
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

function parseTollSummary(resData: unknown) {
  const root = (resData ?? {}) as Record<string, unknown>;
  const s =
    (root.summary as Record<string, unknown>) ??
    (typeof root.data === 'object' && root.data ? (root.data as Record<string, unknown>) : root);

  const thisMonthDebit = safeNum(
    s.thisMonthDebit ?? s.this_month_debit ?? s.monthDebit ?? s.monthlyDebit,
    0
  );
  const thisMonthTxnCount = safeNum(
    s.thisMonthTxnCount ?? s.this_month_txn_count ?? s.monthTxnCount ?? s.txnCountThisMonth,
    0
  );

  const topPlazaRaw = s.topPlaza ?? s.top_plaza;
  let topPlaza = '—';
  if (typeof topPlazaRaw === 'string') topPlaza = topPlazaRaw || '—';
  else if (topPlazaRaw && typeof topPlazaRaw === 'object') {
    const o = topPlazaRaw as Record<string, unknown>;
    topPlaza = safeStr(o.name ?? o.plaza ?? o.label ?? o.title, '—');
  }

  const vehRaw = s.highestSpendVehicle ?? s.highest_spend_vehicle ?? s.topVehicle;
  let highestVehicle = '—';
  let highestVehicleDebit: number | undefined;
  if (typeof vehRaw === 'string') highestVehicle = vehRaw || '—';
  else if (vehRaw && typeof vehRaw === 'object') {
    const o = vehRaw as Record<string, unknown>;
    highestVehicle = safeStr(o.regNumber ?? o.vehicle ?? o.vehicleNumber ?? o.reg_number, '—');
    highestVehicleDebit = safeNum(o.totalDebit ?? o.debit ?? o.amount, NaN);
    if (!Number.isFinite(highestVehicleDebit)) highestVehicleDebit = undefined;
  }

  return { thisMonthDebit, thisMonthTxnCount, topPlaza, highestVehicle, highestVehicleDebit };
}

interface AggRow {
  key: string;
  label: string;
  txnCount: number;
  totalDebit: number;
}

function parseAggRows(resData: unknown, mode: 'vehicle' | 'plaza' | 'month'): AggRow[] {
  const raw = parseTollListPayload(resData).rowsRaw;
  return raw.map((r, i) => {
    const row = r as Record<string, unknown>;
    if (mode === 'vehicle') {
      const label = safeStr(
        row.vehicle ?? row.vehicleNumber ?? row.regNumber ?? row.vehicleReg ?? row.label,
        '—'
      );
      return {
        key: `${label}-${i}`,
        label,
        txnCount: safeNum(row.txnCount ?? row.count ?? row.txns, 0),
        totalDebit: safeNum(row.totalDebit ?? row.debit ?? row.amount, 0),
      };
    }
    if (mode === 'plaza') {
      const label = safeStr(row.plaza ?? row.plazaName ?? row.name ?? row.label, '—');
      return {
        key: `${label}-${i}`,
        label,
        txnCount: safeNum(row.txnCount ?? row.count ?? row.txns, 0),
        totalDebit: safeNum(row.totalDebit ?? row.debit ?? row.amount, 0),
      };
    }
    const ym = safeStr(row.month ?? row.yearMonth ?? row.period ?? row.label, '—');
    return {
      key: `${ym}-${i}`,
      label: ym,
      txnCount: safeNum(row.txnCount ?? row.count ?? row.txns, 0),
      totalDebit: safeNum(row.totalDebit ?? row.debit ?? row.amount, 0),
    };
  });
}

interface ImportHistoryBatch {
  id: string;
  importBatchId: string;
  createdAt?: string;
  count: number;
  txnMin?: string;
  txnMax?: string;
  totalDebit?: number;
}

function historyIso(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v.toISOString();
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString();
  return undefined;
}

function parseImportHistoryResponse(resData: unknown): unknown[] {
  if (Array.isArray(resData)) return resData;
  if (resData && typeof resData === 'object') {
    const o = resData as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.items)) return o.items;
  }
  return [];
}

function normalizeImportHistoryBatch(b: Record<string, unknown>): ImportHistoryBatch {
  const sum = (b._sum as Record<string, unknown>) ?? {};
  const min = (b._min as Record<string, unknown>) ?? {};
  const max = (b._max as Record<string, unknown>) ?? {};
  const isGroupBy =
    b.importBatchId != null ||
    b._count != null ||
    b._sum != null ||
    b._min != null ||
    b._max != null;

  if (isGroupBy) {
    const importBatchId = String(b.importBatchId ?? b.import_batch_id ?? '');
    const id = importBatchId || String(b.id ?? Math.random());
    let count = 0;
    if (typeof b._count === 'number') count = b._count;
    else if (b._count && typeof b._count === 'object') {
      const c = b._count as Record<string, unknown>;
      count = Number(c._all ?? c.id ?? Object.values(c)[0] ?? 0);
    }
    const rawD = sum.totalDebit ?? sum.total_debit ?? sum.debit;
    let totalDebit: number | undefined;
    if (rawD != null && rawD !== '') {
      const n = Number(rawD);
      if (Number.isFinite(n)) totalDebit = n;
    }
    return {
      id,
      importBatchId: importBatchId || id,
      createdAt: historyIso(min.createdAt ?? min.created_at),
      count: Number.isFinite(count) ? count : 0,
      txnMin: historyIso(min.txnDate ?? min.txn_date ?? min.date),
      txnMax: historyIso(max.txnDate ?? max.txn_date ?? max.date),
      totalDebit,
    };
  }

  return {
    id: String(b.id ?? b.importBatchId ?? Math.random()),
    importBatchId: String(b.importBatchId ?? b.fileName ?? b.file_name ?? b.id ?? '—'),
    createdAt: historyIso(b.createdAt ?? b.created_at ?? b.importedAt),
    count: Number(b.imported ?? b.recordsImported ?? b.count ?? b._count ?? 0),
    txnMin: undefined,
    txnMax: undefined,
    totalDebit: undefined,
  };
}

function normalizeTollImportResult(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  return {
    imported: Number(o.imported ?? o.importedCount ?? 0),
    duplicates: Number(o.duplicates ?? o.duplicatesSkipped ?? o.duplicates_skipped ?? 0),
    skipped: Number(o.skipped ?? o.skippedCount ?? 0),
  };
}

const inputClass =
  'h-10 rounded-lg border border-[#E0E8F0] text-sm text-[#0D2847] px-3 font-["Rajdhani"] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20';

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

function sortRows(list: TollTxRow[], sortBy: SortKey, sortDir: SortDir): TollTxRow[] {
  const mul = sortDir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    if (sortBy === 'date') {
      return (new Date(a.date).getTime() - new Date(b.date).getTime()) * mul;
    }
    if (sortBy === 'debit' || sortBy === 'balance') {
      return (a[sortBy] - b[sortBy]) * mul;
    }
    return String(a[sortBy]).localeCompare(String(b[sortBy]), undefined, { sensitivity: 'base' }) * mul;
  });
}

export default function TollPage() {
  const qc = useQueryClient();
  const dr = defaultDateRange();
  const [draft, setDraft] = useState({
    vehicleNumbers: [] as string[],
    plazaSearch: '',
    txnType: '' as TxnTypeFilter,
    startDate: dr.start,
    endDate: dr.end,
  });
  const [applied, setApplied] = useState(draft);
  const [viewTab, setViewTab] = useState<ViewTab>('transactions');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importDrag, setImportDrag] = useState(false);
  const [importResult, setImportResult] = useState<ReturnType<typeof normalizeTollImportResult>>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filterParams = useMemo(() => {
    const p: Record<string, string | number> = {};
    if (applied.vehicleNumbers.length > 0) p.vehicleNumber = applied.vehicleNumbers.join(',');
    if (applied.plazaSearch.trim()) p.plaza = applied.plazaSearch.trim();
    if (applied.txnType) p.txnType = applied.txnType;
    if (applied.startDate) p.startDate = applied.startDate;
    if (applied.endDate) p.endDate = applied.endDate;
    return p;
  }, [applied]);

  const txParams = useMemo(() => {
    return {
      ...filterParams,
      page,
      limit: LIMIT,
      sortBy,
      sortDir,
    };
  }, [filterParams, page, sortBy, sortDir]);

  const { data: vehiclesRaw } = useQuery({
    queryKey: ['toll-page-vehicles'],
    queryFn: async () => {
      const res = await api.get('/vehicles', { params: { limit: 500, page: 1 } });
      const raw = res.data?.data ?? res.data;
      return Array.isArray(raw) ? raw : [];
    },
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['toll-summary'],
    queryFn: async () => {
      try {
        const res = await api.get('/toll/summary');
        return parseTollSummary(res.data);
      } catch {
        return parseTollSummary({});
      }
    },
  });

  const { data: txRes, isLoading: txLoading } = useQuery({
    queryKey: ['toll-transactions', txParams],
    enabled: viewTab === 'transactions',
    queryFn: async () => {
      const res = await api.get('/toll/transactions', { params: txParams });
      const { rowsRaw, total } = parseTollListPayload(res.data);
      const rows = rowsRaw.map((r) => normalizeTollTx(r));
      const totalPages = Math.max(1, Math.ceil(total / LIMIT));
      return { rows, total, totalPages };
    },
  });

  const aggParams = useMemo(() => ({ ...filterParams, page: 1, limit: 5000 }), [filterParams]);

  const { data: byVehicleData, isLoading: byVLoading } = useQuery({
    queryKey: ['toll-by-vehicle', aggParams],
    enabled: viewTab === 'by-vehicle',
    queryFn: async () => {
      const res = await api.get('/toll/by-vehicle', { params: aggParams });
      return parseAggRows(res.data, 'vehicle');
    },
  });

  const { data: byPlazaData, isLoading: byPLoading } = useQuery({
    queryKey: ['toll-by-plaza', aggParams],
    enabled: viewTab === 'by-plaza',
    queryFn: async () => {
      const res = await api.get('/toll/by-plaza', { params: aggParams });
      return parseAggRows(res.data, 'plaza');
    },
  });

  const { data: byMonthData, isLoading: byMLoading } = useQuery({
    queryKey: ['toll-by-month', aggParams],
    enabled: viewTab === 'by-month',
    queryFn: async () => {
      const res = await api.get('/toll/by-month', { params: aggParams });
      return parseAggRows(res.data, 'month');
    },
  });

  const { data: historyRaw, isLoading: historyLoading } = useQuery({
    queryKey: ['toll-import-history'],
    queryFn: async () => {
      const res = await api.get('/toll/import-history');
      return parseImportHistoryResponse(res.data);
    },
  });

  const history: ImportHistoryBatch[] = (historyRaw ?? []).map((h) =>
    normalizeImportHistoryBatch((h ?? {}) as Record<string, unknown>)
  );

  const vehicleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of vehiclesRaw ?? []) {
      const r = (row as Record<string, unknown>).regNumber ?? (row as Record<string, unknown>).registrationNumber;
      if (r != null && String(r).trim()) set.add(String(r).trim());
    }
    for (const t of txRes?.rows ?? []) {
      const v = String(t.vehicle ?? '').trim();
      if (v && v !== '—') set.add(v);
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
  }, [vehiclesRaw, txRes?.rows]);

  const rowsSorted = useMemo(() => {
    const list = txRes?.rows ?? [];
    return sortRows(list, sortBy, sortDir);
  }, [txRes?.rows, sortBy, sortDir]);

  const total = safeNum(txRes?.total, 0);
  const totalPages = safeNum(txRes?.totalPages, 1);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir(key === 'date' || key === 'debit' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const applySearch = () => {
    setApplied({ ...draft });
    setPage(1);
  };

  const applyQuickPreset = (preset: string) => {
    const r = dateRangeForPreset(preset);
    setDraft((d) => ({ ...d, startDate: r.start, endDate: r.end }));
  };

  const handleUpload = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Please choose an Excel (.xlsx) file');
      return;
    }
    setImportLoading(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/toll/import', formData, { timeout: 120000 });
      const norm = normalizeTollImportResult(res.data);
      setImportResult(norm);
      qc.invalidateQueries({ queryKey: ['toll-import-history'] });
      qc.invalidateQueries({ queryKey: ['toll-summary'] });
      qc.invalidateQueries({ queryKey: ['toll-transactions'] });
      qc.invalidateQueries({ queryKey: ['toll-by-vehicle'] });
      qc.invalidateQueries({ queryKey: ['toll-by-plaza'] });
      qc.invalidateQueries({ queryKey: ['toll-by-month'] });
      toast.success('Import complete');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: unknown } | string } };
      const msg = e?.response?.data;
      const text =
        typeof msg === 'object' && msg && 'message' in msg && typeof (msg as { message: string }).message === 'string'
          ? (msg as { message: string }).message
          : typeof msg === 'string'
            ? msg
            : 'Import failed';
      toast.error(text);
    } finally {
      setImportLoading(false);
    }
  };

  const deleteBatch = async (batch: ImportHistoryBatch) => {
    const id = batch.importBatchId || batch.id;
    if (!id) return;
    setDeletingId(id);
    try {
      await api.delete(`/toll/import-history/${encodeURIComponent(id)}`);
      toast.success('Batch removed');
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
      const params = { ...filterParams, page: 1, limit: 100000, sortBy, sortDir };
      if (viewTab === 'transactions') {
        const res = await api.get('/toll/transactions', { params });
        const { rowsRaw } = parseTollListPayload(res.data);
        const list = rowsRaw.map((r) => normalizeTollTx(r as Record<string, unknown>));
        const sorted = sortRows(list, sortBy, sortDir);
        const ws = XLSX.utils.aoa_to_sheet([
          ['Date', 'Type', 'Plaza', 'Debit', 'Balance'],
          ...sorted.map((t) => [
            formatBpclDate(t.date),
            t.type,
            t.plaza,
            t.debit,
            t.balance,
          ]),
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
        XLSX.writeFile(wb, `Toll_Transactions_${new Date().toISOString().slice(0, 10)}.xlsx`);
      } else if (viewTab === 'by-vehicle') {
        const res = await api.get('/toll/by-vehicle', { params: aggParams });
        const rows = parseAggRows(res.data, 'vehicle');
        const ws = XLSX.utils.aoa_to_sheet([
          ['Vehicle', 'Txn count', 'Total debit'],
          ...rows.map((r) => [r.label, r.txnCount, r.totalDebit]),
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'By vehicle');
        XLSX.writeFile(wb, `Toll_By_Vehicle_${new Date().toISOString().slice(0, 10)}.xlsx`);
      } else if (viewTab === 'by-plaza') {
        const res = await api.get('/toll/by-plaza', { params: aggParams });
        const rows = parseAggRows(res.data, 'plaza');
        const ws = XLSX.utils.aoa_to_sheet([
          ['Plaza', 'Txn count', 'Total debit'],
          ...rows.map((r) => [r.label, r.txnCount, r.totalDebit]),
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'By plaza');
        XLSX.writeFile(wb, `Toll_By_Plaza_${new Date().toISOString().slice(0, 10)}.xlsx`);
      } else {
        const res = await api.get('/toll/by-month', { params: aggParams });
        const rows = parseAggRows(res.data, 'month');
        const ws = XLSX.utils.aoa_to_sheet([
          ['Month', 'Txn count', 'Total debit'],
          ...rows.map((r) => [r.label, r.txnCount, r.totalDebit]),
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

  const summary = summaryData ?? {
    thisMonthDebit: 0,
    thisMonthTxnCount: 0,
    topPlaza: '—',
    highestVehicle: '—',
    highestVehicleDebit: undefined as number | undefined,
  };

  const tabLoading =
    viewTab === 'transactions'
      ? txLoading
      : viewTab === 'by-vehicle'
        ? byVLoading
        : viewTab === 'by-plaza'
          ? byPLoading
          : byMLoading;

  const SortHead = ({ k, children }: { k: SortKey; children: ReactNode }) => (
    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] whitespace-nowrap">
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-[#1565C0]"
      >
        {children}
        {sortBy === k ? (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : null}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Toll</h2>
          <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">
            FASTag and toll debits — filter by vehicle, plaza, type, and period
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setImportOpen(true);
              setImportResult(null);
            }}
            className="inline-flex items-center gap-2 border border-[#E0E8F0] bg-white text-[#0D2847] hover:bg-[#F4F6F8] font-medium px-4 py-2.5 rounded-lg transition-colors font-['Barlow_Condensed'] uppercase tracking-wider text-sm"
          >
            <Upload className="w-4 h-4" /> Import
          </button>
          <button
            type="button"
            disabled={exporting || tabLoading}
            onClick={() => void exportExcel()}
            className="inline-flex items-center gap-2 border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8] font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
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
        <div className="flex-1 min-w-[160px]">
          <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">
            Plaza search
          </label>
          <input
            type="search"
            placeholder="Search plaza…"
            className={`${inputClass} w-full`}
            value={draft.plazaSearch}
            onChange={(e) => setDraft((d) => ({ ...d, plazaSearch: e.target.value }))}
          />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">
            Type
          </label>
          <select
            className={`${inputClass} min-w-[140px]`}
            value={draft.txnType}
            onChange={(e) => setDraft((d) => ({ ...d, txnType: e.target.value as TxnTypeFilter }))}
          >
            <option value="">All</option>
            <option value="TOLL">Toll</option>
            <option value="NON_FIN">Non-fin</option>
            <option value="SD_DEBIT">SD-Debit</option>
          </select>
        </div>
        <button
          type="button"
          onClick={applySearch}
          className="h-10 inline-flex items-center gap-2 px-5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847]"
        >
          <Search className="w-4 h-4" /> Search
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#7A9AB8]">
          Quick presets
        </span>
        {(
          [
            ['today', 'Today'],
            ['this-week', 'This Week'],
            ['this-month', 'This Month'],
            ['last-month', 'Last Month'],
            ['this-fy', 'This FY'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => applyQuickPreset(key)}
            className="px-3 py-1.5 rounded-lg border border-[#E0E8F0] text-xs font-['Rajdhani'] text-[#1A4A7A] hover:bg-[#E3F2FD] hover:border-[#1565C0]/40 transition-colors"
          >
            {label}
          </button>
        ))}
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
              title="This month debit"
              value={String(formatInrTwoDecimals(safeNum(summary.thisMonthDebit)))}
            />
            <StatCard
              icon={ListOrdered}
              iconColor="blue"
              title="This month txn count"
              value={String(formatNumber(safeNum(summary.thisMonthTxnCount)))}
            />
            <StatCard icon={MapPin} iconColor="cyan" title="Top plaza" value={String(summary.topPlaza)} />
            <StatCard
              icon={Truck}
              iconColor="green"
              title="Highest spend vehicle"
              value={String(summary.highestVehicle)}
              subtitle={
                summary.highestVehicleDebit != null && Number.isFinite(summary.highestVehicleDebit)
                  ? formatInrTwoDecimals(summary.highestVehicleDebit)
                  : undefined
              }
            />
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
          <ChevronDown className={`w-5 h-5 text-[#7A9AB8] transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
        </button>
        {historyOpen && (
          <div className="p-0">
            {historyLoading ? (
              <div className="p-8">
                <LoadingSpinner text="Loading history…" />
              </div>
            ) : history.length === 0 ? (
              <p className="p-6 text-sm text-[#7A9AB8] font-['Rajdhani']">No previous imports yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-['Rajdhani']">
                  <thead>
                    <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Batch</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Imported</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Period</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Total debit</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E8F0]">
                    {history.map((h) => (
                      <tr key={h.id} className="hover:bg-[#F8F9FA]">
                        <td className="px-4 py-2 font-mono text-[#0D2847]">{h.importBatchId || '—'}</td>
                        <td className="px-4 py-2 text-[#1A4A7A]">
                          {h.createdAt
                            ? new Date(h.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                          <span className="text-[#7A9AB8] ml-2">{formatNumber(h.count)} rows</span>
                        </td>
                        <td className="px-4 py-2 text-xs text-[#7A9AB8]">
                          {h.txnMin || h.txnMax
                            ? `${h.txnMin ? renderTxnDate(h.txnMin) : '—'} — ${h.txnMax ? renderTxnDate(h.txnMax) : '—'}`
                            : '—'}
                        </td>
                        <td className="px-4 py-2 font-semibold text-[#0D2847]">
                          {h.totalDebit != null && Number.isFinite(h.totalDebit)
                            ? formatInrTwoDecimals(h.totalDebit)
                            : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            disabled={deletingId === (h.importBatchId || h.id)}
                            onClick={() => void deleteBatch(h)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                            aria-label="Delete batch"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="sr-only">Delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
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

      <div className="bg-white rounded-xl rounded-tl-none border border-[#E0E8F0] border-t-0 shadow-sm overflow-hidden -mt-px">
        {viewTab === 'transactions' && (
          <>
            {txLoading ? (
              <div className="p-12">
                <LoadingSpinner text="Loading transactions…" />
              </div>
            ) : rowsSorted.length === 0 ? (
              <EmptyState message="No toll transactions for these filters" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                        <SortHead k="date">Date</SortHead>
                        <SortHead k="type">Type</SortHead>
                        <SortHead k="plaza">Plaza</SortHead>
                        <SortHead k="debit">Debit</SortHead>
                        <SortHead k="balance">Balance</SortHead>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E8F0]">
                      {rowsSorted.map((t, idx) => (
                        <tr key={String(t.id)} className={idx % 2 === 1 ? 'bg-[#F8F9FA]' : ''}>
                          <td className="px-4 py-3 text-sm font-['Rajdhani'] text-[#0D2847] whitespace-nowrap">
                            {renderTxnDate(t.date)}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#0D2847]">{String(t.type || '—')}</td>
                          <td className="px-4 py-3 text-sm text-[#0D2847] max-w-[200px] truncate">{String(t.plaza || '—')}</td>
                          <td className="px-4 py-3 text-sm font-mono font-semibold text-[#DC2626] tabular-nums">
                            {formatInrTwoDecimals(safeNum(t.debit))}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono tabular-nums text-[#1A4A7A]">
                            {formatInrTwoDecimals(safeNum(t.balance))}
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
          <AggTable
            loading={byVLoading}
            rows={byVehicleData ?? []}
            cols={['Vehicle', 'Txn count', 'Total debit']}
            empty="No vehicle aggregates for these filters"
          />
        )}
        {viewTab === 'by-plaza' && (
          <AggTable
            loading={byPLoading}
            rows={byPlazaData ?? []}
            cols={['Plaza', 'Txn count', 'Total debit']}
            empty="No plaza aggregates for these filters"
          />
        )}
        {viewTab === 'by-month' && (
          <AggTable
            loading={byMLoading}
            rows={byMonthData ?? []}
            cols={['Month', 'Txn count', 'Total debit']}
            empty="No monthly aggregates for these filters"
          />
        )}
      </div>

      {importOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal>
          <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-['Oswald'] text-lg font-bold text-[#0D2847] tracking-wide uppercase">Import toll data</h3>
                <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-1">Upload FASTag Excel export (.xlsx)</p>
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
                if (f) void handleUpload(f);
              }}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                importDrag ? 'border-[#1565C0] bg-[#1565C0]/5' : 'border-[#E0E8F0]'
              }`}
            >
              {importLoading ? (
                <LoadingSpinner text="Processing file…" />
              ) : (
                <>
                  <FileSpreadsheet className="w-10 h-10 text-[#1565C0] mx-auto mb-3" />
                  <p className="font-['Barlow_Condensed'] text-sm uppercase tracking-wider text-[#1A4A7A] mb-2">
                    Drag & drop .xlsx
                  </p>
                  <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm cursor-pointer hover:bg-[#0D2847] transition-colors">
                    <Upload className="w-4 h-4" />
                    Choose file
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUpload(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </>
              )}
            </div>
            {importResult && (
              <div className="rounded-lg border border-[#E0E8F0] bg-[#F8F9FA] p-4 font-['Rajdhani'] text-sm text-[#0D2847] space-y-1">
                <p className="font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Result</p>
                <p>Imported: {formatNumber(importResult.imported)}</p>
                <p>Duplicates: {formatNumber(importResult.duplicates)}</p>
                <p>Skipped: {formatNumber(importResult.skipped)}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="w-full py-2.5 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#F4F6F8]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AggTable({
  loading,
  rows,
  cols,
  empty,
}: {
  loading: boolean;
  rows: AggRow[];
  cols: [string, string, string];
  empty: string;
}) {
  if (loading) {
    return (
      <div className="p-12">
        <LoadingSpinner text="Loading…" />
      </div>
    );
  }
  if (rows.length === 0) return <EmptyState message={empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
            {cols.map((h) => (
              <th
                key={h}
                className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E0E8F0]">
          {rows.map((r, idx) => (
            <tr key={r.key} className={idx % 2 === 1 ? 'bg-[#F8F9FA]' : ''}>
              <td className="px-4 py-3 text-sm font-mono text-[#0D2847]">{r.label}</td>
              <td className="px-4 py-3 text-sm tabular-nums">{formatNumber(r.txnCount)}</td>
              <td className="px-4 py-3 text-sm font-mono font-semibold text-[#DC2626] tabular-nums">
                {formatInrTwoDecimals(r.totalDebit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
