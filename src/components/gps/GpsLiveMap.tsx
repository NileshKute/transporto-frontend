'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { vehicleReg as reg, type GpsVehicle } from './types';
import { mapThemes, type MapThemeKey } from './mapThemes';
import { buildCleanMarkerDivIcon } from './truckIcons';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Leaflet marker: direction arrow + status-colored body + reg label only (no speed/temp/AC). */
function createLiveVehicleIcon(args: {
  iconType: GpsVehicle['iconType'];
  status: GpsVehicle['status'];
  direction: GpsVehicle['direction'];
  mapRegLabel: string;
}): L.DivIcon {
  return buildCleanMarkerDivIcon({
    iconType: args.iconType,
    status: String(args.status || 'UNKNOWN'),
    direction: args.direction,
    mapRegLabel: args.mapRegLabel,
  });
}

function createPopupContent(vehicle: GpsVehicle): string {
  const statusColors: Record<string, string> = {
    MOVING: '#22c55e',
    HALTED: '#ef4444',
    LONG_HALT: '#dc2626',
    IDLE: '#f59e0b',
    OFFLINE: '#9ca3af',
  };

  const st = String(vehicle.status ?? 'UNKNOWN');
  const statusColor = statusColors[st] || '#6b7280';
  const tempNum = vehicle.temperature != null ? Number(vehicle.temperature) : NaN;
  const temp =
    vehicle.temperature != null && !Number.isNaN(tempNum) ? `${tempNum.toFixed(1)}°C` : 'N/A';
  const tempColor =
    vehicle.temperature != null && !Number.isNaN(tempNum)
      ? tempNum < 0
        ? '#3b82f6'
        : tempNum < 10
          ? '#06b6d4'
          : '#ef4444'
      : '#6b7280';

  const regLabel = escapeHtml(vehicle.regNumber || vehicle.registrationNumber || '—');
  const pulseStyle = st === 'MOVING' ? 'animation:pulse 2s infinite;' : '';

  let lastLine = '';
  if (vehicle.lastUpdated) {
    const d = new Date(vehicle.lastUpdated);
    const shown = Number.isNaN(d.getTime())
      ? escapeHtml(String(vehicle.lastUpdated))
      : d.toLocaleTimeString('en-IN');
    lastLine = `<div style="font-size:10px;color:#94a3b8;margin-top:8px;text-align:right;">Updated: ${shown}</div>`;
  }

  return `
    <div style="min-width:240px;font-family:system-ui,-apple-system,sans-serif;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${statusColor};${pulseStyle}"></div>
        <span style="font-weight:700;font-size:15px;color:#0D2847;">${regLabel}</span>
        <span style="margin-left:auto;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;background:${statusColor}20;color:${statusColor};">${escapeHtml(st)}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;text-align:center;">
          <div style="font-size:10px;color:#64748b;margin-bottom:2px;">Speed</div>
          <div style="font-size:16px;font-weight:700;color:#0D2847;">${Math.round(Number(vehicle.speed) || 0)}<span style="font-size:10px;font-weight:400;"> km/h</span></div>
        </div>
        <div style="background:#f0f9ff;border-radius:8px;padding:8px 10px;text-align:center;">
          <div style="font-size:10px;color:#64748b;margin-bottom:2px;">Temperature</div>
          <div style="font-size:16px;font-weight:700;color:${tempColor};">${temp}</div>
        </div>
      </div>

      <div style="font-size:12px;color:#475569;line-height:1.6;">
        ${vehicle.location ? `<div style="display:flex;gap:6px;"><span style="color:#94a3b8;">Location:</span> ${escapeHtml(vehicle.location)}</div>` : ''}
        ${vehicle.movingSince && st === 'MOVING' ? `<div style="display:flex;gap:6px;"><span style="color:#94a3b8;">Moving:</span> ${escapeHtml(vehicle.movingSince)}</div>` : ''}
        ${vehicle.haltedSince && (st === 'HALTED' || st === 'LONG_HALT') ? `<div style="display:flex;gap:6px;"><span style="color:#94a3b8;">Halted:</span> ${escapeHtml(vehicle.haltedSince)}</div>` : ''}
        ${vehicle.noDataSince && st === 'OFFLINE' ? `<div style="display:flex;gap:6px;"><span style="color:#94a3b8;">Offline:</span> ${escapeHtml(vehicle.noDataSince)}</div>` : ''}
      </div>

      <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;">
        ${vehicle.acOn ? '<span style="font-size:10px;background:#ecfeff;color:#0891b2;padding:2px 8px;border-radius:10px;font-weight:600;">AC ON</span>' : ''}
        ${vehicle.ignitionOn ? '<span style="font-size:10px;background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:10px;font-weight:600;">IGN ON</span>' : ''}
        ${vehicle.doorOpen ? '<span style="font-size:10px;background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:10px;font-weight:600;">DOOR OPEN</span>' : ''}
      </div>

      ${lastLine}
    </div>
  `;
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

function validCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function MapViewSync({
  vehicles,
  selectedReg,
}: {
  vehicles: GpsVehicle[];
  selectedReg: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    const pts = vehicles.filter((v) => validCoord(v.latitude, v.longitude));
    if (pts.length === 0) return;

    if (selectedReg) {
      const sel = pts.find((v) => reg(v) === selectedReg);
      if (sel) {
        map.flyTo([sel.latitude as number, sel.longitude as number], 14);
        return;
      }
    }

    if (pts.length === 1) {
      map.flyTo([pts[0].latitude as number, pts[0].longitude as number], 12);
      return;
    }
    const b = L.latLngBounds(pts.map((v) => [v.latitude as number, v.longitude as number] as [number, number]));
    map.fitBounds(b, { padding: [48, 48], maxZoom: 12 });
  }, [map, vehicles, selectedReg]);

  return null;
}

export function GpsLiveMap({
  vehicles,
  selectedVehicle,
  onMarkerClick,
  mapTheme,
}: {
  vehicles: GpsVehicle[];
  selectedVehicle: GpsVehicle | null;
  onMarkerClick: (v: GpsVehicle) => void;
  mapTheme: MapThemeKey;
}) {
  useEffect(() => {
    fixLeafletDefaultIcons();
  }, []);

  const selectedReg = selectedVehicle ? reg(selectedVehicle) : null;

  const mappable = useMemo(
    () => vehicles.filter((v) => validCoord(v.latitude, v.longitude)),
    [vehicles]
  );

  const theme = mapThemes[mapTheme];

  return (
    <MapContainer
      center={[19.05, 73.1]}
      zoom={10}
      className="h-full w-full z-0"
      scrollWheelZoom
    >
      <TileLayer key={mapTheme} attribution={theme.attribution} url={theme.url} />
      <ZoomControl position="bottomleft" />
      <MapViewSync vehicles={vehicles} selectedReg={selectedReg} />
      {mappable.map((v) => (
        <Marker
          key={`${reg(v)}-${v.iconType ?? ''}-${v.direction ?? ''}-${String(v.status)}`}
          position={[v.latitude as number, v.longitude as number]}
          icon={createLiveVehicleIcon({
            iconType: v.iconType,
            status: v.status,
            direction: v.direction,
            mapRegLabel: reg(v),
          })}
          eventHandlers={{
            click: () => onMarkerClick(v),
          }}
        >
          <Popup maxWidth={280} className="custom-popup" closeButton autoPan>
            <div dangerouslySetInnerHTML={{ __html: createPopupContent(v) }} />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
