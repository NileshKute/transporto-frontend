'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatIndianCurrency } from '@/lib/utils';
import { ArrowLeft, Pencil, Plus, FileText, Eye, Download, Truck } from 'lucide-react';
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

const BILLING_LABELS: Record<BillingType, string> = {
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

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const qc = useQueryClient();
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<{ vehicleId: string; route: string; billingType: BillingType; monthlyRate?: number; tripRate?: number }>({ vehicleId: '', route: '', billingType: 'MONTHLY_CONTRACT' });
  const [removeVehicleId, setRemoveVehicleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Client>>({});

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const res = await api.get(`/clients/${id}`);
      return res.data?.data ?? res.data;
    },
    enabled: !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', { clientId: id }],
    queryFn: async () => {
      const res = await api.get('/invoices', { params: { clientId: id } });
      const raw = res.data?.data ?? res.data;
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!id,
  });

  const { data: allVehicles = [] } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: () => api.get('/vehicles?limit=500').then(r => r.data?.data ?? r.data ?? []),
  });

  const assignedVehicleIds = (client?.vehicles ?? []).map((v: ClientVehicle) => v.vehicleId || v.vehicle?.id).filter(Boolean);
  const availableVehicles = (allVehicles as any[]).filter(v => !assignedVehicleIds.includes(v.id));

  const assignMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/clients/${id}/vehicles`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] });
      toast.success('Vehicle assigned');
      setAssignModalOpen(false);
      setAssignForm({ vehicleId: '', route: '', billingType: 'MONTHLY_CONTRACT' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to assign'),
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
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update'),
  });

  const openEditModal = () => {
    const cl = client as Client;
    setEditForm({
      name: cl?.name,
      address: cl?.address,
      gstNumber: cl?.gstNumber,
      contactPerson: cl?.contactPerson,
      contactPhone: cl?.contactPhone,
      contactEmail: cl?.contactEmail,
      billingType: cl?.billingType,
      contractRate: cl?.contractRate,
      adhocTripRate: cl?.adhocTripRate,
      paymentTermsDays: cl?.paymentTermsDays ?? 15,
      isActive: cl?.isActive !== false,
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
    try {
      const res = await api.post(`/invoices/${invoiceId}/generate-pdf`, {}, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  if (isLoading || !client) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner />
      </div>
    );
  }

  const c = client as Client;
  const vehicles = c.vehicles ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-['Oswald'] text-2xl font-bold text-[#0D2847] tracking-wide">{c.name}</h1>
          <div className="flex flex-wrap gap-4 mt-1 font-['Rajdhani'] text-sm text-[#7A9AB8]">
            {c.gstNumber && <span className="font-mono">{c.gstNumber}</span>}
            {c.contactPerson && <span>{c.contactPerson}</span>}
            {c.contactPhone && <span className="font-mono">{c.contactPhone}</span>}
            {c.contactEmail && <span>{c.contactEmail}</span>}
          </div>
        </div>
        <button
          onClick={openEditModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1565C0] text-[#1565C0] font-['Barlow_Condensed'] font-semibold uppercase hover:bg-[#1565C0]/10"
        >
          <Pencil className="w-4 h-4" /> Edit
        </button>
      </div>

      {/* Assigned Vehicles */}
      <section className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E0E8F0] bg-[#F4F6F8]">
          <h2 className="font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#1A4A7A]">Assigned Vehicles</h2>
          <button
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
                {vehicles.map((v: ClientVehicle) => (
                  <tr key={v.id} className="hover:bg-[#F4F6F8]">
                    <td className="px-4 py-3 font-['Rajdhani'] font-mono font-medium text-[#0D2847]">{v.vehicle?.regNumber ?? v.vehicleId}</td>
                    <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#1A4A7A]">{v.route || '—'}</td>
                    <td className="px-4 py-3 font-['Rajdhani'] text-sm">{BILLING_LABELS[v.billingType]}</td>
                    <td className="px-4 py-3 font-['Rajdhani'] text-sm">{v.monthlyRate != null ? formatIndianCurrency(v.monthlyRate) : '—'}</td>
                    <td className="px-4 py-3 font-['Rajdhani'] text-sm">{v.tripRate != null ? formatIndianCurrency(v.tripRate) : '—'}</td>
                    <td className="px-4 py-3"><span className={v.isActive !== false ? 'text-[#16A34A]' : 'text-[#7A9AB8]'}>{(v.isActive !== false) ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3">
                      <button onClick={() => setRemoveVehicleId(v.id)} className="text-[#DC2626] hover:underline font-['Rajdhani'] text-sm">Remove</button>
                    </td>
                  </tr>
                ))}
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
                {(invoices as Invoice[]).map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#F4F6F8]">
                    <td className="px-4 py-3 font-['Oswald'] font-bold text-[#1565C0]">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline">{inv.invoiceNumber}</Link>
                    </td>
                    <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#0D2847]">
                      {inv.periodStart && inv.periodEnd ? `${new Date(inv.periodStart).toLocaleDateString('en-IN')} – ${new Date(inv.periodEnd).toLocaleDateString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-['Oswald'] text-sm font-semibold text-[#0D2847]">{formatIndianCurrency(inv.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-['Barlow_Condensed'] font-semibold ${STATUS_CLASSES[inv.status] ?? 'bg-[#7A9AB8]/10 text-[#7A9AB8]'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-['Rajdhani'] text-sm text-[#7A9AB8]">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/invoices/${inv.id}`} className="p-2 text-[#42A5F5] hover:bg-[#42A5F5]/10 rounded" title="View"><Eye className="w-4 h-4" /></Link>
                        <button onClick={() => openPdf(inv.id)} className="p-2 text-[#42A5F5] hover:bg-[#42A5F5]/10 rounded" title="Download PDF"><Download className="w-4 h-4" /></button>
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
            <select className={inputClass} value={assignForm.vehicleId} onChange={e => setAssignForm(f => ({ ...f, vehicleId: e.target.value }))} required>
              <option value="">Select vehicle</option>
              {availableVehicles.map((v: any) => (
                <option key={v.id} value={v.id}>{v.regNumber} {v.make ? `– ${v.make} ${v.model || ''}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Route</label>
            <input className={inputClass} value={assignForm.route} onChange={e => setAssignForm(f => ({ ...f, route: e.target.value }))} placeholder="Route or description" />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Billing Type</label>
            <select className={inputClass} value={assignForm.billingType} onChange={e => setAssignForm(f => ({ ...f, billingType: e.target.value as BillingType }))}>
              <option value="MONTHLY_CONTRACT">Monthly Contract</option>
              <option value="ADHOC">Adhoc</option>
              <option value="MIXED">Mixed</option>
            </select>
          </div>
          {(assignForm.billingType === 'MONTHLY_CONTRACT' || assignForm.billingType === 'MIXED') && (
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Monthly Rate (₹)</label>
              <input className={inputClass} type="number" min={0} step={0.01} value={assignForm.monthlyRate ?? ''} onChange={e => setAssignForm(f => ({ ...f, monthlyRate: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
          )}
          {(assignForm.billingType === 'ADHOC' || assignForm.billingType === 'MIXED') && (
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Trip Rate (₹)</label>
              <input className={inputClass} type="number" min={0} step={0.01} value={assignForm.tripRate ?? ''} onChange={e => setAssignForm(f => ({ ...f, tripRate: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-[#E0E8F0]">
            <button type="button" onClick={() => setAssignModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#F4F6F8]">Cancel</button>
            <button type="submit" disabled={assignMutation.isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50">Assign</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Client" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); updateClientMutation.mutate(editForm); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Name *</label>
              <input className={inputClass} value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">GST Number</label>
              <input className={inputClass} value={editForm.gstNumber ?? ''} onChange={e => setEditForm(f => ({ ...f, gstNumber: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Address</label>
            <textarea className={inputClass} rows={2} value={editForm.address ?? ''} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Contact Person</label>
              <input className={inputClass} value={editForm.contactPerson ?? ''} onChange={e => setEditForm(f => ({ ...f, contactPerson: e.target.value }))} />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Contact Phone</label>
              <input className={inputClass} type="tel" value={editForm.contactPhone ?? ''} onChange={e => setEditForm(f => ({ ...f, contactPhone: e.target.value }))} />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Contact Email</label>
              <input className={inputClass} type="email" value={editForm.contactEmail ?? ''} onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Billing Type</label>
            <select className={inputClass} value={editForm.billingType ?? 'MONTHLY_CONTRACT'} onChange={e => setEditForm(f => ({ ...f, billingType: e.target.value as BillingType }))}>
              <option value="MONTHLY_CONTRACT">Monthly Contract</option>
              <option value="ADHOC">Adhoc</option>
              <option value="MIXED">Mixed</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {(editForm.billingType === 'MONTHLY_CONTRACT' || editForm.billingType === 'MIXED') && (
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Contract Rate (₹/month)</label>
                <input className={inputClass} type="number" min={0} step={0.01} value={editForm.contractRate ?? ''} onChange={e => setEditForm(f => ({ ...f, contractRate: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
            )}
            {(editForm.billingType === 'ADHOC' || editForm.billingType === 'MIXED') && (
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Adhoc Trip Rate (₹/trip)</label>
                <input className={inputClass} type="number" min={0} step={0.01} value={editForm.adhocTripRate ?? ''} onChange={e => setEditForm(f => ({ ...f, adhocTripRate: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
            )}
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Payment Terms (days)</label>
              <input className={inputClass} type="number" min={1} value={editForm.paymentTermsDays ?? 15} onChange={e => setEditForm(f => ({ ...f, paymentTermsDays: Number(e.target.value) || 15 }))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="editActive" checked={editForm.isActive ?? true} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded border-[#E0E8F0]" />
            <label htmlFor="editActive" className="font-['Rajdhani'] text-sm text-[#0D2847]">Active</label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-[#E0E8F0]">
            <button type="button" onClick={() => setEditModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#F4F6F8]">Cancel</button>
            <button type="submit" disabled={updateClientMutation.isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50">Update</button>
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
