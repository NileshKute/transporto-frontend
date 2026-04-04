'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatIndianCurrency, formatDate, cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  BookOpen, Plus, Download, Search, TrendingUp, TrendingDown, Banknote,
  Hash, CheckCircle, Clock, CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermission } from '@/hooks/usePermission';

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

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
];

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
  const canViewLedger = usePermission('driver-ledger', 'view');
  const canCreate = usePermission('driver-ledger', 'create');
  const canMarkPaid = usePermission('driver-ledger', 'mark-paid');
  const canDownload = usePermission('driver-ledger', 'download');

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
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPaidEntry, setMarkPaidEntry] = useState<any>(null);
  const [paymentInfoEntry, setPaymentInfoEntry] = useState<any>(null);

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
      case 'last2': case 'last3': case 'last6': case 'last12':
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

  const summary = useMemo(() => {
    if (summaryFromApi) {
      return {
        totalCredits: Number(summaryFromApi.totalCredits ?? 0),
        totalDebits: Number(summaryFromApi.totalDebits ?? 0),
        paidCount: Number(summaryFromApi.paidCount ?? 0),
        unpaidCount: Number(summaryFromApi.unpaidCount ?? 0),
        paidTotal: Number(summaryFromApi.paidTotal ?? 0),
        unpaidTotal: Number(summaryFromApi.unpaidTotal ?? 0),
        entryCount: Number(summaryFromApi.entryCount ?? entries.length),
      };
    }
    let cr = 0, dr = 0, pc = 0, uc = 0, pt = 0, ut = 0;
    for (const e of entries) {
      const amt = Math.abs(Number(e.amount ?? 0));
      if (isCredit(String(e.type ?? ''), Number(e.amount ?? 0))) cr += amt;
      else dr += amt;
      if (e.isPaid) { pc++; pt += amt; }
      else { uc++; ut += amt; }
    }
    return { totalCredits: cr, totalDebits: dr, paidCount: pc, unpaidCount: uc, paidTotal: pt, unpaidTotal: ut, entryCount: entries.length };
  }, [entries, summaryFromApi]);

  const net = summary.totalCredits - summary.totalDebits;

  const createMut = useMutation({
    mutationFn: (payload: any) => api.post('/driver-ledger', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-ledger'] });
      toast.success('Entry added');
      setAddEntryOpen(false);
    },
    onError: () => toast.error('Failed to add entry'),
  });

  const markPaidMut = useMutation({
    mutationFn: ({ id, ...payload }: any) => api.put(`/driver-ledger/${id}/mark-paid`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-ledger'] });
      toast.success('Marked as paid');
      setMarkPaidOpen(false);
      setMarkPaidEntry(null);
    },
    onError: () => toast.error('Failed to mark as paid'),
  });

  useEffect(() => { setViewTriggered(false); }, [selectedDriver, filterType, month, year, financialYear, startDate, endDate]);

  const handleView = () => {
    if (!canViewLedger) { toast.error('You do not have permission to view the driver ledger'); return; }
    if (!selectedDriver) { toast.error('Please select a driver'); return; }
    if (filterType === 'custom' && (!startDate || !endDate)) { toast.error('Select start and end dates'); return; }
    setViewTriggered(true);
  };

  const downloadPDF = async () => {
    if (!canDownload) { toast.error('You do not have permission to download ledger PDFs'); return; }
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
    if (!canViewLedger) { toast.error('You do not have permission to view the driver ledger'); return; }
    setFilterType(ft);
    setTimeout(() => { if (selectedDriver) setViewTriggered(true); }, 0);
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
          <div className="flex-1 min-w-[180px]">
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Driver</label>
            <select className={inputClass} value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
              <option value="">Select Driver</option>
              {driverOpts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="w-44">
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Period</label>
            <select className={inputClass} value={filterType} onChange={e => setFilterType(e.target.value)}>
              {FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
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
          <button
            onClick={handleView}
            disabled={!canViewLedger}
            title={!canViewLedger ? 'No permission to view ledger' : undefined}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847] h-[38px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Search className="w-4 h-4" /> View
          </button>
          {canDownload && (
            <button onClick={downloadPDF} disabled={!selectedDriver || pdfLoading} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#0D2847] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#1A4A7A] disabled:opacity-50 h-[38px]">
              <Download className="w-4 h-4" /> {pdfLoading ? 'Downloading...' : 'PDF'}
            </button>
          )}
        </div>
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
                <p className="font-['Oswald'] text-lg font-bold text-[#16A34A]">{formatIndianCurrency(summary.totalCredits)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#E0E8F0] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#DC2626]/15 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-[#DC2626]" /></div>
              <div>
                <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Total Debits</p>
                <p className="font-['Oswald'] text-lg font-bold text-[#DC2626]">{formatIndianCurrency(summary.totalDebits)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#E0E8F0] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#16A34A]/15 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-[#16A34A]" /></div>
              <div>
                <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Paid Entries</p>
                <p className="font-['Oswald'] text-lg font-bold text-[#16A34A]">{summary.paidCount}</p>
                <p className="font-['Rajdhani'] text-xs text-[#7A9AB8]">{formatIndianCurrency(summary.paidTotal)} settled</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#E0E8F0] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/15 flex items-center justify-center"><Clock className="w-5 h-5 text-[#F59E0B]" /></div>
              <div>
                <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Pending</p>
                <p className="font-['Oswald'] text-lg font-bold text-[#F59E0B]">{summary.unpaidCount}</p>
                <p className="font-['Rajdhani'] text-xs text-[#7A9AB8]">{formatIndianCurrency(summary.unpaidTotal)} for salary</p>
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
            {canCreate && (
              <button onClick={() => setAddEntryOpen(true)} disabled={!selectedDriver}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-xs hover:bg-[#0D2847] disabled:opacity-50">
                <Plus className="w-3.5 h-3.5" /> Add Entry
              </button>
            )}
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
                    {['Date', 'Description', 'Type', 'Credit (₹)', 'Debit (₹)', 'Status', ...(canMarkPaid ? ['Actions'] as const : [])].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#1A4A7A]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E8F0]">
                  {entries.map((e: any, idx: number) => {
                    const amt = Number(e.amount ?? 0);
                    const credit = isCredit(String(e.type ?? ''), amt);
                    const typeStr = String(e.type ?? 'OTHER');
                    const paid = e.isPaid === true;
                    return (
                      <tr key={String(e.id ?? idx)} className={idx % 2 === 1 ? 'bg-[#F8F9FA]' : ''}>
                        <td className="px-3 py-2.5 font-['Rajdhani'] text-[#0D2847] whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="px-3 py-2.5 font-['Rajdhani'] text-[#0D2847] max-w-[200px] truncate">{typeof e.description === 'string' ? e.description : '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-['Barlow_Condensed'] font-semibold uppercase ${TYPE_BADGES[typeStr] ?? TYPE_BADGES.OTHER}`}>
                            {typeStr.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-['Oswald'] font-semibold text-[#16A34A] text-right tabular-nums">{credit ? formatIndianCurrency(Math.abs(amt)) : ''}</td>
                        <td className="px-3 py-2.5 font-['Oswald'] font-semibold text-[#DC2626] text-right tabular-nums">{!credit ? formatIndianCurrency(Math.abs(amt)) : ''}</td>
                        <td className="px-3 py-2.5">
                          {paid ? (
                            <button
                              onClick={() => setPaymentInfoEntry(e)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-['Barlow_Condensed'] font-semibold uppercase bg-[#16A34A]/10 text-[#16A34A] hover:bg-[#16A34A]/20 cursor-pointer"
                            >
                              <CheckCircle className="w-3 h-3" /> PAID
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-['Barlow_Condensed'] font-semibold uppercase bg-[#F59E0B]/10 text-[#F59E0B]">
                              <Clock className="w-3 h-3" /> PENDING
                            </span>
                          )}
                        </td>
                        {canMarkPaid && (
                          <td className="px-3 py-2.5">
                            {!paid && (
                              <button
                                onClick={() => { setMarkPaidEntry(e); setMarkPaidOpen(true); }}
                                className="px-2 py-1 rounded text-[10px] font-['Barlow_Condensed'] font-semibold uppercase bg-[#16A34A]/10 text-[#16A34A] hover:bg-[#16A34A]/20"
                              >
                                Mark Paid
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F4F6F8] border-t-2 border-[#0D2847]">
                    <td colSpan={3} className="px-3 py-3 font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wider text-[#0D2847]">Total</td>
                    <td className="px-3 py-3 font-['Oswald'] text-base font-bold text-[#16A34A] text-right tabular-nums">{formatIndianCurrency(summary.totalCredits)}</td>
                    <td className="px-3 py-3 font-['Oswald'] text-base font-bold text-[#DC2626] text-right tabular-nums">{formatIndianCurrency(summary.totalDebits)}</td>
                    <td colSpan={canMarkPaid ? 2 : 1} className="px-3 py-3 font-['Oswald'] text-base font-bold text-right tabular-nums">
                      <span className="text-[#7A9AB8] text-xs font-['Barlow_Condensed'] mr-2">NET</span>
                      <span className={net >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}>{formatIndianCurrency(net)}</span>
                    </td>
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

      {/* Add Entry Modal */}
      <AddEntryModal
        isOpen={addEntryOpen}
        onClose={() => setAddEntryOpen(false)}
        driverId={selectedDriver}
        onSave={(payload: any) => createMut.mutate(payload)}
        isPending={createMut.isPending}
      />

      {/* Mark Entry Paid Modal */}
      <Modal isOpen={markPaidOpen} onClose={() => { setMarkPaidOpen(false); setMarkPaidEntry(null); }} title="Mark Entry as Paid">
        {markPaidEntry && (
          <MarkPaidForm
            entry={markPaidEntry}
            onSave={(p: any) => markPaidMut.mutate({ id: markPaidEntry.id, ...p })}
            isPending={markPaidMut.isPending}
            onCancel={() => { setMarkPaidOpen(false); setMarkPaidEntry(null); }}
          />
        )}
      </Modal>

      {/* Payment Info Popover Modal */}
      <Modal isOpen={!!paymentInfoEntry} onClose={() => setPaymentInfoEntry(null)} title="Payment Details">
        {paymentInfoEntry && <PaymentInfo entry={paymentInfoEntry} />}
      </Modal>
    </div>
  );
}

/* ── Add Entry Modal ── */
function AddEntryModal({ isOpen, onClose, driverId, onSave, isPending }: {
  isOpen: boolean; onClose: () => void; driverId: string; onSave: (p: any) => void; isPending: boolean;
}) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10), type: 'EXTRA_DUTY' as string,
    description: '', amount: '', isPaid: false, paidMode: 'CASH', paidRef: '', paidBy: 'Ganesh Kute',
  });
  const reset = () => {
    setForm({
      date: new Date().toISOString().slice(0, 10), type: 'EXTRA_DUTY',
      description: '', amount: '', isPaid: false, paidMode: 'CASH', paidRef: '', paidBy: 'Ganesh Kute',
    });
    setValidationErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!driverId?.trim()) errors.driverId = 'Driver is required';
    if (!form.type?.trim()) errors.type = 'Entry type is required';
    if (!form.date?.trim()) errors.date = 'Date is required';
    const amt = Number(form.amount);
    if (form.amount === '' || !Number.isFinite(amt) || amt <= 0) {
      errors.amount = 'Valid amount is required';
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    const type = form.type;
    const isCr = CREDIT_TYPES.includes(type) || (type === 'OTHER' && Number(form.amount) >= 0);
    const d = new Date(form.date);
    onSave({
      driverId, date: form.date, type, category: type, description: form.description,
      amount: Number(form.amount), isCredit: isCr, month: d.getMonth() + 1, year: d.getFullYear(),
      isPaid: form.isPaid,
      ...(form.isPaid ? { paidMode: form.paidMode, paidRef: form.paidRef || undefined, paidBy: form.paidBy } : {}),
    });
    reset();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Add Ledger Entry">
      <form onSubmit={handleSubmit} className="space-y-4">
        {validationErrors.driverId && (
          <p className="text-red-600 text-xs font-['Rajdhani']">{validationErrors.driverId}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Date *</label>
            <input
              type="date"
              className={cn(inputClass, validationErrors.date && 'border-red-500 ring-1 ring-red-500/25')}
              value={form.date}
              onChange={(e) => {
                setForm((f) => ({ ...f, date: e.target.value }));
                setValidationErrors((prev) => {
                  const next = { ...prev };
                  delete next.date;
                  return next;
                });
              }}
            />
            {validationErrors.date && <p className="text-red-600 text-xs mt-1 font-['Rajdhani']">{validationErrors.date}</p>}
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Type *</label>
            <select
              className={cn(inputClass, validationErrors.type && 'border-red-500 ring-1 ring-red-500/25')}
              value={form.type}
              onChange={(e) => {
                setForm((f) => ({ ...f, type: e.target.value }));
                setValidationErrors((prev) => {
                  const next = { ...prev };
                  delete next.type;
                  return next;
                });
              }}
            >
              {ENTRY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            {validationErrors.type && <p className="text-red-600 text-xs mt-1 font-['Rajdhani']">{validationErrors.type}</p>}
          </div>
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Description *</label>
          <input className={inputClass} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Zepto Blinkit Extra Duty" />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Amount (₹) *</label>
          <input
            type="number"
            className={cn(inputClass, validationErrors.amount && 'border-red-500 ring-1 ring-red-500/25')}
            value={form.amount}
            onChange={(e) => {
              setForm((f) => ({ ...f, amount: e.target.value }));
              setValidationErrors((prev) => {
                const next = { ...prev };
                delete next.amount;
                return next;
              });
            }}
            min={0}
            step="0.01"
          />
          {validationErrors.amount && <p className="text-red-600 text-xs mt-1 font-['Rajdhani']">{validationErrors.amount}</p>}
        </div>

        {/* Already Paid Toggle */}
        <div className="border border-[#E0E8F0] rounded-lg p-3 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isPaid} onChange={e => setForm(f => ({ ...f, isPaid: e.target.checked }))}
              className="w-4 h-4 rounded border-[#E0E8F0] text-[#16A34A] focus:ring-[#16A34A]" />
            <span className="font-['Barlow_Condensed'] text-sm font-semibold uppercase tracking-wider text-[#0D2847]">Already Paid?</span>
            <span className="font-['Rajdhani'] text-xs text-[#7A9AB8]">Check if money was already exchanged</span>
          </label>
          {form.isPaid && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E0E8F0]">
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Payment Mode</label>
                <select className={inputClass} value={form.paidMode} onChange={e => setForm(f => ({ ...f, paidMode: e.target.value }))}>
                  {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Reference</label>
                <input className={inputClass} value={form.paidRef} onChange={e => setForm(f => ({ ...f, paidRef: e.target.value }))} placeholder="UTR / Cheque No" />
              </div>
              <div className="col-span-2">
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Paid By</label>
                <input className={inputClass} value={form.paidBy} onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#E0E8F0]">
          <button type="button" onClick={() => { reset(); onClose(); }} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm">Cancel</button>
          <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm disabled:opacity-50">{isPending ? 'Saving...' : 'Add Entry'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Mark Paid Form ── */
function MarkPaidForm({ entry, onSave, isPending, onCancel }: {
  entry: any; onSave: (p: any) => void; isPending: boolean; onCancel: () => void;
}) {
  const [form, setForm] = useState({ paidMode: 'CASH', paidRef: '', paidBy: 'Ganesh Kute', paidNotes: '' });
  const amt = Math.abs(Number(entry.amount ?? 0));
  const typeStr = String(entry.type ?? '').replace(/_/g, ' ');

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div className="border border-[#E0E8F0] rounded-lg p-3 bg-[#F4F6F8]">
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">{typeStr} — {typeof entry.description === 'string' ? entry.description : ''}</p>
        <p className="font-['Oswald'] text-lg font-bold text-[#0D2847] mt-1">{formatIndianCurrency(amt)}</p>
      </div>
      <div>
        <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Payment Mode *</label>
        <select className={inputClass} value={form.paidMode} onChange={e => setForm(f => ({ ...f, paidMode: e.target.value }))}>
          {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Transaction Reference</label>
        <input className={inputClass} value={form.paidRef} onChange={e => setForm(f => ({ ...f, paidRef: e.target.value }))} placeholder="UTR number, cheque no, UPI ref..." />
      </div>
      <div>
        <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Paid By *</label>
        <input className={inputClass} value={form.paidBy} onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))} required />
      </div>
      <div>
        <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Notes</label>
        <textarea className={inputClass} rows={2} value={form.paidNotes} onChange={e => setForm(f => ({ ...f, paidNotes: e.target.value }))} placeholder="Optional notes" />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#E0E8F0]">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm">Cancel</button>
        <button type="submit" disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#16A34A] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm disabled:opacity-50">
          <CheckCircle className="w-3.5 h-3.5" /> {isPending ? 'Saving...' : 'Confirm Payment'}
        </button>
      </div>
    </form>
  );
}

/* ── Payment Info Display ── */
function PaymentInfo({ entry }: { entry: any }) {
  return (
    <div className="space-y-3">
      <div className="border border-[#16A34A]/30 bg-[#16A34A]/5 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-4 h-4 text-[#16A34A]" />
          <span className="font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#16A34A] text-sm">Payment Details</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <span className="font-['Rajdhani'] text-[#7A9AB8]">Amount</span>
          <span className="font-['Oswald'] font-semibold text-[#0D2847]">{formatIndianCurrency(Math.abs(Number(entry.amount ?? 0)))}</span>
          <span className="font-['Rajdhani'] text-[#7A9AB8]">Type</span>
          <span className="font-['Rajdhani'] font-semibold text-[#0D2847]">{String(entry.type ?? '').replace(/_/g, ' ')}</span>
          {entry.paidDate && (
            <>
              <span className="font-['Rajdhani'] text-[#7A9AB8]">Paid on</span>
              <span className="font-['Rajdhani'] font-semibold text-[#0D2847]">{formatDate(entry.paidDate)}</span>
            </>
          )}
          {entry.paidMode && (
            <>
              <span className="font-['Rajdhani'] text-[#7A9AB8]">Mode</span>
              <span className="font-['Rajdhani'] font-semibold text-[#0D2847]">{String(entry.paidMode).replace(/_/g, ' ')}</span>
            </>
          )}
          {entry.paidRef && (
            <>
              <span className="font-['Rajdhani'] text-[#7A9AB8]">Reference</span>
              <span className="font-mono text-xs text-[#0D2847]">{String(entry.paidRef)}</span>
            </>
          )}
          {entry.paidBy && (
            <>
              <span className="font-['Rajdhani'] text-[#7A9AB8]">Paid By</span>
              <span className="font-['Rajdhani'] font-semibold text-[#0D2847]">{String(entry.paidBy)}</span>
            </>
          )}
        </div>
        {entry.paidNotes && (
          <p className="font-['Rajdhani'] text-xs text-[#7A9AB8] mt-2 pt-2 border-t border-[#16A34A]/20">{String(entry.paidNotes)}</p>
        )}
      </div>
    </div>
  );
}
