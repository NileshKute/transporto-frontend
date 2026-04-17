'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { quotationsApi } from '@/lib/api/quotations';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Pagination } from '@/components/ui/Pagination';
import { StatCard } from '@/components/ui/StatCard';
import { formatIndianCurrency } from '@/lib/utils';
import { displayText, toArray } from '@/lib/displayText';
import {
  normalizeQuotationsList,
  type QuotationListItem,
} from '@/lib/quotations/normalize';
import { STATUS_BADGE_CLASSES, VEHICLE_QUOTE_TYPE_OPTIONS } from '@/lib/quotations/constants';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Download,
  Trash2,
  FileText,
  TrendingUp,
  Percent,
  IndianRupee,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { format } from 'date-fns';

function formatQuoteListDate(
  quoteDate: string | undefined,
  createdAt: string | undefined,
): { text: string; isEstimated: boolean } {
  if (quoteDate?.trim()) {
    const d = new Date(quoteDate);
    if (!Number.isNaN(d.getTime())) {
      return { text: format(d, 'dd MMM yyyy'), isEstimated: false };
    }
  }
  if (createdAt?.trim()) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) {
      return { text: format(d, 'dd MMM yyyy'), isEstimated: true };
    }
  }
  return { text: '—', isEstimated: false };
}

const STATUS_FILTER = [
  'All',
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED_TO_INVOICE',
] as const;

const LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;

type ClientOpt = { id: string; name: string };

function normalizeClientOpt(raw: unknown): ClientOpt | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : '';
  if (!id) return null;
  return { id, name: displayText(r.name, 'Client') };
}

function safeQuoteDate(iso: string): Date | null {
  if (!iso || typeof iso !== 'string') return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function vehicleLabel(type: string, other?: string): string {
  if (!type) return '—';
  if (type === 'OTHER' && other) return other;
  const o = VEHICLE_QUOTE_TYPE_OPTIONS.find((x) => x.value === type);
  return o?.label ?? type.replace(/_/g, ' ');
}

export default function QuotationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [clientFilter, setClientFilter] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearchQuery((prev) => {
        if (prev !== trimmed) setPage(1);
        return trimmed;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data: listPayload, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['quotations-list', searchQuery],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 500 };
      if (searchQuery) params.search = searchQuery;
      const res = await quotationsApi.list(params);
      return res.data;
    },
  });

  const items = useMemo(() => normalizeQuotationsList(listPayload), [listPayload]);

  const { data: clientsRaw = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      try {
        const res = await api.get('/clients');
        return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      } catch {
        return [];
      }
    },
  });

  const clients = useMemo(
    () => toArray<unknown>(clientsRaw).map(normalizeClientOpt).filter((c): c is ClientOpt => c != null),
    [clientsRaw]
  );

  const filtered = useMemo(() => {
    let list = [...items];
    if (statusFilter !== 'All') list = list.filter((q) => q.status === statusFilter);
    if (clientFilter) list = list.filter((q) => q.clientId === clientFilter);
    if (vehicleTypeFilter) list = list.filter((q) => q.vehicleType === vehicleTypeFilter);
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter((q) => {
        const d = safeQuoteDate(q.quoteDate);
        return d != null && d >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((q) => {
        const d = safeQuoteDate(q.quoteDate);
        return d != null && d <= to;
      });
    }
    return list;
  }, [items, statusFilter, clientFilter, vehicleTypeFilter, dateFrom, dateTo, clients]);

  const { data: statsRemote } = useQuery({
    queryKey: ['quotations-stats'],
    queryFn: async () => {
      try {
        const res = await quotationsApi.getStats();
        return res.data?.data ?? res.data;
      } catch {
        return null;
      }
    },
  });

  const stats = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    if (statsRemote && typeof statsRemote === 'object') {
      const s = statsRemote as Record<string, unknown>;
      return {
        total: Number(s.totalQuotes ?? s.total ?? items.length) || items.length,
        thisMonth: Number(s.thisMonth ?? s.this_month ?? 0),
        conversionRate: Number(s.conversionRate ?? s.conversion_rate ?? 0),
        totalValue: Number(s.totalValue ?? s.total_value ?? 0),
      };
    }
    let thisMonth = 0;
    let totalValue = 0;
    let converted = 0;
    items.forEach((row) => {
      totalValue += row.monthlyRate || 0;
      const d = safeQuoteDate(row.quoteDate);
      if (d && d.getMonth() === m && d.getFullYear() === y) thisMonth += 1;
      if (row.status === 'CONVERTED_TO_INVOICE') converted += 1;
    });
    const conversionRate = items.length ? Math.round((converted / items.length) * 1000) / 10 : 0;
    return {
      total: items.length,
      thisMonth,
      conversionRate,
      totalValue,
    };
  }, [statsRemote, items]);

  const totalForPagination = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalForPagination / LIMIT));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * LIMIT;
    return filtered.slice(start, start + LIMIT);
  }, [filtered, currentPage]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quotationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations-list'] });
      qc.invalidateQueries({ queryKey: ['quotations-stats'] });
      toast.success('Quotation deleted');
      setDeleteId(null);
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? displayText((e as { response?: { data?: { message?: unknown } } }).response?.data?.message, '')
          : '';
      toast.error(msg || 'Delete failed');
    },
  });

  const downloadPdf = async (id: string) => {
    try {
      const res = await quotationsApi.downloadPdf(id);
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  const listErrorMessage =
    error && typeof error === 'object' && 'response' in error
      ? displayText((error as { response?: { data?: { message?: unknown } } }).response?.data?.message, '')
      : '';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Quotations</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/quotations/new"
            className="inline-flex items-center justify-center gap-2 bg-[#1565C0] hover:bg-[#0D2847] text-white font-['Barlow_Condensed'] font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> New quotation
          </Link>
          <Link
            href="/quotations/import"
            className="inline-flex items-center justify-center gap-2 border-2 border-[#42A5F5] text-[#42A5F5] hover:bg-[#42A5F5]/10 font-['Barlow_Condensed'] font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg transition-colors"
          >
            Import
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={FileText} iconColor="blue" title="Total quotes" value={stats.total} />
        <StatCard icon={TrendingUp} iconColor="green" title="This month" value={stats.thisMonth} />
        <StatCard icon={Percent} iconColor="purple" title="Conversion rate" value={`${stats.conversionRate}%`} />
        <StatCard icon={IndianRupee} iconColor="amber" title="Total value" value={formatIndianCurrency(stats.totalValue)} />
      </div>

      <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm font-['Rajdhani'] text-[#0D2847] focus:border-[#42A5F5] min-w-[140px]"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_FILTER.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All statuses' : s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm font-['Rajdhani'] text-[#0D2847] focus:border-[#42A5F5] min-w-[160px]"
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm font-['Rajdhani'] text-[#0D2847] focus:border-[#42A5F5] min-w-[160px]"
            value={vehicleTypeFilter}
            onChange={(e) => {
              setVehicleTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All vehicle types</option>
            {VEHICLE_QUOTE_TYPE_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm font-['Rajdhani'] text-[#0D2847]"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
          <input
            type="date"
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm font-['Rajdhani'] text-[#0D2847]"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
          <div className="flex-1 min-w-[200px] w-full sm:w-auto">
            <div className="relative">
              {!searchInput && (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              )}
              <input
                type="text"
                placeholder="Search quote no, client, attn, subject, terms, content..."
                className={`w-full ${searchInput ? 'pl-4' : 'pl-11'} pr-4 py-3 rounded-lg border border-[#E0E8F0] text-sm font-['Rajdhani'] text-[#0D2847] outline-none focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/30`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setSearchQuery(searchInput.trim());
                    setPage(1);
                  }
                }}
                aria-describedby="quotations-search-hint"
              />
            </div>
            <p id="quotations-search-hint" className="text-xs text-gray-500 mt-1 font-['Rajdhani']">
              Searches across quote number, client name, attn person, subject, terms, notes, and raw text
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <LoadingSpinner text="Loading quotations…" />
        ) : isError ? (
          <div className="p-8 text-center space-y-3">
            <p className="font-['Oswald'] text-[#0D2847]">Could not load quotations</p>
            <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">{listErrorMessage || 'Is the quotations API deployed?'}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847]"
            >
              Retry
            </button>
          </div>
        ) : !filtered.length ? (
          <EmptyState
            message="No quotations yet"
            description="Create a quotation or import historical data."
            action={{ label: 'New quotation', onClick: () => { window.location.href = '/quotations/new'; } }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Quote no</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Date</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Client</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Vehicle</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Monthly rate</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Status</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E8F0]">
                {paged.map((row: QuotationListItem) => {
                  const clientName = row.client?.name ?? clients.find((c) => c.id === row.clientId)?.name ?? '—';
                  const { text: dateStr, isEstimated } = formatQuoteListDate(row.quoteDate, row.createdAt);
                  const st = displayText(row.status, 'DRAFT');
                  const badge = STATUS_BADGE_CLASSES[st] ?? 'bg-[#7A9AB8]/15 text-[#5C6F82]';
                  const isDraft = st === 'DRAFT';
                  const canEdit = isDraft || row.sourceType === 'imported';
                  return (
                    <tr key={row.id} className="hover:bg-[#F4F6F8]">
                      <td className="px-4 py-3">
                        <Link href={`/quotations/${row.id}`} className="font-['Oswald'] font-bold text-[#1565C0] hover:underline">
                          {displayText(row.quoteNumber, '—')}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#7A9AB8]">
                        {dateStr}
                        {isEstimated && (
                          <span className="ml-1 text-xs text-[#BA7517]" title="Estimated from import date">
                            ~
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#0D2847]">{displayText(clientName, '—')}</td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#1A4A7A]">{vehicleLabel(row.vehicleType, row.vehicleTypeOther)}</td>
                      <td className="px-4 py-3 font-['Oswald'] font-semibold text-[#0D2847]">{formatIndianCurrency(row.monthlyRate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-['Barlow_Condensed'] font-semibold ${badge}`}>
                          {st.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <Link href={`/quotations/${row.id}`} className="p-2 text-[#42A5F5] hover:bg-[#42A5F5]/10 rounded" title="View">
                            <Eye className="w-4 h-4" />
                          </Link>
                          {canEdit && (
                            <Link href={`/quotations/${row.id}/edit`} className="p-2 text-[#1565C0] hover:bg-[#1565C0]/10 rounded" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => void downloadPdf(row.id)}
                            className="p-2 text-[#42A5F5] hover:bg-[#42A5F5]/10 rounded"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => setDeleteId(row.id)}
                              className="p-2 text-[#DC2626] hover:bg-[#DC2626]/10 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !isError && filtered.length > 0 && (
          <Pagination page={currentPage} totalPages={totalPages} total={totalForPagination} limit={LIMIT} onPageChange={setPage} />
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete quotation?"
        message="This cannot be undone. Only draft quotations can be deleted."
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
