import { formatDate } from '@/lib/utils';

export type RcPreviewBadge = 'NEW' | 'KEPT' | 'UPD';

export type RcExpiryVisual = 'valid' | 'expiring' | 'expired' | 'na';

export type RcPreviewRow = {
  key: string;
  label: string;
  badge: RcPreviewBadge;
  value: string;
  rcHint?: string;
  expiryVisual?: RcExpiryVisual;
};

export type RcPreviewSection = { id: string; title: string; rows: RcPreviewRow[] };

export type RcPreviewResult = {
  regDisplay: string;
  sections: RcPreviewSection[];
  applyPatch: Record<string, unknown>;
  updateCount: number;
  rcStatusLine?: string;
};

const DISPLAY_ONLY_KEYS = new Set(['fatherName', 'vehicleClass']);

function unwrapApiPayload(raw: unknown): Record<string, unknown> {
  if (raw == null || typeof raw !== 'object') return {};
  let cur: unknown = raw;
  for (let i = 0; i < 3; i++) {
    if (cur == null || typeof cur !== 'object' || Array.isArray(cur)) break;
    const o = cur as Record<string, unknown>;
    if (o.data != null && typeof o.data === 'object' && !Array.isArray(o.data)) {
      cur = o.data;
    } else break;
  }
  return (cur != null && typeof cur === 'object' && !Array.isArray(cur) ? cur : {}) as Record<string, unknown>;
}

function mergeNestedRc(src: Record<string, unknown>): Record<string, unknown> {
  const nested = ['rc', 'rcDetails', 'vehicleDetails', 'details', 'result', 'vehicle'];
  let m = { ...src };
  for (const k of nested) {
    const v = src[k];
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      m = { ...m, ...(v as Record<string, unknown>) };
    }
  }
  return m;
}

function pickString(src: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = src[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function normalizeDateToIso(input: unknown): string | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}

function pickDate(src: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const n = normalizeDateToIso(src[k]);
    if (n) return n;
  }
  return null;
}

/** Flatten common SurePass / backend shapes into canonical keys */
export function extractRcDataFromResponse(raw: unknown): Record<string, string | null> {
  const flat = mergeNestedRc(unwrapApiPayload(raw));

  const yearRaw =
    pickString(flat, ['manufacturingYear', 'manufacturing_year', 'year', 'regYear', 'vehicleYear', 'modelYear']) ||
    (flat.year != null && (typeof flat.year === 'number' || typeof flat.year === 'string') ? String(flat.year) : '');

  return {
    regNumber: pickString(flat, ['regNumber', 'registrationNumber', 'vehicleNumber', 'rc_regn_no', 'reg_no']) || null,
    ownerName: pickString(flat, ['ownerName', 'registeredOwner', 'owner', 'owner_name']) || null,
    fatherName: pickString(flat, ['fatherName', 'father_name', 'fathersName', 'father']) || null,
    make: pickString(flat, ['make', 'maker', 'vehicleMake', 'manufacturer']) || null,
    model: pickString(flat, ['model', 'vehicleModel']) || null,
    vehicleClass: pickString(flat, ['vehicleClass', 'class', 'vehicle_class', 'rcVehicleClass', 'vehicleCatgory']) || null,
    fuelType: pickString(flat, ['fuelType', 'fuel', 'fuel_type', 'fuelTypeDesc']) || null,
    color: pickString(flat, ['color', 'colour']) || null,
    engineNumber: pickString(flat, ['engineNumber', 'engineNo', 'engine_no']) || null,
    chassisNumber: pickString(flat, ['chassisNumber', 'chassisNo', 'chassis_no']) || null,
    year: yearRaw || null,
    rcNumber: pickString(flat, ['rcNumber', 'rc_number', 'rcNo']) || null,
    insuranceExpiryDate: pickDate(flat, ['insuranceExpiryDate', 'insuranceUpto', 'insurance_valid_upto', 'insuranceUptoDate']),
    fitnessExpiryDate: pickDate(flat, ['fitnessExpiryDate', 'fitnessUpto', 'fit_up_to', 'fitness_valid_upto']),
    pucExpiryDate: pickDate(flat, ['pucExpiryDate', 'puccUpto', 'pucc_upto', 'pollution_cert_valid_upto']),
    taxExpiryDate: pickDate(flat, ['taxExpiryDate', 'taxPaidUpto', 'tax_upto', 'roadTaxValidUpto']),
    permitExpiryDate: pickDate(flat, ['permitExpiryDate', 'permitValidUpto', 'permit_upto']),
    rcStatus: pickString(flat, ['rcStatus', 'status', 'rc_status', 'rcStatusDesc']) || null,
  };
}

function isEmptyCurrent(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') return val.trim() === '';
  if (typeof val === 'number') return false;
  return false;
}

function expiryVisual(iso: string | null): RcExpiryVisual {
  if (!iso) return 'na';
  const exp = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(exp.getTime())) return 'na';
  const now = new Date();
  const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
}

const EXPIRY_KEYS = [
  { key: 'insuranceExpiryDate', label: 'Insurance' },
  { key: 'fitnessExpiryDate', label: 'Fitness' },
  { key: 'pucExpiryDate', label: 'PUC' },
  { key: 'taxExpiryDate', label: 'Tax' },
  { key: 'permitExpiryDate', label: 'Permit' },
] as const;

const VEHICLE_DETAIL_KEYS = [
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'vehicleClass', label: 'Class' },
  { key: 'fuelType', label: 'Fuel' },
  { key: 'color', label: 'Color' },
  { key: 'engineNumber', label: 'Engine No' },
  { key: 'chassisNumber', label: 'Chassis No' },
  { key: 'year', label: 'Year' },
  { key: 'rcNumber', label: 'RC Number' },
] as const;

const OWNER_KEYS = [
  { key: 'ownerName', label: 'Owner Name' },
  { key: 'fatherName', label: 'Father Name' },
] as const;

function formatDisplayValue(key: string, val: string | null): string {
  if (!val) return '—';
  if (key === 'year') return val;
  if (key.endsWith('ExpiryDate')) return formatDate(val);
  return val;
}

function coerceFuelType(raw: string): string {
  const u = raw.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const aliases: Record<string, string> = {
    DIESEL: 'DIESEL',
    PETROL: 'PETROL',
    CNG: 'CNG',
    ELECTRIC: 'ELECTRIC',
    HYBRID: 'HYBRID',
    LPG: 'CNG',
  };
  return aliases[u] ?? u;
}

/** Build preview + PATCH payload: empty fields filled; expiries always refreshed when RC has a date */
export function buildRcPreview(
  current: Record<string, unknown>,
  fetched: Record<string, string | null>
): RcPreviewResult {
  const regDisplay =
    (fetched.regNumber && fetched.regNumber.trim()) ||
    (typeof current.regNumber === 'string' && current.regNumber.trim()) ||
    'Vehicle';

  const applyPatch: Record<string, unknown> = {};
  const sections: RcPreviewSection[] = [];

  const ownerRows: RcPreviewRow[] = [];
  for (const { key, label } of OWNER_KEYS) {
    const inc = fetched[key];
    const cur = current[key];
    if (!inc) continue;
    if (DISPLAY_ONLY_KEYS.has(key)) {
      if (isEmptyCurrent(cur)) {
        ownerRows.push({ key, label, badge: 'NEW', value: formatDisplayValue(key, inc) });
      } else {
        ownerRows.push({
          key,
          label,
          badge: 'KEPT',
          value: formatDisplayValue(key, String(cur)),
          rcHint: inc !== String(cur) ? inc : undefined,
        });
      }
      continue;
    }
    const empty = isEmptyCurrent(cur);
    if (empty) {
      ownerRows.push({ key, label, badge: 'NEW', value: formatDisplayValue(key, inc) });
      applyPatch[key] = inc;
    } else {
      ownerRows.push({
        key,
        label,
        badge: 'KEPT',
        value: formatDisplayValue(key, String(cur)),
        rcHint: inc !== String(cur) ? inc : undefined,
      });
    }
  }
  if (ownerRows.length) sections.push({ id: 'owner', title: 'Owner details', rows: ownerRows });

  const vehicleRows: RcPreviewRow[] = [];
  for (const { key, label } of VEHICLE_DETAIL_KEYS) {
    const inc = fetched[key];
    if (!inc) continue;
    const curV = current[key];
    if (DISPLAY_ONLY_KEYS.has(key)) {
      const emptyV = isEmptyCurrent(curV);
      if (emptyV) {
        vehicleRows.push({ key, label, badge: 'NEW', value: formatDisplayValue(key, inc) });
      } else {
        vehicleRows.push({
          key,
          label,
          badge: 'KEPT',
          value: formatDisplayValue(key, String(curV)),
          rcHint: inc !== String(curV) ? formatDisplayValue(key, inc) : undefined,
        });
      }
      continue;
    }
    const cur = current[key];
    const empty = isEmptyCurrent(cur);
    if (empty) {
      vehicleRows.push({ key, label, badge: 'NEW', value: formatDisplayValue(key, inc) });
      if (key === 'fuelType') applyPatch[key] = coerceFuelType(inc);
      else if (key === 'year') {
        const n = parseInt(inc, 10);
        applyPatch[key] = Number.isNaN(n) ? inc : n;
      } else applyPatch[key] = inc;
    } else {
      vehicleRows.push({
        key,
        label,
        badge: 'KEPT',
        value: formatDisplayValue(key, String(cur)),
        rcHint: inc !== String(cur) ? formatDisplayValue(key, inc) : undefined,
      });
    }
  }
  if (vehicleRows.length) sections.push({ id: 'vehicle', title: 'Vehicle details', rows: vehicleRows });

  const expiryRows: RcPreviewRow[] = [];
  for (const { key, label } of EXPIRY_KEYS) {
    const inc = fetched[key];
    if (!inc) continue;
    const vis = expiryVisual(inc);
    expiryRows.push({
      key,
      label,
      badge: 'UPD',
      value: formatDisplayValue(key, inc),
      expiryVisual: vis,
    });
    applyPatch[key] = inc;
  }
  if (expiryRows.length) sections.push({ id: 'expiry', title: 'Expiry dates (always updated)', rows: expiryRows });

  let updateCount = 0;
  for (const k of Object.keys(applyPatch)) {
    if (DISPLAY_ONLY_KEYS.has(k)) continue;
    updateCount += 1;
  }

  return {
    regDisplay,
    sections,
    applyPatch,
    updateCount,
    rcStatusLine: fetched.rcStatus?.trim() || undefined,
  };
}

export function coerceVehicleRcPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  if (out.year != null) {
    const n = parseInt(String(out.year), 10);
    if (!Number.isNaN(n)) out.year = n;
    else delete out.year;
  }
  if (typeof out.fuelType === 'string') {
    out.fuelType = coerceFuelType(out.fuelType);
  }
  delete out.regNumber;
  delete out.fatherName;
  delete out.vehicleClass;
  return out;
}

export function rcVerificationToastMessage(err: unknown): string {
  const ax = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
  const raw =
    (typeof ax.response?.data?.message === 'string' && ax.response.data.message) ||
    (typeof ax.message === 'string' ? ax.message : '');
  const low = raw.toLowerCase();
  if (
    ax.response?.status === 503 ||
    low.includes('surepass') ||
    low.includes('not configured') ||
    low.includes('api key')
  ) {
    return 'SurePass API not configured. Contact admin.';
  }
  const detail = raw || 'Unknown error';
  return `RC verification failed: ${detail}`;
}
