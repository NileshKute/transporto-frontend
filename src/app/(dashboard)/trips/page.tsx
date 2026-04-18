'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DailyTripLogPanel } from '@/components/trips/DailyTripLogPanel';
import { formatCurrency, formatDate, safe, safeNumber } from '@/lib/utils';
import { Plus, Search, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LocationSelect } from '@/components/common/LocationSelect';
import { driverSelectLabel } from '@/lib/driverLabel';

const STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const EDIT_STATUSES = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

const inputClass =
  'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm text-[#0D2847] font-[\'Rajdhani\'] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25';

function sliceDate(iso: string | Date | undefined | null): string {
  if (!iso) return '';
  if (typeof iso === 'string') return iso.slice(0, 10);
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function locStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

function tripToEditForm(t: Record<string, unknown>) {
  const sk = t.startKm != null ? Number(t.startKm) : NaN;
  const ek = t.endKm != null ? Number(t.endKm) : NaN;
  let dist = t.distanceKm != null ? Number(t.distanceKm) : NaN;
  if (!Number.isFinite(dist) && Number.isFinite(sk) && Number.isFinite(ek) && ek >= sk) {
    dist = ek - sk;
  }
  return {
    date: sliceDate(t.date as string),
    vehicleId: String(t.vehicleId ?? (t.vehicle as { id?: string } | undefined)?.id ?? ''),
    driverId: String(t.driverId ?? (t.driver as { id?: string } | undefined)?.id ?? ''),
    startLocation: locStr(t.startLocation),
    endLocation: locStr(t.endLocation),
    clientName: String(t.clientName ?? ''),
    startKm: t.startKm != null && t.startKm !== '' ? String(t.startKm) : '',
    endKm: t.endKm != null && t.endKm !== '' ? String(t.endKm) : '',
    distanceKm: Number.isFinite(dist) ? String(dist) : '',
    billAmount: t.billAmount != null && t.billAmount !== '' ? String(t.billAmount) : '',
    tollAmount: t.tollAmount != null && t.tollAmount !== '' ? String(t.tollAmount) : '',
    status: String(t.status ?? 'IN_PROGRESS'),
    lrNumber: String(t.lrNumber ?? (t as { lr_number?: string }).lr_number ?? ''),
  };
}

function tabButtonClass(active: boolean) {
  return `pb-3 px-1 text-sm font-['Barlow_Condensed'] uppercase tracking-wider border-b-2 transition-colors ${
    active
      ? 'border-[#1565C0] text-[#1565C0] font-bold'
      : 'border-transparent text-[#64748b] hover:text-[#0D2847]'
  }`;
}

function TripsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainTab = searchParams.get('tab') === 'records' ? 'records' : 'daily';

  const setTab = (t: 'daily' | 'records') => {
    router.replace(t === 'records' ? '/trips?tab=records' : '/trips', { scroll: false });
  };

  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [completeTrip, setCompleteTrip] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [completeForm, setCompleteForm] = useState<any>({});
  const [editTrip, setEditTrip] = useState<Record<string, unknown> | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: () => api.get('/vehicles?limit=100').then((r) => r.data.data),
  });
  const { data: drivers } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: () => api.get('/drivers?limit=100').then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['trips', page, search, status],
    queryFn: () =>
      api
        .get('/trips', { params: { page, limit: 20, search: search || undefined, status: status || undefined } })
        .then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/trips', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip created');
      setModalOpen(false);
      setForm({});
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => api.put(`/trips/${id}/complete`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip completed!');
      setCompleteTrip(null);
      setCompleteForm({});
    },
    onError: () => toast.error('Failed to complete trip'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/trips/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip updated');
      setEditTrip(null);
      setEditForm({});
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast.error(typeof msg === 'string' ? msg : 'Failed to update trip');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/trips/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip deleted');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Failed to delete trip'),
  });

  const f = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p: any) => ({ ...p, [name]: e.target.value }));

  const ef =
    (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setEditForm((p) => {
        const next = { ...p, [name]: e.target.value };
        if (name === 'startKm' || name === 'endKm') {
          const sk = Number(next.startKm);
          const ek = Number(next.endKm);
          if (Number.isFinite(sk) && Number.isFinite(ek) && ek >= sk) {
            next.distanceKm = String(ek - sk);
          }
        }
        return next;
      });

  const openEditModal = (trip: Record<string, unknown>) => {
    setEditTrip(trip);
    setEditForm(tripToEditForm(trip));
  };

  const closeEditModal = () => {
    setEditTrip(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!editTrip?.id) return;
    const sk = Number(editForm.startKm);
    const ek = editForm.endKm === '' ? NaN : Number(editForm.endKm);
    let distanceKm: number | undefined;
    if (editForm.distanceKm !== '' && editForm.distanceKm != null) {
      const d = Number(editForm.distanceKm);
      if (Number.isFinite(d)) distanceKm = d;
    }
    if (distanceKm === undefined && Number.isFinite(sk) && Number.isFinite(ek) && ek >= sk) {
      distanceKm = ek - sk;
    }
    if (distanceKm === undefined || !Number.isFinite(distanceKm)) {
      distanceKm = Number(editTrip.distanceKm) || 0;
    }

    const payload: Record<string, unknown> = {
      date: editForm.date,
      vehicleId: editForm.vehicleId,
      driverId: editForm.driverId,
      startLocation: editForm.startLocation,
      endLocation: editForm.endLocation,
      clientName: editForm.clientName || undefined,
      startKm: Number.isFinite(sk) ? sk : 0,
      endKm: Number.isFinite(ek) ? ek : undefined,
      distanceKm,
      billAmount: editForm.billAmount === '' ? 0 : Number(editForm.billAmount),
      tollAmount: editForm.tollAmount === '' ? 0 : Number(editForm.tollAmount),
      status: editForm.status,
      lrNumber: editForm.lrNumber || undefined,
    };
    editMutation.mutate({ id: String(editTrip.id), data: payload });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Trips</h2>
          <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">Manage daily logs and trip records</p>
        </div>
        {mainTab === 'records' ? (
          <button
            type="button"
            onClick={() => {
              setForm({});
              setModalOpen(true);
            }}
            className="flex items-center gap-2 bg-[#1565C0] hover:bg-[#0D2847] text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> New Trip
          </button>
        ) : null}
      </div>

      <div className="border-b border-[#E0E8F0]">
        <nav className="flex gap-1 sm:gap-6" aria-label="Trips sections">
          <button type="button" onClick={() => setTab('daily')} className={tabButtonClass(mainTab === 'daily')}>
            Daily Log
          </button>
          <button type="button" onClick={() => setTab('records')} className={tabButtonClass(mainTab === 'records')}>
            Trip Records
          </button>
        </nav>
      </div>

      {mainTab === 'daily' ? (
        <DailyTripLogPanel />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-4 mb-5 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A9AB8]" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search trip#, location, client..."
                className="h-10 pl-10 rounded-lg border border-[#E0E8F0] text-sm text-[#0D2847] w-full"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-10 w-40 rounded-lg border border-[#E0E8F0] text-sm text-[#0D2847]"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden">
            {isLoading ? (
              <LoadingSpinner />
            ) : !data?.data?.length ? (
              <EmptyState message="No trips found" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Trip #</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Vehicle</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Driver</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Route</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Distance</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Bill</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E8F0]">
                    {data.data.map((t: any) => (
                      <tr key={String(t.id ?? safe(t.tripNumber))} className="hover:bg-[#F4F6F8] transition-colors">
                        <td className="px-4 py-3.5 text-sm font-mono font-bold text-[#1565C0]">{safe(t.tripNumber)}</td>
                        <td className="px-4 py-3.5 text-sm text-[#0D2847]">{formatDate(t.date)}</td>
                        <td className="px-4 py-3.5 text-sm text-[#0D2847] font-mono">{safe(t.vehicle?.regNumber)}</td>
                        <td className="px-4 py-3.5 text-sm text-[#0D2847]">{safe(t.driver?.name)}</td>
                        <td className="px-4 py-3.5 text-sm text-[#0D2847] max-w-[150px]">
                          <span className="truncate block">
                            {typeof t.startLocation === 'string' ? t.startLocation : safe(t.startLocation)} →{' '}
                            {typeof t.endLocation === 'string' ? t.endLocation || '...' : safe(t.endLocation)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-[#0D2847] font-mono">
                          {Number.isFinite(safeNumber(t.distanceKm, NaN)) ? `${safeNumber(t.distanceKm)} km` : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="px-4 py-3.5 font-mono font-semibold text-emerald-600">
                          {t.billAmount != null &&
                          typeof t.billAmount !== 'object' &&
                          Number.isFinite(safeNumber(t.billAmount, NaN))
                            ? formatCurrency(safeNumber(t.billAmount, 0))
                            : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {t.status === 'IN_PROGRESS' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCompleteTrip(t);
                                  setCompleteForm({ endKm: t.endKm || '', endLocation: t.endLocation || '' });
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-600 border border-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <CheckCircle className="w-3 h-3" /> Complete
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditModal(t as Record<string, unknown>)}
                              className="p-1.5 rounded-md text-[#1565C0] hover:bg-blue-50 transition-colors"
                              title="Edit trip"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(t as Record<string, unknown>)}
                              className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete trip"
                            >
                              <Trash2 size={16} />
                            </button>
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

          <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Trip" size="lg">
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Vehicle *</label>
                  <select value={form.vehicleId || ''} onChange={f('vehicleId')}>
                    <option value="">Select Vehicle</option>
                    {vehicles?.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {safe(v.regNumber)} — {safe(v.make)} {safe(v.model)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Driver *</label>
                  <select value={form.driverId || ''} onChange={f('driverId')}>
                    <option value="">Select Driver</option>
                    {drivers?.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {driverSelectLabel(d)} — {safe(d.phone)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Date *</label>
                  <input type="date" value={form.date || ''} onChange={f('date')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Start KM *</label>
                  <input type="number" value={form.startKm || ''} onChange={f('startKm')} placeholder="85000" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Start Location *</label>
                  <LocationSelect
                    value={String(form.startLocation || '')}
                    onChange={(name) => setForm((p: any) => ({ ...p, startLocation: name }))}
                    placeholder="From"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">End Location</label>
                  <LocationSelect
                    value={String(form.endLocation || '')}
                    onChange={(name, picked) =>
                      setForm((p: any) => ({
                        ...p,
                        endLocation: name,
                        ...(picked?.type === 'CLIENT'
                          ? { clientName: (picked.shortName || picked.name || '').trim() }
                          : {}),
                      }))
                    }
                    placeholder="To"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Cargo Type</label>
                  <input value={form.cargoType || ''} onChange={f('cargoType')} placeholder="FMCG Goods" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Client Name</label>
                  <input value={form.clientName || ''} onChange={f('clientName')} placeholder="Reliance Retail" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Bill Amount (₹)</label>
                  <input type="number" value={form.billAmount || ''} onChange={f('billAmount')} placeholder="45000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">Toll Amount (₹)</label>
                  <input type="number" value={form.tollAmount || ''} onChange={f('tollAmount')} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-slate-300 bg-[#1a2035] hover:bg-[#243050] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => createMutation.mutate(form)}
                  disabled={createMutation.isPending}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Trip'}
                </button>
              </div>
            </div>
          </Modal>

          <Modal isOpen={!!editTrip} onClose={closeEditModal} title="Edit Trip" size="xl">
            <div className="max-h-[75vh] overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    Date *
                  </label>
                  <input type="date" className={inputClass} value={editForm.date || ''} onChange={ef('date')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    Status *
                  </label>
                  <select className={inputClass} value={editForm.status || ''} onChange={ef('status')}>
                    {EDIT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    Vehicle *
                  </label>
                  <select className={inputClass} value={editForm.vehicleId || ''} onChange={ef('vehicleId')}>
                    <option value="">Select vehicle</option>
                    {vehicles?.map((v: { id: string; regNumber?: string; make?: string; model?: string }) => (
                      <option key={v.id} value={v.id}>
                        {safe(v.regNumber)} — {safe(v.make)} {safe(v.model)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    Driver *
                  </label>
                  <select className={inputClass} value={editForm.driverId || ''} onChange={ef('driverId')}>
                    <option value="">Select driver</option>
                    {drivers?.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {driverSelectLabel(d)} — {safe(d.phone)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    Start location *
                  </label>
                  <input className={inputClass} value={editForm.startLocation || ''} onChange={ef('startLocation')} placeholder="Start" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    End location
                  </label>
                  <input className={inputClass} value={editForm.endLocation || ''} onChange={ef('endLocation')} placeholder="End" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    Client name
                  </label>
                  <input className={inputClass} value={editForm.clientName || ''} onChange={ef('clientName')} placeholder="Client" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    Start KM *
                  </label>
                  <input type="number" className={inputClass} value={editForm.startKm || ''} onChange={ef('startKm')} min={0} step="0.1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    End KM
                  </label>
                  <input type="number" className={inputClass} value={editForm.endKm || ''} onChange={ef('endKm')} min={0} step="0.1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    Distance (km)
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    value={editForm.distanceKm || ''}
                    onChange={ef('distanceKm')}
                    min={0}
                    step="0.1"
                    placeholder="Auto from odometer"
                  />
                  <p className="text-[10px] text-[#7A9AB8] mt-1 font-['Rajdhani']">Updates when start/end KM change; you can override.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    LR number
                  </label>
                  <input className={inputClass} value={editForm.lrNumber || ''} onChange={ef('lrNumber')} placeholder="LR #" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    Bill amount (₹)
                  </label>
                  <input type="number" className={inputClass} value={editForm.billAmount || ''} onChange={ef('billAmount')} min={0} step="0.01" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5 font-['Barlow_Condensed'] uppercase tracking-wider">
                    Toll amount (₹)
                  </label>
                  <input type="number" className={inputClass} value={editForm.tollAmount || ''} onChange={ef('tollAmount')} min={0} step="0.01" />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-[#E0E8F0]">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 py-2.5 text-sm font-medium text-[#0D2847] bg-white border border-[#E0E8F0] hover:bg-[#F4F6F8] rounded-lg font-['Barlow_Condensed'] uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={editMutation.isPending || !editForm.date || !editForm.vehicleId || !editForm.driverId}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-[#1565C0] hover:bg-[#0D2847] disabled:opacity-50 rounded-lg font-['Barlow_Condensed'] uppercase tracking-wider"
                >
                  {editMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </Modal>

          <ConfirmDialog
            isOpen={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={() => deleteTarget?.id && deleteMutation.mutate(String(deleteTarget.id))}
            title="Delete trip?"
            message={`Are you sure you want to delete trip ${safe(deleteTarget?.tripNumber)}?`}
            confirmLabel="Delete"
            variant="danger"
            loading={deleteMutation.isPending}
          />

          <Modal isOpen={!!completeTrip} onClose={() => setCompleteTrip(null)} title="Complete Trip" size="sm">
            <div className="p-5 space-y-4">
              <p className="text-sm text-[#7A9AB8]">
                Trip <span className="text-blue-400 font-mono">{completeTrip?.tripNumber}</span>
              </p>
              <div>
                <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">End KM *</label>
                <input
                  type="number"
                  value={completeForm.endKm || ''}
                  onChange={(e) => setCompleteForm((p: any) => ({ ...p, endKm: e.target.value }))}
                  placeholder="Final odometer reading"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#7A9AB8] mb-1.5">End Location</label>
                <LocationSelect
                  value={String(completeForm.endLocation || '')}
                  onChange={(name) => setCompleteForm((p: any) => ({ ...p, endLocation: name }))}
                  placeholder="Destination"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCompleteTrip(null)}
                  className="flex-1 py-2.5 text-sm text-slate-300 bg-[#1a2035] hover:bg-[#243050] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => completeMutation.mutate({ id: completeTrip.id, ...completeForm })}
                  disabled={completeMutation.isPending}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg"
                >
                  {completeMutation.isPending ? 'Completing...' : 'Mark Completed'}
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}

export default function TripsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      }
    >
      <TripsPageInner />
    </Suspense>
  );
}
