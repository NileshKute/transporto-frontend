'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { buildTruckMarkerDivIcon } from './truckIcons';

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

function shareStatusPulseColor(status: string): string {
  switch (status) {
    case 'MOVING':
      return '#22c55e';
    case 'HALTED':
      return '#ef4444';
    case 'LONG_HALT':
      return '#f97316';
    default:
      return '#94a3b8';
  }
}

function createShareMarkerIcon(
  status: string,
  options: {
    iconType?: string;
    direction?: number | null;
    temperature?: number | null;
    speed?: number | null;
  }
): L.DivIcon {
  const st = status || 'OFFLINE';
  const t = options.temperature != null ? Number(options.temperature) : NaN;
  const spd = options.speed != null ? Number(options.speed) : NaN;
  const pulse = shareStatusPulseColor(st);

  const tempBadge =
    options.temperature != null && !Number.isNaN(t)
      ? `<div style="position:absolute;top:-4px;right:-8px;z-index:2;background:${t < 0 ? '#3b82f6' : t < 10 ? '#06b6d4' : '#ef4444'};color:#fff;font-size:8px;font-weight:700;padding:1px 3px;border-radius:6px;border:1px solid #fff;">${t.toFixed(0)}°</div>`
      : '';

  const speedBadge =
    st === 'MOVING' && !Number.isNaN(spd) && spd > 0
      ? `<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);z-index:2;background:#0D2847;color:#fff;font-size:7px;font-weight:600;padding:1px 3px;border-radius:4px;border:1px solid #fff;">${Math.round(spd)}</div>`
      : '';

  const pulseRing =
    st === 'MOVING'
      ? `<div style="position:absolute;top:2px;left:2px;width:52px;height:52px;border-radius:50%;background:${pulse}33;animation:pulse 2s infinite;pointer-events:none;z-index:0;"></div>`
      : '';

  return buildTruckMarkerDivIcon({
    iconType: options.iconType,
    status: st,
    direction: options.direction,
    badges: { tempHtml: tempBadge, speedHtml: speedBadge, pulseRingHtml: pulseRing },
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
  iconType,
  regNumber,
  speed,
  temperature,
  location,
}: {
  latitude: number | null;
  longitude: number | null;
  status: string;
  direction?: number | null;
  iconType?: string;
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
        iconType,
        direction,
        temperature,
        speed,
      }),
    [status, iconType, direction, temperature, speed]
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
