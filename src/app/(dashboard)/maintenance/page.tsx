'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatCard } from '@/components/ui/StatCard';
import {
  formatInrTwoDecimals,
  formatDateDdMmYyyy,
  safe,
  safeNumber,
  cn,
} from '@/lib/utils';
import { Plus, Search, Trash2, ClipboardList, IndianRupee, Wrench, Package, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const LIMIT = 50;
const inputClass =
  'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm text-[#0D2847] font-["Rajdhani"] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20';

type Category = 'TRUCK' | 'REEFER';

interface MaintType {
  id: string;
  name: string;
  icon?: string | null;
  category: Category;
}

interface MaintRecord {
  id: string;
  date?: string;
  category?: Category | string;
  description?: string;
  laborCost?: number;
  partsCost?: number;
  totalCost?: number;
  odometerKm?: number | null;
  runningHours?: number | null;
  garage?: string | null;
  billNumber?: string | null;
  partsUsed?: string | null;
  nextServiceDueDate?: string | null;
  nextServiceKm?: number | null;
  nextServiceHours?: number | null;
  notes?: string | null;
  vehicle?: { id?: string; regNumber?: string };
  maintenanceType?: { id?: string; name?: string; icon?: string | null };
  maintenanceTypeId?: string;
}

function parseListResponse(res: unknown): {
  rows: MaintRecord[];
  total: number;
  totalPages: number;
  summary?: { totalCost?: number; laborCost?: number; partsCost?: number; count?: number };
} {
  const root = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
  const body = root.data !== undefined ? root.data : root;
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const rawRows = Array.isArray(b.data)
    ? b.data
    : Array.isArray(b.records)
      ? b.records
      : Array.isArray(body)
        ? (body as MaintRecord[])
        : [];
  const rows = rawRows as MaintRecord[];
  const total = safeNumber(b.total ?? root.total, rows.length);
  const limit = safeNumber(b.limit, LIMIT);
  const totalPages = Math.max(1, Math.ceil(total / (limit || LIMIT)));
  const summary = b.summary && typeof b.summary === 'object' ? (b.summary as Record<string, number>) : undefined;
  return {
    rows,
    total,
    totalPages,
    summary: summary
      ? {
          totalCost: summary.totalCost,
          laborCost: summary.laborCost,
          partsCost: summary.partsCost,
          count: summary.count,
        }
      : undefined,
  };
}

function sumRows(rows: MaintRecord[]) {
  let labor = 0;
  let parts = 0;
  let total = 0;
  for (const r of rows) {
    labor += safeNumber(r.laborCost, 0);
    parts += safeNumber(r.partsCost, 0);
    total += safeNumber(r.totalCost ?? safeNumber(r.laborCost, 0) + safeNumber(r.partsCost, 0), 0);
  }
  return { labor, parts, total };
}

function CategoryBadge({ category }: { category: unknown }) {
  const c = String(category ?? '').toUpperCase();
  if (c === 'REEFER') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-['Barlow_Condensed'] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 border border-cyan-500/30">
        ❄️ Reefer
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-['Barlow_Condensed'] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1565C0]/15 text-[#1565C0] border border-[#1565C0]/30">
      🚛 Truck
    </span>
  );
}

function MaintenancePageInner() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [filterVehicleId, setFilterVehicleId] = useState('');
  const [categoryTab, setCategoryTab] = useState<'ALL' | Category>('ALL');
  const [typeId, setTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [applied, setApplied] = useState({
    vehicleId: '',
    category: 'ALL' as 'ALL' | Category,
    typeId: '',
    startDate: '',
    endDate: '',
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<MaintRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [totalManual, setTotalManual] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    vehicleId: '',
    category: 'TRUCK' as Category,
    maintenanceTypeId: '',
    date: '',
    description: '',
    partsUsed: '',
    laborCost: '',
    partsCost: '',
    totalCost: '',
    odometerKm: '',
    runningHours: '',
    garage: '',
    billNumber: '',
    nextServiceDueDate: '',
    nextServiceKm: '',
    nextServiceHours: '',
    notes: '',
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-list-maintenance'],
    queryFn: async () => {
      const r = await api.get('/vehicles', { params: { limit: 500 } });
      const raw = r.data?.data ?? r.data;
      return Array.isArray(raw) ? raw : [];
    },
  });

  const { data: types = [] } = useQuery({
    queryKey: ['vehicle-maintenance-types-all'],
    queryFn: async () => {
      const r = await api.get('/vehicle-maintenance/types');
      const raw = r.data?.data ?? r.data;
      const arr = Array.isArray(raw) ? raw : [];
      return arr.map((t: Record<string, unknown>) => ({
        id: String(t.id ?? ''),
        name: safe(t.name),
        icon: typeof t.icon === 'string' ? t.icon : '',
        category: (String(t.category ?? 'TRUCK').toUpperCase() === 'REEFER' ? 'REEFER' : 'TRUCK') as Category,
      })) as MaintType[];
    },
  });

  const filteredTypesForForm = useMemo(() => {
    return types.filter((t) => t.category === form.category);
  }, [types, form.category]);

  const filteredTypesForFilter = useMemo(() => {
    if (categoryTab === 'ALL') return types;
    return types.filter((t) => t.category === categoryTab);
  }, [types, categoryTab]);

  const listParams = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: LIMIT };
    if (applied.vehicleId) p.vehicleId = applied.vehicleId;
    if (applied.category !== 'ALL') p.category = applied.category;
    if (applied.typeId) p.maintenanceTypeId = applied.typeId;
    if (applied.startDate) p.startDate = applied.startDate;
    if (applied.endDate) p.endDate = applied.endDate;
    return p;
  }, [applied, page]);

  const { data: listResult, isLoading } = useQuery({
    queryKey: ['vehicle-maintenance-records', listParams],
    queryFn: async () => {
      const r = await api.get('/vehicle-maintenance/records', { params: listParams });
      return parseListResponse(r.data);
    },
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['vehicle-maintenance-reminders'],
    queryFn: async () => {
      try {
        const r = await api.get('/vehicle-maintenance/reminders', { params: { days: 30 } });
        const raw = r.data?.data ?? r.data;
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    },
  });

  const rows = listResult?.rows ?? [];
  const total = listResult?.total ?? 0;
  const totalPages = listResult?.totalPages ?? 1;
  const summary = listResult?.summary;
  const pageSums = useMemo(() => sumRows(rows), [rows]);

  const stats = useMemo(() => {
    const count = summary?.count ?? total;
    const totalCost = summary?.totalCost ?? pageSums.total;
    const labor = summary?.laborCost ?? pageSums.labor;
    const parts = summary?.partsCost ?? pageSums.parts;
    return { count, totalCost, labor, parts };
  }, [summary, total, pageSums]);

  const applySearch = () => {
    setApplied({
      vehicleId: filterVehicleId,
      category: categoryTab,
      typeId,
      startDate,
      endDate,
    });
    setPage(1);
  };

  useEffect(() => {
    const vid = searchParams.get('vehicleId');
    if (vid) {
      setFilterVehicleId(vid);
      setApplied((a) => ({ ...a, vehicleId: vid }));
    }
    const open = searchParams.get('open');
    if (open === 'add' && vid) {
      setForm((f) => ({
        ...f,
        vehicleId: vid,
        category: 'TRUCK',
        date: new Date().toISOString().slice(0, 10),
      }));
      setViewRecord(null);
      setTotalManual(false);
      setValidationErrors({});
      setModalOpen(true);
    }
  }, [searchParams]);

  const openAdd = () => {
    setValidationErrors({});
    setViewRecord(null);
    setTotalManual(false);
    setForm({
      vehicleId: filterVehicleId || '',
      category: 'TRUCK',
      maintenanceTypeId: '',
      date: new Date().toISOString().slice(0, 10),
      description: '',
      partsUsed: '',
      laborCost: '',
      partsCost: '',
      totalCost: '',
      odometerKm: '',
      runningHours: '',
      garage: '',
      billNumber: '',
      nextServiceDueDate: '',
      nextServiceKm: '',
      nextServiceHours: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (r: MaintRecord) => {
    setValidationErrors({});
    setViewRecord(r);
    setTotalManual(true);
    const cat = (String(r.category ?? 'TRUCK').toUpperCase() === 'REEFER' ? 'REEFER' : 'TRUCK') as Category;
    const tid = r.maintenanceType?.id ?? r.maintenanceTypeId ?? '';
    setForm({
      vehicleId: r.vehicle?.id ?? filterVehicleId ?? '',
      category: cat,
      maintenanceTypeId: tid,
      date: r.date ? String(r.date).slice(0, 10) : '',
      description: typeof r.description === 'string' ? r.description : '',
      partsUsed: typeof r.partsUsed === 'string' ? r.partsUsed : '',
      laborCost: r.laborCost != null ? String(r.laborCost) : '',
      partsCost: r.partsCost != null ? String(r.partsCost) : '',
      totalCost: r.totalCost != null ? String(r.totalCost) : '',
      odometerKm: r.odometerKm != null ? String(r.odometerKm) : '',
      runningHours: r.runningHours != null ? String(r.runningHours) : '',
      garage: typeof r.garage === 'string' ? r.garage : '',
      billNumber: typeof r.billNumber === 'string' ? r.billNumber : '',
      nextServiceDueDate: r.nextServiceDueDate ? String(r.nextServiceDueDate).slice(0, 10) : '',
      nextServiceKm: r.nextServiceKm != null ? String(r.nextServiceKm) : '',
      nextServiceHours: r.nextServiceHours != null ? String(r.nextServiceHours) : '',
      notes: typeof r.notes === 'string' ? r.notes : '',
    });
    setModalOpen(true);
  };

  const recalcTotal = useCallback(
    (labor: string, parts: string) => {
      const L = safeNumber(labor, 0);
      const P = safeNumber(parts, 0);
      return String(L + P);
    },
    []
  );

  const setLaborParts = (field: 'laborCost' | 'partsCost', value: string) => {
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next.cost;
      return next;
    });
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (!totalManual) {
        next.totalCost = recalcTotal(
          field === 'laborCost' ? value : f.laborCost,
          field === 'partsCost' ? value : f.partsCost
        );
      }
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (viewRecord?.id) {
        return api.put(`/vehicle-maintenance/records/${viewRecord.id}`, payload);
      }
      return api.post('/vehicle-maintenance/records', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle-maintenance-records'] });
      qc.invalidateQueries({ queryKey: ['vehicle-maintenance-reminders'] });
      qc.invalidateQueries({ queryKey: ['vehicle-maintenance-vehicle'] });
      toast.success(viewRecord ? 'Record updated' : 'Record saved');
      setModalOpen(false);
      setViewRecord(null);
      setValidationErrors({});
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(typeof msg === 'string' ? msg : 'Failed to save');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vehicle-maintenance/records/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle-maintenance-records'] });
      qc.invalidateQueries({ queryKey: ['vehicle-maintenance-reminders'] });
      qc.invalidateQueries({ queryKey: ['vehicle-maintenance-vehicle'] });
      toast.success('Record deleted');
      setDeleteId(null);
    },
    onError: () => toast.error('Failed to delete'),
  });

  const submitRecord = () => {
    const errors: Record<string, string> = {};
    if (!form.vehicleId) errors.vehicleId = 'Vehicle is required';
    if (!form.maintenanceTypeId?.trim()) errors.typeId = 'Maintenance type is required';
    if (!form.date?.trim()) errors.date = 'Date is required';
    const laborN = safeNumber(form.laborCost, 0);
    const partsN = safeNumber(form.partsCost, 0);
    const totalN = form.totalCost !== '' ? safeNumber(form.totalCost, laborN + partsN) : laborN + partsN;
    if (laborN <= 0 && partsN <= 0 && totalN <= 0) {
      errors.cost = 'Enter at least one cost (labor, parts, or total)';
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    const labor = laborN;
    const parts = partsN;
    const total = totalN;
    const payload: Record<string, unknown> = {
      vehicleId: form.vehicleId,
      category: form.category,
      maintenanceTypeId: form.maintenanceTypeId || undefined,
      date: form.date,
      description: form.description || undefined,
      partsUsed: form.partsUsed || undefined,
      laborCost: labor,
      partsCost: parts,
      totalCost: total,
      garage: form.garage || undefined,
      billNumber: form.billNumber || undefined,
      nextServiceDueDate: form.nextServiceDueDate || undefined,
      notes: form.notes || undefined,
    };
    if (form.category === 'TRUCK') {
      if (form.odometerKm !== '') payload.odometerKm = safeNumber(form.odometerKm, 0);
      if (form.nextServiceKm !== '') payload.nextServiceKm = safeNumber(form.nextServiceKm, 0);
    } else {
      if (form.runningHours !== '') payload.runningHours = safeNumber(form.runningHours, 0);
      if (form.nextServiceHours !== '') payload.nextServiceHours = safeNumber(form.nextServiceHours, 0);
    }
    saveMutation.mutate(payload);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Vehicle Maintenance</h1>
          <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">Maintenance book — truck & reefer</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#1565C0] hover:bg-[#0D2847] text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors font-['Barlow_Condensed'] uppercase tracking-wider text-sm"
        >
          <Plus className="w-4 h-4" /> Add Record
        </button>
      </div>

      {/* Reminders */}
      {reminders.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-amber-900">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="font-['Barlow_Condensed'] font-bold uppercase tracking-wider text-sm">Upcoming & overdue service alerts</span>
          </div>
          <ul className="space-y-2 text-sm font-['Rajdhani'] text-[#0D2847]">
            {reminders.map((item: Record<string, unknown>, idx: number) => {
              const overdue = item.overdue === true || item.status === 'OVERDUE';
              const veh = item.vehicle;
              const vehReg =
                veh && typeof veh === 'object' && veh !== null ? (veh as Record<string, unknown>).regNumber : undefined;
              const typ = item.type;
              const typeNameRaw =
                typ && typeof typ === 'object' && typ !== null ? (typ as Record<string, unknown>).name : undefined;
              const reg = safe(item.vehicleRegNumber ?? item.regNumber ?? vehReg);
              const typeName = safe(item.typeName ?? item.maintenanceTypeName ?? typeNameRaw);
              const dueDate = item.dueDate ?? item.nextServiceDueDate;
              const days = item.dueInDays ?? item.daysUntil;
              const hours = item.dueAtHours ?? item.nextServiceHours;
              let line = '';
              if (overdue) {
                line = `${reg} — ${typeName} was due on ${formatDateDdMmYyyy(dueDate as string)}`;
              } else if (days != null && Number.isFinite(Number(days))) {
                line = `${reg} — ${typeName} due in ${safe(days)} days (${formatDateDdMmYyyy(dueDate as string)})`;
              } else if (hours != null) {
                line = `${reg} — ${typeName} due at ${safeNumber(hours).toLocaleString('en-IN')} hrs`;
              } else {
                line = `${reg} — ${typeName} — ${safe(item.message)}`;
              }
              return (
                <li key={String(item.id ?? idx)} className="flex items-start gap-2">
                  <span className="flex-shrink-0">{overdue ? '🔴' : '🟡'}</span>
                  <span>
                    {overdue ? <strong className="text-red-800">OVERDUE: </strong> : <strong className="text-amber-800">UPCOMING: </strong>}
                    {line}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[180px] flex-1">
            <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Vehicle</label>
            <select
              className={inputClass}
              value={filterVehicleId}
              onChange={(e) => setFilterVehicleId(e.target.value)}
            >
              <option value="">All vehicles</option>
              {vehicles.map((v: { id?: string; regNumber?: string }) => (
                <option key={String(v.id)} value={String(v.id)}>
                  {safe(v.regNumber)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1">
            <label className="sr-only">Category</label>
            {(['ALL', 'TRUCK', 'REEFER'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryTab(c)}
                className={`px-3 py-2 rounded-lg text-xs font-['Barlow_Condensed'] font-semibold uppercase tracking-wider border transition-colors ${
                  categoryTab === c
                    ? 'bg-[#1565C0] text-white border-[#1565C0]'
                    : 'bg-[#F4F6F8] text-[#1A4A7A] border-[#E0E8F0] hover:bg-[#E8EEF4]'
                }`}
              >
                {c === 'ALL' ? 'All' : c === 'TRUCK' ? '🚛 Truck' : '❄️ Reefer'}
              </button>
            ))}
          </div>
          <div className="min-w-[160px]">
            <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Type</label>
            <select className={inputClass} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">All types</option>
              {filteredTypesForFilter.map((t) => (
                <option key={t.id} value={t.id}>
                  {(t.icon ? `${t.icon} ` : '') + t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">From</label>
            <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">To</label>
            <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button
            type="button"
            onClick={applySearch}
            className="flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0D2847] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#1565C0]"
          >
            <Search className="w-4 h-4" /> Search
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} iconColor="blue" title="Total records" value={stats.count} />
        <StatCard icon={IndianRupee} iconColor="green" title="Total cost" value={formatInrTwoDecimals(stats.totalCost)} />
        <StatCard icon={Wrench} iconColor="amber" title="Labor cost" value={formatInrTwoDecimals(stats.labor)} />
        <StatCard icon={Package} iconColor="purple" title="Parts cost" value={formatInrTwoDecimals(stats.parts)} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="No maintenance records" description="Adjust filters or add a new record" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  {['Date', 'Vehicle', 'Category', 'Type', 'Description', 'Cost', 'KM / Hours', 'Garage', ''].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#1A4A7A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E8F0]">
                {rows.map((m) => {
                  const cat = String(m.category ?? 'TRUCK').toUpperCase();
                  const isReefer = cat === 'REEFER';
                  const kmOrHrs = isReefer
                    ? Number.isFinite(safeNumber(m.runningHours, NaN))
                      ? `${safeNumber(m.runningHours).toLocaleString('en-IN')} hrs`
                      : '—'
                    : Number.isFinite(safeNumber(m.odometerKm, NaN))
                      ? `${safeNumber(m.odometerKm).toLocaleString('en-IN')} km`
                      : '—';
                  const typeName = m.maintenanceType?.name ?? '';
                  const typeIcon = m.maintenanceType?.icon ?? '';
                  return (
                    <tr
                      key={String(m.id)}
                      className="hover:bg-[#F4F6F8]/80 cursor-pointer transition-colors"
                      onClick={() => openEdit(m)}
                    >
                      <td className="px-4 py-3 font-['Rajdhani'] whitespace-nowrap">{formatDateDdMmYyyy(m.date)}</td>
                      <td className="px-4 py-3 font-mono text-[#1565C0]">{safe(m.vehicle?.regNumber)}</td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={m.category} />
                      </td>
                      <td className="px-4 py-3 text-[#0D2847]">
                        <span className="inline-flex items-center gap-1">
                          {typeIcon ? <span aria-hidden>{typeIcon}</span> : null}
                          <span>{safe(typeName)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#1A4A7A] max-w-[200px] truncate">{safe(m.description)}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-[#0D2847]">{formatInrTwoDecimals(safeNumber(m.totalCost, 0))}</td>
                      <td className="px-4 py-3 font-mono text-[#1A4A7A]">{kmOrHrs}</td>
                      <td className="px-4 py-3 text-[#1A4A7A]">{safe(m.garage)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="p-2 text-[#DC2626] hover:bg-red-50 rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(String(m.id));
                          }}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setViewRecord(null);
          setValidationErrors({});
        }}
        title={viewRecord ? 'View / edit record' : 'Add maintenance record'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Vehicle *</label>
              <select
                className={cn(inputClass, validationErrors.vehicleId && 'border-red-500 ring-1 ring-red-500/25')}
                value={form.vehicleId}
                onChange={(e) => {
                  setForm((f) => ({ ...f, vehicleId: e.target.value }));
                  setValidationErrors((prev) => {
                    const next = { ...prev };
                    delete next.vehicleId;
                    return next;
                  });
                }}
              >
                <option value="">Select vehicle *</option>
                {vehicles.map((v: { id?: string; regNumber?: string }) => (
                  <option key={String(v.id)} value={String(v.id)}>
                    {safe(v.regNumber)}
                  </option>
                ))}
              </select>
              {validationErrors.vehicleId && <p className="text-red-600 text-xs mt-1 font-['Rajdhani']">{validationErrors.vehicleId}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Date *</label>
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
          </div>

          <div>
            <span className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-2">Category *</span>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="vm-cat"
                  checked={form.category === 'TRUCK'}
                  onChange={() => {
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next.typeId;
                      return next;
                    });
                    setForm((f) => ({
                      ...f,
                      category: 'TRUCK',
                      maintenanceTypeId: '',
                      runningHours: '',
                      nextServiceHours: '',
                    }));
                  }}
                />
                <span>🚛 Truck</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="vm-cat"
                  checked={form.category === 'REEFER'}
                  onChange={() => {
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next.typeId;
                      return next;
                    });
                    setForm((f) => ({
                      ...f,
                      category: 'REEFER',
                      maintenanceTypeId: '',
                      odometerKm: '',
                      nextServiceKm: '',
                    }));
                  }}
                />
                <span>❄️ Reefer</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Type *</label>
            <select
              className={cn(inputClass, validationErrors.typeId && 'border-red-500 ring-1 ring-red-500/25')}
              value={form.maintenanceTypeId}
              onChange={(e) => {
                setForm((f) => ({ ...f, maintenanceTypeId: e.target.value }));
                setValidationErrors((prev) => {
                  const next = { ...prev };
                  delete next.typeId;
                  return next;
                });
              }}
            >
              <option value="">Select type *</option>
              {filteredTypesForForm.map((t) => (
                <option key={t.id} value={t.id}>
                  {(t.icon ? `${t.icon} ` : '') + t.name}
                </option>
              ))}
            </select>
            {validationErrors.typeId && <p className="text-red-600 text-xs mt-1 font-['Rajdhani']">{validationErrors.typeId}</p>}
          </div>

          <div>
            <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Description</label>
            <textarea className={inputClass} rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Parts used (comma separated)</label>
            <textarea className={inputClass} rows={2} value={form.partsUsed} onChange={(e) => setForm((f) => ({ ...f, partsUsed: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Labor cost (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={cn(inputClass, validationErrors.cost && 'border-red-500 ring-1 ring-red-500/25')}
                value={form.laborCost}
                onChange={(e) => setLaborParts('laborCost', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Parts cost (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={cn(inputClass, validationErrors.cost && 'border-red-500 ring-1 ring-red-500/25')}
                value={form.partsCost}
                onChange={(e) => setLaborParts('partsCost', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Total cost (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={cn(inputClass, validationErrors.cost && 'border-red-500 ring-1 ring-red-500/25')}
                value={form.totalCost}
                onChange={(e) => {
                  setTotalManual(true);
                  setValidationErrors((prev) => {
                    const next = { ...prev };
                    delete next.cost;
                    return next;
                  });
                  setForm((f) => ({ ...f, totalCost: e.target.value }));
                }}
              />
              <p className="text-[10px] text-[#7A9AB8] mt-1">Auto = labor + parts; edit to override</p>
            </div>
          </div>
          {validationErrors.cost && <p className="text-red-600 text-xs font-['Rajdhani']">{validationErrors.cost}</p>}

          {form.category === 'TRUCK' ? (
            <div>
              <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Odometer KM</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.odometerKm}
                onChange={(e) => setForm((f) => ({ ...f, odometerKm: e.target.value }))}
              />
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Running hours</label>
              <input
                type="number"
                min={0}
                step="0.1"
                className={inputClass}
                value={form.runningHours}
                onChange={(e) => setForm((f) => ({ ...f, runningHours: e.target.value }))}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Garage / vendor</label>
              <input className={inputClass} value={form.garage} onChange={(e) => setForm((f) => ({ ...f, garage: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Bill number</label>
              <input className={inputClass} value={form.billNumber} onChange={(e) => setForm((f) => ({ ...f, billNumber: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Next service due date</label>
            <input
              type="date"
              className={inputClass}
              value={form.nextServiceDueDate}
              onChange={(e) => setForm((f) => ({ ...f, nextServiceDueDate: e.target.value }))}
            />
          </div>

          {form.category === 'TRUCK' ? (
            <div>
              <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Next service KM</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.nextServiceKm}
                onChange={(e) => setForm((f) => ({ ...f, nextServiceKm: e.target.value }))}
              />
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Next service hours</label>
              <input
                type="number"
                min={0}
                step="0.1"
                className={inputClass}
                value={form.nextServiceHours}
                onChange={(e) => setForm((f) => ({ ...f, nextServiceHours: e.target.value }))}
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Notes</label>
            <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                setViewRecord(null);
                setValidationErrors({});
              }}
              className="flex-1 py-2.5 text-sm font-medium text-[#1A4A7A] border border-[#E0E8F0] rounded-lg hover:bg-[#F4F6F8]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={submitRecord}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#1565C0] hover:bg-[#0D2847] disabled:opacity-50 rounded-lg font-['Barlow_Condensed'] uppercase tracking-wider"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save record'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId);
        }}
        loading={deleteMutation.isPending}
        title="Delete maintenance record?"
        message="This cannot be undone."
      />
    </div>
  );
}

export default function MaintenancePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <MaintenancePageInner />
    </Suspense>
  );
}
