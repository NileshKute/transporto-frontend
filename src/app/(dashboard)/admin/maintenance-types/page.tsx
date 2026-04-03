'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { safe } from '@/lib/utils';
import { Settings, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Category = 'TRUCK' | 'REEFER';

interface MaintTypeRow {
  id: string;
  name: string;
  icon?: string | null;
  category: Category;
}

const inputClass =
  'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm text-[#0D2847] font-["Rajdhani"] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20';

export default function MaintenanceTypesAdminPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<Category>('TRUCK');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaintTypeRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', icon: '' });

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const { data: types = [], isLoading } = useQuery({
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
      })) as MaintTypeRow[];
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => types.filter((t) => t.category === tab), [types, tab]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) router.replace('/dashboard');
  }, [authLoading, isAdmin, router]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const category = editing?.category ?? tab;
      const payload = {
        category,
        name: form.name.trim(),
        icon: form.icon.trim() || undefined,
      };
      if (editing) {
        return api.put(`/vehicle-maintenance/types/${editing.id}`, payload);
      }
      return api.post('/vehicle-maintenance/types', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle-maintenance-types-all'] });
      toast.success(editing ? 'Type updated' : 'Type created');
      setModalOpen(false);
      setEditing(null);
      setForm({ name: '', icon: '' });
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
    mutationFn: (id: string) => api.delete(`/vehicle-maintenance/types/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle-maintenance-types-all'] });
      toast.success('Type deleted');
      setDeleteId(null);
    },
    onError: () => toast.error('Failed to delete'),
  });

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm({ name: '', icon: '' });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((row: MaintTypeRow) => {
    setEditing(row);
    setForm({ name: row.name === '—' ? '' : row.name, icon: row.icon ?? '' });
    setTab(row.category);
    setModalOpen(true);
  }, []);

  if (authLoading || !isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-7 h-7 text-[#1565C0]" />
            <h1 className="font-['Oswald'] text-2xl font-bold text-[#0D2847] tracking-wide uppercase">Maintenance types</h1>
          </div>
          <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-1 max-w-2xl">
            Define service types for truck and reefer maintenance. Used on the maintenance book and reminders.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847]"
        >
          <Plus className="w-4 h-4" /> Add type
        </button>
      </div>

      <div className="flex gap-1 bg-white rounded-xl border border-[#E0E8F0] p-1 w-fit shadow-sm">
        {(['TRUCK', 'REEFER'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setTab(c)}
            className={`px-4 py-2 rounded-lg text-sm font-['Barlow_Condensed'] font-semibold uppercase tracking-wider transition-colors ${
              tab === c ? 'bg-[#1565C0] text-white' : 'text-[#1A4A7A] hover:bg-[#F4F6F8]'
            }`}
          >
            {c === 'TRUCK' ? '🚛 Truck' : '❄️ Reefer'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-[#7A9AB8] font-['Rajdhani']">No types for this category yet.</div>
        ) : (
          <ul className="divide-y divide-[#E0E8F0]">
            {filtered.map((row) => (
              <li key={row.id} className="flex items-center justify-between px-5 py-4 hover:bg-[#F4F6F8]/50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0" aria-hidden>
                    {row.icon || '🔧'}
                  </span>
                  <span className="font-['Rajdhani'] font-medium text-[#0D2847] truncate">{safe(row.name)}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="p-2 text-[#1565C0] hover:bg-[#1565C0]/10 rounded-lg"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(row.id)}
                    className="p-2 text-[#DC2626] hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setForm({ name: '', icon: '' });
        }}
        title={editing ? 'Edit type' : 'Add type'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#7A9AB8] font-['Rajdhani']">
            Category:{' '}
            <strong className="text-[#0D2847]">
              {(editing?.category ?? tab) === 'TRUCK' ? '🚛 Truck' : '❄️ Reefer'}
            </strong>
            {!editing && ' — switch tab above before saving if needed'}
          </p>
          <div>
            <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Name *</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Regular Servicing"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-['Barlow_Condensed'] font-semibold uppercase text-[#1A4A7A] mb-1">Icon (emoji or text)</label>
            <input
              className={inputClass}
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="🔧"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                setEditing(null);
                setForm({ name: '', icon: '' });
              }}
              className="flex-1 py-2.5 text-sm font-medium text-[#1A4A7A] border border-[#E0E8F0] rounded-lg hover:bg-[#F4F6F8]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending || !form.name.trim()}
              onClick={() => saveMutation.mutate()}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#1565C0] hover:bg-[#0D2847] disabled:opacity-50 rounded-lg font-['Barlow_Condensed'] uppercase tracking-wider"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
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
        title="Delete this maintenance type?"
        message="Existing records may still reference it depending on backend rules."
      />
    </div>
  );
}
