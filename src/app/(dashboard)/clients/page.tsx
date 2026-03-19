'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Building2, Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

type BillingType = 'MONTHLY_CONTRACT' | 'ADHOC' | 'MIXED';

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
  isActive: boolean;
  _count?: { vehicles?: number };
}

const BILLING_LABELS: Record<BillingType, string> = {
  MONTHLY_CONTRACT: 'Monthly',
  ADHOC: 'Adhoc',
  MIXED: 'Mixed',
};

const BILLING_CLASSES: Record<BillingType, string> = {
  MONTHLY_CONTRACT: 'bg-[#1565C0]/10 text-[#1565C0]',
  ADHOC: 'bg-[#42A5F5]/10 text-[#42A5F5]',
  MIXED: 'bg-[#F59E0B]/10 text-[#F59E0B]',
};

const inputClass = 'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-[#0D2847] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20 font-["Rajdhani"] text-sm';

export default function ClientsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Client>>({ billingType: 'MONTHLY_CONTRACT', paymentTermsDays: 15, isActive: true });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get('/clients');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? res.data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Client>) =>
      editClient ? api.put(`/clients/${editClient.id}`, payload) : api.post('/clients', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(editClient ? 'Client updated' : 'Client created');
      setModalOpen(false);
      setForm({ billingType: 'MONTHLY_CONTRACT', paymentTermsDays: 15, isActive: true });
      setEditClient(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted');
      setDeleteId(null);
    },
    onError: () => toast.error('Failed to delete'),
  });

  const openCreate = () => {
    setForm({ billingType: 'MONTHLY_CONTRACT', paymentTermsDays: 15, isActive: true });
    setEditClient(null);
    setModalOpen(true);
  };

  const openEdit = (c: Client) => {
    setForm({
      name: c.name,
      address: c.address,
      gstNumber: c.gstNumber,
      contactPerson: c.contactPerson,
      contactPhone: c.contactPhone,
      contactEmail: c.contactEmail,
      billingType: c.billingType,
      contractRate: c.contractRate,
      adhocTripRate: c.adhocTripRate,
      paymentTermsDays: c.paymentTermsDays ?? 15,
      isActive: c.isActive,
    });
    setEditClient(c);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form as any);
  };

  const showContractRate = form.billingType === 'MONTHLY_CONTRACT' || form.billingType === 'MIXED';
  const showAdhocRate = form.billingType === 'ADHOC' || form.billingType === 'MIXED';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Clients</h1>
          <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#1565C0] hover:bg-[#0D2847] text-white font-['Barlow_Condensed'] font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <LoadingSpinner />
        ) : !clients.length ? (
          <EmptyState message="No clients" description="Add your first client to get started" action={{ label: 'Add Client', onClick: openCreate }} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Name</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">GST No</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Contact Person</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Phone</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Billing Type</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Vehicles</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Status</th>
                  <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E8F0]">
                {(clients as Client[]).map((c) => (
                  <tr key={c.id} className="hover:bg-[#F4F6F8] transition-colors">
                    <td className="px-4 py-3.5 font-['Rajdhani'] text-sm font-medium text-[#0D2847]">
                      <Link href={`/clients/${c.id}`} className="text-[#1565C0] hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-4 py-3.5 font-['Rajdhani'] text-sm text-[#1A4A7A] font-mono">{c.gstNumber || '—'}</td>
                    <td className="px-4 py-3.5 font-['Rajdhani'] text-sm text-[#0D2847]">{c.contactPerson || '—'}</td>
                    <td className="px-4 py-3.5 font-['Rajdhani'] text-sm text-[#1A4A7A] font-mono">{c.contactPhone || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-['Barlow_Condensed'] font-semibold ${BILLING_CLASSES[c.billingType]}`}>
                        {BILLING_LABELS[c.billingType]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-['Rajdhani'] text-sm text-[#0D2847]">{(c as any)._count?.vehicles ?? 0}</td>
                    <td className="px-4 py-3.5">
                      <span className={c.isActive ? 'text-[#16A34A] font-["Rajdhani"] text-sm font-medium' : 'text-[#DC2626] font-["Rajdhani"] text-sm'}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/clients/${c.id}`} className="p-2 text-[#42A5F5] hover:bg-[#42A5F5]/10 rounded-lg" title="View"><Eye className="w-4 h-4" /></Link>
                        <button onClick={() => openEdit(c)} className="p-2 text-[#42A5F5] hover:bg-[#42A5F5]/10 rounded-lg" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteId(c.id)} className="p-2 text-[#DC2626] hover:bg-[#DC2626]/10 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && clients.length > 0 && (
          <div className="px-4 py-2 border-t border-[#E0E8F0] font-['Rajdhani'] text-xs text-[#7A9AB8]">
            Showing 1–{clients.length} of {clients.length}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditClient(null); }} title={editClient ? 'Edit Client' : 'Add Client'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Name *</label>
              <input className={inputClass} value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Client name" />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">GST Number</label>
              <input className={inputClass} value={form.gstNumber ?? ''} onChange={e => setForm(f => ({ ...f, gstNumber: e.target.value }))} placeholder="GSTIN" />
            </div>
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Address</label>
            <textarea className={inputClass} rows={2} value={form.address ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Contact Person</label>
              <input className={inputClass} value={form.contactPerson ?? ''} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Contact Phone</label>
              <input className={inputClass} type="tel" value={form.contactPhone ?? ''} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Contact Email</label>
              <input className={inputClass} type="email" value={form.contactEmail ?? ''} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Billing Type</label>
            <select className={inputClass} value={form.billingType ?? 'MONTHLY_CONTRACT'} onChange={e => setForm(f => ({ ...f, billingType: e.target.value as BillingType }))}>
              <option value="MONTHLY_CONTRACT">Monthly Contract</option>
              <option value="ADHOC">Adhoc</option>
              <option value="MIXED">Mixed</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {showContractRate && (
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Contract Rate (₹/month)</label>
                <input className={inputClass} type="number" min={0} step={0.01} value={form.contractRate ?? ''} onChange={e => setForm(f => ({ ...f, contractRate: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
            )}
            {showAdhocRate && (
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Adhoc Trip Rate (₹/trip)</label>
                <input className={inputClass} type="number" min={0} step={0.01} value={form.adhocTripRate ?? ''} onChange={e => setForm(f => ({ ...f, adhocTripRate: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
            )}
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1.5">Payment Terms (days)</label>
              <input className={inputClass} type="number" min={1} value={form.paymentTermsDays ?? 15} onChange={e => setForm(f => ({ ...f, paymentTermsDays: Number(e.target.value) || 15 }))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive ?? true} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded border-[#E0E8F0]" />
            <label htmlFor="isActive" className="font-['Rajdhani'] text-sm text-[#0D2847]">Active</label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-[#E0E8F0]">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#F4F6F8]">
              Cancel
            </button>
            <button type="submit" disabled={saveMutation.isPending} className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50">
              {saveMutation.isPending ? 'Saving...' : editClient ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Delete client?"
        message="This will remove the client and cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
