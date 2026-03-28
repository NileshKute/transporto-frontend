'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatIndianCurrency, formatDate } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookOpen, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Banknote, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_BADGES: Record<string, string> = {
  SALARY: 'bg-[#16A34A]/10 text-[#16A34A]',
  ADVANCE: 'bg-[#DC2626]/10 text-[#DC2626]',
  ADVANCE_RECOVERY: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  EXTRA_DUTY: 'bg-[#1565C0]/10 text-[#1565C0]',
  BONUS: 'bg-[#16A34A]/10 text-[#16A34A]',
  PENALTY: 'bg-[#DC2626]/10 text-[#DC2626]',
  FOOD: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  FUEL_ADVANCE: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  TOLL: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  MAINTENANCE: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  OTHER: 'bg-[#7A9AB8]/10 text-[#7A9AB8]',
};

const EXPENSE_CATS = ['FOOD', 'FUEL_ADVANCE', 'TOLL', 'MAINTENANCE', 'OTHER'];

const inputClass = 'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-[#0D2847] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20 font-["Rajdhani"] text-sm';

export default function DriverLedgerPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [driverId, setDriverId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [extraDutyOpen, setExtraDutyOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: async () => {
      const r = await api.get('/drivers?limit=200');
      return r.data?.data ?? r.data ?? [];
    },
  });

  const driverOpts = useMemo(() =>
    (Array.isArray(drivers) ? drivers : []).map((d: any) => ({
      id: String(d.id),
      name: `${d.name || 'Driver'}${d.employeeCode ? ` (${d.employeeCode})` : ''}`,
    })),
  [drivers]);

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['driver-ledger', driverId, typeFilter, month, year],
    queryFn: async () => {
      const params: any = { month, year, limit: 100 };
      if (driverId) params.driverId = driverId;
      if (typeFilter) params.type = typeFilter;
      const r = await api.get('/driver-ledger', { params });
      return r.data;
    },
  });

  const entries = ledgerData?.data ?? [];

  const { data: summary } = useQuery({
    queryKey: ['driver-summary', driverId, month, year],
    queryFn: async () => {
      const r = await api.get(`/driver-ledger/summary/${driverId}`, { params: { month, year } });
      return r.data;
    },
    enabled: !!driverId,
  });

  const createMut = useMutation({
    mutationFn: ({ _endpoint, ...payload }: any) => api.post(_endpoint || '/driver-ledger', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-ledger'] });
      qc.invalidateQueries({ queryKey: ['driver-summary'] });
      toast.success('Entry saved');
    },
    onError: () => toast.error('Failed to save'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: any) => api.put(`/driver-ledger/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-ledger'] });
      qc.invalidateQueries({ queryKey: ['driver-summary'] });
      toast.success('Entry updated');
      setEditOpen(false);
    },
    onError: () => toast.error('Failed to update'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/driver-ledger/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-ledger'] });
      qc.invalidateQueries({ queryKey: ['driver-summary'] });
      toast.success('Entry deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-['Oswald'] text-2xl font-bold text-[#0D2847] tracking-wide">DRIVER LEDGER</h1>
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">Daily accounting — advances, extra duty, expenses</p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setAdvanceOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847]">
          <Banknote className="w-4 h-4" /> Give Advance
        </button>
        <button onClick={() => setExtraDutyOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#42A5F5] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#1565C0]">
          <TrendingUp className="w-4 h-4" /> Record Extra Duty
        </button>
        <button onClick={() => setExpenseOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#F4F6F8]">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-52">
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Driver</label>
          <select className={inputClass} value={driverId} onChange={e => setDriverId(e.target.value)}>
            <option value="">All Drivers</option>
            {driverOpts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="w-36">
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Month</label>
          <select className={inputClass} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Year</label>
          <input type="number" className={inputClass} value={year} onChange={e => setYear(Number(e.target.value))} min={2020} max={2030} />
        </div>
        <div className="w-40">
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Type</label>
          <select className={inputClass} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {['ADVANCE','EXTRA_DUTY','SALARY','BONUS','PENALTY','FOOD','FUEL_ADVANCE','TOLL','MAINTENANCE','OTHER'].map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Cards (when driver selected) */}
      {driverId && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Monthly Salary', value: formatIndianCurrency(summary.baseSalary), icon: Wallet, color: '#16A34A' },
            { label: 'Total Advances', value: formatIndianCurrency(summary.advances), icon: TrendingDown, color: '#DC2626' },
            { label: 'Extra Duty Pay', value: formatIndianCurrency(summary.extraDuty), icon: TrendingUp, color: '#1565C0' },
            { label: 'Net Balance', value: formatIndianCurrency(summary.netBalance), icon: Banknote, color: '#0D2847' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-[#E0E8F0] rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + '15' }}>
                  <s.icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">{s.label}</p>
                  <p className="font-['Oswald'] text-lg font-bold text-[#0D2847]">{s.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white border border-[#E0E8F0] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E0E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#42A5F5]" />
            <span className="font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#1A4A7A] text-sm">Ledger Entries</span>
          </div>
          <span className="font-['Rajdhani'] text-xs text-[#7A9AB8]">{entries.length} entries</span>
        </div>

        {isLoading ? (
          <div className="p-8"><LoadingSpinner text="Loading ledger..." /></div>
        ) : entries.length === 0 ? (
          <EmptyState message="No ledger entries found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  {['Date','Driver','Type','Description','Credit (₹)','Debit (₹)','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#1A4A7A]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E8F0]">
                {entries.map((e: any) => {
                  const amt = Number(e.amount ?? 0);
                  return (
                    <tr key={e.id} className="hover:bg-[#F4F6F8]/50">
                      <td className="px-4 py-2.5 font-['Rajdhani'] text-[#0D2847] whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="px-4 py-2.5 font-['Rajdhani'] text-[#0D2847]">{typeof e.driver === 'object' && e.driver ? String(e.driver.name ?? '—') : '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-['Barlow_Condensed'] font-semibold uppercase ${TYPE_BADGES[String(e.type ?? '')] ?? TYPE_BADGES.OTHER}`}>
                          {String(e.type || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-['Rajdhani'] text-[#0D2847] max-w-[200px] truncate">{typeof e.description === 'string' ? e.description : '—'}</td>
                      <td className="px-4 py-2.5 font-['Oswald'] font-semibold text-[#16A34A]">{e.isCredit ? `+${formatIndianCurrency(amt)}` : ''}</td>
                      <td className="px-4 py-2.5 font-['Oswald'] font-semibold text-[#DC2626]">{!e.isCredit ? `-${formatIndianCurrency(amt)}` : ''}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditEntry(e); setEditOpen(true); }} className="p-1.5 rounded hover:bg-[#42A5F5]/10 text-[#42A5F5]"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if (confirm('Delete this entry?')) deleteMut.mutate(e.id); }} className="p-1.5 rounded hover:bg-[#DC2626]/10 text-[#DC2626]"><Trash2 className="w-3.5 h-3.5" /></button>
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

      {/* ── Give Advance Modal ── */}
      <AdvanceModal
        isOpen={advanceOpen}
        onClose={() => setAdvanceOpen(false)}
        drivers={driverOpts}
        defaultDriverId={driverId}
        onSave={(p: any) => {
          createMut.mutate({ ...p, _endpoint: '/driver-ledger/advance' }, { onSuccess: () => setAdvanceOpen(false) });
        }}
        isPending={createMut.isPending}
      />

      {/* ── Record Extra Duty Modal ── */}
      <ExtraDutyModal
        isOpen={extraDutyOpen}
        onClose={() => setExtraDutyOpen(false)}
        drivers={driverOpts}
        defaultDriverId={driverId}
        onSave={(p: any) => {
          createMut.mutate({ ...p, _endpoint: '/driver-ledger/extra-duty' }, { onSuccess: () => setExtraDutyOpen(false) });
        }}
        isPending={createMut.isPending}
      />

      {/* ── Add Expense Modal ── */}
      <ExpenseModal
        isOpen={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        drivers={driverOpts}
        defaultDriverId={driverId}
        onSave={(p: any) => {
          createMut.mutate(p, { onSuccess: () => setExpenseOpen(false) });
        }}
        isPending={createMut.isPending}
      />

      {/* ── Edit Modal ── */}
      <EditEntryModal
        isOpen={editOpen}
        onClose={() => { setEditOpen(false); setEditEntry(null); }}
        entry={editEntry}
        onSave={(p: any) => updateMut.mutate(p)}
        isPending={updateMut.isPending}
      />
    </div>
  );
}

/* ───────────────── Sub-components / Modals ─────────────── */

function AdvanceModal({ isOpen, onClose, drivers, defaultDriverId, onSave, isPending }: any) {
  const [form, setForm] = useState({ driverId: '', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });
  const reset = () => setForm({ driverId: defaultDriverId || '', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Give Advance">
      <form onSubmit={e => { e.preventDefault(); onSave({ driverId: form.driverId || defaultDriverId, amount: Number(form.amount), description: form.description, date: form.date }); }} className="space-y-4">
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Driver *</label>
          <select className={inputClass} value={form.driverId || defaultDriverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))} required>
            <option value="">Select driver</option>
            {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Amount (₹) *</label>
          <input type="number" className={inputClass} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} min={1} required />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Description *</label>
          <input className={inputClass} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Monthly advance, Fuel money" required />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Date</label>
          <input type="date" className={inputClass} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#E0E8F0]">
          <button type="button" onClick={() => { reset(); onClose(); }} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm">Cancel</button>
          <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm disabled:opacity-50">{isPending ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ExtraDutyModal({ isOpen, onClose, drivers, defaultDriverId, onSave, isPending }: any) {
  const [form, setForm] = useState({ driverId: '', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });
  const reset = () => setForm({ driverId: defaultDriverId || '', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Record Extra Duty">
      <form onSubmit={e => { e.preventDefault(); onSave({ driverId: form.driverId || defaultDriverId, amount: Number(form.amount), description: form.description, date: form.date }); }} className="space-y-4">
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Driver *</label>
          <select className={inputClass} value={form.driverId || defaultDriverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))} required>
            <option value="">Select driver</option>
            {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Amount (₹) *</label>
          <input type="number" className={inputClass} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} min={1} required />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Description *</label>
          <input className={inputClass} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Extra trip to Pune, Sunday duty" required />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Date</label>
          <input type="date" className={inputClass} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#E0E8F0]">
          <button type="button" onClick={() => { reset(); onClose(); }} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm">Cancel</button>
          <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg bg-[#42A5F5] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm disabled:opacity-50">{isPending ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ExpenseModal({ isOpen, onClose, drivers, defaultDriverId, onSave, isPending }: any) {
  const [form, setForm] = useState({ driverId: '', category: 'FOOD', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });
  const reset = () => setForm({ driverId: defaultDriverId || '', category: 'FOOD', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Add Expense">
      <form onSubmit={e => { e.preventDefault(); onSave({ driverId: form.driverId || defaultDriverId, type: form.category, category: form.category, amount: Number(form.amount), description: form.description, isCredit: false, date: form.date }); }} className="space-y-4">
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Driver *</label>
          <select className={inputClass} value={form.driverId || defaultDriverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))} required>
            <option value="">Select driver</option>
            {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Category *</label>
          <select className={inputClass} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {EXPENSE_CATS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Amount (₹) *</label>
          <input type="number" className={inputClass} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} min={1} required />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Description *</label>
          <input className={inputClass} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" required />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Date</label>
          <input type="date" className={inputClass} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#E0E8F0]">
          <button type="button" onClick={() => { reset(); onClose(); }} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm">Cancel</button>
          <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg bg-[#0D2847] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm disabled:opacity-50">{isPending ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditEntryModal({ isOpen, onClose, entry, onSave, isPending }: any) {
  const [form, setForm] = useState({ description: '', amount: '', notes: '' });

  useEffect(() => {
    if (entry) {
      setForm({ description: entry.description || '', amount: String(Number(entry.amount ?? 0)), notes: entry.notes || '' });
    }
  }, [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Entry">
      {entry && (
        <form onSubmit={e => { e.preventDefault(); onSave({ id: entry.id, description: form.description, amount: Number(form.amount), notes: form.notes }); }} className="space-y-4">
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Description</label>
            <input className={inputClass} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Amount (₹)</label>
            <input type="number" className={inputClass} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} min={0} />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Notes</label>
            <textarea className={inputClass} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E0E8F0]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm disabled:opacity-50">{isPending ? 'Saving...' : 'Update'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
