'use client';

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { clearPermissionCache } from '@/hooks/usePermission';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Settings, Save, RotateCcw } from 'lucide-react';

type Matrix = Record<string, Record<string, Record<string, { allowed: boolean; ownOnly: boolean }>>>;

const MODULE_LABELS: Record<string, string> = {
  vehicles: 'Vehicles',
  drivers: 'Drivers',
  trips: 'Trips',
  fuel: 'Fuel',
  maintenance: 'Maintenance',
  emergencies: 'Emergencies',
  insurance: 'Insurance',
  'cold-storage': 'Cold Storage',
  shifts: 'Shifts',
  whatsapp: 'WhatsApp',
  clients: 'Clients',
  invoices: 'Invoices',
  quotations: 'Quotations',
  'driver-ledger': 'Driver Ledger',
  salary: 'Salary',
  users: 'Users',
  permissions: 'Permissions',
};

const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  pay: 'Pay',
  download: 'Download PDF',
  'mark-paid': 'Mark as Paid',
};

const inputClass =
  'rounded border border-[#E0E8F0] text-[#0D2847] focus:ring-2 focus:ring-[#42A5F5]/30';

export default function PermissionsAdminPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState<Matrix>({});
  const [roles, setRoles] = useState<string[]>([]);
  const [pending, setPending] = useState<
    Map<string, { role: string; module: string; action: string; allowed: boolean; ownOnly: boolean }>
  >(new Map());

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/permissions/matrix');
      setMatrix(res.data.matrix ?? {});
      setRoles(res.data.roles ?? []);
      setPending(new Map());
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load permissions');
      router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      router.replace('/dashboard');
      return;
    }
    load();
  }, [authLoading, isAdmin, load, router]);

  const rows = useMemo(() => {
    const out: { module: string; action: string }[] = [];
    const mods = Object.keys(matrix).sort();
    for (const mod of mods) {
      const acts = Object.keys(matrix[mod] || {}).sort();
      for (const act of acts) {
        out.push({ module: mod, action: act });
      }
    }
    return out;
  }, [matrix]);

  const cellKey = (role: string, module: string, action: string) =>
    `${role}|${module}|${action}`;

  const getCell = (role: string, module: string, action: string) => {
    const k = cellKey(role, module, action);
    if (pending.has(k)) return pending.get(k)!;
    const m = matrix[module]?.[action]?.[role];
    return {
      role,
      module,
      action,
      allowed: m?.allowed ?? false,
      ownOnly: m?.ownOnly ?? false,
    };
  };

  const toggleAllowed = (role: string, module: string, action: string) => {
    if (role === 'ADMIN') return;
    const cur = getCell(role, module, action);
    const next = { ...cur, allowed: !cur.allowed };
    setPending((prev) => {
      const n = new Map(prev);
      n.set(cellKey(role, module, action), next);
      return n;
    });
  };

  const toggleOwnOnly = (role: string, module: string, action: string) => {
    if (role === 'ADMIN') return;
    const cur = getCell(role, module, action);
    const next = { ...cur, ownOnly: !cur.ownOnly };
    setPending((prev) => {
      const n = new Map(prev);
      n.set(cellKey(role, module, action), next);
      return n;
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
      clearPermissionCache();
      toast.success('Permissions saved');
      await load();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm('Reset all permissions to factory defaults?')) return;
    setSaving(true);
    try {
      await api.post('/permissions/reset');
      clearPermissionCache();
      toast.success('Reset to defaults');
      await load();
    } catch {
      toast.error('Failed to reset');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-7 h-7 text-[#1565C0]" />
            <h1 className="font-['Oswald'] text-2xl font-bold text-[#0D2847] tracking-wide">
              PERMISSION MANAGER
            </h1>
          </div>
          <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-1 max-w-2xl">
            Control which roles can access each module and action. Admin always has full access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-white disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" /> Reset defaults
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading || pending.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847] disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Save permissions
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner text="Loading matrix..." />
        </div>
      ) : (
        <div className="bg-white border border-[#E0E8F0] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[calc(100vh-220px)]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-20 bg-[#0D2847] text-white shadow">
                <tr>
                  <th className="sticky left-0 z-30 bg-[#0D2847] text-left px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase tracking-wider min-w-[220px] border-r border-[#1A4A7A]">
                    Module / Action
                  </th>
                  {roles.map((r) => (
                    <th
                      key={r}
                      className="px-2 py-3 font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-center min-w-[100px] border-l border-[#1A4A7A]"
                    >
                      {r.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ module, action }, idx) => {
                  const modLabel = MODULE_LABELS[module] || module;
                  const prev = rows[idx - 1];
                  const showModHeader = !prev || prev.module !== module;
                  return (
                    <Fragment key={`${module}-${action}`}>
                      {showModHeader && (
                        <tr className="bg-[#1A4A7A] text-white">
                          <td
                            colSpan={roles.length + 1}
                            className="sticky left-0 z-10 px-4 py-2 font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-widest bg-[#1A4A7A]"
                          >
                            {modLabel}
                          </td>
                        </tr>
                      )}
                      <tr
                        className={idx % 2 === 0 ? 'bg-[#F8F9FA]' : 'bg-white'}
                      >
                        <td className="sticky left-0 z-10 bg-inherit px-4 py-2 pl-8 border-r border-[#E0E8F0] font-['Rajdhani'] text-[#0D2847] whitespace-nowrap">
                          {ACTION_LABELS[action] || action}
                        </td>
                        {roles.map((role) => {
                          const c = getCell(role, module, action);
                          const adminCol = role === 'ADMIN';
                          return (
                            <td
                              key={role}
                              className="text-center align-middle px-2 py-2 border-l border-[#E0E8F0]"
                            >
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="checkbox"
                                  className={`${inputClass} w-4 h-4 accent-[#1565C0] cursor-pointer`}
                                  checked={c.allowed}
                                  disabled={adminCol}
                                  onChange={() => toggleAllowed(role, module, action)}
                                />
                                {role === 'DRIVER' && c.allowed && (
                                  <button
                                    type="button"
                                    title="Own records only"
                                    onClick={() => toggleOwnOnly(role, module, action)}
                                    className={`text-[10px] font-['Barlow_Condensed'] uppercase px-1.5 py-0.5 rounded ${
                                      c.ownOnly
                                        ? 'bg-[#F59E0B]/20 text-[#B45309]'
                                        : 'text-[#7A9AB8] hover:bg-[#F4F6F8]'
                                    }`}
                                  >
                                    {c.ownOnly ? 'Own' : 'All'}
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
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
