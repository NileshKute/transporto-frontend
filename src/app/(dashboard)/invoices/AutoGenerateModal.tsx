'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { formatIndianCurrency } from '@/lib/utils';
import { displayText, toArray } from '@/lib/displayText';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface LineItem {
  id?: string;
  vehicleRegNo?: string;
  description?: string;
  route?: string;
  trips?: number;
  days?: number;
  rate?: number;
  amount?: number;
}

interface Deduction {
  id?: string;
  description: string;
  amount: number;
}

interface DraftInvoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  client?: { name: string };
  periodStart: string;
  periodEnd: string;
  lineItems?: LineItem[];
  deductions?: Deduction[];
  subtotal?: number;
  totalDeductions?: number;
  totalAmount?: number;
  amountInWords?: string;
  notes?: string;
}

const inputClass = 'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-[#0D2847] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20 font-["Rajdhani"] text-sm';

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

function normalizeLineItem(li: unknown): LineItem {
  if (!li || typeof li !== 'object') {
    return { vehicleRegNo: '', description: '', trips: 0, days: 0, rate: 0, amount: 0 };
  }
  const r = li as Record<string, unknown>;
  return {
    id: r.id != null ? String(r.id) : undefined,
    vehicleRegNo: displayText(r.vehicleRegNo ?? r.vehicle_reg_no ?? r.vehicleNo, ''),
    description: displayText(r.description ?? r.route, ''),
    route: displayText(r.route ?? r.description, ''),
    trips: Number(r.trips ?? 0) || 0,
    days: Number(r.days ?? 0) || 0,
    rate: Number(r.rate ?? 0) || 0,
    amount: Number(r.amount ?? 0) || 0,
  };
}

function normalizeDeduction(d: unknown): Deduction {
  if (d != null && typeof d === 'object') {
    const o = d as Record<string, unknown>;
    return {
      id: o.id != null ? String(o.id) : undefined,
      description: displayText(o.description ?? o.name, ''),
      amount: Number(o.amount ?? 0) || 0,
    };
  }
  const n = Number(d);
  return { description: '', amount: Number.isFinite(n) ? n : 0 };
}

/** Build safe draft from API; throws if payload cannot be used. */
function normalizeAutoGenerateResponse(raw: unknown): DraftInvoice {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('Invalid response from server');
  }
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : '';
  if (!id) {
    const msg = r.message ?? r.error;
    throw new Error(displayText(msg, 'No invoice was created'));
  }

  let clientName = '';
  const client = r.client;
  if (client && typeof client === 'object') {
    clientName = displayText((client as Record<string, unknown>).name, '');
  }

  const lineSource = r.lineItems ?? r.line_items ?? r.items;
  const lineItems = toArray<unknown>(lineSource).map(normalizeLineItem);

  const dedSource = r.deductions;
  const deductions = toArray<unknown>(dedSource).map(normalizeDeduction);

  return {
    id,
    invoiceNumber: displayText(r.invoiceNumber ?? r.invoice_number, ''),
    clientId: String(r.clientId ?? r.client_id ?? ''),
    client: clientName ? { name: clientName } : undefined,
    periodStart: String(r.periodStart ?? r.period_start ?? ''),
    periodEnd: String(r.periodEnd ?? r.period_end ?? ''),
    lineItems,
    deductions,
    subtotal: Number(r.subtotal ?? 0) || 0,
    totalDeductions: Number(r.totalDeductions ?? r.total_deductions ?? 0) || 0,
    totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0) || 0,
    amountInWords: (() => {
      const w = displayText(r.amountInWords ?? r.amount_in_words, '');
      return w === '—' ? undefined : w;
    })(),
    notes: typeof r.notes === 'string' ? r.notes : undefined,
  };
}

function axiosErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const data = (e as { response?: { data?: { message?: unknown; error?: unknown } } }).response?.data;
    const m = data?.message ?? data?.error;
    if (typeof m === 'string') return m;
  }
  if (e instanceof Error) return e.message;
  return 'Auto-generate failed';
}

export function AutoGenerateModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [clientId, setClientId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [draft, setDraft] = useState<DraftInvoice | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      try {
        const res = await api.get('/clients');
        return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      } catch {
        return [];
      }
    },
    enabled: isOpen,
  });

  const updateDraftMutation = useMutation({
    mutationFn: (payload: Partial<DraftInvoice>) => api.put(`/invoices/${draft!.id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices-list'] });
      toast.success('Saved as draft');
      onSuccess();
      reset();
    },
    onError: () => toast.error('Failed to save'),
  });

  const reset = () => {
    setStep(1);
    setClientId('');
    setMonth(new Date().getMonth() + 1);
    setYear(new Date().getFullYear());
    setDraft(null);
    setGenerating(false);
    onClose();
  };

  const handleGenerate = async () => {
    if (!clientId) return;
    setGenerating(true);
    try {
      const res = await api.post('/invoices/auto-generate', { clientId, month, year });
      const raw = res.data?.data ?? res.data;
      try {
        const normalized = normalizeAutoGenerateResponse(raw);
        setDraft(normalized);
        setStep(2);
      } catch (inner) {
        const msg = inner instanceof Error ? inner.message : 'Invalid invoice data';
        toast.error(msg);
      }
    } catch (e) {
      toast.error(axiosErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const lineItems = draft?.lineItems ?? [];
  const deductions = draft?.deductions ?? [];
  const subtotal = lineItems.reduce((s, li) => s + (Number(li.amount) || 0), 0);
  const totalDeductions = deductions.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalAmount = Math.max(0, subtotal - totalDeductions);

  const updateLineItem = (index: number, field: keyof LineItem, value: number | string) => {
    if (!draft) return;
    const next = [...(draft.lineItems ?? [])];
    const item = { ...(next[index] ?? {}), [field]: value } as LineItem;
    if (field === 'trips' || field === 'days' || field === 'rate') {
      const t = Number(item.trips) || 0;
      const d = Number(item.days) || 0;
      const r = Number(item.rate) || 0;
      item.amount = t && r ? t * r : d && r ? d * r : r;
    }
    next[index] = item;
    setDraft({ ...draft, lineItems: next });
  };

  const addLineItem = () => {
    if (!draft) return;
    setDraft({ ...draft, lineItems: [...(draft.lineItems ?? []), { vehicleRegNo: '', description: '', trips: 0, days: 0, rate: 0, amount: 0 }] });
  };

  const removeLineItem = (index: number) => {
    if (!draft) return;
    const next = (draft.lineItems ?? []).filter((_, i) => i !== index);
    setDraft({ ...draft, lineItems: next });
  };

  const addDeduction = () => {
    if (!draft) return;
    setDraft({ ...draft, deductions: [...(draft.deductions ?? []), { description: '', amount: 0 }] });
  };

  const updateDeduction = (index: number, field: 'description' | 'amount', value: string | number) => {
    if (!draft) return;
    const next = [...(draft.deductions ?? [])];
    next[index] = { ...next[index], [field]: field === 'amount' ? Number(value) || 0 : String(value) };
    setDraft({ ...draft, deductions: next });
  };

  const removeDeduction = (index: number) => {
    if (!draft) return;
    setDraft({ ...draft, deductions: (draft.deductions ?? []).filter((_, i) => i !== index) });
  };

  const handleSaveDraft = () => {
    if (!draft) return;
    updateDraftMutation.mutate({
      invoiceNumber: draft.invoiceNumber,
      lineItems: draft.lineItems,
      deductions: draft.deductions,
      notes: draft.notes,
      totalAmount,
      subtotal,
      totalDeductions,
      amountInWords: amountToWords(totalAmount),
    });
  };

  const handleGeneratePdf = async () => {
    if (!draft?.id) return;
    try {
      const res = await api.post(`/invoices/${draft.id}/generate-pdf`, {}, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
      toast.success('PDF opened in new tab');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  const clientRows = Array.isArray(clients) ? clients : [];

  return (
    <Modal isOpen={isOpen} onClose={reset} title="Auto Generate Invoice" size="xl">
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Client *</label>
            <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">Select client</option>
              {clientRows.map((c: Record<string, unknown>) => (
                <option key={String(c.id ?? '')} value={String(c.id ?? '')}>
                  {displayText(c.name, 'Client')}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Month</label>
              <select className={inputClass} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Year</label>
              <input type="number" className={inputClass} value={year} onChange={(e) => setYear(Number(e.target.value))} min={2020} max={2030} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-[#E0E8F0]">
            <button type="button" onClick={reset} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#F4F6F8]">
              Cancel
            </button>
            <button type="button" onClick={() => void handleGenerate()} disabled={!clientId || generating} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50">
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && draft && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Invoice Number</label>
              <input className={inputClass} value={draft.invoiceNumber} onChange={(e) => setDraft({ ...draft, invoiceNumber: e.target.value })} />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Client</label>
              <input className={inputClass + ' bg-[#F4F6F8]'} value={displayText(draft.client?.name, '')} readOnly disabled />
            </div>
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Billing Period</label>
            <p className="font-['Rajdhani'] text-sm text-[#0D2847]">
              {draft.periodStart && draft.periodEnd
                ? `${new Date(draft.periodStart).toLocaleDateString('en-IN')} – ${new Date(draft.periodEnd).toLocaleDateString('en-IN')}`
                : '—'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Line Items</span>
              <button type="button" onClick={addLineItem} className="flex items-center gap-1 text-[#1565C0] font-['Barlow_Condensed'] text-sm font-semibold hover:underline">
                <Plus className="w-4 h-4" /> Add Line Item
              </button>
            </div>
            <div className="overflow-x-auto border border-[#E0E8F0] rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                    <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Vehicle No</th>
                    <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Route/Description</th>
                    <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Trips</th>
                    <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Days</th>
                    <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Rate</th>
                    <th className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li, i) => (
                    <tr key={i} className="border-b border-[#E0E8F0] last:border-0">
                      <td className="px-3 py-2">
                        <input className={inputClass + ' min-w-0'} value={li.vehicleRegNo ?? ''} onChange={(e) => updateLineItem(i, 'vehicleRegNo', e.target.value)} placeholder="Reg No" />
                      </td>
                      <td className="px-3 py-2">
                        <input className={inputClass + ' min-w-0'} value={li.description ?? li.route ?? ''} onChange={(e) => updateLineItem(i, 'description', e.target.value)} placeholder="Route" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" className={inputClass + ' w-20'} value={li.trips ?? ''} onChange={(e) => updateLineItem(i, 'trips', Number(e.target.value) || 0)} min={0} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" className={inputClass + ' w-20'} value={li.days ?? ''} onChange={(e) => updateLineItem(i, 'days', Number(e.target.value) || 0)} min={0} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" className={inputClass + ' w-24'} value={li.rate ?? ''} onChange={(e) => updateLineItem(i, 'rate', Number(e.target.value) || 0)} min={0} step={0.01} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" className={inputClass + ' w-24'} value={li.amount ?? ''} onChange={(e) => updateLineItem(i, 'amount', Number(e.target.value) || 0)} min={0} step={0.01} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => removeLineItem(i)} className="p-1 text-[#DC2626] hover:bg-[#DC2626]/10 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Deductions</span>
              <button type="button" onClick={addDeduction} className="flex items-center gap-1 text-[#1565C0] font-['Barlow_Condensed'] text-sm font-semibold hover:underline">
                <Plus className="w-4 h-4" /> Add Deduction
              </button>
            </div>
            <div className="space-y-2">
              {deductions.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={inputClass + ' flex-1'} value={d.description} onChange={(e) => updateDeduction(i, 'description', e.target.value)} placeholder="Description" />
                  <input type="number" className={inputClass + ' w-32'} value={d.amount || ''} onChange={(e) => updateDeduction(i, 'amount', e.target.value)} min={0} step={0.01} placeholder="Amount" />
                  <button type="button" onClick={() => removeDeduction(i)} className="p-2 text-[#DC2626] hover:bg-[#DC2626]/10 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[#E0E8F0] pt-4 space-y-1 text-right font-['Rajdhani'] text-sm">
            <p>
              Subtotal: <span className="font-['Oswald'] font-semibold">{formatIndianCurrency(subtotal)}</span>
            </p>
            <p>
              Total Deductions: <span className="font-['Oswald'] font-semibold">{formatIndianCurrency(totalDeductions)}</span>
            </p>
            <p className="text-[#0D2847]">
              Total Amount: <span className="font-['Oswald'] text-lg font-bold text-[#1565C0]">{formatIndianCurrency(totalAmount)}</span>
            </p>
            <p className="text-[#7A9AB8] italic">Amount in words: {amountToWords(totalAmount)}</p>
          </div>

          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Notes</label>
            <textarea className={inputClass} rows={2} value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Optional notes" />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-[#E0E8F0]">
            <button type="button" onClick={() => setStep(1)} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#F4F6F8]">
              Back
            </button>
            <button type="button" onClick={handleSaveDraft} disabled={updateDraftMutation.isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50">
              {updateDraftMutation.isPending ? 'Saving...' : 'Save as Draft'}
            </button>
            <button type="button" onClick={() => void handleGeneratePdf()} className="px-4 py-2 rounded-lg border-2 border-[#42A5F5] text-[#42A5F5] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#42A5F5]/10">
              Generate PDF
            </button>
            <button type="button" disabled className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#7A9AB8] font-['Barlow_Condensed'] uppercase tracking-wider cursor-not-allowed" title="Coming soon">
              Send to Client
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
