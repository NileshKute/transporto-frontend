import L from 'leaflet';

/**
 * Top-down (bird's-eye) vehicle icons — cab/windshield toward smaller Y (north on map).
 * Map rotation uses GPS bearing clockwise from north (0° = icon points up).
 */

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

/** Optional palette for future `iconColor` support; map uses status colors. */
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

const VB = 48;

function mixHex(hex: string, toward: string, t: number): string {
  const rgb = (h: string) => {
    const x = h.replace('#', '');
    return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = rgb(hex);
  const [r2, g2, b2] = rgb(toward);
  const h = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}

function w(cx: number, cy: number, r: number, stroke: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#1a1a1a" stroke="${stroke}" stroke-width="0.4" opacity="0.92"/>`;
}

function mirror(cx: number, cy: number, stroke: string): string {
  return `<rect x="${cx - 0.8}" y="${cy - 2}" width="1.6" height="4" rx="0.3" fill="${stroke}" opacity="0.85"/>`;
}

/** Neutral slate for icon picker (shape only). */
export const PICKER_BODY_FILL = '#455a64';
export const PICKER_STROKE = '#263238';

function svgWrap(inner: string, displaySize = 40): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" width="${displaySize}" height="${displaySize}" shape-rendering="geometricPrecision">${inner}</svg>`;
}

/** Reefer: cab top, cargo box with cold lines + snowflake */
function reeferTruck(c: string, s: string, win: string): string {
  return svgWrap(`
  <defs>
    <linearGradient id="tgReefer" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${mixHex(c, '#000000', 0.12)}"/>
      <stop offset="100%" style="stop-color:${c}"/>
    </linearGradient>
  </defs>
  <rect x="14" y="6" width="20" height="11" rx="2" fill="url(#tgReefer)" stroke="${s}" stroke-width="1"/>
  <rect x="17" y="8" width="14" height="5" rx="1" fill="${win}" stroke="${s}" stroke-width="0.5" opacity="0.95"/>
  ${mirror(12, 11, s)}${mirror(36, 11, s)}
  <rect x="10" y="17" width="28" height="24" rx="1.5" fill="${c}" stroke="${s}" stroke-width="1.1"/>
  <path d="M14 22h20M14 28h20M14 34h12" stroke="${s}" stroke-width="0.55" opacity="0.45"/>
  <path d="M24 24v8M20 28h8M21 25l6 6M27 25l-6 6" stroke="${s}" stroke-width="0.9" fill="none" opacity="0.75"/>
  <path d="M10 17 L24 17 L24 41 L10 41 Z" fill="#000" opacity="0.06"/>
  ${w(16, 44, 2.8, s)}${w(32, 44, 2.8, s)}
`);
}

function miniTruck(c: string, s: string, win: string): string {
  return svgWrap(`
  <rect x="16" y="7" width="16" height="10" rx="1.8" fill="${c}" stroke="${s}" stroke-width="1"/>
  <rect x="18" y="9" width="12" height="4.5" rx="0.8" fill="${win}" stroke="${s}" stroke-width="0.45"/>
  ${mirror(13, 11, s)}${mirror(35, 11, s)}
  <rect x="12" y="17" width="24" height="20" rx="1.2" fill="${c}" stroke="${s}" stroke-width="1"/>
  <path d="M12 17 L12 37 L20 37 L20 17" fill="#000" opacity="0.05"/>
  ${w(15, 41, 2.6, s)}${w(33, 41, 2.6, s)}
`);
}

function mediumTruck(c: string, s: string, win: string): string {
  return svgWrap(`
  <rect x="15" y="5" width="18" height="12" rx="2" fill="${c}" stroke="${s}" stroke-width="1"/>
  <rect x="17" y="7" width="14" height="5.5" rx="1" fill="${win}" stroke="${s}" stroke-width="0.5"/>
  ${mirror(11, 10, s)}${mirror(37, 10, s)}
  <rect x="9" y="17" width="30" height="24" rx="1.3" fill="${c}" stroke="${s}" stroke-width="1.1"/>
  <path d="M9 17 L16 17 L16 41 L9 41 Z" fill="#000" opacity="0.06"/>
  ${w(14, 44, 2.9, s)}${w(24, 44, 2.9, s)}${w(34, 44, 2.9, s)}
`);
}

function largeTruck(c: string, s: string, win: string): string {
  return svgWrap(`
  <rect x="14" y="4" width="20" height="13" rx="2" fill="${c}" stroke="${s}" stroke-width="1"/>
  <rect x="16" y="6" width="16" height="6" rx="1" fill="${win}" stroke="${s}" stroke-width="0.5"/>
  ${mirror(10, 10, s)}${mirror(38, 10, s)}
  <rect x="7" y="17" width="34" height="26" rx="1.2" fill="${c}" stroke="${s}" stroke-width="1.1"/>
  <path d="M7 17 L14 17 L14 43 L7 43 Z" fill="#000" opacity="0.07"/>
  ${w(12, 45, 2.8, s)}${w(22, 45, 2.8, s)}${w(32, 45, 2.8, s)}${w(38, 45, 2.5, s)}
`);
}

function containerTruck(c: string, s: string, win: string): string {
  return svgWrap(`
  <rect x="17" y="5" width="14" height="11" rx="1.5" fill="${c}" stroke="${s}" stroke-width="1"/>
  <rect x="18.5" y="7" width="11" height="4.5" rx="0.6" fill="${win}" stroke="${s}" stroke-width="0.45"/>
  ${mirror(14, 9.5, s)}${mirror(34, 9.5, s)}
  <rect x="4" y="16" width="40" height="22" rx="0.8" fill="${c}" stroke="${s}" stroke-width="1"/>
  <path d="M8 16v22M14 16v22M20 16v22M26 16v22M32 16v22M38 16v22" stroke="${s}" stroke-width="0.45" opacity="0.4"/>
  <path d="M4 16 L10 16 L10 38 L4 38 Z" fill="#000" opacity="0.06"/>
  ${w(9, 42, 2.5, s)}${w(19, 42, 2.5, s)}${w(29, 42, 2.5, s)}${w(39, 42, 2.5, s)}
`);
}

function vanIcon(c: string, s: string, win: string): string {
  return svgWrap(`
  <path d="M12 14 Q12 6 24 6 Q36 6 36 14 L36 38 Q36 42 32 42 L16 42 Q12 42 12 38 Z" fill="${c}" stroke="${s}" stroke-width="1.1"/>
  <path d="M16 8 Q24 5 32 8 L32 14 Q24 11 16 14 Z" fill="${win}" stroke="${s}" stroke-width="0.5"/>
  ${mirror(9, 18, s)}${mirror(39, 18, s)}
  <path d="M12 14 L18 14 L18 40 L12 40 Z" fill="#000" opacity="0.05"/>
  ${w(17, 43, 3, s)}${w(31, 43, 3, s)}
`);
}

function pickupIcon(c: string, s: string, win: string): string {
  const bed = mixHex(c, '#94a3b8', 0.55);
  return svgWrap(`
  <rect x="16" y="6" width="16" height="11" rx="1.8" fill="${c}" stroke="${s}" stroke-width="1"/>
  <rect x="18" y="8" width="12" height="4.5" rx="0.7" fill="${win}" stroke="${s}" stroke-width="0.45"/>
  ${mirror(13, 10, s)}${mirror(35, 10, s)}
  <rect x="10" y="17" width="28" height="18" rx="1" fill="${bed}" stroke="${s}" stroke-width="1"/>
  <rect x="12" y="19" width="24" height="12" rx="0.5" fill="#334155" stroke="${s}" stroke-width="0.4" opacity="0.35"/>
  <path d="M10 17 L15 17 L15 35 L10 35 Z" fill="#000" opacity="0.05"/>
  ${w(15, 39, 2.8, s)}${w(33, 39, 2.8, s)}
`);
}

function tankerIcon(c: string, s: string, win: string): string {
  return svgWrap(`
  <rect x="17" y="5" width="14" height="11" rx="1.5" fill="${c}" stroke="${s}" stroke-width="1"/>
  <rect x="18.5" y="7" width="11" height="4.5" rx="0.6" fill="${win}" stroke="${s}" stroke-width="0.45"/>
  ${mirror(14, 9, s)}${mirror(34, 9, s)}
  <ellipse cx="24" cy="28" rx="15" ry="10" fill="${c}" stroke="${s}" stroke-width="1.1"/>
  <ellipse cx="24" cy="28" rx="11" ry="6.5" fill="none" stroke="${s}" stroke-width="0.4" opacity="0.35"/>
  <path d="M9 28 Q9 22 24 20 Q39 22 39 28" fill="none" stroke="#000" stroke-width="0.8" opacity="0.08"/>
  ${w(12, 38, 2.4, s)}${w(36, 38, 2.4, s)}
`);
}

function tempoIcon(c: string, s: string, win: string): string {
  return svgWrap(`
  <path d="M18 8 L30 8 L34 20 L34 38 L14 38 L14 20 Z" fill="${c}" stroke="${s}" stroke-width="1"/>
  <rect x="20" y="10" width="10" height="5" rx="0.8" fill="${win}" stroke="${s}" stroke-width="0.45"/>
  ${w(24, 12, 3.2, s)}
  ${w(17, 40, 2.8, s)}${w(31, 40, 2.8, s)}
  ${mirror(12, 22, s)}${mirror(36, 22, s)}
`);
}

function bikeIcon(c: string, s: string, win: string): string {
  return svgWrap(`
  <rect x="21" y="8" width="8" height="7" rx="1" fill="${c}" stroke="${s}" stroke-width="0.9"/>
  <rect x="22" y="9.5" width="5" height="3" rx="0.3" fill="${win}" stroke="${s}" stroke-width="0.35"/>
  <path d="M24 15 L22 28 M24 15 L26 28" stroke="${s}" stroke-width="2" stroke-linecap="round"/>
  ${w(17, 34, 3.4, s)}${w(31, 34, 3.4, s)}
  <path d="M17 34 L22 20 L26 20 L31 34" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>
`);
}

function carSedan(c: string, s: string, win: string): string {
  return svgWrap(`
  <path d="M16 10 L32 10 L34 18 L34 36 L14 36 L14 18 Z" fill="${c}" stroke="${s}" stroke-width="1"/>
  <path d="M17 11 L31 11 L32 17 L16 17 Z" fill="${win}" stroke="${s}" stroke-width="0.45"/>
  <path d="M14 18 L18 18 L18 36 L14 36 Z" fill="#000" opacity="0.06"/>
  ${mirror(11, 22, s)}${mirror(37, 22, s)}
  ${w(18, 38, 2.9, s)}${w(30, 38, 2.9, s)}
`);
}

function carSuv(c: string, s: string, win: string): string {
  return svgWrap(`
  <path d="M13 9 L35 9 L37 19 L37 37 L11 37 L11 19 Z" fill="${c}" stroke="${s}" stroke-width="1.05"/>
  <path d="M14 10 L34 10 L35 17 L13 17 Z" fill="${win}" stroke="${s}" stroke-width="0.45"/>
  <path d="M15 11h18M15 13.5h18" stroke="${s}" stroke-width="0.55" opacity="0.35"/>
  <path d="M11 19 L16 19 L16 37 L11 37 Z" fill="#000" opacity="0.06"/>
  ${mirror(8, 21, s)}${mirror(40, 21, s)}
  ${w(16, 39, 3, s)}${w(32, 39, 3, s)}
`);
}

function ambulanceIcon(c: string, s: string, win: string): string {
  const body = '#eceff1';
  return svgWrap(`
  <path d="M12 12 Q12 5 24 5 Q36 5 36 12 L36 38 Q36 42 30 42 L18 42 Q12 42 12 38 Z" fill="${body}" stroke="${s}" stroke-width="1.1"/>
  <path d="M16 7 Q24 4 32 7 L32 13 Q24 10 16 13 Z" fill="${win}" stroke="${s}" stroke-width="0.45"/>
  <rect x="20" y="20" width="8" height="2" rx="0.3" fill="#e53935"/>
  <rect x="23" y="17" width="2" height="8" rx="0.3" fill="#e53935"/>
  ${mirror(8, 20, s)}${mirror(40, 20, s)}
  <path d="M12 12 L17 12 L17 40 L12 40 Z" fill="#000" opacity="0.04"/>
  ${w(17, 43, 3, s)}${w(31, 43, 3, s)}
`);
}

function busIcon(c: string, s: string, win: string): string {
  return svgWrap(`
  <rect x="10" y="6" width="28" height="34" rx="2" fill="${c}" stroke="${s}" stroke-width="1.1"/>
  <rect x="13" y="8" width="22" height="6" rx="1" fill="${win}" stroke="${s}" stroke-width="0.5"/>
  <path d="M12 17h24M12 22h24M12 27h24M12 32h24" stroke="${s}" stroke-width="0.5" opacity="0.35"/>
  <path d="M10 6 L14 6 L14 40 L10 40 Z" fill="#000" opacity="0.06"/>
  ${mirror(7, 18, s)}${mirror(41, 18, s)}
  ${w(15, 42, 2.6, s)}${w(24, 42, 2.6, s)}${w(33, 42, 2.6, s)}
`);
}

function autoRickshaw(c: string, s: string, win: string): string {
  return svgWrap(`
  <path d="M20 10 Q28 8 34 16 L36 32 Q36 40 24 40 Q12 40 12 32 L14 16 Q16 10 20 10 Z" fill="${c}" stroke="${s}" stroke-width="1"/>
  <ellipse cx="24" cy="16" rx="7" ry="5" fill="${win}" stroke="${s}" stroke-width="0.5"/>
  ${w(24, 11, 2.8, s)}
  ${w(14, 38, 2.6, s)}${w(34, 38, 2.6, s)}
  ${mirror(10, 24, s)}${mirror(38, 24, s)}
`);
}

const TOPDOWN_RENDERERS: Record<TruckIconType, (c: string, s: string, win: string) => string> = {
  reefer_truck: reeferTruck,
  mini_truck: miniTruck,
  medium_truck: mediumTruck,
  large_truck: largeTruck,
  container: containerTruck,
  van: vanIcon,
  pickup: pickupIcon,
  tanker: tankerIcon,
  tempo: tempoIcon,
  bike: bikeIcon,
  car_sedan: carSedan,
  car_suv: carSuv,
  ambulance: ambulanceIcon,
  bus: busIcon,
  auto_rickshaw: autoRickshaw,
};

function renderTopDownSvg(type: TruckIconType, body: string, stroke: string, displaySize = 40): string {
  const win = mixHex(body, '#ffffff', 0.48);
  const raw = TOPDOWN_RENDERERS[type](body, stroke, win);
  if (displaySize === 40) return raw;
  return raw.replace(/width="40" height="40"/, `width="${displaySize}" height="${displaySize}"`);
}

export const TRUCK_ICONS: Record<TruckIconType, (fill: string, stroke: string) => string> = {
  reefer_truck: (f, st) => renderTopDownSvg('reefer_truck', f, st),
  mini_truck: (f, st) => renderTopDownSvg('mini_truck', f, st),
  medium_truck: (f, st) => renderTopDownSvg('medium_truck', f, st),
  large_truck: (f, st) => renderTopDownSvg('large_truck', f, st),
  container: (f, st) => renderTopDownSvg('container', f, st),
  van: (f, st) => renderTopDownSvg('van', f, st),
  pickup: (f, st) => renderTopDownSvg('pickup', f, st),
  tanker: (f, st) => renderTopDownSvg('tanker', f, st),
  tempo: (f, st) => renderTopDownSvg('tempo', f, st),
  bike: (f, st) => renderTopDownSvg('bike', f, st),
  car_sedan: (f, st) => renderTopDownSvg('car_sedan', f, st),
  car_suv: (f, st) => renderTopDownSvg('car_suv', f, st),
  ambulance: (f, st) => renderTopDownSvg('ambulance', f, st),
  bus: (f, st) => renderTopDownSvg('bus', f, st),
  auto_rickshaw: (f, st) => renderTopDownSvg('auto_rickshaw', f, st),
};

export function normalizeTruckIconType(raw: string | undefined | null): TruckIconType {
  if (!raw) return DEFAULT_TRUCK_ICON;
  const k = String(raw).toLowerCase().replace(/-/g, '_');
  return (TRUCK_ICON_TYPES as readonly string[]).includes(k) ? (k as TruckIconType) : DEFAULT_TRUCK_ICON;
}

export function statusToFillStroke(status: string | undefined): { fill: string; stroke: string } {
  switch (status) {
    case 'MOVING':
      return { fill: '#22c55e', stroke: '#15803d' };
    case 'HALTED':
      return { fill: '#ef4444', stroke: '#b91c1c' };
    case 'LONG_HALT':
      return { fill: '#f97316', stroke: '#c2410c' };
    case 'IDLE':
      return { fill: '#eab308', stroke: '#a16207' };
    case 'OFFLINE':
    default:
      return { fill: '#94a3b8', stroke: '#475569' };
  }
}

/** GPS bearing: 0° = north, clockwise — matches top-down art (front toward smaller Y / up). */
export function directionToRotationDegrees(direction: number | null | undefined): number {
  if (direction == null || Number.isNaN(Number(direction))) return 0;
  return Number(direction);
}

/** Raw SVG string (40×40) for map / embedding. */
export function getTopDownVehicleIcon(
  iconType: string | undefined,
  status: string | undefined,
  direction?: number | null
): { svg: string; rotation: number; fill: string; stroke: string } {
  const { fill, stroke } = statusToFillStroke(status);
  const type = normalizeTruckIconType(iconType);
  return {
    svg: TRUCK_ICONS[type](fill, stroke),
    rotation: directionToRotationDegrees(direction ?? null),
    fill,
    stroke,
  };
}

export interface TruckMarkerBadges {
  tempHtml?: string;
  speedHtml?: string;
  pulseRingHtml?: string;
}

export function buildTruckMarkerDivIcon(options: {
  iconType: string | undefined;
  status: string | undefined;
  direction?: number | null;
  badges?: TruckMarkerBadges;
  iconSize?: [number, number];
  iconAnchor?: [number, number];
  popupAnchor?: [number, number];
}): L.DivIcon {
  const { fill, stroke } = statusToFillStroke(options.status);
  const type = normalizeTruckIconType(options.iconType);
  const svg = TRUCK_ICONS[type](fill, stroke);
  const rot = directionToRotationDegrees(options.direction ?? null);
  const moving = options.status === 'MOVING';
  const b = options.badges ?? {};

  const html = `
    <div style="position:relative;width:56px;height:56px;">
      ${b.pulseRingHtml ?? ''}
      <div style="position:absolute;left:8px;top:8px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
        <div class="truck-marker-rot" style="width:40px;height:40px;transform:rotate(${rot}deg);transform-origin:center center;display:flex;align-items:center;justify-content:center;">
          ${svg}
        </div>
      </div>
      ${b.tempHtml ?? ''}
      ${b.speedHtml ?? ''}
    </div>
  `;

  const size: [number, number] = options.iconSize ?? [56, 56];
  const anchor: [number, number] = options.iconAnchor ?? [28, 28];
  const pop: [number, number] = options.popupAnchor ?? [0, -26];

  return L.divIcon({
    html,
    className: `truck-marker${moving ? ' moving' : ''}`,
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: pop,
  });
}

/** Picker preview: neutral body color, shape only. */
export function pickerPreviewSvg(iconType: TruckIconType, displaySize = 44): string {
  return renderTopDownSvg(iconType, PICKER_BODY_FILL, PICKER_STROKE, displaySize);
}

/** @deprecated Use pickerPreviewSvg in React; kept for string HTML if needed */
export function truckIconThumbnailSvg(iconType: TruckIconType, selected: boolean): string {
  const svg = pickerPreviewSvg(iconType, 36);
  const border = selected ? 'box-shadow:0 0 0 2px #1565C0;' : 'box-shadow:inset 0 0 0 1px #e2e8f0;';
  return `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:#f1f5f9;${border}">${svg}</div>`;
}
