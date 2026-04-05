'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ChevronDown, MapPin, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export type LocationRecord = {
  id: string;
  name: string;
  shortName?: string | null;
  type: string;
  city?: string | null;
  state?: string | null;
};

const GROUP_ORDER = ['PICKUP', 'CLIENT', 'CITY', 'WAREHOUSE', 'DROP', 'VILLAGE', 'GENERAL'];

function groupTitle(type: string): string {
  const t = type || 'GENERAL';
  if (t === 'PICKUP') return 'Pickup points';
  if (t === 'CLIENT') return 'Clients';
  if (t === 'CITY') return 'Cities';
  if (t === 'WAREHOUSE') return 'Warehouses';
  if (t === 'DROP') return 'Drop points';
  if (t === 'VILLAGE') return 'Villages';
  return 'Other';
}

function formatOption(loc: LocationRecord): string {
  const city = loc.city?.trim();
  return city ? `${loc.name} (${city})` : loc.name;
}

function normalizeApiList(raw: unknown): LocationRecord[] {
  const root = raw as Record<string, unknown>;
  const inner = root?.data !== undefined ? root.data : raw;
  const arr = Array.isArray(inner) ? inner : [];
  return arr
    .map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? '').trim(),
      shortName: row.shortName != null ? String(row.shortName) : null,
      type: String(row.type ?? 'GENERAL'),
      city: row.city != null ? String(row.city) : null,
      state: row.state != null ? String(row.state) : null,
    }))
    .filter((l) => l.id && l.name);
}

const TYPE_OPTIONS = [
  ['GENERAL', 'General'],
  ['PICKUP', 'Pickup'],
  ['CLIENT', 'Client'],
  ['CITY', 'City'],
  ['WAREHOUSE', 'Warehouse'],
  ['DROP', 'Drop'],
] as const;

type LocationSelectProps = {
  value: string;
  onChange: (name: string, picked?: LocationRecord | null) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
};

export function LocationSelect({
  value,
  onChange,
  placeholder = 'Search location…',
  className = '',
  inputClassName = '',
  disabled = false,
}: LocationSelectProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [quickExpanded, setQuickExpanded] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [addType, setAddType] = useState('GENERAL');
  const wrapRef = useRef<HTMLDivElement>(null);

  const resetForms = useCallback(() => {
    setQ('');
    setQuickExpanded(false);
    setManualOpen(false);
    setManualName('');
    setAddType('GENERAL');
  }, []);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations-master'],
    queryFn: async () => {
      const res = await api.get('/locations', { params: { limit: 2000 } });
      return normalizeApiList(res.data);
    },
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return locations;
    return locations.filter((l) => {
      const hay = `${l.name} ${l.shortName ?? ''} ${l.city ?? ''}`.toLowerCase();
      return hay.includes(s);
    });
  }, [locations, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, LocationRecord[]>();
    for (const loc of filtered) {
      const t = loc.type || 'GENERAL';
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(loc);
    }
    const keys = [...map.keys()].sort(
      (a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b) || a.localeCompare(b),
    );
    return keys.map((type) => ({ type, items: map.get(type)! }));
  }, [filtered]);

  const exactMatch = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    return (
      locations.find((l) => l.name.toLowerCase() === s) ??
      locations.find((l) => (l.shortName ?? '').toLowerCase() === s) ??
      null
    );
  }, [locations, q]);

  const canQuickAdd = q.trim().length > 0 && !exactMatch;

  const createLocation = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      try {
        const res = await api.post('/locations', { name: trimmed, type: addType });
        const row = res.data as Record<string, unknown>;
        const created: LocationRecord = {
          id: String(row.id ?? ''),
          name: String(row.name ?? trimmed),
          shortName: row.shortName != null ? String(row.shortName) : null,
          type: String(row.type ?? addType),
          city: row.city != null ? String(row.city) : null,
          state: row.state != null ? String(row.state) : null,
        };
        await qc.invalidateQueries({ queryKey: ['locations-master'] });
        toast.success('Location added');
        onChange(created.name, created);
        setOpen(false);
        resetForms();
      } catch (e: unknown) {
        const ax = e as { response?: { data?: { message?: string } } };
        toast.error(ax.response?.data?.message ?? 'Could not add location');
      }
    },
    [addType, onChange, qc, resetForms],
  );

  const pick = useCallback(
    (loc: LocationRecord) => {
      onChange(loc.name, loc);
      setOpen(false);
      resetForms();
    },
    [onChange, resetForms],
  );

  const displayLabel = value.trim() ? value : placeholder;

  const typeSelect = (
    <select
      value={addType}
      onChange={(e) => setAddType(e.target.value)}
      className="w-full h-9 px-2 rounded-md border border-[#E0E8F0] text-sm"
    >
      {TYPE_OPTIONS.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );

  return (
    <div ref={wrapRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => {
            const next = !o;
            if (next) {
              setQ('');
              setQuickExpanded(false);
              setManualOpen(false);
              setManualName('');
              setAddType('GENERAL');
            }
            return next;
          });
        }}
        className={`flex items-center gap-1 w-full text-left h-9 px-2 rounded-lg border border-[#E0E8F0] text-sm text-[#0D2847] font-['Rajdhani'] bg-white hover:border-[#42A5F5]/50 disabled:opacity-50 ${inputClassName}`}
      >
        <MapPin className="w-3.5 h-3.5 text-[#7A9AB8] shrink-0" />
        <span className={`truncate flex-1 ${value.trim() ? '' : 'text-[#7A9AB8]'}`}>{displayLabel}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-[#7A9AB8] transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-[#E0E8F0] bg-white shadow-lg max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[#E8EEF4]">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to filter…"
              className="w-full h-9 px-2 rounded-md border border-[#E0E8F0] text-sm text-[#0D2847]"
            />
          </div>
          <div className="overflow-y-auto flex-1 text-sm min-h-[120px]">
            {isLoading && <div className="p-3 text-[#7A9AB8] text-xs">Loading locations…</div>}
            {!isLoading &&
              grouped.map(({ type, items }) => (
                <div key={type}>
                  <div className="sticky top-0 bg-[#F4F6F8] px-2 py-1 text-[10px] font-['Barlow_Condensed'] uppercase tracking-wider text-[#1A4A7A]">
                    {groupTitle(type)}
                  </div>
                  {items.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => pick(loc)}
                      className="w-full text-left px-3 py-2 hover:bg-[#E3F2FD] text-[#0D2847] font-['Rajdhani'] border-b border-[#F0F4F8] last:border-0"
                    >
                      {formatOption(loc)}
                    </button>
                  ))}
                </div>
              ))}
            {!isLoading && filtered.length === 0 && !canQuickAdd && (
              <div className="p-3 text-xs text-[#7A9AB8]">No locations match.</div>
            )}
          </div>

          {canQuickAdd && (
            <div className="border-t border-[#E0E8F0] p-2 space-y-2 bg-[#FAFBFC]">
              {!quickExpanded ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuickExpanded(true);
                    setManualOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm text-[#1565C0] font-semibold hover:bg-[#E3F2FD]"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Add &quot;{q.trim()}&quot; as new location
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[#7A9AB8]">New: {q.trim()}</p>
                  {typeSelect}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickExpanded(false)}
                      className="flex-1 py-1.5 text-xs border border-[#E0E8F0] rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void createLocation(q.trim())}
                      className="flex-1 py-1.5 text-xs bg-[#1565C0] text-white rounded-lg font-semibold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-[#E0E8F0] p-2 space-y-2 bg-white">
            {manualOpen ? (
              <div className="space-y-2">
                <input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="New location name"
                  className="w-full h-9 px-2 rounded-md border border-[#E0E8F0] text-sm"
                />
                {typeSelect}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setManualOpen(false);
                      setManualName('');
                    }}
                    className="flex-1 py-1.5 text-xs border border-[#E0E8F0] rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void createLocation(manualName)}
                    className="flex-1 py-1.5 text-xs bg-[#1565C0] text-white rounded-lg font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setManualOpen(true);
                  setQuickExpanded(false);
                  setManualName('');
                }}
                className="w-full text-center text-xs text-[#1565C0] font-semibold py-1 hover:underline"
              >
                + Add new location…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
