export type DocAlertRow = {
  id: string;
  severity: string;
  entityType: string;
  entityLabel: string;
  documentType: string;
  documentNo: string;
  expiryDate: string | null;
  daysRemaining: number | null;
  acknowledged: boolean;
};

function readNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function extractAlertsList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return [];
  const o = body as Record<string, unknown>;
  const inner = (o.data ?? o) as Record<string, unknown>;
  if (Array.isArray(inner.data)) return inner.data;
  if (Array.isArray(inner.alerts)) return inner.alerts;
  if (Array.isArray(o.alerts)) return o.alerts;
  return [];
}

export function normalizeAlertRow(raw: unknown): DocAlertRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : '';
  if (!id) return null;
  const entityType = String(r.entityType ?? r.entity_type ?? r.type ?? 'VEHICLE').toUpperCase();
  const entityLabel =
    String(
      r.entityLabel ??
        r.entity_name ??
        r.regNumber ??
        r.reg_number ??
        r.vehicleRegNumber ??
        r.driverName ??
        r.driver_name ??
        r.name ??
        '—',
    ) || '—';
  const documentType = String(r.documentType ?? r.document_type ?? r.docType ?? '—').toUpperCase();
  const documentNo = String(r.documentNo ?? r.document_no ?? r.documentNumber ?? '');
  const expiryRaw = r.expiryDate ?? r.expiry_date ?? r.expiresAt;
  const expiryDate = expiryRaw != null ? String(expiryRaw) : null;
  const daysRemaining =
    r.daysRemaining != null
      ? readNum(r.daysRemaining)
      : r.days_remaining != null
        ? readNum(r.days_remaining)
        : null;
  const acknowledged = Boolean(r.acknowledged ?? r.isAcknowledged);
  const severity = String(r.severity ?? 'INFO').toUpperCase();
  return {
    id,
    severity,
    entityType,
    entityLabel,
    documentType,
    documentNo,
    expiryDate,
    daysRemaining,
    acknowledged,
  };
}

const SEVERITY_ORDER: Record<string, number> = {
  EXPIRED: 0,
  CRITICAL: 1,
  URGENT: 2,
  WARNING: 3,
  INFO: 4,
};

export function sortAlertsByUrgency(rows: DocAlertRow[]): DocAlertRow[] {
  return [...rows].sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 99;
    const sb = SEVERITY_ORDER[b.severity] ?? 99;
    if (sa !== sb) return sa - sb;
    const da = a.daysRemaining ?? 9999;
    const db = b.daysRemaining ?? 9999;
    return da - db;
  });
}
