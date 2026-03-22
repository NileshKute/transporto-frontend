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
import { displayText, toArray } from '@/lib/displayText';
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

function safeClientObj(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const qc = useQueryClient();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: invoice, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      try {
        const res = await api.get(`/invoices/${id}`);
        return res.data?.data ?? res.data?.invoice ?? res.data;
      } catch (e) {
        console.error('Invoice detail fetch failed:', e);
        throw e;
      }
    },
    enabled: !!id,
    retry: 1,
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
    onError: (e: unknown) => {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as { response?: { data?: { message?: string } } }).response?.data?.message : undefined;
      toast.error(typeof msg === 'string' ? msg : 'Failed to record payment');
    },
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

  const errMsg =
    error && typeof error === 'object' && 'response' in error
      ? displayText((error as { response?: { data?: { message?: unknown } } }).response?.data?.message, '')
      : '';

  if (!id) {
    return (
      <div className="p-8 text-center font-['Rajdhani'] text-[#7A9AB8]">
        Invalid invoice.
        <button type="button" onClick={() => router.push('/invoices')} className="mt-4 block mx-auto text-[#1565C0] hover:underline">
          Back to invoices
        </button>
      </div>
    );
  }

  if (isLoading || (isFetching && !invoice)) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner text="Loading invoice…" />
      </div>
    );
  }

  if (isError || !invoice || typeof invoice !== 'object') {
    return (
      <div className="rounded-lg border border-[#E0E8F0] bg-white p-8 text-center space-y-4">
        <p className="font-['Oswald'] text-[#0D2847]">Could not load invoice</p>
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">{errMsg || 'It may have been deleted or you may not have access.'}</p>
        <button type="button" onClick={() => router.push('/invoices')} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847]">
          Back to invoices
        </button>
      </div>
    );
  }

  const inv = invoice as Record<string, unknown>;
  const totalAmount = Number(inv.totalAmount ?? inv.total_amount ?? 0) || 0;
  const amountPaid = Number(inv.amountPaid ?? inv.amount_paid ?? 0) || 0;
  const balance = totalAmount - amountPaid;
  const lineItems = toArray<unknown>(inv.lineItems ?? inv.line_items);
  const deductions = toArray<unknown>(inv.deductions);
  const client = safeClientObj(inv.client);
  const statusStr = displayText(inv.status, 'DRAFT');
  const isDraft = statusStr === 'DRAFT';

  const invoiceNumber = displayText(inv.invoiceNumber ?? inv.invoice_number, '—');
  const periodStart = inv.periodStart ?? inv.period_start;
  const periodEnd = inv.periodEnd ?? inv.period_end;
  const notesText = typeof inv.notes === 'string' ? inv.notes : displayText(inv.notes, '');
  const amountInWords = displayText(inv.amountInWords ?? inv.amount_in_words, '');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.back()} className="p-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-['Oswald'] text-2xl font-bold text-[#0D2847] tracking-wide">{invoiceNumber}</h1>
            <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">{displayText(client.name, 'Client')}</p>
          </div>
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-['Barlow_Condensed'] font-semibold uppercase ${STATUS_CLASSES[statusStr] ?? 'bg-[#7A9AB8]/10 text-[#7A9AB8]'}`}>
            {statusStr}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void openPdf()} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#42A5F5] text-[#42A5F5] font-['Barlow_Condensed'] font-semibold uppercase hover:bg-[#42A5F5]/10">
            <Download className="w-4 h-4" /> Download PDF
          </button>
          {statusStr !== 'PAID' && statusStr !== 'CANCELLED' && (
            <button type="button" onClick={() => markPaidMutation.mutate()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#16A34A] text-white font-['Barlow_Condensed'] font-semibold uppercase hover:bg-[#15803d]">
              <DollarSign className="w-4 h-4" /> Mark Paid
            </button>
          )}
          {isDraft && (
            <>
              <Link href={`/invoices/${id}/edit`} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] font-semibold uppercase hover:bg-[#F4F6F8]">
                <Pencil className="w-4 h-4" /> Edit
              </Link>
              <button type="button" onClick={() => setDeleteConfirm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#DC2626] text-[#DC2626] font-['Barlow_Condensed'] font-semibold uppercase hover:bg-[#DC2626]/10">
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
                  <p className="font-['Rajdhani'] font-medium text-[#0D2847]">{displayText(client.name, '—')}</p>
                  {displayText(client.address, '') !== '—' ? (
                    <p className="font-['Rajdhani'] text-sm text-[#1A4A7A] mt-0.5">{displayText(client.address, '')}</p>
                  ) : null}
                  {displayText(client.gstNumber ?? client.gst_number, '') !== '—' ? (
                    <p className="font-['Rajdhani'] text-sm font-mono text-[#7A9AB8] mt-0.5">GST: {displayText(client.gstNumber ?? client.gst_number, '')}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Invoice #</p>
                  <p className="font-['Oswald'] font-bold text-[#1565C0]">{invoiceNumber}</p>
                  {periodStart && periodEnd ? (
                    <p className="font-['Rajdhani'] text-sm text-[#1A4A7A] mt-1">
                      Period: {formatDate(String(periodStart))} – {formatDate(String(periodEnd))}
                    </p>
                  ) : null}
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
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center font-['Rajdhani'] text-[#7A9AB8]">
                          No line items
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((liRaw, i) => {
                        const li = liRaw && typeof liRaw === 'object' ? (liRaw as Record<string, unknown>) : {};
                        const veh = displayText(li.vehicleRegNo ?? li.vehicle_reg_no, '');
                        const desc = displayText(li.description ?? li.route, '');
                        const cellText = [veh, desc].filter((x) => x && x !== '—').join(' ') || '—';
                        const trips = li.trips ?? li.tripCount;
                        const tripsDisplay = trips != null && trips !== '' ? displayText(trips, '') : '—';
                        const days = li.days;
                        const daysDisplay = days != null && days !== '' ? displayText(days, '') : '—';
                        const rate = li.rate;
                        const amt = Number(li.amount ?? 0) || 0;
                        return (
                          <tr key={i}>
                            <td className="px-4 py-3 font-['Rajdhani'] text-[#0D2847]">{cellText}</td>
                            <td className="px-4 py-3 font-['Rajdhani'] text-right text-[#1A4A7A]">{tripsDisplay}</td>
                            <td className="px-4 py-3 font-['Rajdhani'] text-right text-[#1A4A7A]">{daysDisplay}</td>
                            <td className="px-4 py-3 font-['Rajdhani'] text-right text-[#1A4A7A]">{rate != null ? formatIndianCurrency(Number(rate) || 0) : '—'}</td>
                            <td className="px-4 py-3 font-['Oswald'] font-semibold text-right text-[#0D2847]">{formatIndianCurrency(amt)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {deductions.length > 0 && (
                <div className="border border-[#E0E8F0] rounded-lg overflow-hidden">
                  <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#1A4A7A] px-4 py-2 bg-[#F4F6F8] border-b border-[#E0E8F0]">Deductions</p>
                  <ul className="divide-y divide-[#E0E8F0]">
                    {deductions.map((dRaw, i) => {
                      const d = dRaw && typeof dRaw === 'object' ? (dRaw as Record<string, unknown>) : null;
                      const label = d ? displayText(d.description ?? d.name, 'Deduction') : 'Deduction';
                      const amt = d ? Number(d.amount ?? 0) || 0 : Number(dRaw) || 0;
                      return (
                        <li key={i} className="flex justify-between px-4 py-2 font-['Rajdhani'] text-sm">
                          <span className="text-[#0D2847]">{label}</span>
                          <span className="font-['Oswald'] font-semibold text-[#DC2626]">- {formatIndianCurrency(amt)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="text-right space-y-1 font-['Rajdhani'] text-sm">
                <p>
                  Subtotal: <span className="font-['Oswald'] font-semibold">{formatIndianCurrency(Number(inv.subtotal ?? totalAmount) || 0)}</span>
                </p>
                {deductions.length > 0 ? (
                  <p>
                    Total Deductions:{' '}
                    <span className="font-['Oswald'] font-semibold">
                      {formatIndianCurrency(
                        Number(
                          Number(inv.totalDeductions ?? inv.total_deductions ?? 0) ||
                            deductions.reduce<number>((s, dRaw) => {
                              const d = dRaw && typeof dRaw === 'object' ? (dRaw as Record<string, unknown>) : null;
                              return s + (d ? Number(d.amount ?? 0) || 0 : Number(dRaw) || 0);
                            }, 0)
                        )
                      )}
                    </span>
                  </p>
                ) : null}
                <p className="text-lg">
                  Total: <span className="font-['Oswald'] font-bold text-[#1565C0]">{formatIndianCurrency(totalAmount)}</span>
                </p>
                {amountInWords && amountInWords !== '—' ? <p className="text-[#7A9AB8] italic text-xs">{amountInWords}</p> : null}
              </div>

              {notesText && notesText !== '—' ? (
                <p className="font-['Rajdhani'] text-sm text-[#1A4A7A] border-t border-[#E0E8F0] pt-4">Notes: {notesText}</p>
              ) : null}

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
              <p className="flex justify-between">
                <span className="text-[#7A9AB8]">Amount</span>
                <span className="font-['Oswald'] font-semibold">{formatIndianCurrency(totalAmount)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-[#7A9AB8]">Paid</span>
                <span className="font-['Oswald'] font-semibold text-[#16A34A]">{formatIndianCurrency(amountPaid)}</span>
              </p>
              <p className="flex justify-between border-t border-[#E0E8F0] pt-2">
                <span className="text-[#0D2847]">Balance</span>
                <span className="font-['Oswald'] font-bold text-[#0D2847]">{formatIndianCurrency(balance)}</span>
              </p>
            </div>
            {statusStr !== 'PAID' && statusStr !== 'CANCELLED' && (
              <button
                type="button"
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
            <input className={inputClass} type="number" min={0.01} step={0.01} value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} required placeholder="0.00" />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Date</label>
            <input className={inputClass} type="date" value={paymentForm.date} onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Notes</label>
            <textarea className={inputClass} rows={2} value={paymentForm.notes} onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-[#E0E8F0]">
            <button type="button" onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#F4F6F8]">
              Cancel
            </button>
            <button type="submit" disabled={recordPaymentMutation.isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50">
              Record
            </button>
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
