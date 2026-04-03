'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatBpclDate, formatInrTwoDecimals, formatNumber } from '@/lib/utils';
import { Fuel, IndianRupee, Gauge, ListOrdered, Search, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const LIMIT = 50;

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function normalizeTx(row: any) {
  const d = row.txnDate ?? row.date ?? row.transactionDate ?? row.createdAt;
  return {
    id: String(row.id ?? `${d}-${row.cardNumber}`),
    date: d,
    vehicle: String(row.vehicleReg ?? row.vehicleNumber ?? row.regNumber ?? row.vehicle?.regNumber ?? '—'),
    card: String(row.cardNumber ?? row.card ?? '—'),
    product: String(row.product ?? row.fuelType ?? '—'),
    litres: Number(row.litres ?? row.liters ?? row.quantity ?? 0),
    rate: Number(row.rate ?? row.ratePerLitre ?? row.ratePerLiter ?? 0),
    amount: Number(row.amount ?? row.totalAmount ?? 0),
    station: String(row.station ?? row.stationName ?? row.outlet ?? '—'),
    city: String(row.city ?? row.stationCity ?? '—'),
  };
}

function normalizeDashboard(d: any) {
  if (!d || typeof d !== 'object') return null;
  return {
    totalTransactions: Number(d.totalTransactions ?? d.total_txns ?? d.count ?? 0),
    totalLitres: Number(d.totalLitres ?? d.total_litres ?? d.totalLiters ?? 0),
    totalAmount: Number(d.totalAmount ?? d.total_amount ?? 0),
    avgRatePerLitre: Number(d.avgRatePerLitre ?? d.avg_rate_per_litre ?? d.avgRate ?? 0),
  };
}

const inputClass =
  'h-10 rounded-lg border border-[#E0E8F0] text-sm text-[#0D2847] px-3 font-["Rajdhani"] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20';

export default function BpclTransactionsPage() {
  const dr = defaultDateRange();
  const [draft, setDraft] = useState({
    tag: '',
    vehicleNumber: '',
    cardNumber: '',
    startDate: dr.start,
    endDate: dr.end,
    product: '',
  });
  const [applied, setApplied] = useState(draft);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

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
    if (applied.vehicleNumber.trim()) p.vehicleNumber = applied.vehicleNumber.trim();
    if (applied.cardNumber) p.cardNumber = applied.cardNumber;
    if (applied.startDate) p.startDate = applied.startDate;
    if (applied.endDate) p.endDate = applied.endDate;
    if (applied.product) p.product = applied.product;
    return p;
  }, [applied, page]);

  const dashParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (applied.startDate) p.startDate = applied.startDate;
    if (applied.endDate) p.endDate = applied.endDate;
    if (applied.tag) p.tag = applied.tag;
    if (applied.vehicleNumber.trim()) p.vehicleNumber = applied.vehicleNumber.trim();
    if (applied.cardNumber) p.cardNumber = applied.cardNumber;
    if (applied.product) p.product = applied.product;
    return p;
  }, [applied]);

  const { data: dashRes, isLoading: dashLoading } = useQuery({
    queryKey: ['bpcl-dashboard', dashParams],
    queryFn: async () => {
      const res = await api.get('/bpcl/dashboard', { params: dashParams });
      return normalizeDashboard(res.data?.data ?? res.data);
    },
  });

  const { data: txRes, isLoading: txLoading } = useQuery({
    queryKey: ['bpcl-transactions', txParams],
    queryFn: async () => {
      const res = await api.get('/bpcl/transactions', { params: txParams });
      const body = res.data?.data ?? res.data;
      const rows = Array.isArray(body) ? body : body?.data ?? body?.items ?? [];
      const total = Number(res.data?.total ?? body?.total ?? rows.length);
      const totalPages = Math.max(1, Math.ceil(total / LIMIT));
      return { rows: rows.map(normalizeTx), total, totalPages };
    },
  });

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
      const p: Record<string, string | number> = { ...txParams, page: 1, limit: 10000 };
      delete p.page;
      const res = await api.get('/bpcl/transactions', { params: { ...txParams, page: 1, limit: 10000 } });
      const body = res.data?.data ?? res.data;
      const raw = Array.isArray(body) ? body : body?.data ?? body?.items ?? [];
      const list = raw.map(normalizeTx).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const headers = ['Date', 'Vehicle', 'Card', 'Product', 'Litres', 'Rate', 'Amount', 'Station', 'City'];
      const csvRows = list.map((t) => [
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
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
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

  const total = txRes?.total ?? 0;
  const totalPages = txRes?.totalPages ?? 1;

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
        <div className="flex-1 min-w-[140px]">
          <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Vehicle number</label>
          <input
            className={`${inputClass} w-full min-w-[140px]`}
            placeholder="e.g. MH46BM7711"
            value={draft.vehicleNumber}
            onChange={(e) => setDraft((d) => ({ ...d, vehicleNumber: e.target.value }))}
          />
        </div>
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
        {dashLoading ? (
          <div className="col-span-full py-8 flex justify-center">
            <LoadingSpinner text="Loading summary…" />
          </div>
        ) : (
          <>
            <StatCard
              icon={ListOrdered}
              iconColor="blue"
              title="Total transactions"
              value={formatNumber(dashRes?.totalTransactions ?? total)}
            />
            <StatCard
              icon={Fuel}
              iconColor="cyan"
              title="Total litres"
              value={`${formatNumber(dashRes?.totalLitres ?? 0)} L`}
            />
            <StatCard
              icon={IndianRupee}
              iconColor="amber"
              title="Total amount"
              value={formatInrTwoDecimals(dashRes?.totalAmount ?? 0)}
            />
            <StatCard
              icon={Gauge}
              iconColor="green"
              title="Avg rate / litre"
              value={
                dashRes?.avgRatePerLitre != null && dashRes.avgRatePerLitre > 0
                  ? formatInrTwoDecimals(dashRes.avgRatePerLitre)
                  : '—'
              }
            />
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
                    <tr key={t.id} className={idx % 2 === 1 ? 'bg-[#F8F9FA]' : ''}>
                      <td className="px-4 py-3 text-sm font-['Rajdhani'] text-[#0D2847] whitespace-nowrap">
                        {formatBpclDate(t.date)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-[#0D2847]">{t.vehicle}</td>
                      <td className="px-4 py-3 text-sm font-mono text-[#1A4A7A]">{t.card}</td>
                      <td className="px-4 py-3 text-sm text-[#0D2847]">{t.product}</td>
                      <td className="px-4 py-3 text-sm font-mono tabular-nums">{formatNumber(t.litres)}</td>
                      <td className="px-4 py-3 text-sm font-mono tabular-nums">{formatInrTwoDecimals(t.rate)}</td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-[#16A34A] tabular-nums">
                        {formatInrTwoDecimals(t.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#0D2847] max-w-[160px] truncate">{t.station}</td>
                      <td className="px-4 py-3 text-sm text-[#7A9AB8]">{t.city}</td>
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
