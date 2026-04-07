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
    quoteDate: String(r.quoteDate ?? r.quote_date ?? ''),
    validUntil: r.validUntil != null || r.valid_until != null ? String(r.validUntil ?? r.valid_until) : undefined,
    clientId: String(r.clientId ?? r.client_id ?? ''),
    client,
    attnPerson: displayText(r.attnPerson ?? r.attn_person, ''),
    vehicleType: displayText(r.vehicleType ?? r.vehicle_type, ''),
    vehicleTypeOther: displayText(r.vehicleTypeOther ?? r.vehicle_type_other, ''),
    monthlyRate: readNum(r.monthlyRate ?? r.monthly_rate),
    status: displayText(r.status, 'DRAFT'),
    createdAt: r.createdAt != null ? String(r.createdAt) : r.created_at != null ? String(r.created_at) : undefined,
    updatedAt: r.updatedAt != null ? String(r.updatedAt) : r.updated_at != null ? String(r.updated_at) : undefined,
  };
}

export function normalizeQuotationsList(data: unknown): QuotationListItem[] {
  let arr: unknown[] = [];
  if (Array.isArray(data)) arr = data;
  else if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.data)) arr = o.data;
    else if (Array.isArray(o.quotations)) arr = o.quotations;
    else if (Array.isArray(o.items)) arr = o.items;
  }
  return arr.map(normalizeQuotationRow).filter((x): x is QuotationListItem => x != null);
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
