'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatIndianCurrency } from '@/lib/utils';
import { ArrowLeft, Pencil, Plus, Eye, Download } from 'lucide-react';
import toast from 'react-hot-toast';

type BillingType = 'MONTHLY_CONTRACT' | 'ADHOC' | 'MIXED';

interface ClientVehicle {
  id: string;
  vehicleId: string;
  vehicle?: { id: string; regNumber: string };
  route?: string;
  billingType: BillingType;
  monthlyRate?: number;
  tripRate?: number;
  isActive?: boolean;
}

interface Client {
  id: string;
  name: string;
  address?: string;
  gstNumber?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  billingType: BillingType;
  contractRate?: number;
  adhocTripRate?: number;
  paymentTermsDays?: number;
  isActive?: boolean;
  vehicles?: ClientVehicle[];
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

const BILLING_LABELS: Record<string, string> = {
  MONTHLY_CONTRACT: 'Monthly',
  ADHOC: 'Adhoc',
  MIXED: 'Mixed',
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-[#7A9AB8]/10 text-[#7A9AB8]',
  SENT: 'bg-[#42A5F5]/10 text-[#42A5F5]',
  PAID: 'bg-[#16A34A]/10 text-[#16A34A]',
  PARTIAL: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  OVERDUE: 'bg-[#DC2626]/10 text-[#DC2626]',
  CANCELLED: 'bg-[#7A9AB8]/10 text-[#7A9AB8] line-through',
};

const inputClass = 'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-[#0D2847] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20 font-["Rajdhani"] text-sm';

/** Coerce API value to a plain array (handles undefined, single object mistakes, nested keys). */
function toArray<T>(value: unknown): T[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'object') return [value as T];
  return [];
}

/** Normalize one client–vehicle assignment from various API shapes (camelCase / snake_case / Prisma). */
function normalizeClientVehicle(row: Record<string, unknown> | null | undefined): ClientVehicle | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const nestedVehicle = r.vehicle && typeof r.vehicle === 'object' ? (r.vehicle as Record<string, unknown>) : null;
  const vehicleId = String(r.vehicleId ?? r.vehicle_id ?? nestedVehicle?.id ?? '');
  const rowId = r.id ?? r.clientVehicleId ?? r.client_vehicle_id;
  const id = rowId != null ? String(rowId) : vehicleId ? `cv-${vehicleId}` : `cv-${Math.random().toString(36).slice(2)}`;
  const regFromNested =
    nestedVehicle?.regNumber != null
      ? String(nestedVehicle.regNumber)
      : nestedVehicle?.reg_number != null
        ? String(nestedVehicle.reg_number)
        : '';
  const billingRaw = (r.billingType ?? r.billing_type ?? 'MONTHLY_CONTRACT') as string;
  const billingType = (['MONTHLY_CONTRACT', 'ADHOC', 'MIXED'].includes(billingRaw) ? billingRaw : 'MONTHLY_CONTRACT') as BillingType;
  const monthlyRate = r.monthlyRate ?? r.monthly_rate;
  const tripRate = r.tripRate ?? r.trip_rate;
  const vehicle: { id: string; regNumber: string } | undefined =
    nestedVehicle || regFromNested
      ? {
          id: String(nestedVehicle?.id ?? vehicleId ?? ''),
          regNumber: regFromNested || vehicleId || '—',
        }
      : vehicleId
        ? { id: vehicleId, regNumber: vehicleId }
        : undefined;

  return {
    id,
    vehicleId,
    vehicle,
    route: r.route != null ? String(r.route) : undefined,
    billingType,
    monthlyRate: typeof monthlyRate === 'number' ? monthlyRate : monthlyRate != null ? Number(monthlyRate) : undefined,
    tripRate: typeof tripRate === 'number' ? tripRate : tripRate != null ? Number(tripRate) : undefined,
    isActive: r.isActive === false || r.is_active === false ? false : true,
  };
}

function normalizeClientVehiclesList(raw: unknown): ClientVehicle[] {
  return toArray<Record<string, unknown>>(raw)
    .map((item) => normalizeClientVehicle(item))
    .filter((v): v is ClientVehicle => v != null);
}

/** Normalize GET /clients/:id response body into a safe Client shape. */
function normalizeClient(raw: unknown): Client | null {
  if (raw == null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : null;
  if (!id) return null;

  const vehiclesSource = r.vehicles ?? r.clientVehicles ?? r.client_vehicles ?? r.ClientVehicle;
  const vehicles = normalizeClientVehiclesList(vehiclesSource);

  const billingRaw = (r.billingType ?? r.billing_type ?? 'MONTHLY_CONTRACT') as string;
  const billingType = (['MONTHLY_CONTRACT', 'ADHOC', 'MIXED'].includes(billingRaw) ? billingRaw : 'MONTHLY_CONTRACT') as BillingType;

  return {
    id,
    name: typeof r.name === 'string' && r.name.trim() ? r.name : 'Client',
    address: r.address != null ? String(r.address) : undefined,
    gstNumber: r.gstNumber != null ? String(r.gstNumber) : r.gst_number != null ? String(r.gst_number) : undefined,
    contactPerson: r.contactPerson != null ? String(r.contactPerson) : r.contact_person != null ? String(r.contact_person) : undefined,
    contactPhone: r.contactPhone != null ? String(r.contactPhone) : r.contact_phone != null ? String(r.contact_phone) : undefined,
    contactEmail: r.contactEmail != null ? String(r.contactEmail) : r.contact_email != null ? String(r.contact_email) : undefined,
    billingType,
    contractRate:
      typeof r.contractRate === 'number'
        ? r.contractRate
        : r.contract_rate != null
          ? Number(r.contract_rate)
          : undefined,
    adhocTripRate:
      typeof r.adhocTripRate === 'number'
        ? r.adhocTripRate
        : r.adhoc_trip_rate != null
          ? Number(r.adhoc_trip_rate)
          : undefined,
    paymentTermsDays:
      typeof r.paymentTermsDays === 'number'
        ? r.paymentTermsDays
        : r.payment_terms_days != null
          ? Number(r.payment_terms_days)
          : 15,
    isActive: r.isActive === false || r.is_active === false ? false : true,
    vehicles,
  };
}

function safeInvoicesList(raw: unknown): Invoice[] {
  const arr = toArray<Record<string, unknown>>(raw);
  return arr
    .map((inv) => {
      if (!inv?.id) return null;
      return {
        id: String(inv.id),
        invoiceNumber: String(inv.invoiceNumber ?? inv.invoice_number ?? ''),
        clientId: String(inv.clientId ?? inv.client_id ?? ''),
        periodStart: String(inv.periodStart ?? inv.period_start ?? ''),
        periodEnd: String(inv.periodEnd ?? inv.period_end ?? ''),
        totalAmount: Number(inv.totalAmount ?? inv.total_amount ?? 0) || 0,
        status: String(inv.status ?? 'DRAFT'),
        createdAt: String(inv.createdAt ?? inv.created_at ?? ''),
      } as Invoice;
    })
    .filter((x): x is Invoice => x != null && !!x.id);
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const qc = useQueryClient();
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<{ vehicleId: string; route: string; billingType: BillingType; monthlyRate?: number; tripRate?: number }>({ vehicleId: '', route: '', billingType: 'MONTHLY_CONTRACT' });
  const [removeVehicleId, setRemoveVehicleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Client>>({});

  const {
    data: client,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      try {
        const res = await api.get(`/clients/${id}`);
        const raw = res.data?.data ?? res.data?.client ?? res.data;
        const normalized = normalizeClient(raw);
        return normalized;
      } catch (e) {
        console.error('Client detail fetch failed:', e);
        throw e;
      }
    },
    enabled: !!id,
    retry: 1,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', { clientId: id }],
    queryFn: async () => {
      try {
        const res = await api.get('/invoices', { params: { clientId: id } });
        const raw = res.data?.data ?? res.data?.invoices ?? res.data;
        return safeInvoicesList(raw);
      } catch (e) {
        console.error('Client invoices fetch failed:', e);
        return [] as Invoice[];
      }
    },
    enabled: !!id,
  });

  const { data: allVehiclesRaw } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: async () => {
      try {
        const r = await api.get('/vehicles?limit=500');
        const raw = r.data?.data ?? r.data;
        return Array.isArray(raw) ? raw : toArray(raw);
      } catch {
        return [];
      }
    },
  });

  const allVehicles = useMemo(() => (Array.isArray(allVehiclesRaw) ? allVehiclesRaw : []), [allVehiclesRaw]);

  const vehicles = useMemo(() => {
    const list = client?.vehicles;
    if (!list || !Array.isArray(list)) return [];
    return list;
  }, [client?.vehicles]);

  const assignedVehicleIds = useMemo(() => {
    return vehicles
      .map((v) => v.vehicleId || v.vehicle?.id)
      .filter((x): x is string => typeof x === 'string' && x.length > 0);
  }, [vehicles]);

  const availableVehicles = useMemo(() => {
    return allVehicles.filter((v: { id?: string }) => v?.id && !assignedVehicleIds.includes(String(v.id)));
  }, [allVehicles, assignedVehicleIds]);

  const assignMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post(`/clients/${id}/vehicles`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] });
      toast.success('Vehicle assigned');
      setAssignModalOpen(false);
      setAssignForm({ vehicleId: '', route: '', billingType: 'MONTHLY_CONTRACT' });
    },
    onError: (e: unknown) => {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as { response?: { data?: { message?: string } } }).response?.data?.message : undefined;
      toast.error(msg || 'Failed to assign');
    },
  });

  const removeVehicleMutation = useMutation({
    mutationFn: (assignmentId: string) => api.delete(`/clients/${id}/vehicles/${assignmentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] });
      toast.success('Vehicle removed');
      setRemoveVehicleId(null);
    },
    onError: () => toast.error('Failed to remove'),
  });

  const updateClientMutation = useMutation({
    mutationFn: (payload: Partial<Client>) => api.put(`/clients/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] });
      toast.success('Client updated');
      setEditModalOpen(false);
    },
    onError: (e: unknown) => {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as { response?: { data?: { message?: string } } }).response?.data?.message : undefined;
      toast.error(msg || 'Failed to update');
    },
  });

  const openEditModal = () => {
    if (!client) return;
    const cl = client;
    setEditForm({
      name: cl.name,
      address: cl.address,
      gstNumber: cl.gstNumber,
      contactPerson: cl.contactPerson,
      contactPhone: cl.contactPhone,
      contactEmail: cl.contactEmail,
      billingType: cl.billingType,
      contractRate: cl.contractRate,
      adhocTripRate: cl.adhocTripRate,
      paymentTermsDays: cl.paymentTermsDays ?? 15,
      isActive: cl.isActive !== false,
    });
    setEditModalOpen(true);
  };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.vehicleId) return;
    assignMutation.mutate({
      vehicleId: assignForm.vehicleId,
      route: assignForm.route || undefined,
      billingType: assignForm.billingType,
      monthlyRate: assignForm.monthlyRate,
      tripRate: assignForm.tripRate,
    });
  };

  const openPdf = async (invoiceId: string) => {
    if (!invoiceId) return;
    try {
      const res = await api.post(`/invoices/${invoiceId}/generate-pdf`, {}, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  if (!id) {
    return (
      <div className="rounded-lg border border-[#E0E8F0] bg-white p-8 text-center font-['Rajdhani'] text-[#7A9AB8]">
        Invalid client link.
        <button type="button" onClick={() => router.push('/clients')} className="mt-4 block mx-auto text-[#1565C0] hover:underline">
          Back to clients
        </button>
      </div>
    );
  }

  if (isLoading || (isFetching && !client)) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner text="Loading client…" />
      </div>
    );
  }

  if (isError || !client) {
    const message =
      error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string }; status?: number } }).response?.data?.message
        : undefined;
    return (
      <div className="rounded-lg border border-[#E0E8F0] bg-white p-8 text-center space-y-4">
        <p className="font-['Oswald'] text-[#0D2847]">Could not load client</p>
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">{message || 'The client may have been removed or you may not have access.'}</p>
        <button type="button" onClick={() => router.push('/clients')} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847]">
          Back to clients
        </button>
      </div>
    );
  }

  const c = client;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => router.back()} className="p-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-['Oswald'] text-2xl font-bold text-[#0D2847] tracking-wide truncate">{c.name}</h1>
          <div className="flex flex-wrap gap-4 mt-1 font-['Rajdhani'] text-sm text-[#7A9AB8]">
            {c.gstNumber ? <span className="font-mono">{c.gstNumber}</span> : null}
            {c.contactPerson ? <span>{c.contactPerson}</span> : null}
            {c.contactPhone ? <span className="font-mono">{c.contactPhone}</span> : null}
            {c.contactEmail ? <span>{c.contactEmail}</span> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={openEditModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1565C0] text-[#1565C0] font-['Barlow_Condensed'] font-semibold uppercase hover:bg-[#1565C0]/10 shrink-0"
        >
          <Pencil className="w-4 h-4" /> Edit
        </button>
      </div>

      {/* Assigned Vehicles */}
      <section className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E0E8F0] bg-[#F4F6F8]">
          <h2 className="font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#1A4A7A]">Assigned Vehicles</h2>
          <button
            type="button"
            onClick={() => setAssignModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] font-semibold uppercase text-sm hover:bg-[#0D2847]"
          >
            <Plus className="w-4 h-4" /> Assign Vehicle
          </button>
        </div>
        {!vehicles.length ? (
          <EmptyState message="No vehicles assigned" description="Assign vehicles to this client" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Vehicle Reg No</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Route</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Billing Type</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Monthly Rate</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Trip Rate</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Status</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E8F0]">
                {vehicles.map((v) => {
                  const regDisplay = v.vehicle?.regNumber?.trim() || v.vehicleId || '—';
                  const billingLabel = BILLING_LABELS[v.billingType] ?? String(v.billingType ?? '—');
                  return (
                    <tr key={v.id} className="hover:bg-[#F4F6F8]">
                      <td className="px-4 py-3 font-['Rajdhani'] font-mono font-medium text-[#0D2847]">{regDisplay}</td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#1A4A7A]">{v.route?.trim() ? v.route : '—'}</td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm">{billingLabel}</td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm">{v.monthlyRate != null && !Number.isNaN(v.monthlyRate) ? formatIndianCurrency(v.monthlyRate) : '—'}</td>
                      <td className="px-4 py-3 font-['Rajdhani'] text-sm">{v.tripRate != null && !Number.isNaN(v.tripRate) ? formatIndianCurrency(v.tripRate) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={v.isActive !== false ? 'text-[#16A34A]' : 'text-[#7A9AB8]'}>{v.isActive !== false ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setRemoveVehicleId(v.id)} className="text-[#DC2626] hover:underline font-['Rajdhani'] text-sm">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Invoice History */}
      <section className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm overflow-hidden">
        <h2 className="font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#1A4A7A] px-4 py-3 border-b border-[#E0E8F0] bg-[#F4F6F8]">Invoice History</h2>
        {!invoices.length ? (
          <EmptyState message="No invoices" description="Create an invoice from the Invoices page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Invoice No</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Period</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Amount</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Status</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Date</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase text-[#1A4A7A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E8F0]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#F4F6F8]">
                    <td className="px-4 py-3 font-['Oswald'] font-bold text-[#1565C0]">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline">
                        {inv.invoiceNumber || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#0D2847]">
                      {inv.periodStart && inv.periodEnd
                        ? `${new Date(inv.periodStart).toLocaleDateString('en-IN')} – ${new Date(inv.periodEnd).toLocaleDateString('en-IN')}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 font-['Oswald'] text-sm font-semibold text-[#0D2847]">{formatIndianCurrency(inv.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-['Barlow_Condensed'] font-semibold ${STATUS_CLASSES[inv.status] ?? 'bg-[#7A9AB8]/10 text-[#7A9AB8]'}`}>
                        {inv.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#7A9AB8]">
                      {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/invoices/${inv.id}`} className="p-2 text-[#42A5F5] hover:bg-[#42A5F5]/10 rounded" title="View">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button type="button" onClick={() => openPdf(inv.id)} className="p-2 text-[#42A5F5] hover:bg-[#42A5F5]/10 rounded" title="Download PDF">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal isOpen={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Assign Vehicle" size="md">
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Vehicle *</label>
            <select className={inputClass} value={assignForm.vehicleId} onChange={(e) => setAssignForm((f) => ({ ...f, vehicleId: e.target.value }))} required>
              <option value="">Select vehicle</option>
              {availableVehicles.map((v: { id?: string; regNumber?: string; reg_number?: string; make?: string; model?: string }) => (
                <option key={String(v.id)} value={String(v.id)}>
                  {v.regNumber ?? v.reg_number ?? v.id} {v.make ? `– ${v.make} ${v.model ?? ''}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Route</label>
            <input className={inputClass} value={assignForm.route} onChange={(e) => setAssignForm((f) => ({ ...f, route: e.target.value }))} placeholder="Route or description" />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Billing Type</label>
            <select className={inputClass} value={assignForm.billingType} onChange={(e) => setAssignForm((f) => ({ ...f, billingType: e.target.value as BillingType }))}>
              <option value="MONTHLY_CONTRACT">Monthly Contract</option>
              <option value="ADHOC">Adhoc</option>
              <option value="MIXED">Mixed</option>
            </select>
          </div>
          {(assignForm.billingType === 'MONTHLY_CONTRACT' || assignForm.billingType === 'MIXED') && (
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Monthly Rate (₹)</label>
              <input
                className={inputClass}
                type="number"
                min={0}
                step={0.01}
                value={assignForm.monthlyRate ?? ''}
                onChange={(e) => setAssignForm((f) => ({ ...f, monthlyRate: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
          )}
          {(assignForm.billingType === 'ADHOC' || assignForm.billingType === 'MIXED') && (
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Trip Rate (₹)</label>
              <input
                className={inputClass}
                type="number"
                min={0}
                step={0.01}
                value={assignForm.tripRate ?? ''}
                onChange={(e) => setAssignForm((f) => ({ ...f, tripRate: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-[#E0E8F0]">
            <button type="button" onClick={() => setAssignModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#F4F6F8]">
              Cancel
            </button>
            <button type="submit" disabled={assignMutation.isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50">
              Assign
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Client" size="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateClientMutation.mutate(editForm);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Name *</label>
              <input className={inputClass} value={editForm.name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">GST Number</label>
              <input className={inputClass} value={editForm.gstNumber ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, gstNumber: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Address</label>
            <textarea className={inputClass} rows={2} value={editForm.address ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Contact Person</label>
              <input className={inputClass} value={editForm.contactPerson ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, contactPerson: e.target.value }))} />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Contact Phone</label>
              <input className={inputClass} type="tel" value={editForm.contactPhone ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, contactPhone: e.target.value }))} />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Contact Email</label>
              <input className={inputClass} type="email" value={editForm.contactEmail ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, contactEmail: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Billing Type</label>
            <select className={inputClass} value={editForm.billingType ?? 'MONTHLY_CONTRACT'} onChange={(e) => setEditForm((f) => ({ ...f, billingType: e.target.value as BillingType }))}>
              <option value="MONTHLY_CONTRACT">Monthly Contract</option>
              <option value="ADHOC">Adhoc</option>
              <option value="MIXED">Mixed</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {(editForm.billingType === 'MONTHLY_CONTRACT' || editForm.billingType === 'MIXED') && (
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Contract Rate (₹/month)</label>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  step={0.01}
                  value={editForm.contractRate ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, contractRate: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </div>
            )}
            {(editForm.billingType === 'ADHOC' || editForm.billingType === 'MIXED') && (
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Adhoc Trip Rate (₹/trip)</label>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  step={0.01}
                  value={editForm.adhocTripRate ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, adhocTripRate: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </div>
            )}
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Payment Terms (days)</label>
              <input
                className={inputClass}
                type="number"
                min={1}
                value={editForm.paymentTermsDays ?? 15}
                onChange={(e) => setEditForm((f) => ({ ...f, paymentTermsDays: Number(e.target.value) || 15 }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="editActive" checked={editForm.isActive ?? true} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded border-[#E0E8F0]" />
            <label htmlFor="editActive" className="font-['Rajdhani'] text-sm text-[#0D2847]">
              Active
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-[#E0E8F0]">
            <button type="button" onClick={() => setEditModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#F4F6F8]">
              Cancel
            </button>
            <button type="submit" disabled={updateClientMutation.isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50">
              Update
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!removeVehicleId}
        onClose={() => setRemoveVehicleId(null)}
        onConfirm={() => removeVehicleId && removeVehicleMutation.mutate(removeVehicleId)}
        loading={removeVehicleMutation.isPending}
        title="Remove vehicle?"
        message="This will unassign the vehicle from this client."
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}
