'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatIndianCurrency } from '@/lib/utils';
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

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [searchNum, setSearchNum] = useState('');
  const [autoGenOpen, setAutoGenOpen] = useState(false);

  const { data: invoicesRaw, isLoading } = useQuery({
    queryKey: ['invoices-list'],
    queryFn: async () => {
      const res = await api.get('/invoices', { params: { limit: 500 } });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get('/clients');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  const invoices = Array.isArray(invoicesRaw) ? invoicesRaw : [];

  const filtered = useMemo(() => {
    let list = [...invoices];
    if (clientFilter) list = list.filter((i: Invoice) => i.clientId === clientFilter);
    if (statusFilter !== 'All') list = list.filter((i: Invoice) => i.status === statusFilter);
    if (monthFilter) list = list.filter((i: Invoice) => {
      const d = i.periodStart ? new Date(i.periodStart) : new Date(i.createdAt);
      return d.getMonth() + 1 === Number(monthFilter) && d.getFullYear() === Number(yearFilter);
    });
    if (yearFilter) list = list.filter((i: Invoice) => {
      const d = i.periodStart ? new Date(i.periodStart) : new Date(i.createdAt);
      return d.getFullYear() === Number(yearFilter);
    });
    if (searchNum.trim()) list = list.filter((i: Invoice) => i.invoiceNumber?.toLowerCase().includes(searchNum.trim().toLowerCase()));
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
    invoices.forEach((inv: Invoice) => {
      const balance = (inv.totalAmount ?? 0) - (inv.amountPaid ?? 0);
      if (inv.status !== 'PAID' && inv.status !== 'CANCELLED') pendingAmount += balance;
      const created = inv.createdAt ? new Date(inv.createdAt) : null;
      if (inv.status === 'PAID' && created && created.getMonth() === thisMonth && created.getFullYear() === thisYear)
        paidThisMonth += inv.amountPaid ?? inv.totalAmount ?? 0;
      if (inv.status === 'OVERDUE') overdueCount += 1;
    });
    return { totalInvoices, pendingAmount, paidThisMonth, overdueCount };
  }, [invoices]);

  const openPdf = async (id: string) => {
    try {
      const res = await api.post(`/invoices/${id}/generate-pdf`, {}, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.put(`/invoices/${id}/status`, { status: 'PAID' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices-list'] });
      toast.success('Marked as paid');
    },
    onError: () => toast.error('Failed to update'),
  });

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
            onChange={e => setClientFilter(e.target.value)}
          >
            <option value="">All clients</option>
            {(clients as any[]).map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm font-['Rajdhani'] text-[#0D2847] focus:border-[#42A5F5]"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm font-['Rajdhani'] text-[#0D2847] focus:border-[#42A5F5]"
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
          >
            <option value="">All months</option>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Year"
            className="w-24 rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm font-['Rajdhani'] text-[#0D2847] focus:border-[#42A5F5]"
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
          />
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A9AB8]" />
            <input
              type="text"
              placeholder="Search by invoice number"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E0E8F0] text-sm font-['Rajdhani'] text-[#0D2847] focus:border-[#42A5F5]"
              value={searchNum}
              onChange={e => setSearchNum(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <LoadingSpinner />
        ) : !filtered.length ? (
          <EmptyState message="No invoices" description="Create an invoice or use Auto Generate" />
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
                {filtered.map((inv: Invoice) => {
                  const paid = inv.amountPaid ?? 0;
                  const balance = (inv.totalAmount ?? 0) - paid;
                  const clientName = (inv as any).client?.name ?? (clients as any[]).find((c: any) => c.id === inv.clientId)?.name ?? '—';
                  return (
                    <tr key={inv.id} className="hover:bg-[#F4F6F8]">
                      <td className="px-4 py-3">
                        <Link href={`/invoices/${inv.id}`} className="font-['Oswald'] font-bold text-[#1565C0] hover:underline">{inv.invoiceNumber}</Link>
                      </td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#0D2847]">{clientName}</td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#1A4A7A]">
                        {inv.periodStart && inv.periodEnd
                          ? `${new Date(inv.periodStart).toLocaleDateString('en-IN')} – ${new Date(inv.periodEnd).toLocaleDateString('en-IN')}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 font-['Oswald'] font-semibold text-[#0D2847]">{formatIndianCurrency(inv.totalAmount)}</td>
                      <td className="px-4 py-3 font-['Oswald'] text-sm text-[#0D2847]">{formatIndianCurrency(paid)}</td>
                      <td className="px-4 py-3 font-['Oswald'] text-sm text-[#0D2847]">{formatIndianCurrency(balance)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-['Barlow_Condensed'] font-semibold ${STATUS_CLASSES[inv.status] ?? 'bg-[#7A9AB8]/10 text-[#7A9AB8]'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#7A9AB8]">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/invoices/${inv.id}`} className="p-2 text-[#42A5F5] hover:bg-[#42A5F5]/10 rounded" title="View"><Eye className="w-4 h-4" /></Link>
                          <button onClick={() => openPdf(inv.id)} className="p-2 text-[#42A5F5] hover:bg-[#42A5F5]/10 rounded" title="Download PDF"><Download className="w-4 h-4" /></button>
                          {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                            <button onClick={() => markPaidMutation.mutate(inv.id)} className="p-2 text-[#16A34A] hover:bg-[#16A34A]/10 rounded" title="Mark as Paid"><DollarSign className="w-4 h-4" /></button>
                          )}
                          <button className="p-2 text-[#7A9AB8] hover:bg-[#7A9AB8]/10 rounded" title="Send (coming soon)" disabled><Send className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AutoGenerateModal isOpen={autoGenOpen} onClose={() => setAutoGenOpen(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['invoices-list'] }); setAutoGenOpen(false); }} />
    </div>
  );
}
