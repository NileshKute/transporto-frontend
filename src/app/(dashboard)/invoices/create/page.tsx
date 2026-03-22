'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { formatIndianCurrency } from '@/lib/utils';
import { displayText, toArray } from '@/lib/displayText';
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

export default function CreateInvoicePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [lineItems, setLineItems] = useState<LineRow[]>([{ vehicleRegNo: '', description: '', billingType: 'MONTHLY_CONTRACT', tripCount: 0, days: 0, rate: 0, amount: 0 }]);
  const [deductions, setDeductions] = useState<DeductionRow[]>([{ description: '', amount: 0 }]);
  const [notes, setNotes] = useState('');

  const { data: nextNum } = useQuery({
    queryKey: ['invoices-next-number'],
    queryFn: async () => {
      try {
        const res = await api.get('/invoices/next-number');
        const n = res.data?.number ?? res.data?.data?.number ?? res.data;
        return typeof n === 'string' || typeof n === 'number' ? String(n) : '';
      } catch {
        return '';
      }
    },
  });

  useEffect(() => {
    if (nextNum && !invoiceNumber) setInvoiceNumber(String(nextNum));
  }, [nextNum, invoiceNumber]);

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

  const clientOptions = useMemo(() => {
    return toArray<Record<string, unknown>>(clientsRaw)
      .map((c) => {
        const id = c.id != null ? String(c.id) : '';
        if (!id) return null;
        return { id, name: displayText(c.name, 'Client') };
      })
      .filter((x): x is { id: string; name: string } => x != null);
  }, [clientsRaw]);

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      try {
        const r = await api.get(`/clients/${clientId}`);
        return r.data?.data ?? r.data;
      } catch {
        return null;
      }
    },
    enabled: !!clientId,
  });

  useEffect(() => {
    if (!clientId || !client || typeof client !== 'object') return;
    const c = client as Record<string, unknown>;
    const terms = Number(c.paymentTermsDays ?? c.payment_terms_days ?? 15) || 15;
    if (issueDate) {
      const d = new Date(issueDate);
      d.setDate(d.getDate() + terms);
      setDueDate(d.toISOString().slice(0, 10));
    }
  }, [clientId, client, issueDate]);

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

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/invoices', payload);
      return res.data?.data ?? res.data;
    },
    onSuccess: (data: unknown) => {
      qc.invalidateQueries({ queryKey: ['invoices-list'] });
      toast.success('Invoice saved as draft');
      const d = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
      const newId = d?.id != null ? String(d.id) : '';
      if (newId) router.push(`/invoices/${newId}`);
      else toast.error('Could not read new invoice id');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !invoiceNumber) return;
    createMutation.mutate({
      clientId,
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
      status: 'DRAFT',
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/invoices" className="p-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Create Invoice</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-[#E0E8F0] rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Client *</label>
            <select className={inputClass} value={clientId} onChange={e => setClientId(e.target.value)} required>
              <option value="">Select client</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Invoice Number *</label>
            <input className={inputClass} value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required placeholder="From next number" />
          </div>
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
                    <td className="px-3 py-2"><input className={inputClass + ' min-w-0'} value={row.vehicleRegNo} onChange={e => updateLineItem(i, 'vehicleRegNo', e.target.value)} placeholder="DL01AB1234" /></td>
                    <td className="px-3 py-2"><input className={inputClass + ' min-w-0'} value={row.description} onChange={e => updateLineItem(i, 'description', e.target.value)} placeholder="Route" /></td>
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
                <input type="number" className={inputClass + ' w-32'} value={d.amount || ''} onChange={e => setDeductions(deductions.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} min={0} step={0.01} placeholder="Amount" />
                <button type="button" onClick={() => setDeductions(deductions.filter((_, j) => j !== i))} className="p-2 text-[#DC2626] hover:bg-[#DC2626]/10 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Notes</label>
          <textarea className={inputClass} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>

        <div className="border-t border-[#E0E8F0] pt-4 space-y-1 font-['Rajdhani'] text-sm">
          <p>Subtotal: <span className="font-['Oswald'] font-semibold">{formatIndianCurrency(subtotal)}</span></p>
          <p>Total Deductions: <span className="font-['Oswald'] font-semibold">{formatIndianCurrency(totalDeductions)}</span></p>
          <p className="text-[#0D2847]">Total: <span className="font-['Oswald'] text-lg font-bold text-[#1565C0]">{formatIndianCurrency(totalAmount)}</span></p>
          <p className="text-[#7A9AB8] italic">Amount in words: {amountToWords(totalAmount)}</p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-[#E0E8F0]">
          <Link href="/invoices" className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#F4F6F8]">Cancel</Link>
          <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50">
            {createMutation.isPending ? 'Saving...' : 'Save Draft'}
          </button>
          <button type="button" onClick={() => toast('Save draft first, then open invoice to generate PDF')} className="px-4 py-2 rounded-lg border-2 border-[#42A5F5] text-[#42A5F5] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#42A5F5]/10">
            Generate PDF
          </button>
        </div>
      </form>
    </div>
  );
}
