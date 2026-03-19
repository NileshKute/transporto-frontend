'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { formatIndianCurrency } from '@/lib/utils';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface LineRow {
  vehicleRegNo: string;
  description: string;
  billingType: 'MONTHLY_CONTRACT' | 'ADHOC';
  tripCount: number;
  days: number;
  rate: number;
  amount: number;
}

interface DeductionRow {
  description: string;
  amount: number;
}

function amountToWords(n: number): string {
  if (n <= 0) return 'Zero only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const toHundred = (x: number): string => {
    if (x >= 100) return ones[Math.floor(x / 100)] + ' Hundred ' + toHundred(x % 100).trim();
    if (x >= 20) return (tens[Math.floor(x / 10)] + ' ' + ones[x % 10]).trim();
    if (x >= 10) return teens[x - 10];
    return ones[x] || '';
  };
  const int = Math.floor(n);
  const dec = Math.round((n - int) * 100);
  if (int >= 10000000) return amountToWords(Math.floor(int / 10000000)) + ' Crore ' + amountToWords(int % 10000000).trim() + (dec ? ' and ' + dec + '/100' : '') + ' only';
  if (int >= 100000) return amountToWords(Math.floor(int / 100000)) + ' Lakh ' + amountToWords(int % 100000).trim() + (dec ? ' and ' + dec + '/100' : '') + ' only';
  if (int >= 1000) return amountToWords(Math.floor(int / 1000)) + ' Thousand ' + amountToWords(int % 1000).trim() + (dec ? ' and ' + dec + '/100' : '') + ' only';
  return toHundred(int) + (dec ? ' and ' + dec + '/100' : '') + ' only';
}

const inputClass = 'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-[#0D2847] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20 font-["Rajdhani"] text-sm';

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const qc = useQueryClient();
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lineItems, setLineItems] = useState<LineRow[]>([]);
  const [deductions, setDeductions] = useState<DeductionRow[]>([]);
  const [notes, setNotes] = useState('');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const res = await api.get(`/invoices/${id}`);
      return res.data?.data ?? res.data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!invoice) return;
    const inv = invoice as any;
    setInvoiceNumber(inv.invoiceNumber ?? '');
    setPeriodStart(inv.periodStart ? inv.periodStart.slice(0, 10) : '');
    setPeriodEnd(inv.periodEnd ? inv.periodEnd.slice(0, 10) : '');
    setIssueDate(inv.issueDate ? inv.issueDate.slice(0, 10) : '');
    setDueDate(inv.dueDate ? inv.dueDate.slice(0, 10) : '');
    const items = inv.lineItems ?? inv.line_items ?? [];
    setLineItems(items.length ? items.map((li: any) => ({
      vehicleRegNo: li.vehicleRegNo ?? li.vehicle_reg_no ?? '',
      description: li.description ?? li.route ?? '',
      billingType: li.billingType ?? 'MONTHLY_CONTRACT',
      tripCount: li.trips ?? li.tripCount ?? 0,
      days: li.days ?? 0,
      rate: Number(li.rate) ?? 0,
      amount: Number(li.amount) ?? 0,
    })) : [{ vehicleRegNo: '', description: '', billingType: 'MONTHLY_CONTRACT', tripCount: 0, days: 0, rate: 0, amount: 0 }]);
    const ded = inv.deductions ?? [];
    setDeductions(ded.length ? ded.map((d: any) => ({ description: typeof d === 'object' ? d.description ?? d.name ?? '' : '', amount: typeof d === 'object' ? Number(d.amount) ?? 0 : Number(d) })) : [{ description: '', amount: 0 }]);
    setNotes(inv.notes ?? '');
  }, [invoice]);

  const updateLineItem = (index: number, field: keyof LineRow, value: string | number) => {
    const next = [...lineItems];
    const row = { ...next[index], [field]: value };
    if (field === 'tripCount' || field === 'rate') row.amount = (Number(row.tripCount) || 0) * (Number(row.rate) || 0);
    if (field === 'days' && row.billingType === 'MONTHLY_CONTRACT') row.amount = (Number(row.days) || 0) * (Number(row.rate) || 0);
    next[index] = row;
    setLineItems(next);
  };

  const subtotal = lineItems.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalDeductions = deductions.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalAmount = Math.max(0, subtotal - totalDeductions);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.put(`/invoices/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices-list'] });
      toast.success('Invoice updated');
      router.push(`/invoices/${id}`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      invoiceNumber,
      periodStart: periodStart || undefined,
      periodEnd: periodEnd || undefined,
      issueDate: issueDate || undefined,
      dueDate: dueDate || undefined,
      lineItems: lineItems.filter(r => r.vehicleRegNo || r.description || r.rate).map(r => ({
        vehicleRegNo: r.vehicleRegNo,
        description: r.description,
        billingType: r.billingType,
        trips: r.tripCount,
        days: r.days,
        rate: r.rate,
        amount: r.amount,
      })),
      deductions: deductions.filter(d => d.description || d.amount).map(d => ({ description: d.description, amount: d.amount })),
      notes: notes || undefined,
      totalAmount,
      subtotal,
      totalDeductions,
    });
  };

  if (isLoading || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#42A5F5] border-t-transparent" />
      </div>
    );
  }

  const inv = invoice as any;
  if (inv.status !== 'DRAFT') {
    return (
      <div className="space-y-4">
        <p className="font-['Rajdhani'] text-[#7A9AB8]">Only draft invoices can be edited.</p>
        <Link href={`/invoices/${id}`} className="text-[#1565C0] hover:underline font-['Barlow_Condensed']">Back to invoice</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href={`/invoices/${id}`} className="p-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Edit Invoice</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-[#E0E8F0] rounded-lg shadow-sm p-6">
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Invoice Number *</label>
          <input className={inputClass} value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Period Start</label>
            <input type="date" className={inputClass} value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Period End</label>
            <input type="date" className={inputClass} value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Issue Date</label>
            <input type="date" className={inputClass} value={issueDate} onChange={e => setIssueDate(e.target.value)} />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Due Date</label>
            <input type="date" className={inputClass} value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Line Items</span>
            <button type="button" onClick={() => setLineItems([...lineItems, { vehicleRegNo: '', description: '', billingType: 'MONTHLY_CONTRACT', tripCount: 0, days: 0, rate: 0, amount: 0 }])} className="flex items-center gap-1 text-[#1565C0] font-['Barlow_Condensed'] text-sm font-semibold hover:underline">
              <Plus className="w-4 h-4" /> Add Row
            </button>
          </div>
          <div className="overflow-x-auto border border-[#E0E8F0] rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Vehicle Reg No</th>
                  <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Description/Route</th>
                  <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Billing Type</th>
                  <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Trips</th>
                  <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Days</th>
                  <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Rate (₹)</th>
                  <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Amount</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((row, i) => (
                  <tr key={i} className="border-b border-[#E0E8F0] last:border-0">
                    <td className="px-3 py-2"><input className={inputClass + ' min-w-0'} value={row.vehicleRegNo} onChange={e => updateLineItem(i, 'vehicleRegNo', e.target.value)} /></td>
                    <td className="px-3 py-2"><input className={inputClass + ' min-w-0'} value={row.description} onChange={e => updateLineItem(i, 'description', e.target.value)} /></td>
                    <td className="px-3 py-2">
                      <select className={inputClass + ' min-w-0'} value={row.billingType} onChange={e => updateLineItem(i, 'billingType', e.target.value as any)}>
                        <option value="MONTHLY_CONTRACT">Monthly</option>
                        <option value="ADHOC">Adhoc</option>
                      </select>
                    </td>
                    <td className="px-3 py-2"><input type="number" className={inputClass + ' w-20'} value={row.tripCount || ''} onChange={e => updateLineItem(i, 'tripCount', Number(e.target.value) || 0)} min={0} /></td>
                    <td className="px-3 py-2"><input type="number" className={inputClass + ' w-20'} value={row.days || ''} onChange={e => updateLineItem(i, 'days', Number(e.target.value) || 0)} min={0} /></td>
                    <td className="px-3 py-2"><input type="number" className={inputClass + ' w-24'} value={row.rate || ''} onChange={e => updateLineItem(i, 'rate', Number(e.target.value) || 0)} min={0} step={0.01} /></td>
                    <td className="px-3 py-2"><input type="number" className={inputClass + ' w-24'} value={row.amount || ''} onChange={e => updateLineItem(i, 'amount', Number(e.target.value) || 0)} min={0} step={0.01} /></td>
                    <td className="px-3 py-2"><button type="button" onClick={() => setLineItems(lineItems.filter((_, j) => j !== i))} className="p-1 text-[#DC2626] hover:bg-[#DC2626]/10 rounded"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Deductions</span>
            <button type="button" onClick={() => setDeductions([...deductions, { description: '', amount: 0 }])} className="flex items-center gap-1 text-[#1565C0] font-['Barlow_Condensed'] text-sm font-semibold hover:underline">
              <Plus className="w-4 h-4" /> Add Deduction
            </button>
          </div>
          <div className="space-y-2">
            {deductions.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={inputClass + ' flex-1'} value={d.description} onChange={e => setDeductions(deductions.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Description" />
                <input type="number" className={inputClass + ' w-32'} value={d.amount || ''} onChange={e => setDeductions(deductions.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} min={0} step={0.01} />
                <button type="button" onClick={() => setDeductions(deductions.filter((_, j) => j !== i))} className="p-2 text-[#DC2626] hover:bg-[#DC2626]/10 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Notes</label>
          <textarea className={inputClass} rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="border-t border-[#E0E8F0] pt-4 space-y-1 font-['Rajdhani'] text-sm">
          <p>Subtotal: <span className="font-['Oswald'] font-semibold">{formatIndianCurrency(subtotal)}</span></p>
          <p>Total Deductions: <span className="font-['Oswald'] font-semibold">{formatIndianCurrency(totalDeductions)}</span></p>
          <p className="text-[#0D2847]">Total: <span className="font-['Oswald'] text-lg font-bold text-[#1565C0]">{formatIndianCurrency(totalAmount)}</span></p>
          <p className="text-[#7A9AB8] italic">Amount in words: {amountToWords(totalAmount)}</p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-[#E0E8F0]">
          <Link href={`/invoices/${id}`} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#F4F6F8]">Cancel</Link>
          <button type="submit" disabled={updateMutation.isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50">
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
