'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Plus, Play, Square } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShiftsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const { data: drivers } = useQuery({ queryKey: ['drivers-list'], queryFn: () => api.get('/drivers?limit=100').then(r => r.data.data) });
  const { data: vehicles } = useQuery({ queryKey: ['vehicles-list'], queryFn: () => api.get('/vehicles?limit=100').then(r => r.data.data) });
  const { data, isLoading } = useQuery({
    queryKey: ['shifts', page, filterStatus],
    queryFn: () => api.get('/shifts', { params: { page, limit: 20, status: filterStatus || undefined } }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/shifts', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Shift created'); setModalOpen(false); setForm({}); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => api.put(`/shifts/${id}/start`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Shift started'); },
    onError: () => toast.error('Failed'),
  });

  const endMutation = useMutation({
    mutationFn: (id: string) => api.put(`/shifts/${id}/end`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Shift ended — hours calculated'); },
    onError: () => toast.error('Failed'),
  });

  const f = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p: any) => ({ ...p, [name]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Shifts</h2><p className="text-sm text-[#1A4A7A]">Driver shift management</p></div>
        <button onClick={() => { setForm({}); setModalOpen(true); }} className="flex items-center gap-2 bg-[#1565C0] hover:bg-[#0D2847] text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Create Shift
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-4 mb-5 flex flex-wrap gap-2">
        {['', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => (
          <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
            className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${filterStatus === s ? 'bg-blue-600 text-white' : 'border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8]'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden">
        {isLoading ? <LoadingSpinner /> : !data?.data?.length ? <EmptyState message="No shifts found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Driver</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Vehicle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">End</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Hours</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Overtime</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E8F0]">
                {data.data.map((s: any) => (
                  <tr key={s.id} className={`hover:bg-[#F4F6F8] transition-colors ${s.overtime > 0 ? 'border-l-4 border-l-[#F59E0B] bg-[#F59E0B]/10' : ''}`}>
                    <td className="px-4 py-3.5 font-medium text-[#0D2847]">{s.driver?.name}</td>
                    <td className="px-4 py-3.5 text-sm text-[#0D2847] font-mono">{s.vehicle?.regNumber || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-[#1A4A7A]">{formatDate(s.date)}</td>
                    <td className="px-4 py-3.5 text-xs text-[#1A4A7A]">{formatDateTime(s.startTime)}</td>
                    <td className="px-4 py-3.5 text-xs text-[#1A4A7A]">{s.endTime ? formatDateTime(s.endTime) : '—'}</td>
                    <td className="px-4 py-3.5 font-mono font-medium text-[#0D2847]">{s.hoursWorked != null ? `${Math.floor(s.hoursWorked)}h ${Math.round((s.hoursWorked % 1) * 60)}m` : '—'}</td>
                    <td className="px-4 py-3.5">{s.overtime > 0 ? <span className="text-[#F59E0B] font-bold text-sm">+{s.overtime}h OT</span> : <span className="text-[#1A4A7A]">—</span>}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {s.status === 'SCHEDULED' && (
                          <button onClick={() => startMutation.mutate(s.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#42A5F5] bg-[#42A5F5]/10 hover:bg-[#42A5F5]/20 rounded-lg transition-colors">
                            <Play className="w-3 h-3 fill-current" /> Start
                          </button>
                        )}
                        {s.status === 'ACTIVE' && (
                          <button onClick={() => endMutation.mutate(s.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors">
                            <Square className="w-3 h-3 fill-current" /> End
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={20} onPageChange={setPage} />}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Shift" size="md">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Driver *</label>
              <select value={form.driverId || ''} onChange={f('driverId')}>
                <option value="">Select Driver</option>
                {drivers?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Vehicle</label>
              <select value={form.vehicleId || ''} onChange={f('vehicleId')}>
                <option value="">Select Vehicle</option>
                {vehicles?.map((v: any) => <option key={v.id} value={v.id}>{v.regNumber}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Date *</label>
              <input type="date" value={form.date || ''} onChange={f('date')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Start Time *</label>
              <input type="datetime-local" value={form.startTime || ''} onChange={f('startTime')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes</label>
              <input value={form.notes || ''} onChange={f('notes')} placeholder="Optional notes" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-sm text-slate-300 bg-[#1a2035] rounded-lg">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg">
              {createMutation.isPending ? 'Creating...' : 'Create Shift'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
