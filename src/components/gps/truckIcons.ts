import L from 'leaflet';

export const TRUCK_ICON_TYPES = [
  'reefer_truck',
  'mini_truck',
  'medium_truck',
  'large_truck',
  'container',
  'van',
  'pickup',
  'tanker',
  'tempo',
  'bike',
  'car_sedan',
  'car_suv',
  'ambulance',
  'bus',
  'auto_rickshaw',
] as const;

export type TruckIconType = (typeof TRUCK_ICON_TYPES)[number];

export const DEFAULT_TRUCK_ICON: TruckIconType = 'reefer_truck';

export const ICON_PICKER_COLORS = [
  { name: 'blue', primary: '#1565C0', dark: '#0D47A1' },
  { name: 'red', primary: '#E53935', dark: '#B71C1C' },
  { name: 'green', primary: '#43A047', dark: '#2E7D32' },
  { name: 'orange', primary: '#FB8C00', dark: '#E65100' },
  { name: 'purple', primary: '#7B1FA2', dark: '#4A148C' },
  { name: 'teal', primary: '#00897B', dark: '#004D40' },
  { name: 'white', primary: '#E0E0E0', dark: '#9E9E9E' },
  { name: 'black', primary: '#424242', dark: '#212121' },
] as const;

export const TRUCK_ICON_LABELS: Record<TruckIconType, string> = {
  reefer_truck: 'Reefer',
  mini_truck: 'Mini truck',
  medium_truck: 'Medium',
  large_truck: 'Heavy',
  container: 'Container',
  van: 'Van',
  pickup: 'Pickup',
  tanker: 'Tanker',
  tempo: 'Tempo',
  bike: 'Bike',
  car_sedan: 'Sedan',
  car_suv: 'SUV',
  ambulance: 'Ambulance',
  bus: 'Bus',
  auto_rickshaw: 'Auto',
};

/** Solid fill per status — map marker body + direction arrow. */
export const STATUS_MARKER_COLORS: Record<string, string> = {
  MOVING: '#16a34a',
  HALTED: '#dc2626',
  LONG_HALT: '#ea580c',
  IDLE: '#ca8a04',
  OFFLINE: '#6b7280',
};

/** Single-path white silhouettes, viewBox 0 0 20 20 — minimal, no strokes. */
export const SIMPLE_TRUCK_PATHS: Record<TruckIconType, string> = {
  reefer_truck: 'M2.5 6.5h5v6.5h-5zm6-1.5h9.5v11h-9.5z',
  mini_truck: 'M3 7h4.5v5.5H3zm5.5 1.5h7.5v7H8.5z',
  medium_truck: 'M2.5 6.5h5v6h-5zm6.5 1h9v8h-9z',
  large_truck: 'M2 6h5v6.5H2zm6 0.5h11.5v9.5H8z',
  container: 'M3 7h4.5v4.5H3zm5.5 1h11.5v7.5H8.5z',
  van: 'M5.5 6.5c0-2 2-2.8 5-2.8s5 0.8 5 2.8v8c0 1.3-1.1 2.2-2.5 2.2H8c-1.4 0-2.5-0.9-2.5-2.2v-8z',
  pickup:
    'M3 6.5h4.5v4.5H3zm6.5 1.5h7.5v4.5h-7.5zm-2 5.5h10v2.5h-10z',
  tanker:
    'M3 6h4v4.5H3zm7.5 3.5a5 2.8 0 1 0 10 0 5 2.8 0 1 0 -10 0z',
  tempo:
    'M9 4.2L13.5 15H6.5L9 4.2z M6.2 16.2a2 2 0 110-4 2 2 0 010 4zm8.2 0a2 2 0 110-4 2 2 0 010 4z',
  bike:
    'M4.8 15.8a2.6 2.6 0 110-5.2 2.6 2.6 0 010 5.2zm8.8 0a2.6 2.6 0 110-5.2 2.6 2.6 0 010 5.2M8 6.5h5.2v7.2H8z',
  car_sedan: 'M4 11.5h12v3.2H4zm1-3l2.2-1.6h7.6l2.2 1.6v3.2H5z',
  car_suv: 'M3.5 10.5h13v4h-13zm1-3.8L7 5h7l2.5 1.7v4H4.5z',
  ambulance:
    'M5.5 5.5c0-1.8 2-2.5 5-2.5s5 0.7 5 2.5v8.5c0 1.2-1 2-2.5 2H8c-1.5 0-2.5-0.8-2.5-2V5.5zM9 9h2v3.5H9zm-1.5-1h5v1.2h-5z',
  bus: 'M6.5 3.5h7v13h-7zm1.8 5.2h3.4v5h-3.4z',
  auto_rickshaw:
    'M10 5.2c2.6 0 4.8 1.7 4.8 4.2V15H5.2v-5.6c0-2.5 2.2-4.2 4.8-4.2z M7.2 16.5a2 2 0 110-4 2 2 0 010 4zm5.6 0a2 2 0 110-4 2 2 0 010 4z',
};

export function formatMapRegLabel(raw: string): string {
  const compact = String(raw).replace(/\s+/g, '').toUpperCase();
  const m = compact.match(/^([A-Z]{2}\d{2})(.+)$/);
  if (m) return `${m[1]} ${m[2]}`;
  return String(raw).trim() || '—';
}

function escapeMarkerLabel(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function normalizeTruckIconType(raw: string | undefined | null): TruckIconType {
  if (!raw) return DEFAULT_TRUCK_ICON;
  const k = String(raw).toLowerCase().replace(/-/g, '_');
  return (TRUCK_ICON_TYPES as readonly string[]).includes(k) ? (k as TruckIconType) : DEFAULT_TRUCK_ICON;
}

function statusToMarkerColor(status: string | undefined): string {
  const s = String(status ?? 'OFFLINE').toUpperCase();
  return STATUS_MARKER_COLORS[s] ?? STATUS_MARKER_COLORS.OFFLINE;
}

/** GPS bearing: 0 = north, clockwise — arrow points up at 0 and rotates with heading. */
export function directionToRotationDegrees(direction: number | null | undefined): number {
  if (direction == null || Number.isNaN(Number(direction))) return 0;
  return Number(direction);
}

/**
 * HTML for Leaflet divIcon — arrow rotates when MOVING; body + silhouette fixed upright; label below, no rotation.
 * Do not add speed, temperature, AC, or other badges here (sidebar + popup only).
 */
export function buildCleanMarkerHtml(
  iconType: string,
  status: string,
  direction: number,
  regLabel?: string
): string {
  const color = statusToMarkerColor(status);
  const type = normalizeTruckIconType(iconType);
  const path = SIMPLE_TRUCK_PATHS[type] ?? SIMPLE_TRUCK_PATHS.reefer_truck;
  const isMoving = String(status).toUpperCase() === 'MOVING';
  const rot = directionToRotationDegrees(direction);
  const labelBlock =
    regLabel && regLabel.trim()
      ? `<div class="marker-label">${escapeMarkerLabel(formatMapRegLabel(regLabel.trim()))}</div>`
      : '';

  const arrowBlock = isMoving
    ? `<div class="marker-arrow" style="transform:rotate(${rot}deg)"><svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true"><path d="M6 0L12 8H0z" fill="${color}"/></svg></div>`
    : '';

  return `<div class="clean-marker">${arrowBlock}<div class="marker-body" style="background:${color}"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="${path}" fill="white" fill-rule="evenodd"/></svg></div>${labelBlock}</div>`;
}

/** Live/share/route playback marker — no speed/temp/AC in HTML. */
export function buildCleanMarkerDivIcon(options: {
  iconType?: string;
  status?: string;
  direction?: number | null;
  mapRegLabel?: string;
}): L.DivIcon {
  const html = buildCleanMarkerHtml(
    options.iconType ?? DEFAULT_TRUCK_ICON,
    String(options.status ?? 'OFFLINE'),
    directionToRotationDegrees(options.direction ?? null),
    options.mapRegLabel
  );
  const hasLabel = Boolean(options.mapRegLabel?.trim());
  return L.divIcon({
    html,
    className: 'gps-clean-marker-icon',
    iconSize: hasLabel ? ([88, 62] as [number, number]) : ([52, 46] as [number, number]),
    iconAnchor: hasLabel ? ([44, 27] as [number, number]) : ([26, 23] as [number, number]),
    popupAnchor: hasLabel ? ([0, -24] as [number, number]) : ([0, -18] as [number, number]),
  });
}

const PICKER_BLUE = '#1565C0';

/** Icon picker: blue rounded square with white silhouette (matches map style). */
export function pickerPreviewSvg(iconType: TruckIconType, displaySize = 44): string {
  const type = normalizeTruckIconType(iconType);
  const path = SIMPLE_TRUCK_PATHS[type] ?? SIMPLE_TRUCK_PATHS.reefer_truck;
  const inner = Math.max(16, Math.round(displaySize * 0.55));
  return `<div class="clean-picker-swatch" style="width:${displaySize}px;height:${displaySize}px;background:${PICKER_BLUE}"><svg width="${inner}" height="${inner}" viewBox="0 0 20 20" aria-hidden="true"><path d="${path}" fill="white" fill-rule="evenodd"/></svg></div>`;
}
