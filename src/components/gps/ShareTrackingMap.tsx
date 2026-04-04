'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [19.033, 73.0297];
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fixLeafletDefaultIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = L.Icon.Default.prototype as any;
  if (proto._getIconUrl) delete proto._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

function statusStyle(status: string): { bg: string; border: string; text: string } {
  switch (status) {
    case 'MOVING':
      return { bg: '#22c55e', border: '#16a34a', text: '#fff' };
    case 'HALTED':
      return { bg: '#ef4444', border: '#dc2626', text: '#fff' };
    case 'LONG_HALT':
      return { bg: '#f97316', border: '#ea580c', text: '#fff' };
    case 'OFFLINE':
    case 'IDLE':
    default:
      return { bg: '#9ca3af', border: '#6b7280', text: '#fff' };
  }
}

function createShareMarkerIcon(
  status: string,
  options?: {
    direction?: number | null;
    temperature?: number | null;
    speed?: number | null;
  }
): L.DivIcon {
  const st = status || 'OFFLINE';
  const c = statusStyle(st);
  const t = options?.temperature != null ? Number(options.temperature) : NaN;
  const spd = options?.speed != null ? Number(options.speed) : NaN;
  const dir = options?.direction != null ? Number(options.direction) : NaN;
  const hasDir = !Number.isNaN(dir);

  const tempBadge =
    options?.temperature != null && !Number.isNaN(t)
      ? `<div style="position:absolute;top:-8px;right:-12px;background:${t < 0 ? '#3b82f6' : t < 10 ? '#06b6d4' : '#ef4444'};color:#fff;font-size:8px;font-weight:700;padding:1px 3px;border-radius:6px;border:1px solid #fff;">${t.toFixed(0)}°</div>`
      : '';

  const speedBadge =
    st === 'MOVING' && !Number.isNaN(spd) && spd > 0
      ? `<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);background:#0D2847;color:#fff;font-size:7px;font-weight:600;padding:1px 3px;border-radius:4px;border:1px solid #fff;">${Math.round(spd)}</div>`
      : '';

  const pulseRing =
    st === 'MOVING'
      ? `<div style="position:absolute;top:10px;left:-4px;width:40px;height:40px;border-radius:50%;background:${c.bg}33;animation:pulse 2s infinite;pointer-events:none;"></div>`
      : '';

  const arrowBlock = hasDir
    ? `<div style="position:absolute;top:0;left:50%;width:14px;height:14px;margin-left:-7px;display:flex;justify-content:center;transform:rotate(${dir}deg);transform-origin:50% 38px;pointer-events:none;">
         <svg width="12" height="12" viewBox="0 0 24 24" style="margin-top:2px;">
           <path fill="#0D2847" stroke="#fff" stroke-width="1" d="M12 3 L21 19 L12 15 L3 19 Z"/>
         </svg>
       </div>`
    : '';

  const html = `
    <div style="position:relative;width:32px;height:48px;">
      ${arrowBlock}
      ${pulseRing}
      <div style="position:absolute;bottom:0;left:0;width:32px;height:32px;background:${c.bg};border:2px solid ${c.border};border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c.text}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 3h15v13H1z"/>
          <path d="M16 8h4l3 3v5h-7V8z"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      </div>
      ${tempBadge}
      ${speedBadge}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-truck-marker',
    iconSize: [32, 48],
    iconAnchor: [16, 48],
    popupAnchor: [0, -48],
  });
}

function popupHtml(reg: string, speed: number, temp: string, tempColor: string, status: string, location: string) {
  return `
    <div style="min-width:200px;font-family:system-ui,sans-serif;font-size:13px;">
      <p style="font-weight:700;color:#0D2847;margin:0 0 6px;">${escapeHtml(reg)}</p>
      <p style="margin:4px 0;color:#475569;">Speed: <strong>${Math.round(speed)} km/h</strong></p>
      <p style="margin:4px 0;color:#475569;">Temp: <strong style="color:${tempColor}">${escapeHtml(temp)}</strong></p>
      <p style="margin:4px 0;color:#475569;">Status: <strong>${escapeHtml(status)}</strong></p>
      ${location ? `<p style="margin:6px 0 0;color:#64748b;font-size:12px;">${escapeHtml(location)}</p>` : ''}
    </div>
  `;
}

function MapViewController({
  targetCenter,
  targetZoom,
  hasPosition,
}: {
  targetCenter: [number, number];
  targetZoom: number;
  hasPosition: boolean;
}) {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!hasPosition) {
      map.setView(DEFAULT_CENTER, 12, { animate: false });
      prev.current = null;
      return;
    }
    const [lat, lng] = targetCenter;
    const p = prev.current;
    if (p && p[0] === lat && p[1] === lng) return;
    prev.current = [lat, lng];
    map.flyTo([lat, lng], targetZoom, { duration: 0.85 });
  }, [map, hasPosition, targetCenter[0], targetCenter[1], targetZoom]);

  return null;
}

export function ShareTrackingMap({
  latitude,
  longitude,
  status,
  direction,
  regNumber,
  speed,
  temperature,
  location,
}: {
  latitude: number | null;
  longitude: number | null;
  status: string;
  direction?: number | null;
  regNumber: string;
  speed: number;
  temperature: number | null;
  location: string;
}) {
  useEffect(() => {
    fixLeafletDefaultIcons();
  }, []);

  const hasPosition =
    latitude != null &&
    longitude != null &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  const center: [number, number] = useMemo(
    () => (hasPosition ? [latitude!, longitude!] : DEFAULT_CENTER),
    [hasPosition, latitude, longitude]
  );
  const zoom = hasPosition ? 14 : 12;

  const icon = useMemo(
    () =>
      createShareMarkerIcon(status || 'OFFLINE', {
        direction,
        temperature,
        speed,
      }),
    [status, direction, temperature, speed]
  );

  const tempStr =
    temperature != null && !Number.isNaN(Number(temperature)) ? `${Number(temperature).toFixed(1)}°C` : '—';
  const tempColor =
    temperature != null && !Number.isNaN(Number(temperature))
      ? Number(temperature) < 0
        ? '#2563eb'
        : Number(temperature) <= 10
          ? '#16a34a'
          : '#dc2626'
      : '#64748b';

  const popup = popupHtml(regNumber, speed, tempStr, tempColor, status || '—', location);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={12}
      className="h-full w-full z-0 min-h-[240px]"
      scrollWheelZoom
      style={{ minHeight: '100%' }}
    >
      <TileLayer attribution={TILE_ATTR} url={TILE_URL} />
      <ZoomControl position="bottomright" />
      <MapViewController targetCenter={center} targetZoom={zoom} hasPosition={hasPosition} />
      {hasPosition && (
        <Marker position={[latitude!, longitude!]} icon={icon}>
          <Popup className="custom-popup" closeButton autoPan>
            <div dangerouslySetInnerHTML={{ __html: popup }} />
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
