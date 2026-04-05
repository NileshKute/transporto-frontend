/** Shared formatters for vehicle detail + RC preview (API uses camelCase). */

export function pickVehicleField(v: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const x = v[k];
    if (x !== null && x !== undefined && String(x).trim() !== '') return x;
  }
  return undefined;
}

export function hasDisplayValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return !Number.isNaN(val);
  const s = String(val).trim();
  return s !== '' && s !== '—';
}

export function formatEmissionShort(s: string): string {
  const u = s.toUpperCase();
  if (u.includes('STAGE VI') || u.includes('BS6') || u.includes('BS-VI') || u.includes('BS VI')) return 'BS-VI';
  if (u.includes('STAGE IV') || u.includes('BS4') || u.includes('BS-IV') || u.includes('BS IV')) return 'BS-IV';
  if (u.includes('STAGE V') || u.includes('BS5') || u.includes('BS-V ')) return 'BS-V';
  if (u.includes('STAGE III')) return 'BS-III';
  return s;
}

/** 1 → "1st Owner", 2 → "2nd Owner", … */
export function formatOwnerSerialDisplay(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number' && !Number.isNaN(v) && v > 0) {
    return ordinalOwner(v);
  }
  const raw = String(v).trim();
  if (!raw) return undefined;
  const n = parseInt(raw.replace(/\D/g, ''), 10);
  if (!Number.isNaN(n) && n > 0) return ordinalOwner(n);
  if (/owner/i.test(raw)) return raw;
  return `${raw} Owner`;
}

function ordinalOwner(n: number): string {
  const suf = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suf} Owner`;
}

export type RcHeaderTone = 'active' | 'inactive' | 'suspended' | 'unknown';

export function parseRcStatusTone(status: string | null | undefined): RcHeaderTone {
  const s = (status || '').toUpperCase();
  if (!s.trim()) return 'unknown';
  if (s.includes('SUSPEND')) return 'suspended';
  if (s.includes('ACTIVE') && !s.includes('INACTIVE')) return 'active';
  if (s.includes('INACTIVE') || s.includes('CANCEL') || s.includes('EXPIRED')) return 'inactive';
  return 'unknown';
}

export function vehicleClassLabel(v: Record<string, unknown>): string | undefined {
  const desc = pickVehicleField(v, ['vehicleClassDesc', 'vehicleClassDescription', 'classDescription']);
  const cat = pickVehicleField(v, ['vehicleCategory', 'vehicleCatgory', 'category']);
  const legacy = pickVehicleField(v, ['vehicleClass', 'class']);
  if (desc && cat) return `${String(desc)} (${String(cat)})`;
  if (desc) return String(desc);
  if (cat) return String(cat);
  if (legacy) return String(legacy);
  return undefined;
}
