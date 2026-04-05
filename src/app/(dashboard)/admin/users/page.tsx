'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/utils';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string | null;
};

const CREATE_ROLES = ['ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'DRIVER'] as const;

function roleBadgeClass(role: string): string {
  const r = role || '';
  if (r === 'SUPER_ADMIN') return 'bg-violet-100 text-violet-800 border-violet-200';
  if (r === 'ADMIN') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (r === 'CEO') return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  if (r === 'MANAGER') return 'bg-cyan-100 text-cyan-800 border-cyan-200';
  if (r === 'ACCOUNTANT') return 'bg-amber-100 text-amber-900 border-amber-200';
  if (r === 'DRIVER') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (r === 'COLD_STORAGE_OPERATOR') return 'bg-sky-100 text-sky-800 border-sky-200';
  if (r === 'VIEWER') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border font-['Barlow_Condensed'] uppercase tracking-wide ${roleBadgeClass(role)}`}
    >
      {role.replace(/_/g, ' ')}
    </span>
  );
}

function parseUsers(res: unknown): UserRow[] {
  if (Array.isArray(res)) return res as UserRow[];
  const o = res as Record<string, unknown>;
  if (Array.isArray(o?.data)) return o.data as UserRow[];
  return [];
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<UserRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<UserRow | null>(null);
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'DRIVER' as string,
    phone: '',
    isActive: true,
  });
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    phone: '',
    isActive: true,
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const r = await api.get('/auth/users');
      return parseUsers(r.data);
    },
    enabled: isAdmin && !authLoading,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) router.replace('/dashboard');
  }, [authLoading, isAdmin, router]);

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/auth/register', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User created');
      setAddOpen(false);
      setAddForm({
        name: '',
        email: '',
        password: '',
        role: 'DRIVER',
        phone: '',
        isActive: true,
      });
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { message?: string } } };
      toast.error(ax.response?.data?.message || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.put(`/auth/users/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User updated');
      setEditRow(null);
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { message?: string } } };
      toast.error(ax.response?.data?.message || 'Failed to update user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User deactivated');
      setDeleteRow(null);
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { message?: string } } };
      toast.error(ax.response?.data?.message || 'Failed to deactivate user');
    },
  });

  const openEdit = useCallback((u: UserRow) => {
    setEditRow(u);
    setEditForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      phone: u.phone ?? '',
      isActive: u.isActive,
    });
  }, []);

  const submitAdd = () => {
    const name = addForm.name.trim();
    const email = addForm.email.trim();
    const password = addForm.password;
    if (!name || !email) {
      toast.error('Name and email are required');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    createMutation.mutate({
      name,
      email,
      password,
      role: addForm.role,
      phone: addForm.phone.trim() || undefined,
      isActive: addForm.isActive,
    });
  };

  const submitEdit = () => {
    if (!editRow) return;
    const name = editForm.name.trim();
    const email = editForm.email.trim();
    if (!name || !email) {
      toast.error('Name and email are required');
      return;
    }
    if (editForm.password.length > 0 && editForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    const body: Record<string, unknown> = {
      name,
      email,
      phone: editForm.phone.trim() || null,
      isActive: editForm.isActive,
    };
    const editingSelf = editRow.id === user?.id;
    if (!editingSelf && editRow.role !== 'SUPER_ADMIN') {
      body.role = editForm.role;
    }
    if (editForm.password.trim()) body.password = editForm.password.trim();
    updateMutation.mutate({ id: editRow.id, body });
  };

  const editRoleOptions = useMemo(() => {
    if (!editRow) return [...CREATE_ROLES];
    if (editRow.role === 'SUPER_ADMIN') return ['SUPER_ADMIN'];
    const extra = [editRow.role].filter((r) => !CREATE_ROLES.includes(r as (typeof CREATE_ROLES)[number]));
    return [...CREATE_ROLES, ...extra];
  }, [editRow]);

  if (authLoading || !isAdmin) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">User Management</h2>
          <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">Create and manage dashboard users</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#1565C0] hover:bg-[#0D2847] text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Created</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E8F0]">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F4F6F8]/80">
                    <td className="px-4 py-3.5 text-sm font-medium text-[#0D2847]">{u.name}</td>
                    <td className="px-4 py-3.5 text-sm text-[#0D2847] font-mono">{u.email}</td>
                    <td className="px-4 py-3.5">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#7A9AB8] font-['Rajdhani']">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="p-2 text-[#1A4A7A] hover:bg-slate-100 rounded-lg"
                          aria-label="Edit user"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteRow(u)}
                          disabled={u.id === user?.id}
                          className="p-2 text-[#1A4A7A] hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:pointer-events-none"
                          aria-label="Deactivate user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add User" size="lg">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1">Name *</label>
              <input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-[#E0E8F0] text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1">Email *</label>
              <input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-[#E0E8F0] text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1">Password * (min 6 characters)</label>
              <input
                type="password"
                value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-[#E0E8F0] text-sm"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1">Role *</label>
              <select
                value={addForm.role}
                onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-[#E0E8F0] text-sm"
              >
                {CREATE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1">Phone</label>
              <input
                value={addForm.phone}
                onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-[#E0E8F0] text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1">Status</label>
              <select
                value={addForm.isActive ? 'active' : 'inactive'}
                onChange={(e) => setAddForm((f) => ({ ...f, isActive: e.target.value === 'active' }))}
                className="w-full h-10 px-3 rounded-lg border border-[#E0E8F0] text-sm max-w-xs"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="flex-1 py-2.5 text-sm border border-[#E0E8F0] rounded-lg hover:bg-[#F4F6F8]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitAdd}
              disabled={createMutation.isPending}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#1565C0] rounded-lg disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!editRow} onClose={() => setEditRow(null)} title="Edit User" size="lg">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1">Name *</label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-[#E0E8F0] text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1">Email *</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-[#E0E8F0] text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1">New password (leave blank to keep)</label>
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-[#E0E8F0] text-sm"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1">Role</label>
              {editRow && (editRow.id === user?.id || editRow.role === 'SUPER_ADMIN') ? (
                <div className="h-10 flex items-center">
                  <RoleBadge role={editRow.role} />
                  <span className="ml-2 text-xs text-[#7A9AB8] font-['Rajdhani']">
                    {editRow.id === user?.id ? '(cannot change your own role)' : ''}
                  </span>
                </div>
              ) : (
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-[#E0E8F0] text-sm"
                >
                  {editRoleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1">Phone</label>
              <input
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-[#E0E8F0] text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#7A9AB8] mb-1">Status</label>
              <select
                value={editForm.isActive ? 'active' : 'inactive'}
                onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.value === 'active' }))}
                className="w-full h-10 px-3 rounded-lg border border-[#E0E8F0] text-sm max-w-xs"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditRow(null)}
              className="flex-1 py-2.5 text-sm border border-[#E0E8F0] rounded-lg hover:bg-[#F4F6F8]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitEdit}
              disabled={updateMutation.isPending}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#1565C0] rounded-lg disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        title="Deactivate user?"
        message={
          deleteRow
            ? `This will set ${deleteRow.name} (${deleteRow.email}) to inactive. They will not be able to sign in.`
            : ''
        }
        onConfirm={() => deleteRow && deleteMutation.mutate(deleteRow.id)}
        loading={deleteMutation.isPending}
        confirmLabel="Deactivate"
      />
    </div>
  );
}
