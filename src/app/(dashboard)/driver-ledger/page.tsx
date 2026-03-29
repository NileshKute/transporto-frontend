'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatIndianCurrency, formatDate } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookOpen, Plus, Download, Search, TrendingUp, TrendingDown, Banknote, Hash } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const FILTER_OPTIONS = [
  { value: 'thisMonth', label: 'This Month' },
  { value: 'month', label: 'Single Month' },
  { value: 'last2', label: 'Last 2 Months' },
  { value: 'last3', label: 'Last 3 Months' },
  { value: 'last6', label: 'Last 6 Months' },
  { value: 'last12', label: 'Last 12 Months' },
  { value: 'year', label: 'Financial Year' },
  { value: 'custom', label: 'Custom Range' },
  { value: 'all', label: 'All Time' },
];

const FY_OPTIONS = ['2023-24', '2024-25', '2025-26'];

const ENTRY_TYPES = ['EXTRA_DUTY', 'ADVANCE_RECOVERY', 'BONUS', 'OTHER'] as const;

const TYPE_BADGES: Record<string, string> = {
  EXTRA_DUTY: 'bg-[#1565C0]/10 text-[#1565C0]',
  ADVANCE_RECOVERY: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  BONUS: 'bg-[#16A34A]/10 text-[#16A34A]',
  SALARY: 'bg-[#16A34A]/10 text-[#16A34A]',
  PENALTY: 'bg-[#DC2626]/10 text-[#DC2626]',
  ADVANCE: 'bg-[#DC2626]/10 text-[#DC2626]',
  FOOD: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  FUEL_ADVANCE: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  TOLL: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  MAINTENANCE: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  OTHER: 'bg-[#7A9AB8]/10 text-[#7A9AB8]',
};

const CREDIT_TYPES = ['EXTRA_DUTY', 'BONUS', 'SALARY'];
const DEBIT_TYPES = ['ADVANCE_RECOVERY', 'PENALTY', 'FOOD', 'FUEL_ADVANCE', 'TOLL', 'MAINTENANCE', 'ADVANCE'];

const inputClass = 'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-[#0D2847] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20 font-["Rajdhani"] text-sm';

function isCredit(type: string, amount: number): boolean {
  if (CREDIT_TYPES.includes(type)) return true;
  if (DEBIT_TYPES.includes(type)) return false;
  return amount >= 0;
}

export default function DriverLedgerPage() {
  const qc = useQueryClient();
  const now = new Date();

  const [selectedDriver, setSelectedDriver] = useState('');
  const [filterType, setFilterType] = useState('thisMonth');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [financialYear, setFinancialYear] = useState('2025-26');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewTriggered, setViewTriggered] = useState(false);
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: driversRaw = [] } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: async () => {
      try {
        const r = await api.get('/drivers?limit=200');
        return r.data?.data ?? r.data ?? [];
      } catch { return []; }
    },
  });

  const driverOpts = useMemo(() =>
    (Array.isArray(driversRaw) ? driversRaw : []).map((d: any) => ({
      id: String(d.id),
      name: `${String(d.name || 'Driver')}${d.employeeCode ? ` (${String(d.employeeCode)})` : ''}`,
      rawName: String(d.name || 'Driver'),
    })),
  [driversRaw]);

  const selectedDriverName = driverOpts.find(d => d.id === selectedDriver)?.rawName || 'Driver';

  const getQueryParams = () => {
    const params: Record<string, string> = {};
    if (selectedDriver) params.driverId = selectedDriver;

    switch (filterType) {
      case 'thisMonth':
        params.filterType = 'month';
        params.month = String(now.getMonth() + 1);
        params.year = String(now.getFullYear());
        break;
      case 'month':
        params.filterType = 'month';
        params.month = String(month);
        params.year = String(year);
        break;
      case 'last2':
      case 'last3':
      case 'last6':
      case 'last12':
        params.filterType = 'lastX';
        params.lastMonths = filterType.replace('last', '');
        break;
      case 'year':
        params.filterType = 'year';
        params.financialYear = financialYear;
        break;
      case 'custom':
        params.filterType = 'custom';
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        break;
      case 'all':
        params.filterType = 'all';
        break;
    }
    return params;
  };

  const canFetch = !!selectedDriver && viewTriggered;
  const queryParams = getQueryParams();

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['driver-ledger', queryParams],
    queryFn: async () => {
      const r = await api.get('/driver-ledger', { params: { ...queryParams, limit: 500 } });
      return r.data;
    },
    enabled: canFetch,
  });

  const entries: any[] = useMemo(() => {
    if (Array.isArray(ledgerData?.entries)) return ledgerData.entries;
    if (Array.isArray(ledgerData?.data)) return ledgerData.data;
    if (Array.isArray(ledgerData)) return ledgerData;
    return [];
  }, [ledgerData]);

  const summaryFromApi = ledgerData?.summary;

  const { totalCredits, totalDebits, entryCount } = useMemo(() => {
    if (summaryFromApi) {
      return {
        totalCredits: Number(summaryFromApi.totalCredits ?? 0),
        totalDebits: Number(summaryFromApi.totalDebits ?? 0),
        entryCount: Number(summaryFromApi.entryCount ?? entries.length),
      };
    }
    let cr = 0, dr = 0;
    for (const e of entries) {
      const amt = Number(e.amount ?? 0);
      if (isCredit(String(e.type ?? ''), amt)) cr += amt;
      else dr += amt;
    }
    return { totalCredits: cr, totalDebits: dr, entryCount: entries.length };
  }, [entries, summaryFromApi]);

  const net = totalCredits - totalDebits;

  const createMut = useMutation({
    mutationFn: (payload: any) => api.post('/driver-ledger', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-ledger'] });
      toast.success('Entry added');
      setAddEntryOpen(false);
    },
    onError: () => toast.error('Failed to add entry'),
  });

  useEffect(() => { setViewTriggered(false); }, [selectedDriver, filterType, month, year, financialYear, startDate, endDate]);

  const handleView = () => {
    if (!selectedDriver) { toast.error('Please select a driver'); return; }
    if (filterType === 'custom' && (!startDate || !endDate)) { toast.error('Select start and end dates'); return; }
    setViewTriggered(true);
  };

  const downloadPDF = async () => {
    if (!selectedDriver) { toast.error('Please select a driver'); return; }
    setPdfLoading(true);
    try {
      const params = getQueryParams();
      const qs = new URLSearchParams(params).toString();
      const response = await api.post(`/driver-ledger/pdf/${selectedDriver}?${qs}`, {}, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Ledger_${selectedDriverName.replace(/\s/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch { toast.error('Failed to download PDF'); }
    finally { setPdfLoading(false); }
  };

  const quickFilter = (ft: string) => {
    setFilterType(ft);
    setTimeout(() => {
      if (selectedDriver) setViewTriggered(true);
    }, 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-['Oswald'] text-2xl font-bold text-[#0D2847] tracking-wide">DRIVER LEDGER</h1>
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">Daily transactions — extra duty, advance recovery, bonus, expenses</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E0E8F0] rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Driver */}
          <div className="flex-1 min-w-[180px]">
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Driver</label>
            <select className={inputClass} value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
              <option value="">Select Driver</option>
              {driverOpts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {/* Filter Type */}
          <div className="w-44">
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Period</label>
            <select className={inputClass} value={filterType} onChange={e => setFilterType(e.target.value)}>
              {FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* Conditional inputs */}
          {filterType === 'month' && (
            <>
              <div className="w-36">
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Month</label>
                <select className={inputClass} value={month} onChange={e => setMonth(Number(e.target.value))}>
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Year</label>
                <select className={inputClass} value={year} onChange={e => setYear(Number(e.target.value))}>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}
          {filterType === 'year' && (
            <div className="w-36">
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Financial Year</label>
              <select className={inputClass} value={financialYear} onChange={e => setFinancialYear(e.target.value)}>
                {FY_OPTIONS.map(fy => <option key={fy} value={fy}>FY {fy}</option>)}
              </select>
            </div>
          )}
          {filterType === 'custom' && (
            <>
              <div className="w-40">
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Start Date</label>
                <input type="date" className={inputClass} value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="w-40">
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">End Date</label>
                <input type="date" className={inputClass} value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </>
          )}
          {/* Buttons */}
          <button onClick={handleView} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847] h-[38px]">
            <Search className="w-4 h-4" /> View
          </button>
          <button onClick={downloadPDF} disabled={!selectedDriver || pdfLoading} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#0D2847] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#1A4A7A] disabled:opacity-50 h-[38px]">
            <Download className="w-4 h-4" /> {pdfLoading ? 'Downloading...' : 'PDF'}
          </button>
        </div>

        {/* Quick filter pills */}
        {selectedDriver && (
          <div className="flex flex-wrap gap-1.5">
            {[
              { ft: 'thisMonth', label: 'This Month' },
              { ft: 'last3', label: 'Last 3M' },
              { ft: 'last6', label: 'Last 6M' },
              { ft: 'year', label: `FY ${financialYear}` },
              { ft: 'all', label: 'All' },
            ].map(p => (
              <button key={p.ft} onClick={() => quickFilter(p.ft)}
                className={`px-3 py-1 rounded-full text-xs font-['Barlow_Condensed'] uppercase tracking-wider transition-colors ${
                  filterType === p.ft ? 'bg-[#1565C0] text-white' : 'bg-[#F4F6F8] text-[#1A4A7A] hover:bg-[#E0E8F0]'
                }`}>{p.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {canFetch && !isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E0E8F0] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#16A34A]/15 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-[#16A34A]" /></div>
              <div>
                <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Total Credits</p>
                <p className="font-['Oswald'] text-lg font-bold text-[#16A34A]">{formatIndianCurrency(totalCredits)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#E0E8F0] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#DC2626]/15 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-[#DC2626]" /></div>
              <div>
                <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Total Debits</p>
                <p className="font-['Oswald'] text-lg font-bold text-[#DC2626]">{formatIndianCurrency(totalDebits)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border-2 border-[#1565C0] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1565C0]/15 flex items-center justify-center"><Banknote className="w-5 h-5 text-[#1565C0]" /></div>
              <div>
                <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Net (Cr - Dr)</p>
                <p className={`font-['Oswald'] text-xl font-bold ${net >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{formatIndianCurrency(net)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#E0E8F0] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#7A9AB8]/15 flex items-center justify-center"><Hash className="w-5 h-5 text-[#7A9AB8]" /></div>
              <div>
                <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Entries</p>
                <p className="font-['Oswald'] text-lg font-bold text-[#0D2847]">{entryCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      {canFetch && (
        <div className="bg-white border border-[#E0E8F0] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E0E8F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#42A5F5]" />
              <span className="font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#1A4A7A] text-sm">
                Ledger — {selectedDriverName}
              </span>
            </div>
            <button onClick={() => setAddEntryOpen(true)} disabled={!selectedDriver}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-xs hover:bg-[#0D2847] disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" /> Add Entry
            </button>
          </div>

          {isLoading ? (
            <div className="p-8"><LoadingSpinner text="Loading ledger..." /></div>
          ) : entries.length === 0 ? (
            <EmptyState message="No ledger entries for this period" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                    {['Date', 'Description', 'Type', 'Credit (₹)', 'Debit (₹)'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#1A4A7A]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E8F0]">
                  {entries.map((e: any, idx: number) => {
                    const amt = Number(e.amount ?? 0);
                    const credit = isCredit(String(e.type ?? ''), amt);
                    const typeStr = String(e.type ?? 'OTHER');
                    return (
                      <tr key={String(e.id ?? idx)} className={idx % 2 === 1 ? 'bg-[#F8F9FA]' : ''}>
                        <td className="px-4 py-2.5 font-['Rajdhani'] text-[#0D2847] whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="px-4 py-2.5 font-['Rajdhani'] text-[#0D2847]">{typeof e.description === 'string' ? e.description : '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-['Barlow_Condensed'] font-semibold uppercase ${TYPE_BADGES[typeStr] ?? TYPE_BADGES.OTHER}`}>
                            {typeStr.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-['Oswald'] font-semibold text-[#16A34A] text-right tabular-nums">{credit ? formatIndianCurrency(amt) : ''}</td>
                        <td className="px-4 py-2.5 font-['Oswald'] font-semibold text-[#DC2626] text-right tabular-nums">{!credit ? formatIndianCurrency(Math.abs(amt)) : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F4F6F8] border-t-2 border-[#0D2847]">
                    <td colSpan={3} className="px-4 py-3 font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wider text-[#0D2847]">Total</td>
                    <td className="px-4 py-3 font-['Oswald'] text-base font-bold text-[#16A34A] text-right tabular-nums">{formatIndianCurrency(totalCredits)}</td>
                    <td className="px-4 py-3 font-['Oswald'] text-base font-bold text-[#DC2626] text-right tabular-nums">{formatIndianCurrency(totalDebits)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {!canFetch && (
        <div className="bg-white border border-[#E0E8F0] rounded-xl p-12">
          <EmptyState message="Select a driver and click View" description="Choose a driver and period from the filters above" />
        </div>
      )}

      <AddEntryModal
        isOpen={addEntryOpen}
        onClose={() => setAddEntryOpen(false)}
        driverId={selectedDriver}
        onSave={(payload: any) => createMut.mutate(payload)}
        isPending={createMut.isPending}
      />
    </div>
  );
}

function AddEntryModal({ isOpen, onClose, driverId, onSave, isPending }: {
  isOpen: boolean; onClose: () => void; driverId: string; onSave: (p: any) => void; isPending: boolean;
}) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), type: 'EXTRA_DUTY' as string, description: '', amount: '' });
  const reset = () => setForm({ date: new Date().toISOString().slice(0, 10), type: 'EXTRA_DUTY', description: '', amount: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const type = form.type;
    const isCr = CREDIT_TYPES.includes(type) || (type === 'OTHER' && Number(form.amount) >= 0);
    const d = new Date(form.date);
    onSave({ driverId, date: form.date, type, category: type, description: form.description, amount: Number(form.amount), isCredit: isCr, month: d.getMonth() + 1, year: d.getFullYear() });
    reset();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Add Ledger Entry">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Date *</label>
          <input type="date" className={inputClass} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Type *</label>
          <select className={inputClass} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Description *</label>
          <input className={inputClass} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Zepto Blinkit Extra Duty" required />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Amount (₹) *</label>
          <input type="number" className={inputClass} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} min={1} step="0.01" required />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#E0E8F0]">
          <button type="button" onClick={() => { reset(); onClose(); }} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm">Cancel</button>
          <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm disabled:opacity-50">{isPending ? 'Saving...' : 'Add Entry'}</button>
        </div>
      </form>
    </Modal>
  );
}
