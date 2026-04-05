import { formatDate, formatDateDdMmYyyy } from '@/lib/utils';
import { formatEmissionShort, formatOwnerSerialDisplay } from '@/lib/vehicleDisplay';

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
};

const PATCH_NEVER = new Set(['fatherName']);

/** When RC sends a value, treat as refreshed from government (blue UPD + patch). */
const FORCE_UPDATE_KEYS = new Set([
  'fuelType',
  'rcStatus',
  'insurancePolicyNumber',
  'insuranceCompany',
  'pucNumber',
  'blacklistStatus',
  'nocDetails',
  'nonUseStatus',
]);

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

function pickBoolString(src: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = src[k];
    if (v === true || v === 'true' || v === 'Y' || v === 'Yes' || v === 'yes') return 'true';
    if (v === false || v === 'false' || v === 'N' || v === 'No' || v === 'no') return 'false';
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

/** Flatten SurePass / backend shapes into canonical keys (string | null). */
export function extractRcDataFromResponse(raw: unknown): Record<string, string | null> {
  const flat = mergeNestedRc(unwrapApiPayload(raw));

  const yearRaw =
    pickString(flat, ['manufacturingYear', 'manufacturing_year', 'year', 'regYear', 'vehicleYear', 'modelYear']) ||
    (flat.year != null && (typeof flat.year === 'number' || typeof flat.year === 'string') ? String(flat.year) : '');

  return {
    regNumber: pickString(flat, ['regNumber', 'registrationNumber', 'vehicleNumber', 'rc_regn_no', 'reg_no']) || null,
    ownerName: pickString(flat, ['ownerName', 'registeredOwner', 'owner', 'owner_name']) || null,
    fatherName: pickString(flat, ['fatherName', 'father_name', 'fathersName', 'father']) || null,
    ownerAddress: pickString(flat, ['ownerAddress', 'address', 'owner_address', 'registeredAddress', 'permanentAddress']) || null,
    ownerNumber: pickString(flat, ['ownerSerial', 'ownerSerialNumber', 'owner_number', 'ownerNo', 'ownerSequence']) || null,
    make: pickString(flat, ['make', 'maker', 'vehicleMake', 'manufacturer']) || null,
    model: pickString(flat, ['model', 'vehicleModel']) || null,
    variant: pickString(flat, ['variant', 'vehicleVariant', 'modelVariant']) || null,
    vehicleClass: pickString(flat, ['vehicleClass', 'class', 'vehicle_class', 'rcVehicleClass', 'vehicleCatgory']) || null,
    vehicleClassDesc: pickString(flat, ['vehicleClassDesc', 'classDescription', 'vehicle_class_desc', 'vehicleClassDescription']) || null,
    vehicleCategory: pickString(flat, ['vehicleCategory', 'category', 'rcCategory', 'vehicleCat']) || null,
    fuelType: pickString(flat, ['fuelType', 'fuel', 'fuel_type', 'fuelTypeDesc']) || null,
    color: pickString(flat, ['color', 'colour']) || null,
    bodyType: pickString(flat, ['bodyType', 'body_type', 'vehicleBodyType']) || null,
    emissionNorms: pickString(flat, ['emissionNorms', 'norms', 'emission_norms', 'standards', 'emissionStandard']) || null,
    engineNumber: pickString(flat, ['engineNumber', 'engineNo', 'engine_no']) || null,
    chassisNumber: pickString(flat, ['chassisNumber', 'chassisNo', 'chassis_no']) || null,
    cubicCapacity: pickString(flat, ['cubicCapacity', 'engineDisplacement', 'vehicleCC', 'cc', 'engineCC']) || null,
    numCylinders: pickString(flat, ['numCylinders', 'cylinders', 'noOfCylinders', 'no_of_cylinder']) || null,
    seatingCapacity: pickString(flat, ['seatingCapacity', 'seats', 'seatCap', 'noOfSeats']) || null,
    /** Prisma: wheelbase (mm) — API may send wheelbaseMm */
    wheelbase: pickString(flat, ['wheelbase', 'wheelbaseMm', 'wheel_base']) || null,
    grossVehicleWeight: pickString(flat, ['grossVehicleWeight', 'grossVehicleWeightKg', 'gvw', 'gross_weight']) || null,
    unladenWeight: pickString(flat, ['unladenWeight', 'unladenWeightKg', 'ulw', 'unladen_weight']) || null,
    loadCapacityKg: pickString(flat, ['loadCapacityKg', 'payload', 'load_capacity']) || null,
    year: yearRaw || null,
    rcNumber: pickString(flat, ['rcNumber', 'rc_number', 'rcNo']) || null,
    registrationDate: pickDate(flat, ['registrationDate', 'regDate', 'dateOfRegistration', 'regn_dt']),
    registeredAt: pickString(flat, ['registeredAt', 'rto', 'registeredRTO', 'registrationLocation', 'regn_at', 'rtoName']) || null,
    rcStatus: pickString(flat, ['rcStatus', 'status', 'rc_status', 'rcStatusDesc', 'vehicleStatus']) || null,
    isFinanced: pickBoolString(flat, ['isFinanced', 'financed', 'finance', 'hypothecated']),
    financerName: pickString(flat, ['financerName', 'financer', 'financingBank', 'hpaBank', 'hypothecation']) || null,
    insuranceCompany: pickString(flat, ['insuranceCompany', 'insurerName', 'insurance_company']) || null,
    insurancePolicyNumber: pickString(flat, ['insurancePolicyNumber', 'policyNumber', 'insurance_policy_no']) || null,
    insuranceExpiryDate: pickDate(flat, ['insuranceExpiryDate', 'insuranceUpto', 'insurance_valid_upto', 'insuranceUptoDate']),
    fitnessExpiryDate: pickDate(flat, ['fitnessExpiryDate', 'fitnessUpto', 'fit_up_to', 'fitness_valid_upto']),
    pucExpiryDate: pickDate(flat, ['pucExpiryDate', 'puccUpto', 'pucc_upto', 'pollution_cert_valid_upto']),
    pucNumber: pickString(flat, ['pucNumber', 'puccNumber', 'puc_no']) || null,
    taxExpiryDate: pickDate(flat, ['taxExpiryDate', 'taxPaidUpto', 'tax_upto', 'roadTaxValidUpto']),
    permitExpiryDate: pickDate(flat, ['permitExpiryDate', 'permitValidUpto', 'permit_upto']),
    blacklistStatus: pickString(flat, ['blacklistStatus', 'blacklist', 'blackListStatus']) || null,
    nocDetails: pickString(flat, ['nocDetails', 'noc', 'noc_details']) || null,
    nonUseStatus: pickString(flat, ['nonUseStatus', 'non_use_status', 'nonUse']) || null,
  };
}

function isEmptyCurrent(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') return val.trim() === '';
  if (typeof val === 'number') return false;
  if (typeof val === 'boolean') return false;
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

function fmtDateVal(key: string, val: string | null): string {
  if (!val) return '—';
  if (key.endsWith('ExpiryDate')) return formatDate(val);
  if (key === 'registrationDate') return formatDateDdMmYyyy(val);
  return val;
}

function pushFillRow(
  rows: RcPreviewRow[],
  patch: Record<string, unknown>,
  key: string,
  label: string,
  current: Record<string, unknown>,
  inc: string | null,
  displayTransform?: (s: string) => string
): void {
  if (!inc) return;
  const shown = displayTransform ? displayTransform(inc) : inc;
  const cur = current[key];
  if (PATCH_NEVER.has(key)) {
    rows.push({
      key,
      label,
      badge: isEmptyCurrent(cur) ? 'NEW' : 'KEPT',
      value: fmtDateVal(key, shown),
      rcHint: !isEmptyCurrent(cur) && String(cur) !== inc ? inc : undefined,
    });
    return;
  }
  if (FORCE_UPDATE_KEYS.has(key)) {
    rows.push({
      key,
      label,
      badge: 'UPD',
      value: fmtDateVal(key, shown),
      rcHint: !isEmptyCurrent(cur) && String(cur) !== inc ? String(cur) : undefined,
    });
    patch[key] = key === 'fuelType' ? coerceFuelType(inc) : inc;
    return;
  }
  const empty = isEmptyCurrent(cur);
  if (empty) {
    rows.push({ key, label, badge: 'NEW', value: fmtDateVal(key, shown) });
    patch[key] = key === 'fuelType' ? coerceFuelType(inc) : key === 'year' ? (parseInt(inc, 10) || inc) : inc;
  } else {
    rows.push({
      key,
      label,
      badge: 'KEPT',
      value: fmtDateVal(key, String(cur)),
      rcHint: inc !== String(cur) ? fmtDateVal(key, shown) : undefined,
    });
  }
}

function pushForceUpdRow(
  rows: RcPreviewRow[],
  patch: Record<string, unknown>,
  key: string,
  label: string,
  current: Record<string, unknown>,
  displayValue: string,
  patchValue: unknown
): void {
  if (!displayValue || displayValue === '—') return;
  const cur = current[key];
  rows.push({
    key,
    label,
    badge: 'UPD',
    value: displayValue,
    rcHint: !isEmptyCurrent(cur) && String(cur) !== String(patchValue ?? '') ? String(cur) : undefined,
  });
  patch[key] = patchValue;
}

const EXPIRY_DOC: { key: string; label: string }[] = [
  { key: 'insuranceExpiryDate', label: 'Insurance expiry' },
  { key: 'fitnessExpiryDate', label: 'Fitness' },
  { key: 'pucExpiryDate', label: 'PUC expiry' },
  { key: 'taxExpiryDate', label: 'Tax' },
  { key: 'permitExpiryDate', label: 'Permit' },
];

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
  pushFillRow(ownerRows, applyPatch, 'ownerName', 'Owner name', current, fetched.ownerName);
  if (fetched.fatherName) {
    pushFillRow(ownerRows, applyPatch, 'fatherName', 'Father name', current, fetched.fatherName);
  }
  pushFillRow(ownerRows, applyPatch, 'ownerAddress', 'Address', current, fetched.ownerAddress);
  if (fetched.ownerNumber) {
    const ord = formatOwnerSerialDisplay(fetched.ownerNumber) ?? fetched.ownerNumber;
    const curOrd = formatOwnerSerialDisplay(current.ownerNumber) ?? (current.ownerNumber != null ? String(current.ownerNumber) : '');
    const empty = isEmptyCurrent(current.ownerNumber);
    if (empty) {
      ownerRows.push({ key: 'ownerNumber', label: 'Owner number', badge: 'NEW', value: ord });
      const on = parseInt(fetched.ownerNumber.replace(/\D/g, ''), 10);
      applyPatch.ownerNumber = Number.isNaN(on) ? fetched.ownerNumber : on;
    } else {
      ownerRows.push({
        key: 'ownerNumber',
        label: 'Owner number',
        badge: 'KEPT',
        value: curOrd || String(current.ownerNumber),
        rcHint: ord !== curOrd ? ord : undefined,
      });
    }
  }
  if (ownerRows.length) sections.push({ id: 'owner', title: 'Owner', rows: ownerRows });

  const vehicleRows: RcPreviewRow[] = [];
  pushFillRow(vehicleRows, applyPatch, 'make', 'Make', current, fetched.make);
  pushFillRow(vehicleRows, applyPatch, 'model', 'Model', current, fetched.model);
  pushFillRow(vehicleRows, applyPatch, 'variant', 'Variant', current, fetched.variant);
  pushFillRow(vehicleRows, applyPatch, 'fuelType', 'Fuel type', current, fetched.fuelType);
  pushFillRow(vehicleRows, applyPatch, 'color', 'Color', current, fetched.color);
  pushFillRow(vehicleRows, applyPatch, 'bodyType', 'Body type', current, fetched.bodyType);
  if (fetched.emissionNorms) {
    pushFillRow(vehicleRows, applyPatch, 'emissionNorms', 'Emission', current, fetched.emissionNorms, formatEmissionShort);
  }
  if (vehicleRows.length) sections.push({ id: 'vehicle', title: 'Vehicle', rows: vehicleRows });

  const specRows: RcPreviewRow[] = [];
  pushFillRow(specRows, applyPatch, 'engineNumber', 'Engine', current, fetched.engineNumber);
  pushFillRow(specRows, applyPatch, 'chassisNumber', 'Chassis', current, fetched.chassisNumber);
  if (fetched.cubicCapacity) {
    pushFillRow(specRows, applyPatch, 'cubicCapacity', 'CC', current, fetched.cubicCapacity, (s) => `${s} cc`);
  }
  pushFillRow(specRows, applyPatch, 'numCylinders', 'Cylinders', current, fetched.numCylinders);
  pushFillRow(specRows, applyPatch, 'seatingCapacity', 'Seats', current, fetched.seatingCapacity);
  if (fetched.wheelbase) {
    pushFillRow(specRows, applyPatch, 'wheelbase', 'Wheelbase', current, fetched.wheelbase, (s) => `${s} mm`);
  }
  if (fetched.grossVehicleWeight) {
    pushFillRow(specRows, applyPatch, 'grossVehicleWeight', 'GVW', current, fetched.grossVehicleWeight, (s) => `${s} kg`);
  }
  if (fetched.unladenWeight) {
    pushFillRow(specRows, applyPatch, 'unladenWeight', 'Unladen', current, fetched.unladenWeight, (s) => `${s} kg`);
  }
  if (fetched.loadCapacityKg) {
    pushFillRow(specRows, applyPatch, 'loadCapacityKg', 'Load capacity', current, fetched.loadCapacityKg, (s) => `${s} kg`);
  }
  pushFillRow(specRows, applyPatch, 'year', 'Year', current, fetched.year);
  if (specRows.length) sections.push({ id: 'specs', title: 'Specs', rows: specRows });

  const regRows: RcPreviewRow[] = [];
  pushFillRow(regRows, applyPatch, 'rcNumber', 'RC number', current, fetched.rcNumber);
  if (fetched.rcStatus) {
    pushForceUpdRow(regRows, applyPatch, 'rcStatus', 'RC status', current, `${fetched.rcStatus} ●`, fetched.rcStatus);
  }
  pushFillRow(regRows, applyPatch, 'registrationDate', 'Reg. date', current, fetched.registrationDate);
  pushFillRow(regRows, applyPatch, 'registeredAt', 'Registered at', current, fetched.registeredAt);
  pushFillRow(regRows, applyPatch, 'vehicleCategory', 'Category', current, fetched.vehicleCategory);
  if (fetched.vehicleClassDesc) {
    pushFillRow(regRows, applyPatch, 'vehicleClassDesc', 'Class', current, fetched.vehicleClassDesc);
  } else if (fetched.vehicleClass) {
    pushFillRow(regRows, applyPatch, 'vehicleClass', 'Class', current, fetched.vehicleClass);
  }
  if (regRows.length) sections.push({ id: 'registration', title: 'Registration', rows: regRows });

  const finRows: RcPreviewRow[] = [];
  if (fetched.financerName) {
    pushFillRow(finRows, applyPatch, 'financerName', 'Financer', current, fetched.financerName);
  }
  if (fetched.isFinanced) {
    const inc = fetched.isFinanced;
    const label = 'Financed';
    const display = inc === 'true' ? 'Yes' : inc === 'false' ? 'No' : inc;
    const cur = current.isFinanced;
    const empty = isEmptyCurrent(cur);
    if (empty) {
      finRows.push({ key: 'isFinanced', label, badge: 'NEW', value: display });
      applyPatch.isFinanced = inc === 'true';
    } else {
      finRows.push({
        key: 'isFinanced',
        label,
        badge: 'KEPT',
        value: cur === true ? 'Yes' : cur === false ? 'No' : String(cur),
        rcHint: display,
      });
    }
  }
  if (finRows.length) sections.push({ id: 'finance', title: 'Finance', rows: finRows });

  const docRows: RcPreviewRow[] = [];
  if (fetched.insuranceCompany || fetched.insuranceExpiryDate) {
    const parts = [fetched.insuranceCompany, fetched.insuranceExpiryDate ? formatDate(fetched.insuranceExpiryDate) : ''].filter(Boolean);
    if (parts.length) {
      docRows.push({
        key: 'insuranceLine',
        label: 'Insurance',
        badge: 'UPD',
        value: parts.join('  '),
        expiryVisual: fetched.insuranceExpiryDate ? expiryVisual(fetched.insuranceExpiryDate) : undefined,
      });
      if (fetched.insuranceExpiryDate) applyPatch.insuranceExpiryDate = fetched.insuranceExpiryDate;
      if (fetched.insuranceCompany) applyPatch.insuranceCompany = fetched.insuranceCompany;
    }
  }
  if (fetched.insurancePolicyNumber) {
    pushForceUpdRow(
      docRows,
      applyPatch,
      'insurancePolicyNumber',
      'Policy no.',
      current,
      fetched.insurancePolicyNumber,
      fetched.insurancePolicyNumber
    );
  }
  if (fetched.fitnessExpiryDate) {
    docRows.push({
      key: 'fitnessExpiryDate',
      label: 'Fitness',
      badge: 'UPD',
      value: formatDate(fetched.fitnessExpiryDate),
      expiryVisual: expiryVisual(fetched.fitnessExpiryDate),
    });
    applyPatch.fitnessExpiryDate = fetched.fitnessExpiryDate;
  }
  if (fetched.pucNumber || fetched.pucExpiryDate) {
    const pucParts = [fetched.pucNumber, fetched.pucExpiryDate ? formatDate(fetched.pucExpiryDate) : ''].filter(Boolean);
    docRows.push({
      key: 'pucLine',
      label: 'PUC',
      badge: 'UPD',
      value: pucParts.length ? pucParts.join('  ') : '—',
      expiryVisual: fetched.pucExpiryDate ? expiryVisual(fetched.pucExpiryDate) : undefined,
    });
    if (fetched.pucNumber) applyPatch.pucNumber = fetched.pucNumber;
    if (fetched.pucExpiryDate) applyPatch.pucExpiryDate = fetched.pucExpiryDate;
  }
  for (const { key, label } of EXPIRY_DOC) {
    if (key === 'insuranceExpiryDate' || key === 'fitnessExpiryDate' || key === 'pucExpiryDate') continue;
    const inc = fetched[key];
    if (!inc) continue;
    docRows.push({
      key,
      label,
      badge: 'UPD',
      value: formatDate(inc),
      expiryVisual: expiryVisual(inc),
    });
    applyPatch[key] = inc;
  }
  if (docRows.length) sections.push({ id: 'documents', title: 'Documents (always updated)', rows: docRows });

  const compRows: RcPreviewRow[] = [];
  const compAny =
    (fetched.blacklistStatus && fetched.blacklistStatus.trim() !== '') ||
    (fetched.nocDetails && fetched.nocDetails.trim() !== '') ||
    (fetched.nonUseStatus && fetched.nonUseStatus.trim() !== '');
  if (compAny) {
    const blVal = fetched.blacklistStatus?.trim()
      ? fetched.blacklistStatus
      : 'Not blacklisted ✅';
    pushForceUpdRow(compRows, applyPatch, 'blacklistStatus', 'Blacklist', current, blVal, fetched.blacklistStatus?.trim() || '');
    if (fetched.nocDetails) {
      pushForceUpdRow(compRows, applyPatch, 'nocDetails', 'NOC', current, fetched.nocDetails, fetched.nocDetails);
    }
    if (fetched.nonUseStatus) {
      pushForceUpdRow(compRows, applyPatch, 'nonUseStatus', 'Non-use', current, fetched.nonUseStatus, fetched.nonUseStatus);
    }
    if (compRows.length) sections.push({ id: 'compliance', title: 'Compliance', rows: compRows });
  }

  delete applyPatch.fatherName;

  let updateCount = 0;
  for (const k of Object.keys(applyPatch)) {
    if (PATCH_NEVER.has(k)) continue;
    if (k === 'insuranceLine' || k === 'pucLine') continue;
    updateCount += 1;
  }

  return {
    regDisplay,
    sections,
    applyPatch,
    updateCount,
  };
}

export function coerceVehicleRcPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  delete out.insuranceLine;
  delete out.pucLine;

  if (out.year != null) {
    const n = parseInt(String(out.year), 10);
    if (!Number.isNaN(n)) out.year = n;
    else delete out.year;
  }
  if (typeof out.fuelType === 'string') {
    out.fuelType = coerceFuelType(out.fuelType);
  }
  const intKeys = ['ownerNumber', 'numCylinders', 'seatingCapacity', 'wheelbase', 'cubicCapacity'];
  for (const k of intKeys) {
    if (out[k] != null && out[k] !== '') {
      const n = parseInt(String(out[k]).replace(/\D/g, ''), 10);
      if (!Number.isNaN(n)) out[k] = n;
    }
  }
  const numKeys = ['grossVehicleWeight', 'unladenWeight', 'loadCapacityKg'];
  for (const k of numKeys) {
    if (out[k] != null && out[k] !== '') {
      const n = parseFloat(String(out[k]).replace(/,/g, ''));
      if (!Number.isNaN(n)) out[k] = n;
    }
  }
  if (out.isFinanced !== undefined) {
    out.isFinanced = out.isFinanced === true || out.isFinanced === 'true' || out.isFinanced === 'Yes';
  }
  delete out.regNumber;
  delete out.fatherName;
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
