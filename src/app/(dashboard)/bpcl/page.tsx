'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatBpclDate, formatInrTwoDecimals, formatNumber } from '@/lib/utils';
import { Fuel, IndianRupee, Gauge, ListOrdered, Search, Download, ChevronDown, X } from 'lucide-react';
import toast from 'react-hot-toast';

const LIMIT = 50;

/** Local calendar: first day of month, six months ago → today (YYYY-MM-DD). */
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

interface TxRow {
  id: string;
  date: string;
  vehicle: string;
  card: string;
  product: string;
  litres: number;
  rate: number;
  amount: number;
  station: string;
  city: string;
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

function renderLitres(n: number): string {
  return Number.isFinite(n) ? Number(n).toFixed(2) : '—';
}

function normalizeTx(row: any): TxRow {
  const d = row.txnDate ?? row.date ?? row.transactionDate ?? row.createdAt;
  const veh = row.vehicleReg ?? row.vehicleNumber ?? row.regNumber;
  const vehicle =
    veh != null
      ? safeStr(veh)
      : row.vehicle && typeof row.vehicle === 'object'
        ? safeStr((row.vehicle as Record<string, unknown>).regNumber ?? (row.vehicle as Record<string, unknown>).reg_number)
        : safeStr(row.vehicle);
  const idRaw = row.id ?? `${isoDateFrom(d)}-${safeStr(row.cardNumber, '')}`;
  return {
    id: safeStr(idRaw, `txn-${Math.random().toString(36).slice(2)}`),
    date: isoDateFrom(d),
    vehicle,
    card: safeStr(row.cardNumber ?? row.card),
    product: safeStr(row.product ?? row.fuelType),
    litres: safeNum(row.litres ?? row.liters ?? row.quantity),
    rate: safeNum(row.rate ?? row.ratePerLitre ?? row.ratePerLiter),
    amount: safeNum(row.amount ?? row.totalAmount),
    station: safeStr(row.station ?? row.stationName ?? row.outlet),
    city: safeStr(row.city ?? row.stationCity),
  };
}

/** Parse BPCL transactions list + totals + summary from various API shapes */
function parseBpclTransactionsPayload(resData: any) {
  const root = resData ?? {};
  const body = root.data !== undefined && root.data !== null ? root.data : root;
  const nestedRows = (body as Record<string, unknown>)?.data ?? (body as Record<string, unknown>)?.items;
  const rowsRaw: any[] = Array.isArray(body) ? body : Array.isArray(nestedRows) ? nestedRows : [];

  const nestedTotal =
    typeof body === 'object' && body && !Array.isArray(body)
      ? (body as Record<string, unknown>).total
      : undefined;
  const rawTotal = root.total ?? nestedTotal;
  const total = safeNum(rawTotal, rowsRaw.length);

  const summaryNested =
    typeof body === 'object' && body && !Array.isArray(body) ? (body as Record<string, unknown>).summary : undefined;
  const summaryRaw = root.summary ?? summaryNested ?? {};
  const s = (summaryRaw && typeof summaryRaw === 'object' ? summaryRaw : {}) as Record<string, unknown>;

  const totalTxns = safeNum(s.txnCount ?? s.txn_count ?? s.count, total);
  const totalLitres = safeNum(s.litres ?? s.totalLitres ?? s.total_litres, 0);
  const totalAmount = safeNum(s.amount ?? s.totalAmount ?? s.total_amount, 0);
  const avgFromSummary = safeNum(s.avgRate ?? s.avg_rate ?? s.avgRatePerLitre ?? s.avg_rate_per_litre, 0);
  const avgRate = totalLitres > 0 ? totalAmount / totalLitres : avgFromSummary;
  return { rowsRaw, total, totalTxns, totalLitres, totalAmount, avgRate };
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
              <label
                key={v}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[#F4F6F8] cursor-pointer"
              >
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

export default function BpclTransactionsPage() {
  const dr = defaultDateRange();
  const [draft, setDraft] = useState({
    tag: '',
    vehicleNumbers: [] as string[],
    cardNumber: '',
    startDate: dr.start,
    endDate: dr.end,
    product: '',
  });
  const [applied, setApplied] = useState(draft);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const { data: vehiclesRaw } = useQuery({
    queryKey: ['bpcl-page-vehicles'],
    queryFn: async () => {
      const res = await api.get('/vehicles', { params: { limit: 500, page: 1 } });
      const raw = res.data?.data ?? res.data;
      return Array.isArray(raw) ? raw : [];
    },
  });

  const { data: cardsRaw } = useQuery({
    queryKey: ['bpcl-cards-options'],
    queryFn: async () => {
      const res = await api.get('/bpcl/cards');
      const raw = res.data?.data ?? res.data;
      return Array.isArray(raw) ? raw : [];
    },
  });

  const cardOptions = useMemo(() => {
    const set = new Set<string>();
    (cardsRaw ?? []).forEach((c: any) => {
      const n = c.cardNumber ?? c.card_number;
      if (n) set.add(String(n));
    });
    return [...set].sort();
  }, [cardsRaw]);

  const txParams = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: LIMIT };
    if (applied.tag) p.tag = applied.tag;
    if (applied.vehicleNumbers.length > 0) p.vehicleNumber = applied.vehicleNumbers.join(',');
    if (applied.cardNumber) p.cardNumber = applied.cardNumber;
    if (applied.startDate) p.startDate = applied.startDate;
    if (applied.endDate) p.endDate = applied.endDate;
    if (applied.product) p.product = applied.product;
    return p;
  }, [applied, page]);

  const { data: txRes, isLoading: txLoading } = useQuery({
    queryKey: ['bpcl-transactions', txParams],
    queryFn: async () => {
      const res = await api.get('/bpcl/transactions', { params: txParams });
      const { rowsRaw, total, totalTxns, totalLitres, totalAmount, avgRate } = parseBpclTransactionsPayload(res.data);
      const totalPages = Math.max(1, Math.ceil(total / LIMIT));
      return {
        rows: rowsRaw.map(normalizeTx),
        total,
        totalPages,
        totalTxns,
        totalLitres,
        totalAmount,
        avgRate,
      };
    },
  });

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

  const rows = useMemo(() => {
    const list = txRes?.rows ?? [];
    return [...list].sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      return tb - ta;
    });
  }, [txRes?.rows]);

  const applySearch = () => {
    setApplied({ ...draft });
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get('/bpcl/transactions', { params: { ...txParams, page: 1, limit: 10000 } });
      const { rowsRaw: raw } = parseBpclTransactionsPayload(res.data);
      const list = raw.map(normalizeTx).sort((a: TxRow, b: TxRow) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const headers = ['Date', 'Vehicle', 'Card', 'Product', 'Litres', 'Rate', 'Amount', 'Station', 'City'];
      const csvRows = list.map((t: TxRow) => [
        formatBpclDate(t.date),
        t.vehicle,
        t.card,
        t.product,
        t.litres,
        t.rate,
        t.amount,
        t.station,
        t.city,
      ]);
      const csvContent = [headers, ...csvRows]
        .map((row: (string | number)[]) =>
          row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BPCL_Transactions_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export started');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const total = safeNum(txRes?.total, 0);
  const totalPages = safeNum(txRes?.totalPages, 1);
  const totalTxns = safeNum(txRes?.totalTxns, total);
  const totalLitres = safeNum(txRes?.totalLitres, 0);
  const totalAmount = safeNum(txRes?.totalAmount, 0);
  const avgRate = safeNum(txRes?.avgRate, 0);
  const avgRatePerL = totalLitres > 0 ? totalAmount / totalLitres : avgRate;
  const avgRateDisplay =
    avgRatePerL > 0
      ? `₹${avgRatePerL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/L`
      : '—';
  const litresDisplay =
    totalLitres > 0
      ? `${safeNum(totalLitres).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`
      : '0';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">BPCL Transactions</h2>
          <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">SmartFleet fuel transactions — filter by tag, vehicle, card, and period</p>
        </div>
        <button
          type="button"
          disabled={exporting || txLoading}
          onClick={() => void exportCsv()}
          className="inline-flex items-center gap-2 border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8] font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Tag</label>
          <select
            className={`${inputClass} w-36`}
            value={draft.tag}
            onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))}
          >
            <option value="">All</option>
            <option value="BUSINESS">Business</option>
            <option value="PERSONAL">Personal</option>
            <option value="IGNORE">Ignore</option>
          </select>
        </div>
        <VehicleMultiSelect
          id="bpcl-vehicle-multiselect"
          options={vehicleOptions}
          selected={draft.vehicleNumbers}
          onChange={(vehicleNumbers) => setDraft((d) => ({ ...d, vehicleNumbers }))}
        />
        <div>
          <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Card</label>
          <select
            className={`${inputClass} w-44`}
            value={draft.cardNumber}
            onChange={(e) => setDraft((d) => ({ ...d, cardNumber: e.target.value }))}
          >
            <option value="">All cards</option>
            {cardOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">From</label>
          <input
            type="date"
            className={inputClass}
            value={draft.startDate}
            onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">To</label>
          <input
            type="date"
            className={inputClass}
            value={draft.endDate}
            onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Product</label>
          <select
            className={`${inputClass} w-32`}
            value={draft.product}
            onChange={(e) => setDraft((d) => ({ ...d, product: e.target.value }))}
          >
            <option value="">All</option>
            <option value="DIESEL">Diesel</option>
            <option value="PETROL">Petrol</option>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {txLoading ? (
          <div className="col-span-full py-8 flex justify-center">
            <LoadingSpinner text="Loading summary…" />
          </div>
        ) : (
          <>
            <StatCard
              icon={ListOrdered}
              iconColor="blue"
              title="Total transactions"
              value={String(formatNumber(safeNum(totalTxns)))}
            />
            <StatCard icon={Fuel} iconColor="cyan" title="Total litres" value={String(litresDisplay)} />
            <StatCard
              icon={IndianRupee}
              iconColor="amber"
              title="Total amount"
              value={String(formatInrTwoDecimals(safeNum(totalAmount)))}
            />
            <StatCard icon={Gauge} iconColor="green" title="Avg rate" value={String(avgRateDisplay)} />
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden">
        {txLoading ? (
          <div className="p-12">
            <LoadingSpinner text="Loading transactions…" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="No transactions for these filters" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                    {['Date', 'Vehicle', 'Card', 'Product', 'Litres', 'Rate', 'Amount', 'Station', 'City'].map((h) => (
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
                  {rows.map((t, idx) => (
                    <tr key={String(t.id)} className={idx % 2 === 1 ? 'bg-[#F8F9FA]' : ''}>
                      <td className="px-4 py-3 text-sm font-['Rajdhani'] text-[#0D2847] whitespace-nowrap">
                        {renderTxnDate(t.date)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-[#0D2847]">{String(t.vehicle || '—')}</td>
                      <td className="px-4 py-3 text-sm font-mono text-[#1A4A7A]">{String(t.card || '—')}</td>
                      <td className="px-4 py-3 text-sm text-[#0D2847]">{String(t.product || '—')}</td>
                      <td className="px-4 py-3 text-sm font-mono tabular-nums">{renderLitres(safeNum(t.litres))}</td>
                      <td className="px-4 py-3 text-sm font-mono tabular-nums">
                        {String(formatInrTwoDecimals(safeNum(t.rate)))}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-[#16A34A] tabular-nums">
                        {String(formatInrTwoDecimals(safeNum(t.amount)))}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#0D2847] max-w-[160px] truncate">
                        {String(t.station || '—')}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#7A9AB8]">{String(t.city || '—')}</td>
                    </tr>
                  ))}
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
