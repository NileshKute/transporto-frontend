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

/** Compact wheel, top-down */
function wheel(cx: number, cy: number, r: number, stroke: string): string {
  const rr = r * 0.68;
  return `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="#121212" stroke="${stroke}" stroke-width="0.22" opacity="0.94"/>`;
}

function sideMirror(cx: number, cy: number, stroke: string): string {
  return `<rect x="${cx - 0.45}" y="${cy - 1.15}" width="0.9" height="2.3" rx="0.2" fill="${mixHex(stroke, '#000000', 0.35)}" opacity="0.72"/>`;
}

/** Windshield / glass — light + slight cool tint */
function windshieldFill(body: string): string {
  return mixHex(mixHex(body, '#ffffff', 0.46), '#a8cce8', 0.2);
}

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


/** Neutral slate for icon picker (shape only). */
export const PICKER_BODY_FILL = '#455a64';
export const PICKER_STROKE = '#263238';

function svgWrap(inner: string, displaySize = 40): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" width="${displaySize}" height="${displaySize}" shape-rendering="geometricPrecision">${inner}</svg>`;
}

function bodyShadeGrad(uid: string, c: string): { def: string; ref: string } {
  const id = `bd${uid}`;
  const lt = mixHex(c, '#ffffff', 0.22);
  const dk = mixHex(c, '#000000', 0.08);
  return {
    def: `<linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="${lt}"/><stop offset="55%" stop-color="${c}"/><stop offset="100%" stop-color="${dk}"/></linearGradient>`,
    ref: `url(#${id})`,
  };
}

const outline = '#141414';

/** Reefer — default fleet icon: rounded cab/box, cold lines, roof snowflake */
function reeferTruck(c: string, s: string, win: string, uid: string): string {
  const gCab = `rc${uid}`;
  const gBox = `rbx${uid}`;
  const cabLt = mixHex(c, '#ffffff', 0.26);
  const boxTop = mixHex(c, '#ffffff', 0.14);
  const boxBot = mixHex(c, '#000000', 0.06);
  const winStroke = mixHex(s, '#6ba8d4', 0.28);
  return svgWrap(`
  <defs>
    <linearGradient id="${gCab}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${cabLt}"/><stop offset="100%" stop-color="${c}"/>
    </linearGradient>
    <linearGradient id="${gBox}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${boxTop}"/><stop offset="100%" stop-color="${boxBot}"/>
    </linearGradient>
  </defs>
  <path d="M15.5 6.5 Q15 6 15.5 5.3 L16.8 4.2 Q17.5 3.5 19 3.5h10 Q30.5 3.5 31.2 4.2 L32.5 5.3 Q33 6 32.5 6.5 V15.2 Q32.5 16.3 31.3 16.3 H16.7 Q15.5 16.3 15.5 15.2 Z"
    fill="url(#${gCab})" stroke="${s}" stroke-width="0.78" stroke-linejoin="round"/>
  <path d="M17.2 5.8 Q24 4.6 30.8 5.8 L30.5 9.8 Q24 8.8 17.5 9.8 Z" fill="${win}" stroke="${winStroke}" stroke-width="0.32" opacity="0.98"/>
  ${sideMirror(11.4, 9.8, s)}${sideMirror(36.6, 9.8, s)}
  <rect x="9.8" y="17.2" width="28.4" height="23.6" rx="3" fill="url(#${gBox})" stroke="${s}" stroke-width="0.78"/>
  <rect x="9.8" y="17.2" width="28.4" height="23.6" rx="3" fill="none" stroke="${outline}" stroke-width="0.45" opacity="0.55"/>
  <line x1="13" y1="22" x2="35" y2="22" stroke="${s}" stroke-width="0.32" opacity="0.22" stroke-linecap="round"/>
  <line x1="13" y1="26.5" x2="35" y2="26.5" stroke="${s}" stroke-width="0.32" opacity="0.22" stroke-linecap="round"/>
  <line x1="13" y1="31" x2="35" y2="31" stroke="${s}" stroke-width="0.32" opacity="0.22" stroke-linecap="round"/>
  <line x1="13" y1="35.5" x2="28" y2="35.5" stroke="${s}" stroke-width="0.32" opacity="0.22" stroke-linecap="round"/>
  <path d="M24 20.5v6.5M21 23.8h6M22 21.5l4 5M26 21.5l-4 5" stroke="${s}" stroke-width="0.48" fill="none" opacity="0.5" stroke-linecap="round"/>
  <path d="M9.8 17.2 L15 17.2 L15 40.8 L9.8 40.8 Z" fill="#000" opacity="0.035"/>
  ${wheel(16.2, 43.8, 2.4, s)}${wheel(31.8, 43.8, 2.4, s)}
`);
}

function miniTruck(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const ws = mixHex(s, '#7ab0d4', 0.22);
  return svgWrap(`
  <defs>${def}</defs>
  <path d="M16.5 7.2 Q16 7 16.5 6.2 L17.5 5.2 Q18 4.5 19.5 4.5h9 Q29.5 4.5 30.2 5.2 L31.2 6.2 Q31.7 7 31.2 7.2 V15.3 Q31.2 16.2 30.2 16.2 H17.8 Q16.8 16.2 16.8 15.3 Z" fill="${ref}" stroke="${s}" stroke-width="0.76" stroke-linejoin="round"/>
  <path d="M18.2 6.2 Q24 5.2 29.8 6.2 L29.5 10 Q24 9.2 18.5 10 Z" fill="${win}" stroke="${ws}" stroke-width="0.3"/>
  ${sideMirror(13.2, 10.2, s)}${sideMirror(34.8, 10.2, s)}
  <rect x="12" y="17.2" width="24" height="19.6" rx="2.6" fill="${ref}" stroke="${s}" stroke-width="0.76"/>
  <rect x="12" y="17.2" width="24" height="19.6" rx="2.6" fill="none" stroke="${outline}" stroke-width="0.42" opacity="0.5"/>
  <path d="M12 17.2 L16.5 17.2 L16.5 36.8 L12 36.8 Z" fill="#000" opacity="0.03"/>
  ${wheel(15.2, 40.5, 2.35, s)}${wheel(32.8, 40.5, 2.35, s)}
`);
}

function mediumTruck(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const ws = mixHex(s, '#7ab0d4', 0.22);
  return svgWrap(`
  <defs>${def}</defs>
  <path d="M15.2 5.5 Q14.5 5 15.2 4.2 L16.5 3.2 Q17.2 2.5 18.8 2.5h10.4 Q30.8 2.5 31.5 3.2 L32.8 4.2 Q33.5 5 32.8 5.5 V15.4 Q32.8 16.5 31.6 16.5 H16.4 Q15.2 16.5 15.2 15.4 Z" fill="${ref}" stroke="${s}" stroke-width="0.76" stroke-linejoin="round"/>
  <path d="M17.2 4.5 Q24 3.4 30.8 4.5 L30.5 9.5 Q24 8.5 17.5 9.5 Z" fill="${win}" stroke="${ws}" stroke-width="0.32"/>
  ${sideMirror(10.8, 9.5, s)}${sideMirror(37.2, 9.5, s)}
  <rect x="8.8" y="17" width="30.4" height="24.2" rx="2.4" fill="${ref}" stroke="${s}" stroke-width="0.76"/>
  <rect x="8.8" y="17" width="30.4" height="24.2" rx="2.4" fill="none" stroke="${outline}" stroke-width="0.42" opacity="0.5"/>
  <path d="M8.8 17 L15.5 17 L15.5 41.2 L8.8 41.2 Z" fill="#000" opacity="0.035"/>
  ${wheel(13.5, 44.2, 2.5, s)}${wheel(24, 44.2, 2.5, s)}${wheel(34.5, 44.2, 2.5, s)}
`);
}

function largeTruck(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const ws = mixHex(s, '#7ab0d4', 0.22);
  return svgWrap(`
  <defs>${def}</defs>
  <path d="M14 4.5 Q13.3 4 14 3.2 L15.5 2 Q16.3 1.2 18 1.2h12 Q31.7 1.2 32.5 2 L34 3.2 Q34.7 4 34 4.5 V15.6 Q34 16.8 32.8 16.8 H15.2 Q14 16.8 14 15.6 Z" fill="${ref}" stroke="${s}" stroke-width="0.76" stroke-linejoin="round"/>
  <path d="M16.2 3.2 Q24 2 31.8 3.2 L31.5 9 Q24 7.8 16.5 9 Z" fill="${win}" stroke="${ws}" stroke-width="0.32"/>
  ${sideMirror(9.6, 8.8, s)}${sideMirror(38.4, 8.8, s)}
  <rect x="6.8" y="17" width="34.4" height="26.2" rx="2.2" fill="${ref}" stroke="${s}" stroke-width="0.76"/>
  <rect x="6.8" y="17" width="34.4" height="26.2" rx="2.2" fill="none" stroke="${outline}" stroke-width="0.42" opacity="0.5"/>
  <path d="M6.8 17 L14 17 L14 43.2 L6.8 43.2 Z" fill="#000" opacity="0.04"/>
  ${wheel(11.5, 45.2, 2.45, s)}${wheel(21.5, 45.2, 2.45, s)}${wheel(31.5, 45.2, 2.45, s)}${wheel(37.5, 45.2, 2.2, s)}
`);
}

function containerTruck(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const ws = mixHex(s, '#7ab0d4', 0.22);
  return svgWrap(`
  <defs>${def}</defs>
  <path d="M17 5.5 Q16.5 5 17 4.3 L18 3.3 Q18.6 2.8 20 2.8h8 Q29.4 2.8 30 3.3 L31 4.3 Q31.5 5 31 5.5 V14.5 Q31 15.5 30 15.5 H18 Q17 15.5 17 14.5 Z" fill="${ref}" stroke="${s}" stroke-width="0.74" stroke-linejoin="round"/>
  <path d="M18.5 4.2 Q24 3.3 29.5 4.2 L29.2 8.5 Q24 7.7 18.8 8.5 Z" fill="${win}" stroke="${ws}" stroke-width="0.28"/>
  ${sideMirror(13.8, 9.2, s)}${sideMirror(34.2, 9.2, s)}
  <rect x="3.6" y="16" width="40.8" height="22.4" rx="1.4" fill="${ref}" stroke="${s}" stroke-width="0.74"/>
  <rect x="3.6" y="16" width="40.8" height="22.4" rx="1.4" fill="none" stroke="${outline}" stroke-width="0.4" opacity="0.48"/>
  <path d="M7.5 16v22M13.5 16v22M19.5 16v22M25.5 16v22M31.5 16v22M37.5 16v22" stroke="${s}" stroke-width="0.28" opacity="0.28" stroke-linecap="round"/>
  <path d="M3.6 16 L9.5 16 L9.5 38.4 L3.6 38.4 Z" fill="#000" opacity="0.035"/>
  ${wheel(8.8, 41.8, 2.25, s)}${wheel(18.8, 41.8, 2.25, s)}${wheel(28.8, 41.8, 2.25, s)}${wheel(38.8, 41.8, 2.25, s)}
`);
}

function vanIcon(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const ws = mixHex(s, '#7ab0d4', 0.22);
  return svgWrap(`
  <defs>${def}</defs>
  <path d="M12.2 14.5 Q12.2 6.2 24 6.2 Q35.8 6.2 35.8 14.5 L35.8 37.8 Q35.8 41.8 31.8 41.8 H16.2 Q12.2 41.8 12.2 37.8 Z" fill="${ref}" stroke="${s}" stroke-width="0.78" stroke-linejoin="round"/>
  <path d="M12.2 14.5 L35.8 14.5" fill="none" stroke="${outline}" stroke-width="0.38" opacity="0.45"/>
  <path d="M16.2 7.5 Q24 5.2 31.8 7.5 L31.5 13.8 Q24 11.8 16.5 13.8 Z" fill="${win}" stroke="${ws}" stroke-width="0.32"/>
  ${sideMirror(9.2, 19, s)}${sideMirror(38.8, 19, s)}
  <path d="M12.2 14.5 L17.5 14.5 L17.5 40.5 L12.2 40.5 Z" fill="#000" opacity="0.03"/>
  ${wheel(17.2, 42.8, 2.65, s)}${wheel(30.8, 42.8, 2.65, s)}
`);
}

function pickupIcon(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const bed = mixHex(c, '#94a3b8', 0.5);
  const ws = mixHex(s, '#7ab0d4', 0.22);
  return svgWrap(`
  <defs>${def}</defs>
  <path d="M16.2 6.2 Q15.8 5.5 16.5 4.8 L17.8 3.8 Q18.5 3.2 20 3.2h8 Q29.5 3.2 30.2 3.8 L31.5 4.8 Q32.2 5.5 31.8 6.2 V15 Q31.8 16 30.8 16 H17.2 Q16.2 16 16.2 15 Z" fill="${ref}" stroke="${s}" stroke-width="0.76" stroke-linejoin="round"/>
  <path d="M18 4.8 Q24 3.8 30 4.8 L29.6 9.2 Q24 8.3 18.4 9.2 Z" fill="${win}" stroke="${ws}" stroke-width="0.3"/>
  ${sideMirror(13.2, 9.5, s)}${sideMirror(34.8, 9.5, s)}
  <rect x="9.8" y="17" width="28.4" height="17.8" rx="2" fill="${bed}" stroke="${s}" stroke-width="0.72"/>
  <rect x="9.8" y="17" width="28.4" height="17.8" rx="2" fill="none" stroke="${outline}" stroke-width="0.38" opacity="0.42"/>
  <rect x="11.5" y="19" width="25" height="11" rx="0.8" fill="#2d3b4d" stroke="${s}" stroke-width="0.28" opacity="0.42"/>
  <path d="M9.8 17 L14.8 17 L14.8 34.8 L9.8 34.8 Z" fill="#000" opacity="0.03"/>
  ${wheel(15.2, 38.5, 2.5, s)}${wheel(32.8, 38.5, 2.5, s)}
`);
}

function tankerIcon(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const ws = mixHex(s, '#7ab0d4', 0.22);
  return svgWrap(`
  <defs>${def}</defs>
  <path d="M17 5.3 Q16.5 4.8 17.2 4 L18.5 3 Q19.2 2.3 20.5 2.3h7 Q28.8 2.3 29.5 3 L30.8 4 Q31.5 4.8 31 5.3 V14.6 Q31 15.6 30 15.6 H18 Q17 15.6 17 14.6 Z" fill="${ref}" stroke="${s}" stroke-width="0.74" stroke-linejoin="round"/>
  <path d="M18.5 4 Q24 3.1 29.5 4 L29.2 8.5 Q24 7.6 18.8 8.5 Z" fill="${win}" stroke="${ws}" stroke-width="0.28"/>
  ${sideMirror(13.8, 8.8, s)}${sideMirror(34.2, 8.8, s)}
  <ellipse cx="24" cy="28" rx="14.8" ry="9.8" fill="${ref}" stroke="${s}" stroke-width="0.76"/>
  <ellipse cx="24" cy="28" rx="14.8" ry="9.8" fill="none" stroke="${outline}" stroke-width="0.35" opacity="0.45"/>
  <ellipse cx="24" cy="28" rx="10.5" ry="6" fill="none" stroke="${s}" stroke-width="0.28" opacity="0.25"/>
  <path d="M9.2 28 Q9.2 22.5 24 20.8 Q38.8 22.5 38.8 28" fill="none" stroke="#000" stroke-width="0.55" opacity="0.06"/>
  ${wheel(11.8, 37.5, 2.2, s)}${wheel(36.2, 37.5, 2.2, s)}
`);
}

function tempoIcon(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const ws = mixHex(s, '#7ab0d4', 0.22);
  return svgWrap(`
  <defs>${def}</defs>
  <path d="M18.2 8.2 L29.8 8.2 L33.5 19.8 Q34 21 34 22.5 V37.5 Q34 38.8 32.8 38.8 H15.2 Q14 38.8 14 37.5 V22.5 Q14 21 14.5 19.8 Z" fill="${ref}" stroke="${s}" stroke-width="0.76" stroke-linejoin="round"/>
  <path d="M18.2 8.2 L33.5 19.8" fill="none" stroke="${outline}" stroke-width="0.35" opacity="0.35"/>
  <rect x="20.2" y="9.8" width="9.6" height="5" rx="0.9" fill="${win}" stroke="${ws}" stroke-width="0.28"/>
  ${wheel(24, 11.8, 2.65, s)}
  ${wheel(17.2, 39.8, 2.45, s)}${wheel(30.8, 39.8, 2.45, s)}
  ${sideMirror(12.2, 22.5, s)}${sideMirror(35.8, 22.5, s)}
`);
}

function bikeIcon(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const ws = mixHex(s, '#7ab0d4', 0.2);
  return svgWrap(`
  <defs>${def}</defs>
  <rect x="20.8" y="7.8" width="8.4" height="7.4" rx="1.4" fill="${ref}" stroke="${s}" stroke-width="0.65"/>
  <rect x="20.8" y="7.8" width="8.4" height="7.4" rx="1.4" fill="none" stroke="${outline}" stroke-width="0.32" opacity="0.45"/>
  <rect x="22" y="9.2" width="5.2" height="3.2" rx="0.45" fill="${win}" stroke="${ws}" stroke-width="0.25"/>
  <path d="M24 15.2 L22.4 27.8 M24 15.2 L25.6 27.8" stroke="${s}" stroke-width="1.65" stroke-linecap="round"/>
  ${wheel(17.2, 33.8, 2.85, s)}${wheel(30.8, 33.8, 2.85, s)}
  <path d="M17.2 33.8 L22.2 20.2 L25.8 20.2 L30.8 33.8" fill="none" stroke="${ref}" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>
`);
}

function carSedan(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const ws = mixHex(s, '#7ab0d4', 0.22);
  return svgWrap(`
  <defs>${def}</defs>
  <path d="M16.5 10.5 Q16 10 16.5 9.2 L17.5 8 Q18.2 7.2 19.5 7.2h9 Q30.8 7.2 31.5 8 L32.5 9.2 Q33 10 32.5 10.5 L34.2 17.8 Q34.5 18.5 34.2 19.2 L34.2 35.5 Q34.2 36.8 33 36.8 H15 Q13.8 36.8 13.8 35.5 L13.8 19.2 Q13.5 18.5 13.8 17.8 Z" fill="${ref}" stroke="${s}" stroke-width="0.74" stroke-linejoin="round"/>
  <path d="M13.8 19.2 L34.2 19.2" fill="none" stroke="${outline}" stroke-width="0.35" opacity="0.4"/>
  <path d="M17.2 9.5 Q24 8.2 30.8 9.5 L31.2 16.5 Q24 15.5 16.8 16.5 Z" fill="${win}" stroke="${ws}" stroke-width="0.3"/>
  <path d="M13.8 19.2 L18 19.2 L18 36.5 L13.8 36.5 Z" fill="#000" opacity="0.04"/>
  ${sideMirror(11.2, 22.5, s)}${sideMirror(36.8, 22.5, s)}
  ${wheel(18.2, 37.8, 2.55, s)}${wheel(29.8, 37.8, 2.55, s)}
`);
}

function carSuv(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const ws = mixHex(s, '#7ab0d4', 0.22);
  return svgWrap(`
  <defs>${def}</defs>
  <path d="M13.2 9.5 Q12.5 9 13.2 8.2 L14.5 7 Q15.3 6.2 17 6.2h14 Q32.7 6.2 33.5 7 L34.8 8.2 Q35.5 9 34.8 9.5 L36.8 18.5 Q37.2 19.2 36.8 20 V36.5 Q36.8 37.8 35.5 37.8 H12.5 Q11.2 37.8 11.2 36.5 V20 Q10.8 19.2 11.2 18.5 Z" fill="${ref}" stroke="${s}" stroke-width="0.74" stroke-linejoin="round"/>
  <path d="M11.2 20 L36.8 20" fill="none" stroke="${outline}" stroke-width="0.35" opacity="0.4"/>
  <path d="M14.2 8.5 Q24 7 33.8 8.5 L34.2 16.2 Q24 15 13.8 16.2 Z" fill="${win}" stroke="${ws}" stroke-width="0.3"/>
  <path d="M14.5 10.5h19M14.5 12.8h19" stroke="${s}" stroke-width="0.38" opacity="0.22" stroke-linecap="round"/>
  <path d="M11.2 20 L15.8 20 L15.8 37.5 L11.2 37.5 Z" fill="#000" opacity="0.035"/>
  ${sideMirror(8.2, 21.5, s)}${sideMirror(39.8, 21.5, s)}
  ${wheel(16.2, 38.8, 2.65, s)}${wheel(31.8, 38.8, 2.65, s)}
`);
}

function ambulanceIcon(c: string, s: string, win: string, _uid: string): string {
  const body = '#eceff1';
  const ws = mixHex(s, '#7ab0d4', 0.18);
  return svgWrap(`
  <path d="M12.2 12.5 Q12.2 5.5 24 5.5 Q35.8 5.5 35.8 12.5 L35.8 37.8 Q35.8 41.8 30.8 41.8 H17.2 Q12.2 41.8 12.2 37.8 Z" fill="${body}" stroke="${s}" stroke-width="0.78" stroke-linejoin="round"/>
  <path d="M12.2 12.5 L35.8 12.5" fill="none" stroke="${outline}" stroke-width="0.35" opacity="0.35"/>
  <path d="M16.2 7 Q24 4.2 31.8 7 L31.5 12.8 Q24 10.5 16.5 12.8 Z" fill="${win}" stroke="${ws}" stroke-width="0.3"/>
  <rect x="20" y="20.2" width="8" height="2" rx="0.35" fill="#e53935"/>
  <rect x="23" y="17.2" width="2" height="8" rx="0.35" fill="#e53935"/>
  ${sideMirror(8.2, 20.5, s)}${sideMirror(39.8, 20.5, s)}
  <path d="M12.2 12.5 L17 12.5 L17 40.5 L12.2 40.5 Z" fill="#000" opacity="0.025"/>
  ${wheel(17.2, 42.8, 2.6, s)}${wheel(30.8, 42.8, 2.6, s)}
`);
}

function busIcon(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const ws = mixHex(s, '#7ab0d4', 0.22);
  return svgWrap(`
  <defs>${def}</defs>
  <rect x="9.8" y="6.2" width="28.4" height="33.6" rx="2.4" fill="${ref}" stroke="${s}" stroke-width="0.76"/>
  <rect x="9.8" y="6.2" width="28.4" height="33.6" rx="2.4" fill="none" stroke="${outline}" stroke-width="0.38" opacity="0.45"/>
  <rect x="12.8" y="7.8" width="22.4" height="6.2" rx="1.2" fill="${win}" stroke="${ws}" stroke-width="0.32"/>
  <path d="M12.2 17.2h23.6M12.2 22h23.6M12.2 26.8h23.6M12.2 31.6h23.6" stroke="${s}" stroke-width="0.32" opacity="0.22" stroke-linecap="round"/>
  <path d="M9.8 6.2 L14.2 6.2 L14.2 39.8 L9.8 39.8 Z" fill="#000" opacity="0.035"/>
  ${sideMirror(7.2, 18.5, s)}${sideMirror(40.8, 18.5, s)}
  ${wheel(15.2, 41.8, 2.35, s)}${wheel(24, 41.8, 2.35, s)}${wheel(32.8, 41.8, 2.35, s)}
`);
}

function autoRickshaw(c: string, s: string, win: string, uid: string): string {
  const { def, ref } = bodyShadeGrad(uid, c);
  const ws = mixHex(s, '#7ab0d4', 0.22);
  return svgWrap(`
  <defs>${def}</defs>
  <path d="M20.2 10.2 Q28 8.2 33.8 16.2 L35.8 31.8 Q36.2 40.2 24 40.2 Q11.8 40.2 12.2 31.8 L14.2 16.2 Q16.2 10.2 20.2 10.2 Z" fill="${ref}" stroke="${s}" stroke-width="0.74" stroke-linejoin="round"/>
  <path d="M20.2 10.2 Q33.8 16.2 35.8 31.8" fill="none" stroke="${outline}" stroke-width="0.32" opacity="0.35"/>
  <ellipse cx="24" cy="16" rx="6.8" ry="4.8" fill="${win}" stroke="${ws}" stroke-width="0.32"/>
  ${wheel(24, 10.8, 2.45, s)}
  ${wheel(14.2, 37.8, 2.3, s)}${wheel(33.8, 37.8, 2.3, s)}
  ${sideMirror(10.2, 24.5, s)}${sideMirror(37.8, 24.5, s)}
`);
}

const TOPDOWN_RENDERERS: Record<TruckIconType, (c: string, s: string, win: string, uid: string) => string> = {
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

function renderTopDownSvg(type: TruckIconType, body: string, stroke: string, displaySize = 40, uid?: string): string {
  const id = uid ?? `g${Math.random().toString(36).slice(2, 10)}`;
  const win = windshieldFill(body);
  const raw = TOPDOWN_RENDERERS[type](body, stroke, win, id);
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
  /** Raw registration string; formatted + shown below icon on live map only */
  mapRegLabel?: string;
  iconSize?: [number, number];
  iconAnchor?: [number, number];
  popupAnchor?: [number, number];
}): L.DivIcon {
  const { fill, stroke } = statusToFillStroke(options.status);
  const type = normalizeTruckIconType(options.iconType);
  const uid = `m${Math.random().toString(36).slice(2, 10)}`;
  const svg = renderTopDownSvg(type, fill, stroke, 40, uid);
  const rot = directionToRotationDegrees(options.direction ?? null);
  const moving = options.status === 'MOVING';
  const b = options.badges ?? {};

  const rawReg = options.mapRegLabel?.trim();
  const hasLabel = Boolean(rawReg);

  const labelHtml = hasLabel
    ? `<div class="truck-label">${escapeMarkerLabel(formatMapRegLabel(rawReg!))}</div>`
    : '';

  const html = hasLabel
    ? `
    <div class="truck-marker-wrapper" style="position:relative;width:88px;height:52px;">
      ${b.pulseRingHtml ?? ''}
      <div style="position:absolute;left:50%;top:2px;width:40px;height:40px;margin-left:-20px;display:flex;align-items:center;justify-content:center;">
        <div class="truck-marker-rot" style="width:40px;height:40px;transform:rotate(${rot}deg);transform-origin:center center;display:flex;align-items:center;justify-content:center;">
          ${svg}
        </div>
      </div>
      ${labelHtml}
      ${b.tempHtml ?? ''}
      ${b.speedHtml ?? ''}
    </div>
  `
    : `
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

  const size: [number, number] =
    options.iconSize ?? (hasLabel ? ([88, 60] as [number, number]) : ([56, 56] as [number, number]));
  const anchor: [number, number] =
    options.iconAnchor ?? (hasLabel ? ([44, 22] as [number, number]) : ([28, 28] as [number, number]));
  const pop: [number, number] = options.popupAnchor ?? (hasLabel ? ([0, -34] as [number, number]) : ([0, -26] as [number, number]));

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
  return renderTopDownSvg(iconType, PICKER_BODY_FILL, PICKER_STROKE, displaySize, `p${Math.random().toString(36).slice(2, 9)}`);
}

/** @deprecated Use pickerPreviewSvg in React; kept for string HTML if needed */
export function truckIconThumbnailSvg(iconType: TruckIconType, selected: boolean): string {
  const svg = pickerPreviewSvg(iconType, 36);
  const border = selected ? 'box-shadow:0 0 0 2px #1565C0;' : 'box-shadow:inset 0 0 0 1px #e2e8f0;';
  return `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:#f1f5f9;${border}">${svg}</div>`;
}
