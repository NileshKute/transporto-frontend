'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatIndianCurrency } from '@/lib/utils';
import { displayText, toArray } from '@/lib/displayText';
import {
  FileText, Clock, CheckCircle, AlertTriangle, Plus, Search,
  Eye, Download, Send, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AutoGenerateModal } from './AutoGenerateModal';

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  client?: { name: string };
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  amountPaid?: number;
  status: string;
  createdAt: string;
}

const STATUS_OPTIONS = ['All', 'DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED'];
const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-[#7A9AB8]/10 text-[#7A9AB8]',
  SENT: 'bg-[#42A5F5]/10 text-[#42A5F5]',
  PAID: 'bg-[#16A34A]/10 text-[#16A34A]',
  PARTIAL: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  OVERDUE: 'bg-[#DC2626]/10 text-[#DC2626]',
  CANCELLED: 'bg-[#7A9AB8]/10 text-[#7A9AB8] line-through',
};

function normalizeInvoiceRow(raw: unknown): Invoice | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : '';
  if (!id) return null;
  let client: { name: string } | undefined;
  const c = r.client;
  if (c && typeof c === 'object') {
    const nm = displayText((c as Record<string, unknown>).name, '');
    if (nm && nm !== '—') client = { name: nm };
  }
  return {
    id,
    invoiceNumber: displayText(r.invoiceNumber ?? r.invoice_number, ''),
    clientId: String(r.clientId ?? r.client_id ?? ''),
    client,
    periodStart: String(r.periodStart ?? r.period_start ?? ''),
    periodEnd: String(r.periodEnd ?? r.period_end ?? ''),
    totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0) || 0,
    amountPaid: Number(r.amountPaid ?? r.amount_paid ?? 0) || 0,
    status: displayText(r.status, 'DRAFT'),
    createdAt: String(r.createdAt ?? r.created_at ?? ''),
  };
}

function normalizeInvoicesList(data: unknown): Invoice[] {
  return toArray<unknown>(data).map(normalizeInvoiceRow).filter((x): x is Invoice => x != null);
}

function safeInvoiceDate(iso: string): Date | null {
  if (!iso || typeof iso !== 'string') return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

type ClientOpt = { id: string; name: string };

function normalizeClientOpt(raw: unknown): ClientOpt | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : '';
  if (!id) return null;
  return { id, name: displayText(r.name, 'Client') };
}

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [searchNum, setSearchNum] = useState('');
  const [autoGenOpen, setAutoGenOpen] = useState(false);

  const { data: invoices = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['invoices-list'],
    queryFn: async () => {
      try {
        const res = await api.get('/invoices', { params: { limit: 500 } });
        const raw = res.data?.data ?? res.data?.invoices ?? res.data;
        return normalizeInvoicesList(raw);
      } catch (e) {
        console.error('Invoices list fetch failed:', e);
        throw e;
      }
    },
  });

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

  const clients = useMemo(() => toArray<unknown>(clientsRaw).map(normalizeClientOpt).filter((c): c is ClientOpt => c != null), [clientsRaw]);

  const filtered = useMemo(() => {
    let list = [...invoices];
    if (clientFilter) list = list.filter((i) => i.clientId === clientFilter);
    if (statusFilter !== 'All') list = list.filter((i) => i.status === statusFilter);
    if (monthFilter) {
      list = list.filter((i) => {
        const d = safeInvoiceDate(i.periodStart) ?? safeInvoiceDate(i.createdAt);
        if (!d) return false;
        return d.getMonth() + 1 === Number(monthFilter) && d.getFullYear() === Number(yearFilter);
      });
    }
    if (yearFilter) {
      list = list.filter((i) => {
        const d = safeInvoiceDate(i.periodStart) ?? safeInvoiceDate(i.createdAt);
        if (!d) return false;
        return d.getFullYear() === Number(yearFilter);
      });
    }
    if (searchNum.trim()) {
      const q = searchNum.trim().toLowerCase();
      list = list.filter((i) => i.invoiceNumber.toLowerCase().includes(q));
    }
    return list;
  }, [invoices, clientFilter, statusFilter, monthFilter, yearFilter, searchNum]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    let totalInvoices = invoices.length;
    let pendingAmount = 0;
    let paidThisMonth = 0;
    let overdueCount = 0;
    invoices.forEach((inv) => {
      const balance = (inv.totalAmount ?? 0) - (inv.amountPaid ?? 0);
      if (inv.status !== 'PAID' && inv.status !== 'CANCELLED') pendingAmount += balance;
      const created = safeInvoiceDate(inv.createdAt);
      if (inv.status === 'PAID' && created && created.getMonth() === thisMonth && created.getFullYear() === thisYear) {
        paidThisMonth += inv.amountPaid ?? inv.totalAmount ?? 0;
      }
      if (inv.status === 'OVERDUE') overdueCount += 1;
    });
    return { totalInvoices, pendingAmount, paidThisMonth, overdueCount };
  }, [invoices]);

  const openPdf = async (invoiceId: string) => {
    if (!invoiceId) return;
    try {
      const res = await api.post(`/invoices/${invoiceId}/generate-pdf`, {}, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  const markPaidMutation = useMutation({
    mutationFn: (invoiceId: string) => api.put(`/invoices/${invoiceId}/status`, { status: 'PAID' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices-list'] });
      toast.success('Marked as paid');
    },
    onError: () => toast.error('Failed to update'),
  });

  const listErrorMessage =
    error && typeof error === 'object' && 'response' in error
      ? displayText((error as { response?: { data?: { message?: unknown } } }).response?.data?.message, '')
      : '';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Invoices</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/invoices/create"
            className="flex items-center gap-2 bg-[#1565C0] hover:bg-[#0D2847] text-white font-['Barlow_Condensed'] font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Invoice
          </Link>
          <button
            onClick={() => setAutoGenOpen(true)}
            className="flex items-center gap-2 border-2 border-[#42A5F5] text-[#42A5F5] hover:bg-[#42A5F5]/10 font-['Barlow_Condensed'] font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" /> Auto Generate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#42A5F5]/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-[#42A5F5]" />
          </div>
          <div>
            <p className="font-['Oswald'] text-2xl font-bold text-[#0D2847]">{stats.totalInvoices}</p>
            <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Total Invoices</p>
          </div>
        </div>
        <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
            <Clock className="w-6 h-6 text-[#F59E0B]" />
          </div>
          <div>
            <p className="font-['Oswald'] text-2xl font-bold text-[#0D2847]">{formatIndianCurrency(stats.pendingAmount)}</p>
            <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Pending Amount</p>
          </div>
        </div>
        <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#16A34A]/10 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-[#16A34A]" />
          </div>
          <div>
            <p className="font-['Oswald'] text-2xl font-bold text-[#0D2847]">{formatIndianCurrency(stats.paidThisMonth)}</p>
            <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Paid This Month</p>
          </div>
        </div>
        <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#DC2626]/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-[#DC2626]" />
          </div>
          <div>
            <p className="font-['Oswald'] text-2xl font-bold text-[#0D2847]">{stats.overdueCount}</p>
            <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Overdue</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm font-['Rajdhani'] text-[#0D2847] focus:border-[#42A5F5]"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm font-['Rajdhani'] text-[#0D2847] focus:border-[#42A5F5]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm font-['Rajdhani'] text-[#0D2847] focus:border-[#42A5F5]"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="">All months</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Year"
            className="w-24 rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm font-['Rajdhani'] text-[#0D2847] focus:border-[#42A5F5]"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          />
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A9AB8]" />
            <input
              type="text"
              placeholder="Search by invoice number"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E0E8F0] text-sm font-['Rajdhani'] text-[#0D2847] focus:border-[#42A5F5]"
              value={searchNum}
              onChange={(e) => setSearchNum(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <LoadingSpinner text="Loading invoices…" />
        ) : isError ? (
          <div className="p-8 text-center space-y-3">
            <p className="font-['Oswald'] text-[#0D2847]">Could not load invoices</p>
            <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">{listErrorMessage || 'Please try again.'}</p>
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
            message="No invoices"
            description="Create an invoice or use Auto Generate"
            action={{ label: 'Create Invoice', onClick: () => { window.location.href = '/invoices/create'; } }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Invoice No</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Client</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Period</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Amount</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Paid</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Balance</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Status</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Date</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E8F0]">
                {filtered.map((inv) => {
                  const paid = inv.amountPaid ?? 0;
                  const balance = (inv.totalAmount ?? 0) - paid;
                  const clientName = inv.client?.name ?? clients.find((c) => c.id === inv.clientId)?.name ?? '—';
                  const periodStr =
                    inv.periodStart && inv.periodEnd
                      ? `${new Date(inv.periodStart).toLocaleDateString('en-IN')} – ${new Date(inv.periodEnd).toLocaleDateString('en-IN')}`
                      : '—';
                  const dateStr = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : '—';
                  const statusStr = displayText(inv.status, '—');
                  const statusClass = STATUS_CLASSES[inv.status] ?? 'bg-[#7A9AB8]/10 text-[#7A9AB8]';
                  return (
                    <tr key={inv.id} className="hover:bg-[#F4F6F8]">
                      <td className="px-4 py-3">
                        <Link href={`/invoices/${inv.id}`} className="font-['Oswald'] font-bold text-[#1565C0] hover:underline">
                          {displayText(inv.invoiceNumber, '—')}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#0D2847]">{displayText(clientName, '—')}</td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#1A4A7A]">{periodStr}</td>
                      <td className="px-4 py-3 font-['Oswald'] font-semibold text-[#0D2847]">{formatIndianCurrency(inv.totalAmount)}</td>
                      <td className="px-4 py-3 font-['Oswald'] text-sm text-[#0D2847]">{formatIndianCurrency(paid)}</td>
                      <td className="px-4 py-3 font-['Oswald'] text-sm text-[#0D2847]">{formatIndianCurrency(balance)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-['Barlow_Condensed'] font-semibold ${statusClass}`}>{statusStr}</span>
                      </td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#7A9AB8]">{dateStr}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/invoices/${inv.id}`} className="p-2 text-[#42A5F5] hover:bg-[#42A5F5]/10 rounded" title="View">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button type="button" onClick={() => void openPdf(inv.id)} className="p-2 text-[#42A5F5] hover:bg-[#42A5F5]/10 rounded" title="Download PDF">
                            <Download className="w-4 h-4" />
                          </button>
                          {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                            <button type="button" onClick={() => markPaidMutation.mutate(inv.id)} className="p-2 text-[#16A34A] hover:bg-[#16A34A]/10 rounded" title="Mark as Paid">
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          <button type="button" className="p-2 text-[#7A9AB8] hover:bg-[#7A9AB8]/10 rounded" title="Send (coming soon)" disabled>
                            <Send className="w-4 h-4" />
                          </button>
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
          <div className="px-4 py-2 border-t border-[#E0E8F0] font-['Rajdhani'] text-xs text-[#7A9AB8]">
            Showing 1–{filtered.length} of {filtered.length}
          </div>
        )}
      </div>

      <AutoGenerateModal
        isOpen={autoGenOpen}
        onClose={() => setAutoGenOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['invoices-list'] });
          setAutoGenOpen(false);
        }}
      />
    </div>
  );
}
