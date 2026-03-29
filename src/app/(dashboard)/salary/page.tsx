'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatIndianCurrency, formatDate } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Wallet, Users, CheckCircle, Calculator, Eye, CircleDollarSign, CreditCard, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_BADGES: Record<string, string> = {
  PENDING: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  CALCULATED: 'bg-[#1565C0]/10 text-[#1565C0]',
  APPROVED: 'bg-[#42A5F5]/10 text-[#42A5F5]',
  PAID: 'bg-[#16A34A]/10 text-[#16A34A]',
  PARTIAL: 'bg-[#F59E0B]/10 text-[#F59E0B]',
};

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
];

const inputClass = 'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-[#0D2847] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20 font-["Rajdhani"] text-sm';

export default function SalaryPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payRecord, setPayRecord] = useState<any>(null);

  const { data: salaryData, isLoading } = useQuery({
    queryKey: ['driver-salary', month, year],
    queryFn: async () => {
      const r = await api.get('/driver-salary', { params: { month, year, limit: 200 } });
      return r.data;
    },
  });

  const records = salaryData?.data ?? [];

  const stats = useMemo(() => {
    let totalPayroll = 0, paid = 0, pending = 0;
    for (const r of records) {
      const net = Number(r.netPayable ?? 0);
      const paidAmt = Number(r.paidAmount ?? 0);
      totalPayroll += net;
      paid += paidAmt;
      if (String(r.status ?? '') !== 'PAID') pending += net - paidAmt;
    }
    return { totalPayroll, paid, pending, count: records.length };
  }, [records]);

  const calcAllMut = useMutation({
    mutationFn: () => api.post('/driver-salary/calculate-all', { month, year }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['driver-salary'] });
      const count = r.data?.count ?? 0;
      toast.success(`Calculated salary for ${count} drivers`);
    },
    onError: () => toast.error('Failed to calculate'),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.put(`/driver-salary/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-salary'] });
      toast.success('Salary approved');
    },
    onError: () => toast.error('Failed to approve'),
  });

  const payMut = useMutation({
    mutationFn: ({ id, ...payload }: any) => api.put(`/driver-salary/${id}/pay`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-salary'] });
      toast.success('Payment recorded');
      setPayOpen(false);
      setPayRecord(null);
    },
    onError: () => toast.error('Failed to record payment'),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-['Oswald'] text-2xl font-bold text-[#0D2847] tracking-wide">DRIVER SALARY</h1>
          <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">Monthly salary calculation, approval, and payments</p>
        </div>
        <div className="flex items-center gap-3">
          <select className={inputClass + ' w-36'} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
          <input type="number" className={inputClass + ' w-24'} value={year} onChange={e => setYear(Number(e.target.value))} min={2020} max={2030} />
          <button
            onClick={() => calcAllMut.mutate()}
            disabled={calcAllMut.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847] disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" />
            {calcAllMut.isPending ? 'Calculating...' : 'Calculate All'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Payroll', value: formatIndianCurrency(stats.totalPayroll), icon: Wallet, color: '#0D2847' },
          { label: 'Paid', value: formatIndianCurrency(stats.paid), icon: CheckCircle, color: '#16A34A' },
          { label: 'Pending', value: formatIndianCurrency(stats.pending), icon: CircleDollarSign, color: '#F59E0B' },
          { label: 'Drivers', value: String(stats.count), icon: Users, color: '#1565C0' },
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

      {/* Salary Table */}
      <div className="bg-white border border-[#E0E8F0] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E0E8F0] flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#42A5F5]" />
          <span className="font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#1A4A7A] text-sm">Salary Records</span>
        </div>

        {isLoading ? (
          <div className="p-8"><LoadingSpinner text="Loading salary data..." /></div>
        ) : records.length === 0 ? (
          <div className="p-8">
            <EmptyState message="No salary records for this month. Click 'Calculate All' to generate." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  {['Driver','Code','Base Salary','Advances','Extra Duty','Bonus','Penalty','Net Payable','Status','Actions'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#1A4A7A] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E8F0]">
                {records.map((r: any) => {
                  const st = String(r.status ?? 'PENDING');
                  const isPaid = st === 'PAID';
                  return (
                    <tr key={r.id} className="hover:bg-[#F4F6F8]/50">
                      <td className="px-3 py-2.5 font-['Rajdhani'] text-[#0D2847] font-medium">{typeof r.driver === 'object' && r.driver ? String(r.driver.name ?? '—') : '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-[#42A5F5]">{typeof r.driver === 'object' && r.driver ? String(r.driver.employeeCode ?? '—') : '—'}</td>
                      <td className="px-3 py-2.5 font-['Oswald'] text-[#0D2847]">{formatIndianCurrency(Number(r.baseSalary ?? 0))}</td>
                      <td className="px-3 py-2.5 font-['Oswald'] text-[#DC2626]">{formatIndianCurrency(Number(r.totalAdvances ?? 0))}</td>
                      <td className="px-3 py-2.5 font-['Oswald'] text-[#1565C0]">{formatIndianCurrency(Number(r.extraDutyPay ?? 0))}</td>
                      <td className="px-3 py-2.5 font-['Oswald'] text-[#16A34A]">{formatIndianCurrency(Number(r.bonuses ?? 0))}</td>
                      <td className="px-3 py-2.5 font-['Oswald'] text-[#DC2626]">{formatIndianCurrency(Number(r.penalties ?? 0))}</td>
                      <td className="px-3 py-2.5 font-['Oswald'] font-bold text-[#0D2847]">{formatIndianCurrency(Number(r.netPayable ?? 0))}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-['Barlow_Condensed'] font-semibold uppercase ${STATUS_BADGES[st] ?? STATUS_BADGES.PENDING}`}>
                          {st}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setDetailRecord(r); setDetailOpen(true); }} className="p-1.5 rounded hover:bg-[#42A5F5]/10 text-[#42A5F5]" title="View Details"><Eye className="w-3.5 h-3.5" /></button>
                          {(st === 'CALCULATED' || st === 'PENDING') && (
                            <button onClick={() => approveMut.mutate(r.id)} disabled={approveMut.isPending} className="p-1.5 rounded hover:bg-[#16A34A]/10 text-[#16A34A]" title="Approve"><CheckCircle className="w-3.5 h-3.5" /></button>
                          )}
                          {!isPaid && (
                            <button onClick={() => { setPayRecord(r); setPayOpen(true); }} className="p-1.5 rounded hover:bg-[#16A34A]/10 text-[#16A34A]" title="Mark as Paid"><CircleDollarSign className="w-3.5 h-3.5" /></button>
                          )}
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

      {/* Detail Modal */}
      <Modal isOpen={detailOpen} onClose={() => { setDetailOpen(false); setDetailRecord(null); }} title="Salary Details" size="lg">
        {detailRecord && <SalaryDetail record={detailRecord} />}
      </Modal>

      {/* Pay Modal */}
      <Modal isOpen={payOpen} onClose={() => { setPayOpen(false); setPayRecord(null); }} title="Mark as Paid">
        {payRecord && (
          <PayForm
            record={payRecord}
            onSave={(p: any) => payMut.mutate({ id: payRecord.id, ...p })}
            isPending={payMut.isPending}
            onCancel={() => { setPayOpen(false); setPayRecord(null); }}
          />
        )}
      </Modal>
    </div>
  );
}

function SalaryDetail({ record }: { record: any }) {
  const net = Number(record.netPayable ?? 0);
  const paid = Number(record.paidAmount ?? 0);
  const st = String(record.status ?? '');
  const isPaid = st === 'PAID';
  const rows = [
    { label: 'Base Salary', value: Number(record.baseSalary ?? 0), sign: '' },
    { label: 'Total Advances', value: Number(record.totalAdvances ?? 0), sign: '(-)' },
    { label: 'Extra Duty Pay', value: Number(record.extraDutyPay ?? 0), sign: '(+)' },
    { label: 'Bonuses', value: Number(record.bonuses ?? 0), sign: '(+)' },
    { label: 'Penalties', value: Number(record.penalties ?? 0), sign: '(-)' },
    { label: 'Other Credits', value: Number(record.otherCredits ?? 0), sign: '(+)' },
    { label: 'Other Debits', value: Number(record.otherDebits ?? 0), sign: '(-)' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1565C0]/10 flex items-center justify-center text-[#1565C0] font-bold text-lg">
          {String(record.driver?.name ?? 'D')[0]}
        </div>
        <div>
          <p className="font-['Rajdhani'] font-semibold text-[#0D2847]">{String(record.driver?.name ?? 'Driver')}</p>
          <p className="font-mono text-xs text-[#42A5F5]">{String(record.driver?.employeeCode ?? '')}</p>
        </div>
        <span className={`ml-auto inline-flex px-2 py-0.5 rounded-full text-[10px] font-['Barlow_Condensed'] font-semibold uppercase ${STATUS_BADGES[st] ?? ''}`}>
          {st}
        </span>
      </div>
      <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">
        Period: {new Date(2000, Number(record.month ?? 1) - 1).toLocaleString('default', { month: 'long' })} {String(record.year ?? '')}
      </p>

      {/* Breakdown */}
      <div className="border border-[#E0E8F0] rounded-lg divide-y divide-[#E0E8F0]">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between px-4 py-2 font-['Rajdhani'] text-sm">
            <span className="text-[#7A9AB8]">{r.sign} {r.label}</span>
            <span className="font-['Oswald'] font-semibold text-[#0D2847]">{formatIndianCurrency(r.value)}</span>
          </div>
        ))}
        <div className="flex justify-between px-4 py-3 bg-[#F4F6F8]">
          <span className="font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#0D2847]">Net Payable</span>
          <span className="font-['Oswald'] text-xl font-bold text-[#1565C0]">{formatIndianCurrency(net)}</span>
        </div>
        {paid > 0 && (
          <div className="flex justify-between px-4 py-2 font-['Rajdhani'] text-sm">
            <span className="text-[#16A34A]">Paid</span>
            <span className="font-['Oswald'] font-semibold text-[#16A34A]">{formatIndianCurrency(paid)}</span>
          </div>
        )}
        {paid > 0 && net - paid > 0 && (
          <div className="flex justify-between px-4 py-2 font-['Rajdhani'] text-sm">
            <span className="text-[#DC2626]">Remaining</span>
            <span className="font-['Oswald'] font-semibold text-[#DC2626]">{formatIndianCurrency(net - paid)}</span>
          </div>
        )}
      </div>

      {/* Payment Info (when paid) */}
      {isPaid && (
        <div className="border border-[#16A34A]/30 bg-[#16A34A]/5 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-[#16A34A]" />
            <span className="font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#16A34A] text-sm">Payment Details</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {record.paidDate && (
              <>
                <span className="font-['Rajdhani'] text-[#7A9AB8]">Paid on</span>
                <span className="font-['Rajdhani'] font-semibold text-[#0D2847]">{formatDate(record.paidDate)}</span>
              </>
            )}
            {record.paymentMode && (
              <>
                <span className="font-['Rajdhani'] text-[#7A9AB8]">Mode</span>
                <span className="font-['Rajdhani'] font-semibold text-[#0D2847]">{String(record.paymentMode ?? '').replace(/_/g, ' ')}</span>
              </>
            )}
            {record.transactionRef && (
              <>
                <span className="font-['Rajdhani'] text-[#7A9AB8]">Ref</span>
                <span className="font-mono text-xs text-[#0D2847]">{String(record.transactionRef)}</span>
              </>
            )}
            {record.paidBy && (
              <>
                <span className="font-['Rajdhani'] text-[#7A9AB8]">By</span>
                <span className="font-['Rajdhani'] font-semibold text-[#0D2847]">{String(record.paidBy)}</span>
              </>
            )}
          </div>
          {record.notes && (
            <p className="font-['Rajdhani'] text-xs text-[#7A9AB8] mt-2 pt-2 border-t border-[#16A34A]/20">{String(record.notes)}</p>
          )}
        </div>
      )}

      {!isPaid && record.paidDate && (
        <p className="font-['Rajdhani'] text-xs text-[#7A9AB8]">Last payment: {formatDate(record.paidDate)}</p>
      )}
    </div>
  );
}

function PayForm({ record, onSave, isPending, onCancel }: any) {
  const remaining = Number(record.netPayable ?? 0) - Number(record.paidAmount ?? 0);
  const [form, setForm] = useState({
    paidAmount: String(Math.max(0, remaining)),
    paidDate: new Date().toISOString().slice(0, 10),
    paymentMode: 'BANK_TRANSFER',
    transactionRef: '',
    paidBy: 'Ganesh Kute',
    notes: '',
  });

  return (
    <form onSubmit={e => {
      e.preventDefault();
      onSave({
        paidAmount: Number(form.paidAmount),
        paidDate: form.paidDate,
        paymentMode: form.paymentMode,
        transactionRef: form.transactionRef || undefined,
        paidBy: form.paidBy,
        notes: form.notes || undefined,
      });
    }} className="space-y-4">
      <div className="border border-[#E0E8F0] rounded-lg p-3 bg-[#F4F6F8]">
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">
          {String(record.driver?.name ?? 'Driver')}
        </p>
        <div className="flex justify-between items-baseline mt-1">
          <span className="font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#1A4A7A]">Net Payable</span>
          <span className="font-['Oswald'] font-semibold text-lg text-[#0D2847]">{formatIndianCurrency(Number(record.netPayable ?? 0))}</span>
        </div>
        {Number(record.paidAmount ?? 0) > 0 && (
          <p className="font-['Rajdhani'] text-xs text-[#7A9AB8] mt-1">Already paid: {formatIndianCurrency(Number(record.paidAmount))}</p>
        )}
      </div>

      <div>
        <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Payment Amount (₹) *</label>
        <input type="number" className={inputClass} value={form.paidAmount} onChange={e => setForm(f => ({ ...f, paidAmount: e.target.value }))} min={1} required />
      </div>
      <div>
        <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Payment Date *</label>
        <input type="date" className={inputClass} value={form.paidDate} onChange={e => setForm(f => ({ ...f, paidDate: e.target.value }))} required />
      </div>
      <div>
        <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Payment Mode *</label>
        <select className={inputClass} value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))}>
          {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Transaction Reference</label>
        <input className={inputClass} value={form.transactionRef} onChange={e => setForm(f => ({ ...f, transactionRef: e.target.value }))} placeholder="UTR number, cheque no, UPI ref..." />
      </div>
      <div>
        <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Paid By *</label>
        <input className={inputClass} value={form.paidBy} onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))} required />
      </div>
      <div>
        <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">Notes</label>
        <textarea className={inputClass} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Payment notes" />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#E0E8F0]">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm">Cancel</button>
        <button type="submit" disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#16A34A] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm disabled:opacity-50">
          <IndianRupee className="w-3.5 h-3.5" />
          {isPending ? 'Saving...' : 'Confirm Payment'}
        </button>
      </div>
    </form>
  );
}
