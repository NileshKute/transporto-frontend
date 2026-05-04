import { displayText } from '@/lib/displayText';

export interface QuotationListItem {
  id: string;
  quoteNumber: string;
  quoteDate: string;
  validUntil?: string;
  clientId: string;
  client?: { name: string };
  attnPerson?: string;
  vehicleType: string;
  vehicleTypeOther?: string;
  monthlyRate: number;
  status: string;
  sourceType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function pickQuotationPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return (r.data ?? r.quotation ?? r) as Record<string, unknown>;
}

function readNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Raw value → ISO-like string if it represents a valid date (for `quoteDate` extraction). */
function coalesceQuoteDateValue(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? undefined : v.toISOString();
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t || t === 'null' || t === 'undefined') return undefined;
    return t;
  }
  return undefined;
}

/**
 * Business quotation date from API row (Word / DB). Tries several keys used by imports and Prisma.
 * Returns '' if none parse — UI should fall back to `createdAt`.
 */
export function readQuoteDateFromRecord(r: Record<string, unknown>): string {
  const keys = [
    'quoteDate',
    'quote_date',
    'quotationDate',
    'quotation_date',
    'docQuoteDate',
    'documentQuoteDate',
    'issueDate',
    'issue_date',
  ] as const;
  for (const k of keys) {
    const s = coalesceQuoteDateValue(r[k]);
    if (!s) continue;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return s;
  }
  return '';
}

export function normalizeQuotationRow(raw: unknown): QuotationListItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : '';
  if (!id) return null;
  let client: { name: string } | undefined;
  const c = r.client;
  if (c && typeof c === 'object') {
    const nm = displayText((c as Record<string, unknown>).name, '');
    if (nm && nm !== '—') client = { name: nm };
  }
  return {
    id,
    quoteNumber: displayText(r.quoteNumber ?? r.quote_number ?? r.number, ''),
    quoteDate: readQuoteDateFromRecord(r),
    validUntil: r.validUntil != null || r.valid_until != null ? String(r.validUntil ?? r.valid_until) : undefined,
    clientId: String(r.clientId ?? r.client_id ?? ''),
    client,
    attnPerson: displayText(r.attnPerson ?? r.attn_person, ''),
    vehicleType: displayText(r.vehicleType ?? r.vehicle_type, ''),
    vehicleTypeOther: displayText(r.vehicleTypeOther ?? r.vehicle_type_other, ''),
    monthlyRate: readNum(r.monthlyRate ?? r.monthly_rate),
    status: displayText(r.status, 'DRAFT'),
    sourceType:
      r.sourceType != null || r.source_type != null
        ? displayText(r.sourceType ?? r.source_type, '')
        : undefined,
    createdAt: r.createdAt != null ? String(r.createdAt) : r.created_at != null ? String(r.created_at) : undefined,
    updatedAt: r.updatedAt != null ? String(r.updatedAt) : r.updated_at != null ? String(r.updated_at) : undefined,
  };
}

/** Raw rows from `GET /quotations` (and similar) list payloads. */
export function extractQuotationsArrayFromPayload(data: unknown): Record<string, unknown>[] {
  let arr: unknown[] = [];
  if (Array.isArray(data)) arr = data;
  else if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.data)) arr = o.data;
    else if (Array.isArray(o.quotations)) arr = o.quotations;
    else if (Array.isArray(o.items)) arr = o.items;
  }
  return arr.filter((x): x is Record<string, unknown> => x != null && typeof x === 'object');
}

/** API omitted monthly rate (distinct from normalized numeric 0). */
export function isMonthlyRateMissingRaw(r: Record<string, unknown>): boolean {
  const v = r.monthlyRate ?? r.monthly_rate;
  return v == null || v === '';
}

export function normalizeQuotationsList(data: unknown): QuotationListItem[] {
  return extractQuotationsArrayFromPayload(data).map(normalizeQuotationRow).filter((x): x is QuotationListItem => x != null);
}

export function listMetaTotal(data: unknown, itemsLen: number): number {
  if (!data || typeof data !== 'object') return itemsLen;
  const o = data as Record<string, unknown>;
  const meta = o.meta;
  if (meta && typeof meta === 'object') {
    const t = (meta as Record<string, unknown>).total;
    if (typeof t === 'number') return t;
  }
  const t2 = o.total;
  if (typeof t2 === 'number') return t2;
  return itemsLen;
}

export function readStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => (typeof x === 'string' ? x : displayText(x, ''))).filter(Boolean);
}
