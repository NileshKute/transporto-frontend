'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatIndianCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Download, DollarSign, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-[#7A9AB8]/10 text-[#7A9AB8]',
  SENT: 'bg-[#42A5F5]/10 text-[#42A5F5]',
  PAID: 'bg-[#16A34A]/10 text-[#16A34A]',
  PARTIAL: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  OVERDUE: 'bg-[#DC2626]/10 text-[#DC2626]',
  CANCELLED: 'bg-[#7A9AB8]/10 text-[#7A9AB8] line-through',
};

const inputClass = 'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-[#0D2847] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20 font-["Rajdhani"] text-sm';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const qc = useQueryClient();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const res = await api.get(`/invoices/${id}`);
      return res.data?.data ?? res.data;
    },
    enabled: !!id,
  });

  const markPaidMutation = useMutation({
    mutationFn: () => api.put(`/invoices/${id}/status`, { status: 'PAID' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices-list'] });
      toast.success('Marked as paid');
    },
    onError: () => toast.error('Failed to update'),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (payload: { amount: number; date: string; notes?: string }) => api.put(`/invoices/${id}/payment`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices-list'] });
      toast.success('Payment recorded');
      setPaymentModalOpen(false);
      setPaymentForm({ amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to record payment'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices-list'] });
      toast.success('Invoice deleted');
      router.push('/invoices');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const openPdf = async () => {
    try {
      const res = await api.post(`/invoices/${id}/generate-pdf`, {}, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) return;
    recordPaymentMutation.mutate({ amount, date: paymentForm.date, notes: paymentForm.notes || undefined });
  };

  if (isLoading || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner />
      </div>
    );
  }

  const inv = invoice as any;
  const totalAmount = Number(inv.totalAmount) || 0;
  const amountPaid = Number(inv.amountPaid) || 0;
  const balance = totalAmount - amountPaid;
  const lineItems = inv.lineItems ?? inv.line_items ?? [];
  const deductions = inv.deductions ?? [];
  const client = inv.client ?? {};
  const isDraft = inv.status === 'DRAFT';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-['Oswald'] text-2xl font-bold text-[#0D2847] tracking-wide">{inv.invoiceNumber}</h1>
            <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">{client.name ?? 'Client'}</p>
          </div>
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-['Barlow_Condensed'] font-semibold uppercase ${STATUS_CLASSES[inv.status] ?? 'bg-[#7A9AB8]/10 text-[#7A9AB8]'}`}>
            {inv.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openPdf} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#42A5F5] text-[#42A5F5] font-['Barlow_Condensed'] font-semibold uppercase hover:bg-[#42A5F5]/10">
            <Download className="w-4 h-4" /> Download PDF
          </button>
          {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
            <button onClick={() => markPaidMutation.mutate()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#16A34A] text-white font-['Barlow_Condensed'] font-semibold uppercase hover:bg-[#15803d]">
              <DollarSign className="w-4 h-4" /> Mark Paid
            </button>
          )}
          {isDraft && (
            <>
              <Link href={`/invoices/${id}/edit`} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] font-semibold uppercase hover:bg-[#F4F6F8]">
                <Pencil className="w-4 h-4" /> Edit
              </Link>
              <button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#DC2626] text-[#DC2626] font-['Barlow_Condensed'] font-semibold uppercase hover:bg-[#DC2626]/10">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm overflow-hidden">
            <div className="bg-[#0D2847] text-white px-6 py-4 border-b border-[#1A4A7A]">
              <h2 className="font-['Oswald'] text-lg font-bold tracking-wide uppercase">G K Enterprise</h2>
              <p className="font-['Rajdhani'] text-sm text-[#64B5F6] mt-1">Transport & Logistics</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Bill To</p>
                  <p className="font-['Rajdhani'] font-medium text-[#0D2847]">{client.name ?? '—'}</p>
                  {client.address && <p className="font-['Rajdhani'] text-sm text-[#1A4A7A] mt-0.5">{client.address}</p>}
                  {client.gstNumber && <p className="font-['Rajdhani'] text-sm font-mono text-[#7A9AB8] mt-0.5">GST: {client.gstNumber}</p>}
                </div>
                <div className="text-right">
                  <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Invoice #</p>
                  <p className="font-['Oswald'] font-bold text-[#1565C0]">{inv.invoiceNumber}</p>
                  {inv.periodStart && inv.periodEnd && (
                    <p className="font-['Rajdhani'] text-sm text-[#1A4A7A] mt-1">Period: {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</p>
                  )}
                </div>
              </div>

              <div className="border border-[#E0E8F0] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                      <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Vehicle / Description</th>
                      <th className="text-right px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Trips</th>
                      <th className="text-right px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Days</th>
                      <th className="text-right px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Rate</th>
                      <th className="text-right px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E8F0]">
                    {lineItems.map((li: any, i: number) => (
                      <tr key={i}>
                        <td className="px-4 py-3 font-['Rajdhani'] text-[#0D2847]">{li.vehicleRegNo ?? li.vehicle_reg_no ?? ''} {li.description ?? li.route ?? ''}</td>
                        <td className="px-4 py-3 font-['Rajdhani'] text-right text-[#1A4A7A]">{li.trips ?? li.tripCount ?? '—'}</td>
                        <td className="px-4 py-3 font-['Rajdhani'] text-right text-[#1A4A7A]">{li.days ?? '—'}</td>
                        <td className="px-4 py-3 font-['Rajdhani'] text-right text-[#1A4A7A]">{li.rate != null ? formatIndianCurrency(li.rate) : '—'}</td>
                        <td className="px-4 py-3 font-['Oswald'] font-semibold text-right text-[#0D2847]">{formatIndianCurrency(li.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {deductions.length > 0 && (
                <div className="border border-[#E0E8F0] rounded-lg overflow-hidden">
                  <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#1A4A7A] px-4 py-2 bg-[#F4F6F8] border-b border-[#E0E8F0]">Deductions</p>
                  <ul className="divide-y divide-[#E0E8F0]">
                    {deductions.map((d: any, i: number) => (
                      <li key={i} className="flex justify-between px-4 py-2 font-['Rajdhani'] text-sm">
                        <span className="text-[#0D2847]">{typeof d === 'object' ? d.description ?? d.name : 'Deduction'}</span>
                        <span className="font-['Oswald'] font-semibold text-[#DC2626]">- {formatIndianCurrency(typeof d === 'object' ? d.amount : d)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-right space-y-1 font-['Rajdhani'] text-sm">
                <p>Subtotal: <span className="font-['Oswald'] font-semibold">{formatIndianCurrency(inv.subtotal ?? totalAmount)}</span></p>
                {deductions.length > 0 && <p>Total Deductions: <span className="font-['Oswald'] font-semibold">{formatIndianCurrency(inv.totalDeductions ?? deductions.reduce((s: number, d: any) => s + (typeof d === 'object' ? Number(d.amount) : Number(d)), 0))}</span></p>}
                <p className="text-lg">Total: <span className="font-['Oswald'] font-bold text-[#1565C0]">{formatIndianCurrency(totalAmount)}</span></p>
                {inv.amountInWords && <p className="text-[#7A9AB8] italic text-xs">{inv.amountInWords}</p>}
              </div>

              {inv.notes && <p className="font-['Rajdhani'] text-sm text-[#1A4A7A] border-t border-[#E0E8F0] pt-4">Notes: {inv.notes}</p>}

              <div className="border-t border-[#E0E8F0] pt-4 font-['Rajdhani'] text-xs text-[#7A9AB8]">
                <p>Bank details and payment terms as per agreement.</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm p-5 space-y-4">
            <h3 className="font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#1A4A7A]">Payment Summary</h3>
            <div className="space-y-2 font-['Rajdhani'] text-sm">
              <p className="flex justify-between"><span className="text-[#7A9AB8]">Amount</span><span className="font-['Oswald'] font-semibold">{formatIndianCurrency(totalAmount)}</span></p>
              <p className="flex justify-between"><span className="text-[#7A9AB8]">Paid</span><span className="font-['Oswald'] font-semibold text-[#16A34A]">{formatIndianCurrency(amountPaid)}</span></p>
              <p className="flex justify-between border-t border-[#E0E8F0] pt-2"><span className="text-[#0D2847]">Balance</span><span className="font-['Oswald'] font-bold text-[#0D2847]">{formatIndianCurrency(balance)}</span></p>
            </div>
            {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
              <button
                onClick={() => setPaymentModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] font-semibold uppercase tracking-wider hover:bg-[#0D2847]"
              >
                <DollarSign className="w-4 h-4" /> Record Payment
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Record Payment" size="md">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Amount (₹) *</label>
            <input className={inputClass} type="number" min={0.01} step={0.01} value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} required placeholder="0.00" />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Date</label>
            <input className={inputClass} type="date" value={paymentForm.date} onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Notes</label>
            <textarea className={inputClass} rows={2} value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-[#E0E8F0]">
            <button type="button" onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#F4F6F8]">Cancel</button>
            <button type="submit" disabled={recordPaymentMutation.isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50">Record</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="Delete invoice?"
        message="This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
