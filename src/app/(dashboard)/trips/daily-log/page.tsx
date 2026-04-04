'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArrowRight, List, Plus, Trash2, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const COMMON_LOCATIONS = [
  'Palak',
  'Sintree',
  'Mullam Naya',
  'Chakan',
  'Pune',
  'Mumbai',
  'Navi Mumbai',
  'Thane',
  'Bhiwandi',
];

const COMMON_CLIENTS = [
  'Zepto',
  'Swiggy',
  'Blinkit',
  'BigBasket',
  'Amazon',
  'Sintree',
  "D'Lecta",
  'Pluckk',
  'Cogent Foods',
  'Fruit FM',
  'Kisan Konnect',
  'YC Fresh',
  'Smoor',
  'Lab N Life',
  'Suyog Food Products',
  'Anusaya Fresh',
];

const inputClass =
  'rounded-lg border border-[#E0E8F0] text-sm text-[#0D2847] px-2.5 py-1.5 font-["Rajdhani"] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20 w-full min-w-0';

const cardClass =
  'bg-white rounded-xl border border-[#E0E8F0] shadow-sm border-l-4 border-l-[#1565C0] p-4 space-y-3';

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type TripLine = {
  id: string;
  from: string;
  to: string;
  client: string;
  notes: string;
  tripType: string;
};

type DriverBlock = {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleReg: string;
  trips: TripLine[];
};

function emptyTrip(): TripLine {
  return { id: uid(), from: '', to: '', client: '', notes: '', tripType: '' };
}

function emptyDriverBlock(): DriverBlock {
  return {
    id: uid(),
    driverId: '',
    driverName: '',
    vehicleId: '',
    vehicleReg: '',
    trips: [emptyTrip()],
  };
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDrivers(raw: unknown): { id: string; name: string }[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((d: Record<string, unknown>) => ({
      id: String(d.id ?? ''),
      name: String(d.name ?? d.fullName ?? '').trim(),
    }))
    .filter((d) => d.id && d.name);
}

function parseVehicles(raw: unknown): { id: string; label: string; reg: string }[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((v: Record<string, unknown>) => {
      const reg = String(v.regNumber ?? v.registrationNumber ?? '').trim();
      const make = v.make != null ? String(v.make) : '';
      const model = v.model != null ? String(v.model) : '';
      const extra = [make, model].filter(Boolean).join(' ');
      const label = extra ? `${reg} — ${extra}` : reg || String(v.id ?? '');
      return { id: String(v.id ?? ''), label, reg: reg || label };
    })
    .filter((v) => v.id);
}

function driverNameFromRow(r: Record<string, unknown>): string {
  const top = r.driverName;
  if (top != null && String(top).trim() !== '') return String(top);
  const drv = r.driver;
  if (typeof drv === 'object' && drv !== null && 'name' in drv) {
    const n = String((drv as { name?: unknown }).name ?? '').trim();
    if (n) return n;
  }
  if (typeof drv === 'string' && drv.trim()) return drv;
  return 'Driver';
}

function vehicleRegFromRow(r: Record<string, unknown>): string {
  const top = r.vehicleReg;
  if (top != null && String(top).trim() !== '') return String(top);
  const veh = r.vehicle;
  if (typeof veh === 'object' && veh !== null && 'regNumber' in veh) {
    const reg = String((veh as { regNumber?: unknown }).regNumber ?? '').trim();
    if (reg) return reg;
  }
  if (typeof veh === 'string' && veh.trim()) return veh;
  return '—';
}

/** Normalize various API shapes for daily log list */
function normalizeDailyLogList(data: unknown): DailyLogDay[] {
  const root = data as Record<string, unknown>;
  const body = root?.data !== undefined ? root.data : data;
  const rows = Array.isArray(body) ? body : (body as Record<string, unknown>)?.data;
  if (!Array.isArray(rows)) return [];

  const byDate = new Map<string, DailyLogDriver[]>();

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const dateRaw = r.date ?? r.logDate ?? r.createdAt;
    const date =
      typeof dateRaw === 'string'
        ? dateRaw.slice(0, 10)
        : dateRaw instanceof Date
          ? todayISO()
          : String(dateRaw ?? '').slice(0, 10) || todayISO();
    const driverName = driverNameFromRow(r);
    const vehicleReg = vehicleRegFromRow(r);
    const id = String(r.id ?? `${date}-${driverName}-${vehicleReg}`);
    const tripsRaw = r.trips ?? r.entries ?? r.lines;
    const trips: DailyLogTrip[] = Array.isArray(tripsRaw)
      ? tripsRaw.map((t: Record<string, unknown>) => ({
          from: String(t.from ?? t.fromLocation ?? t.start ?? ''),
          to: String(t.to ?? t.toLocation ?? t.end ?? ''),
          client: String(t.client ?? ''),
          notes: String(t.notes ?? ''),
        }))
      : [];

    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push({ id, driverName, vehicleReg, trips });
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, drivers]) => ({
      date,
      drivers,
    }));
}

type DailyLogTrip = { from: string; to: string; client: string; notes: string };
type DailyLogDriver = { id: string; driverName: string; vehicleReg: string; trips: DailyLogTrip[] };
type DailyLogDay = { date: string; drivers: DailyLogDriver[] };

export default function DailyTripLogPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<'entry' | 'logs'>('entry');
  const [logDate, setLogDate] = useState(todayISO);
  const [blocks, setBlocks] = useState<DriverBlock[]>(() => [emptyDriverBlock()]);
  const [saving, setSaving] = useState(false);

  const [listDate, setListDate] = useState(todayISO);
  const [listDriver, setListDriver] = useState('');
  const [listVehicle, setListVehicle] = useState('');

  const { data: driversRaw, isLoading: driversLoading } = useQuery({
    queryKey: ['daily-log-drivers'],
    queryFn: async () => {
      const res = await api.get('/drivers', { params: { limit: 500, page: 1 } });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const { data: vehiclesRaw, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['daily-log-vehicles'],
    queryFn: async () => {
      const res = await api.get('/vehicles', { params: { limit: 500, page: 1 } });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const drivers = useMemo(() => parseDrivers(driversRaw), [driversRaw]);
  const vehicles = useMemo(() => parseVehicles(vehiclesRaw), [vehiclesRaw]);

  const listQueryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (listDate) p.date = listDate;
    if (listDriver) p.driverId = listDriver;
    if (listVehicle) p.vehicleId = listVehicle;
    return p;
  }, [listDate, listDriver, listVehicle]);

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['trips-daily-log', listQueryParams],
    queryFn: async () => {
      try {
        const res = await api.get('/trips/daily-log', { params: listQueryParams });
        return normalizeDailyLogList(res.data);
      } catch {
        return [] as DailyLogDay[];
      }
    },
    enabled: view === 'logs',
  });

  const filteredDays = useMemo(() => {
    let days = logsData ?? [];
    if (listDriver) {
      const d = drivers.find((x) => x.id === listDriver);
      const name = (d?.name ?? '').toLowerCase();
      if (name) {
        days = days
          .map((day) => ({
            ...day,
            drivers: day.drivers.filter((dr) => dr.driverName.toLowerCase().includes(name)),
          }))
          .filter((day) => day.drivers.length > 0);
      }
    }
    if (listVehicle) {
      const v = vehicles.find((x) => x.id === listVehicle);
      const reg = (v?.reg ?? '').toLowerCase();
      if (reg) {
        days = days
          .map((day) => ({
            ...day,
            drivers: day.drivers.filter((dr) => dr.vehicleReg.toLowerCase().includes(reg)),
          }))
          .filter((day) => day.drivers.length > 0);
      }
    }
    return days;
  }, [logsData, listDriver, listVehicle, drivers, vehicles]);

  const weekMonthStats = useMemo(() => {
    const all = logsData ?? [];
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let weekTrips = 0;
    let monthTrips = 0;
    for (const day of all) {
      const t = new Date(day.date + 'T12:00:00');
      for (const dr of day.drivers) {
        const n = dr.trips.length;
        if (!Number.isNaN(t.getTime())) {
          if (t >= weekAgo) weekTrips += n;
          if (t >= monthStart) monthTrips += n;
        }
      }
    }
    return { weekTrips, monthTrips };
  }, [logsData]);

  const totalTripsEntry = useMemo(() => {
    let t = 0;
    for (const b of blocks) t += b.trips.filter((x) => x.from.trim() || x.to.trim() || x.client.trim()).length;
    return { drivers: blocks.length, trips: t };
  }, [blocks]);

  const applyNotesShortcut = (trip: TripLine, notes: string): TripLine => {
    const next = { ...trip, notes };
    const cold = /cold/i.test(notes);
    if (cold) next.tripType = 'COLD';
    return next;
  };

  const onClientPick = (trip: TripLine, client: string): TripLine => {
    const next = { ...trip, client };
    if (!next.to.trim() && client.trim()) next.to = client.trim();
    return next;
  };

  const updateBlock = (blockId: string, fn: (b: DriverBlock) => DriverBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? fn(b) : b)));
  };

  const removeBlock = (blockId: string) => {
    if (!confirm('Remove this driver block and all its trips?')) return;
    setBlocks((prev) => (prev.length <= 1 ? [emptyDriverBlock()] : prev.filter((b) => b.id !== blockId)));
  };

  const saveAll = async () => {
    const toSave = blocks.filter((b) => {
      const hasDriver = b.driverName.trim() || b.driverId;
      const hasVeh = b.vehicleReg.trim() || b.vehicleId;
      const hasTrips = b.trips.some((t) => t.from.trim() || t.to.trim() || t.client.trim());
      return hasDriver && hasVeh && hasTrips;
    });
    if (toSave.length === 0) {
      toast.error('Add at least one driver with vehicle and one trip');
      return;
    }
    setSaving(true);
    let ok = 0;
    for (let i = 0; i < toSave.length; i++) {
      const b = toSave[i];
      toast.loading(`Saving ${i + 1} of ${toSave.length}…`, { id: 'daily-save' });
      const tripsPayload = b.trips
        .filter((t) => t.from.trim() || t.to.trim() || t.client.trim())
        .map((t) => ({
          fromLocation: t.from.trim(),
          toLocation: t.to.trim(),
          client: t.client.trim(),
          notes: t.notes.trim() || undefined,
          tripType: t.tripType || (t.notes && /cold/i.test(t.notes) ? 'COLD' : undefined),
        }));
      const payload = {
        date: logDate,
        driverId: b.driverId || undefined,
        driverName: b.driverName.trim() || drivers.find((d) => d.id === b.driverId)?.name,
        vehicleId: b.vehicleId || undefined,
        vehicleReg: b.vehicleReg.trim() || vehicles.find((v) => v.id === b.vehicleId)?.reg,
        trips: tripsPayload,
      };
      try {
        await api.post('/trips/daily-log', payload);
        ok++;
      } catch (e: unknown) {
        const ax = e as { response?: { data?: { message?: string } } };
        toast.dismiss('daily-save');
        toast.error(ax.response?.data?.message ?? `Failed saving block ${b.driverName || i + 1}`);
        setSaving(false);
        return;
      }
    }
    toast.dismiss('daily-save');
    toast.success('All trips saved!');
    void qc.invalidateQueries({ queryKey: ['trips-daily-log'] });
    setSaving(false);
  };

  const deleteLog = useCallback(async (id: string) => {
    if (!confirm('Delete this daily log entry?')) return;
    try {
      await api.delete(`/trips/daily-log/${id}`);
      toast.success('Deleted');
      void refetchLogs();
    } catch {
      toast.error('Delete failed (check API)');
    }
  }, [refetchLogs]);

  const driverOptionsForList = useMemo(() => [{ id: '', name: 'All drivers' }, ...drivers], [drivers]);
  const vehicleOptionsForList = useMemo(() => [{ id: '', label: 'All vehicles', reg: '' }, ...vehicles], [vehicles]);

  return (
    <div className="space-y-5 font-['Rajdhani']">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">
            {view === 'entry' ? 'Daily trip log' : 'Daily trip logs'}
          </h2>
          <p className="text-sm text-[#7A9AB8] mt-0.5">
            {view === 'entry' ? 'Log daily trips for all drivers' : 'Review and filter saved daily logs'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {view === 'entry' ? (
            <button
              type="button"
              onClick={() => setView('logs')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8] text-sm font-medium"
            >
              <List className="w-4 h-4" /> View logs
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setView('entry')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1565C0] text-white hover:bg-[#0D2847] text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> New entry
              </button>
            </>
          )}
        </div>
      </div>

      {view === 'entry' ? (
        <>
          <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-4">
            <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-wider text-[#1A4A7A] mb-1">
              Date
            </label>
            <input
              type="date"
              className={`${inputClass} max-w-[200px] h-10`}
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
            />
          </div>

          {(driversLoading || vehiclesLoading) && (
            <div className="py-6">
              <LoadingSpinner text="Loading drivers & vehicles…" />
            </div>
          )}

          <div className="space-y-4">
            {blocks.map((block) => (
              <div key={block.id} className={cardClass}>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase text-[#1A4A7A] mb-1">
                      Driver
                    </label>
                    <select
                      className={`${inputClass} h-10`}
                      value={block.driverId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const name = drivers.find((d) => d.id === id)?.name ?? '';
                        updateBlock(block.id, (b) => ({ ...b, driverId: id, driverName: name || b.driverName }));
                      }}
                    >
                      <option value="">Select or type name →</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className={`${inputClass} mt-2 h-9`}
                      placeholder="Driver name (required if not in list)"
                      value={block.driverName}
                      onChange={(e) => updateBlock(block.id, (b) => ({ ...b, driverName: e.target.value }))}
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase text-[#1A4A7A] mb-1">
                      Vehicle
                    </label>
                    <select
                      className={`${inputClass} h-10`}
                      value={block.vehicleId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const v = vehicles.find((x) => x.id === id);
                        updateBlock(block.id, (b) => ({
                          ...b,
                          vehicleId: id,
                          vehicleReg: v?.reg ?? b.vehicleReg,
                        }));
                      }}
                    >
                      <option value="">Select or type reg →</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className={`${inputClass} mt-2 h-9 font-mono`}
                      placeholder="Registration (e.g. MH46BU1713)"
                      value={block.vehicleReg}
                      onChange={(e) => updateBlock(block.id, (b) => ({ ...b, vehicleReg: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBlock(block.id)}
                    className="h-10 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm inline-flex items-center gap-1 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" /> Remove
                  </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#F0F4F8]">
                  <p className="text-xs font-['Barlow_Condensed'] uppercase tracking-wide text-[#7A9AB8]">Trips</p>
                  {block.trips.map((trip, ti) => (
                    <div
                      key={trip.id}
                      className="flex flex-col lg:flex-row flex-wrap gap-2 items-stretch lg:items-center bg-[#F8FAFC] rounded-lg p-2 border border-[#E8EEF4]"
                    >
                      <input
                        className={`${inputClass} flex-1 min-w-[100px] lg:max-w-[140px]`}
                        placeholder="From"
                        list={`loc-${block.id}`}
                        value={trip.from}
                        onChange={(e) =>
                          updateBlock(block.id, (b) => ({
                            ...b,
                            trips: b.trips.map((t, j) => (j === ti ? { ...t, from: e.target.value } : t)),
                          }))
                        }
                      />
                      <ArrowRight className="w-4 h-4 text-[#7A9AB8] hidden lg:block shrink-0" />
                      <input
                        className={`${inputClass} flex-1 min-w-[100px] lg:max-w-[140px]`}
                        placeholder="To"
                        list={`loc-${block.id}`}
                        value={trip.to}
                        onChange={(e) =>
                          updateBlock(block.id, (b) => ({
                            ...b,
                            trips: b.trips.map((t, j) => (j === ti ? { ...t, to: e.target.value } : t)),
                          }))
                        }
                      />
                      <input
                        className={`${inputClass} flex-1 min-w-[120px] lg:max-w-[180px]`}
                        placeholder="Client"
                        list={`clients-${block.id}`}
                        value={trip.client}
                        onChange={(e) =>
                          updateBlock(block.id, (b) => ({
                            ...b,
                            trips: b.trips.map((t, j) =>
                              j === ti ? onClientPick({ ...t, client: e.target.value }, e.target.value) : t
                            ),
                          }))
                        }
                      />
                      <input
                        className={`${inputClass} flex-1 min-w-[80px] lg:max-w-[120px]`}
                        placeholder="Notes"
                        value={trip.notes}
                        onChange={(e) =>
                          updateBlock(block.id, (b) => ({
                            ...b,
                            trips: b.trips.map((t, j) => (j === ti ? applyNotesShortcut(t, e.target.value) : t)),
                          }))
                        }
                      />
                      {trip.tripType === 'COLD' && (
                        <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-cyan-100 text-cyan-800 shrink-0">
                          Cold
                        </span>
                      )}
                      <button
                        type="button"
                        className="p-2 rounded-lg text-[#7A9AB8] hover:bg-red-50 hover:text-red-600 shrink-0"
                        aria-label="Remove trip"
                        onClick={() =>
                          updateBlock(block.id, (b) => ({
                            ...b,
                            trips: b.trips.length <= 1 ? [emptyTrip()] : b.trips.filter((t) => t.id !== trip.id),
                          }))
                        }
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <datalist id={`loc-${block.id}`}>
                        {COMMON_LOCATIONS.map((l) => (
                          <option key={l} value={l} />
                        ))}
                      </datalist>
                      <datalist id={`clients-${block.id}`}>
                        {COMMON_CLIENTS.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updateBlock(block.id, (b) => ({ ...b, trips: [...b.trips, emptyTrip()] }))
                    }
                    className="text-sm text-[#1565C0] font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add trip
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setBlocks((p) => [...p, emptyDriverBlock()])}
            className="w-full py-3 rounded-xl border-2 border-dashed border-[#B0BEC5] text-[#1A4A7A] font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#F4F6F8]"
          >
            + Add another driver
          </button>

          <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-4 space-y-3">
            <p className="text-sm text-[#0D2847]">
              <span className="font-semibold">Summary:</span> {totalTripsEntry.drivers} driver
              {totalTripsEntry.drivers !== 1 ? 's' : ''}, {totalTripsEntry.trips} trip
              {totalTripsEntry.trips !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveAll()}
              className="w-full h-12 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847] disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save all trips'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase text-[#1A4A7A] mb-1">
                Date
              </label>
              <input
                type="date"
                className={`${inputClass} h-10 w-[160px]`}
                value={listDate}
                onChange={(e) => setListDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase text-[#1A4A7A] mb-1">
                Driver
              </label>
              <select
                className={`${inputClass} h-10 w-44`}
                value={listDriver}
                onChange={(e) => setListDriver(e.target.value)}
              >
                {driverOptionsForList.map((d) => (
                  <option key={d.id || 'all'} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-[10px] font-semibold uppercase text-[#1A4A7A] mb-1">
                Vehicle
              </label>
              <select
                className={`${inputClass} h-10 min-w-[180px]`}
                value={listVehicle}
                onChange={(e) => setListVehicle(e.target.value)}
              >
                {vehicleOptionsForList.map((v) => (
                  <option key={v.id || 'all-v'} value={v.id}>
                    {v.id ? v.label : 'All vehicles'}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void refetchLogs()}
              className="h-10 px-5 rounded-lg bg-[#1565C0] text-white text-sm hover:bg-[#0D2847]"
            >
              Search
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-[#E0E8F0] p-4 shadow-sm">
              <p className="text-xs text-[#7A9AB8] uppercase font-['Barlow_Condensed']">Trips this week</p>
              <p className="text-2xl font-bold text-[#0D2847] font-['Oswald']">{weekMonthStats.weekTrips}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E0E8F0] p-4 shadow-sm">
              <p className="text-xs text-[#7A9AB8] uppercase font-['Barlow_Condensed']">Trips this month</p>
              <p className="text-2xl font-bold text-[#0D2847] font-['Oswald']">{weekMonthStats.monthTrips}</p>
            </div>
          </div>

          {logsLoading ? (
            <LoadingSpinner text="Loading logs…" />
          ) : filteredDays.length === 0 ? (
            <EmptyState message="No daily logs for these filters. API GET /trips/daily-log may need to be enabled." />
          ) : (
            <div className="space-y-4">
              {filteredDays.map((day) => (
                <div key={day.date} className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-[#F4F6F8] border-b border-[#E0E8F0] flex justify-between items-center">
                    <span className="font-['Oswald'] text-lg text-[#0D2847]">
                      {new Date(day.date + 'T12:00:00').toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-sm text-[#7A9AB8]">
                      {day.drivers.length} driver{day.drivers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="divide-y divide-[#E0E8F0]">
                    {day.drivers.map((dr) => (
                        <div key={dr.id} className="px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="text-left flex-1 min-w-0 flex items-start gap-2">
                              <span className="text-lg" aria-hidden>
                                🚛
                              </span>
                              <div>
                                <p className="font-semibold text-[#0D2847]">
                                  {dr.driverName} — <span className="font-mono">{dr.vehicleReg}</span>
                                </p>
                                <p className="text-xs text-[#7A9AB8]">
                                  {dr.trips.length} trip{dr.trips.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void deleteLog(dr.id)}
                              className="text-xs text-red-600 hover:underline shrink-0"
                            >
                              Delete
                            </button>
                          </div>
                          <ul className="mt-2 space-y-1 text-sm text-[#475569] pl-8">
                            {dr.trips.map((t, i) => (
                              <li key={i}>
                                <span className="font-mono text-[#0D2847]">{t.from || '—'}</span>
                                <span className="mx-1">→</span>
                                <span className="font-mono text-[#0D2847]">{t.to || '—'}</span>
                                {t.client ? (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-[#E3F2FD] text-[#1565C0] text-xs">
                                    {t.client}
                                  </span>
                                ) : null}
                                {t.notes ? <span className="ml-2 text-[#7A9AB8]">({t.notes})</span> : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
