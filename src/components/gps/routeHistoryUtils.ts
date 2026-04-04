/** Single GPS ping from /api/gps/route or /api/gps/history */

export interface GpsRoutePoint {
  id?: string;
  vehicleId?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  direction?: number;
  temperature?: number | null;
  ignitionOn?: boolean;
  acOn?: boolean;
  status?: string;
  haltedSince?: string | null;
  movingSince?: string | null;
  location?: string;
  deviceTimestamp?: string;
  recordedAt?: string;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function pointTimeMs(p: GpsRoutePoint): number {
  const raw = p.deviceTimestamp || p.recordedAt;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function validRoutePoint(p: GpsRoutePoint): p is GpsRoutePoint & { latitude: number; longitude: number } {
  const lat = p.latitude;
  const lng = p.longitude;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export function sortRoutePoints(points: GpsRoutePoint[]): GpsRoutePoint[] {
  return [...points].filter(validRoutePoint).sort((a, b) => pointTimeMs(a) - pointTimeMs(b));
}

export function speedSegmentColor(speedKmh: number): string {
  if (speedKmh < 40) return '#22c55e';
  if (speedKmh < 60) return '#f97316';
  return '#ef4444';
}

export interface LatLngSegment {
  positions: [number, number][];
  color: string;
}

/** One polyline per color run; each edge P_{i-1}→P_i is colored by speed at P_i. */
export function buildSpeedColoredSegments(points: (GpsRoutePoint & { latitude: number; longitude: number })[]): LatLngSegment[] {
  if (points.length < 2) return [];
  const out: LatLngSegment[] = [];
  let run: [number, number][] = [[points[0].latitude, points[0].longitude]];
  let color = speedSegmentColor(Number(points[1].speed ?? 0));

  for (let i = 1; i < points.length; i++) {
    run.push([points[i].latitude, points[i].longitude]);
    const nextColor =
      i + 1 < points.length ? speedSegmentColor(Number(points[i + 1].speed ?? 0)) : null;
    if (nextColor != null && nextColor !== color) {
      out.push({ positions: [...run], color });
      run = [[points[i].latitude, points[i].longitude]];
      color = nextColor;
    }
  }
  if (run.length >= 2) out.push({ positions: run, color });
  return out;
}

function isHaltPoint(p: GpsRoutePoint): boolean {
  const st = String(p.status ?? '').toUpperCase();
  if (st === 'HALTED' || st === 'LONG_HALT') return true;
  if (st === 'MOVING') return false;
  const sp = Number(p.speed ?? 0);
  return sp < 1;
}

export interface HaltEvent {
  startMs: number;
  endMs: number;
  durationMs: number;
  lat: number;
  lng: number;
  location: string;
  startIndex: number;
  endIndex: number;
}

const HALT_MIN_MS = 2 * 60 * 1000;
const CLUSTER_KM = 0.1; // 100 m

/** Group consecutive halt pings; merge if centroid stays within ~100m and duration ≥ 2 min. */
export function detectHaltEvents(
  points: (GpsRoutePoint & { latitude: number; longitude: number })[]
): HaltEvent[] {
  if (points.length === 0) return [];
  const events: HaltEvent[] = [];
  let i = 0;
  while (i < points.length) {
    if (!isHaltPoint(points[i])) {
      i++;
      continue;
    }
    const startIdx = i;
    let j = i;
    let sumLat = points[i].latitude;
    let sumLng = points[i].longitude;
    let count = 1;
    while (j + 1 < points.length && isHaltPoint(points[j + 1])) {
      const next = points[j + 1];
      const distFromStart = haversineKm(points[startIdx].latitude, points[startIdx].longitude, next.latitude, next.longitude);
      if (distFromStart > CLUSTER_KM * 3) break;
      j++;
      sumLat += next.latitude;
      sumLng += next.longitude;
      count++;
    }
    const t0 = pointTimeMs(points[startIdx]);
    const t1 = pointTimeMs(points[j]);
    const durationMs = Math.max(0, t1 - t0);
    if (durationMs >= HALT_MIN_MS) {
      events.push({
        startMs: t0,
        endMs: t1,
        durationMs,
        lat: sumLat / count,
        lng: sumLng / count,
        location: points.slice(startIdx, j + 1).find((p) => p.location)?.location || '—',
        startIndex: startIdx,
        endIndex: j,
      });
    }
    i = j + 1;
  }
  return events;
}

export interface RouteSummary {
  distanceKm: number;
  durationLabel: string;
  maxSpeed: number;
  avgSpeedMoving: number;
  stops: number;
  avgTemp: number | null;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

export function computeRouteSummary(
  points: (GpsRoutePoint & { latitude: number; longitude: number })[],
  haltEvents: HaltEvent[]
): RouteSummary {
  let dist = 0;
  for (let i = 1; i < points.length; i++) {
    dist += haversineKm(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
  }
  const t0 = pointTimeMs(points[0]);
  const t1 = pointTimeMs(points[points.length - 1]);
  const durMs = Math.max(0, t1 - t0);

  let maxS = 0;
  const movingSpeeds: number[] = [];
  const temps: number[] = [];
  for (const p of points) {
    const s = Number(p.speed ?? 0);
    if (s > maxS) maxS = s;
    const st = String(p.status ?? '').toUpperCase();
    if (st === 'MOVING' && s > 0) movingSpeeds.push(s);
    if (p.temperature != null && !Number.isNaN(Number(p.temperature))) temps.push(Number(p.temperature));
  }
  const avgMoving =
    movingSpeeds.length > 0 ? movingSpeeds.reduce((a, b) => a + b, 0) / movingSpeeds.length : 0;
  const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null;

  return {
    distanceKm: dist,
    durationLabel: formatDuration(durMs),
    maxSpeed: maxS,
    avgSpeedMoving: avgMoving,
    stops: haltEvents.length,
    avgTemp,
  };
}

export interface OverspeedPoint {
  index: number;
  speed: number;
  lat: number;
  lng: number;
  location: string;
  timeMs: number;
}

export function detectOverspeed(
  points: (GpsRoutePoint & { latitude: number; longitude: number })[],
  limitKmh = 60
): OverspeedPoint[] {
  const out: OverspeedPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const s = Number(points[i].speed ?? 0);
    if (s > limitKmh) {
      out.push({
        index: i,
        speed: s,
        lat: points[i].latitude,
        lng: points[i].longitude,
        location: points[i].location || '—',
        timeMs: pointTimeMs(points[i]),
      });
    }
  }
  return out;
}

export interface ChartPoint {
  index: number;
  timeLabel: string;
  speed: number;
  temp: number | null;
  timeMs: number;
}

export function buildChartSeries(
  points: (GpsRoutePoint & { latitude: number; longitude: number })[],
  maxPoints = 200
): ChartPoint[] {
  if (points.length === 0) return [];
  if (points.length <= maxPoints) {
    return points.map((p, index) => ({
      index,
      timeLabel: formatChartTime(pointTimeMs(p)),
      speed: Number(p.speed ?? 0),
      temp: p.temperature != null ? Number(p.temperature) : null,
      timeMs: pointTimeMs(p),
    }));
  }
  const step = Math.ceil(points.length / maxPoints);
  const out: ChartPoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    const p = points[i];
    out.push({
      index: i,
      timeLabel: formatChartTime(pointTimeMs(p)),
      speed: Number(p.speed ?? 0),
      temp: p.temperature != null ? Number(p.temperature) : null,
      timeMs: pointTimeMs(p),
    });
  }
  const last = points.length - 1;
  if (out[out.length - 1]?.index !== last) {
    const p = points[last];
    out.push({
      index: last,
      timeLabel: formatChartTime(pointTimeMs(p)),
      speed: Number(p.speed ?? 0),
      temp: p.temperature != null ? Number(p.temperature) : null,
      timeMs: pointTimeMs(p),
    });
  }
  return out;
}

function formatChartTime(ms: number): string {
  if (!ms) return '—';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(ms));
}

export function haltSeverityClass(durationMs: number): 'long' | 'medium' | 'short' {
  const m = durationMs / 60000;
  if (m >= 15) return 'long';
  if (m >= 5) return 'medium';
  return 'short';
}
