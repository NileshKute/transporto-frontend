'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate, formatDateTime, safe } from '@/lib/utils';
import { AlertTriangle, MapPin, Plus, CheckCircle, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { driverSelectLabel } from '@/lib/driverLabel';

const E_TYPES = ['PUNCTURE','ACCIDENT','BREAKDOWN','ENGINE_FAILURE','FUEL_EMPTY','ELECTRICAL_FAILURE','BRAKE_FAILURE','FIRE','THEFT','OTHER'];
const E_STATUSES = ['PENDING','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','CLOSED'];
const PRIORITIES = ['LOW','MEDIUM','HIGH','CRITICAL'];

const priorityBorder: Record<string, string> = { LOW: 'border-l-[#7A9AB8]', MEDIUM: 'border-l-[#1565C0]', HIGH: 'border-l-[#F59E0B]', CRITICAL: 'border-l-[#DC2626]' };
const typeIcon: Record<string, string> = { PUNCTURE: '🛞', ACCIDENT: '💥', BREAKDOWN: '🔧', ENGINE_FAILURE: '⚙️', FUEL_EMPTY: '⛽', FIRE: '🔥', THEFT: '🚨' };

export default function EmergenciesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [resolveItem, setResolveItem] = useState<any>(null);
  const [form, setForm] = useState<any>({ priority: 'HIGH' });
  const [resolveForm, setResolveForm] = useState<any>({});

  const { data: vehicles } = useQuery({ queryKey: ['vehicles-list'], queryFn: () => api.get('/vehicles?limit=100').then(r => r.data.data) });
  const { data: drivers } = useQuery({ queryKey: ['drivers-list'], queryFn: () => api.get('/drivers?limit=100').then(r => r.data.data) });
  const { data, isLoading } = useQuery({
    queryKey: ['emergencies', page, filterStatus],
    queryFn: () => api.get('/emergencies', { params: { page, limit: 20, status: filterStatus || undefined } }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/emergencies', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['emergencies'] }); toast.success('Emergency reported'); setModalOpen(false); setForm({ priority: 'HIGH' }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => api.put(`/emergencies/${id}/resolve`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['emergencies'] }); toast.success('Emergency resolved'); setResolveItem(null); setResolveForm({}); },
    onError: () => toast.error('Failed to resolve'),
  });

  const f = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p: any) => ({ ...p, [name]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Emergencies</h2><p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">Track and resolve incidents</p></div>
        <button onClick={() => { setForm({ priority: 'HIGH' }); setModalOpen(true); }} className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Report Emergency
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-4 mb-5 flex flex-wrap gap-2">
        {['', ...E_STATUSES].map(s => (
          <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
            className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${filterStatus === s ? 'bg-blue-600 text-white' : 'border border-[#E0E8F0] text-slate-700 hover:bg-slate-50'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingSpinner /> : !data?.data?.length ? <EmptyState message="No emergencies found" description="All clear!" /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.data.map((e: any) => (
            <div key={e.id} className={`bg-white rounded-xl border border-[#E0E8F0] p-5 border-l-4 shadow-sm ${priorityBorder[e.priority] || 'border-l-[#42A5F5]'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{typeIcon[e.type] || '⚠️'}</span>
                  <span className="font-bold text-[#0D2847] text-sm">{e.type?.replace(/_/g,' ')}</span>
                </div>
                <StatusBadge status={e.status} />
              </div>
              <p className="text-xs text-[#7A9AB8] mb-3 line-clamp-2">{typeof e.description === 'string' ? e.description : safe(e.description)}</p>
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-xs text-[#1A4A7A]">
                  <span className="font-mono text-[#42A5F5]">{safe(e.vehicle?.regNumber)}</span>
                  <span>•</span>
                  <span>{safe(e.driver?.name)}</span>
                </div>
                {e.location != null && String(e.location) !== '' && (
                  <div className="flex items-center gap-1.5 text-xs text-[#1A4A7A]">
                    <MapPin className="w-3 h-3 text-[#DC2626]" />
                    {safe(e.location)}
                  </div>
                )}
                {e.driver?.phone != null && String(e.driver.phone) !== '' && (
                  <div className="flex items-center gap-1.5 text-xs text-[#1A4A7A]">
                    <Phone className="w-3 h-3" />
                    {safe(e.driver.phone)}
                  </div>
                )}
                <p className="text-xs text-[#1A4A7A]">{formatDateTime(e.createdAt)}</p>
              </div>
              {['PENDING','ACKNOWLEDGED','IN_PROGRESS'].includes(e.status) && (
                <button onClick={() => { setResolveItem(e); setResolveForm({ resolvedBy: '', resolution: '' }); }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-[#16A34A] bg-[#16A34A]/10 hover:bg-[#16A34A]/20 rounded-lg transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" /> Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={20} onPageChange={setPage} />}

      {/* Report Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Report Emergency" size="lg">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Vehicle *</label>
              <select value={form.vehicleId || ''} onChange={f('vehicleId')}>
                <option value="">Select Vehicle</option>
                {vehicles?.map((v: any) => <option key={v.id} value={v.id}>{v.regNumber}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Driver *</label>
              <select value={form.driverId || ''} onChange={f('driverId')}>
                <option value="">Select Driver</option>
                {drivers?.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {driverSelectLabel(d)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Emergency Type *</label>
              <select value={form.type || ''} onChange={f('type')}>
                <option value="">Select Type</option>
                {E_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Priority</label>
              <select value={form.priority || 'HIGH'} onChange={f('priority')}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Date *</label>
              <input type="date" value={form.date || ''} onChange={f('date')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Location</label>
              <input value={form.location || ''} onChange={f('location')} placeholder="NH48, Manesar" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Description *</label>
              <textarea value={form.description || ''} onChange={f('description')} rows={3} placeholder="Describe the emergency..." className="resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-sm text-slate-300 bg-[#1a2035] rounded-lg">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg">
              {createMutation.isPending ? 'Reporting...' : 'Report Emergency'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Resolve Modal */}
      <Modal isOpen={!!resolveItem} onClose={() => setResolveItem(null)} title="Resolve Emergency" size="sm">
        <div className="p-5 space-y-4">
          <p className="text-sm text-[#7A9AB8]">{resolveItem?.type?.replace(/_/g,' ')} — {resolveItem?.vehicle?.regNumber}</p>
          <div>
            <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Resolved By</label>
            <input value={resolveForm.resolvedBy || ''} onChange={e => setResolveForm((p: any) => ({ ...p, resolvedBy: e.target.value }))} placeholder="Name of resolver" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Resolution Notes *</label>
            <textarea value={resolveForm.resolution || ''} onChange={e => setResolveForm((p: any) => ({ ...p, resolution: e.target.value }))} rows={3} placeholder="How was it resolved?" className="resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setResolveItem(null)} className="flex-1 py-2.5 text-sm text-slate-300 bg-[#1a2035] rounded-lg">Cancel</button>
            <button onClick={() => resolveMutation.mutate({ id: resolveItem.id, ...resolveForm })} disabled={resolveMutation.isPending} className="flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg">
              {resolveMutation.isPending ? 'Resolving...' : 'Mark Resolved'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
