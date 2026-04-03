export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null) return '₹0';
  return '₹' + amount.toLocaleString('en-IN');
};

/** Indian number format for invoice amounts: ₹3,07,838 */
export function formatIndianCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  const formatted = Number(amount).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
  return `₹${formatted}`;
}

export const formatNumber = (num: number | null | undefined): string => {
  if (num == null) return '0';
  return num.toLocaleString('en-IN');
};

export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** DD/MM/YYYY for maintenance / service reminders */
export function formatDateDdMmYyyy(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Display as 01-Apr-2025 */
export function formatBpclDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}-${mon}-${d.getFullYear()}`;
}

/** Indian currency with 2 decimals, e.g. ₹1,52,000.00 */
export function formatInrTwoDecimals(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '₹0.00';
  const formatted = Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `₹${formatted}`;
}

export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatTime = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export const cn = (...classes: (string | undefined | false | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

/** Safe string for React children — avoids rendering Date/object as invalid child (#310). */
export function safe(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (val instanceof Date) return val.toLocaleDateString('en-IN');
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return '—';
    }
  }
  return String(val);
}

/** Safe finite number for StatCard / counts (objects → fallback). */
export function safeNumber(val: unknown, fallback = 0): number {
  if (val == null || val === '') return fallback;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export const formatKm = (km: number | null | undefined | unknown): string => {
  const n = safeNumber(km, NaN);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN') + ' km';
};
