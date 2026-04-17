export type Severity = 'EXPIRED' | 'CRITICAL' | 'URGENT' | 'WARNING' | 'INFO';

/** Parse summary response into per-severity unacknowledged counts. */
export function parseSummaryCounts(raw: unknown): Record<Severity, number> {
  const out: Record<Severity, number> = {
    EXPIRED: 0,
    CRITICAL: 0,
    URGENT: 0,
    WARNING: 0,
    INFO: 0,
  };
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  const body = (o.data ?? o) as Record<string, unknown>;
  const nested = (body.counts ?? body.bySeverity ?? body.severity ?? body.unacknowledgedBySeverity) as
    | Record<string, unknown>
    | undefined;
  if (nested && typeof nested === 'object') {
    (Object.keys(out) as Severity[]).forEach((k) => {
      const v = nested[k];
      if (typeof v === 'number') out[k] = v;
      else if (v && typeof v === 'object') {
        const u = (v as Record<string, unknown>).unacknowledged ?? (v as Record<string, unknown>).count;
        if (typeof u === 'number') out[k] = u;
      }
    });
  }
  const readNum = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const flat = (prefix: string) =>
    readNum(body[`${prefix}Unacknowledged`] ?? body[`${prefix.toLowerCase()}Unacknowledged`]);
  if (out.EXPIRED === 0) out.EXPIRED = flat('expired') || readNum(body.expired);
  if (out.CRITICAL === 0) out.CRITICAL = flat('critical') || readNum(body.critical);
  if (out.URGENT === 0) out.URGENT = flat('urgent') || readNum(body.urgent);
  if (out.WARNING === 0) out.WARNING = flat('warning') || readNum(body.warning);
  if (out.INFO === 0) out.INFO = flat('info') || readNum(body.info);
  return out;
}

/** Total unacknowledged for sidebar badge / dashboard. */
export function getUnacknowledgedTotal(raw: unknown): number {
  if (!raw || typeof raw !== 'object') return 0;
  const o = raw as Record<string, unknown>;
  const body = (o.data ?? o) as Record<string, unknown>;
  const direct =
    body.unacknowledgedTotal ??
    body.totalUnacknowledged ??
    body.pendingAcknowledgments ??
    body.unacknowledgedCount;
  if (typeof direct === 'number' && direct >= 0) return direct;
  const sum = Object.values(parseSummaryCounts(raw)).reduce((a, b) => a + b, 0);
  return sum;
}
