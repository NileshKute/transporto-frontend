'use client';

import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import toast from 'react-hot-toast';
import { Settings, Save, RotateCcw } from 'lucide-react';

type MatrixCell = { allowed: boolean; ownOnly: boolean; expiresAt: string | null };

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  CEO: 'CEO',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  DRIVER: 'Driver',
};

const MODULE_LABELS: Record<string, string> = {
  vehicles: 'VEHICLES',
  drivers: 'DRIVERS',
  trips: 'TRIPS',
  fuel: 'FUEL',
  maintenance: 'MAINTENANCE',
  emergencies: 'EMERGENCIES',
  insurance: 'INSURANCE',
  'cold-storage': 'COLD STORAGE',
  shifts: 'SHIFTS',
  whatsapp: 'WHATSAPP',
  clients: 'CLIENTS',
  invoices: 'INVOICES',
  'driver-ledger': 'DRIVER LEDGER',
  salary: 'SALARY',
  users: 'USERS',
  permissions: 'PERMISSIONS',
  dashboard: 'DASHBOARD',
};

const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  pay: 'Pay',
  download: 'Download',
  'mark-paid': 'Mark as Paid',
};

export default function PermissionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, Record<string, MatrixCell>>>>({});
  const [pending, setPending] = useState<
    Map<string, { role: string; module: string; action: string; allowed: boolean; ownOnly: boolean }>
  >(new Map());

  const user = getUser();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/permissions/matrix');
      setRoles(res.data.roles ?? []);
      setMatrix(res.data.matrix ?? {});
      setPending(new Map());
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/dashboard');
      return;
    }
    loadMatrix();
  }, [isAdmin, router, loadMatrix]);

  const modulesOrdered = useMemo(() => Object.keys(matrix).sort(), [matrix]);

  const cellKey = (role: string, module: string, action: string) => `${role}|${module}|${action}`;

  const getCell = (role: string, module: string, action: string): MatrixCell => {
    const k = cellKey(role, module, action);
    const p = pending.get(k);
    if (p) return { allowed: p.allowed, ownOnly: p.ownOnly, expiresAt: null };
    return matrix[module]?.[action]?.[role] ?? { allowed: false, ownOnly: false, expiresAt: null };
  };

  const toggle = (role: string, module: string, action: string) => {
    if (role === 'ADMIN') return;
    const cur = getCell(role, module, action);
    const nextAllowed = !cur.allowed;
    const k = cellKey(role, module, action);
    setPending((prev) => {
      const m = new Map(prev);
      m.set(k, { role, module, action, allowed: nextAllowed, ownOnly: cur.ownOnly });
      return m;
    });
  };

  const toggleOwnOnly = (role: string, module: string, action: string) => {
    if (role !== 'DRIVER') return;
    const cur = getCell(role, module, action);
    const k = cellKey(role, module, action);
    setPending((prev) => {
      const m = new Map(prev);
      m.set(k, {
        role,
        module,
        action,
        allowed: cur.allowed,
        ownOnly: !cur.ownOnly,
      });
      return m;
    });
  };

  const save = async () => {
    if (pending.size === 0) {
      toast('No changes to save');
      return;
    }
    setSaving(true);
    try {
      await api.put('/permissions', { permissions: Array.from(pending.values()) });
      toast.success('Permissions saved');
      await loadMatrix();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm('Reset all permissions to factory defaults?')) return;
    setSaving(true);
    try {
      await api.post('/permissions/reset');
      toast.success('Reset complete');
      await loadMatrix();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#0D2847]">
            <Settings className="w-7 h-7 text-[#1565C0]" />
            <h1 className="font-['Oswald'] text-2xl font-bold uppercase tracking-wide">Permission Manager</h1>
          </div>
          <p className="text-sm text-[#7A9AB8] font-['Rajdhani'] mt-1 max-w-2xl">
            Control which roles can access each module and action. Admin always has full access and cannot be disabled here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || pending.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847] disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Save Permissions
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#F4F6F8] disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" /> Reset to Defaults
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-[#E0E8F0] rounded-xl p-12 text-center text-[#7A9AB8] font-['Rajdhani']">
          Loading matrix…
        </div>
      ) : (
        <div className="bg-white border border-[#E0E8F0] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead className="sticky top-0 z-20 bg-[#0D2847] text-white">
                <tr>
                  <th className="sticky left-0 z-30 bg-[#0D2847] text-left px-3 py-3 font-['Barlow_Condensed'] text-xs uppercase tracking-wider border-r border-[#1A4A7A] min-w-[200px]">
                    Module / Action
                  </th>
                  {roles.map((r) => (
                    <th
                      key={r}
                      className={`px-2 py-3 font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-center min-w-[88px] ${
                        r === 'ADMIN' ? 'bg-[#1A4A7A]/80 text-[#B0BEC5]' : ''
                      }`}
                    >
                      {ROLE_LABELS[r] || r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modulesOrdered.map((mod) => {
                  const actions = Object.keys(matrix[mod] || {}).sort();
                  return (
                    <Fragment key={mod}>
                      <tr className="bg-[#E8EEF4]">
                        <td
                          colSpan={roles.length + 1}
                          className="sticky left-0 z-10 bg-[#E8EEF4] px-3 py-2 font-['Barlow_Condensed'] font-bold text-xs uppercase tracking-widest text-[#0D2847] border-b border-[#D0DCE8]"
                        >
                          {MODULE_LABELS[mod] || mod}
                        </td>
                      </tr>
                      {actions.map((act, idx) => (
                        <tr
                          key={`${mod}-${act}`}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}
                        >
                          <td className="sticky left-0 z-10 bg-inherit px-4 py-2 pl-6 border-r border-[#E0E8F0] font-['Rajdhani'] text-[#0D2847]">
                            {ACTION_LABELS[act] || act}
                          </td>
                          {roles.map((role) => {
                            const cell = getCell(role, mod, act);
                            const adminCol = role === 'ADMIN';
                            const checked = adminCol ? true : cell.allowed;
                            return (
                              <td key={role} className="text-center py-2 px-1 border-b border-[#EEF2F6]">
                                <div className="flex flex-col items-center gap-0.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={adminCol}
                                    onChange={() => toggle(role, mod, act)}
                                    className="w-4 h-4 rounded border-[#B0BEC5] text-[#1565C0] focus:ring-[#42A5F5] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  />
                                  {role === 'DRIVER' && cell.allowed && (
                                    <button
                                      type="button"
                                      title="Own records only"
                                      onClick={() => toggleOwnOnly(role, mod, act)}
                                      className={`text-[9px] font-['Barlow_Condensed'] uppercase px-1 rounded ${
                                        cell.ownOnly ? 'bg-orange-100 text-orange-800' : 'text-[#B0BEC5]'
                                      }`}
                                    >
                                      {cell.ownOnly ? 'Own' : 'all'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
