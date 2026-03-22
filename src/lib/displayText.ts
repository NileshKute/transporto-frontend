/**
 * Safe string for JSX — avoids React error #310 (objects as children).
 */
export function displayText(value: unknown, fallback = '—'): string {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o.name === 'string') return o.name;
    if (typeof o.label === 'string') return o.label;
    if (typeof o.value === 'string' || typeof o.value === 'number' || typeof o.value === 'boolean') return String(o.value);
  }
  return fallback;
}

export function toArray<T>(value: unknown): T[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'object') return [value as T];
  return [];
}
