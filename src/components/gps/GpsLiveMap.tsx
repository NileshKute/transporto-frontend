'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { vehicleReg as reg, type GpsVehicle } from './types';
import { mapThemes, type MapThemeKey } from './mapThemes';
import { buildCleanMarkerDivIcon } from './truckIcons';

/** Popup panel only — never mixed into Leaflet divIcon / marker HTML. */
function GpsVehiclePopupBody({ vehicle }: { vehicle: GpsVehicle }) {
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

  const regLabel = vehicle.regNumber || vehicle.registrationNumber || '—';

  let lastLine: ReactNode = null;
  if (vehicle.lastUpdated) {
    const d = new Date(vehicle.lastUpdated);
    const shown = Number.isNaN(d.getTime()) ? String(vehicle.lastUpdated) : d.toLocaleTimeString('en-IN');
    lastLine = (
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 8, textAlign: 'right' }}>Updated: {shown}</div>
    );
  }

  return (
    <div style={{ minWidth: 240, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: statusColor,
            ...(st === 'MOVING' ? { animation: 'pulse 2s infinite' } : {}),
          }}
        />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#0D2847' }}>{regLabel}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 10,
            background: `${statusColor}20`,
            color: statusColor,
          }}
        >
          {st}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Speed</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0D2847' }}>
            {Math.round(Number(vehicle.speed) || 0)}
            <span style={{ fontSize: 10, fontWeight: 400 }}> km/h</span>
          </div>
        </div>
        <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Temperature</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: tempColor }}>{temp}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
        {vehicle.location ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ color: '#94a3b8' }}>Location:</span> {vehicle.location}
          </div>
        ) : null}
        {vehicle.movingSince && st === 'MOVING' ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ color: '#94a3b8' }}>Moving:</span> {vehicle.movingSince}
          </div>
        ) : null}
        {vehicle.haltedSince && (st === 'HALTED' || st === 'LONG_HALT') ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ color: '#94a3b8' }}>Halted:</span> {vehicle.haltedSince}
          </div>
        ) : null}
        {vehicle.noDataSince && st === 'OFFLINE' ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ color: '#94a3b8' }}>Offline:</span> {vehicle.noDataSince}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
        {vehicle.acOn ? (
          <span
            style={{
              fontSize: 10,
              background: '#ecfeff',
              color: '#0891b2',
              padding: '2px 8px',
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            AC ON
          </span>
        ) : null}
        {vehicle.ignitionOn ? (
          <span
            style={{
              fontSize: 10,
              background: '#f0fdf4',
              color: '#16a34a',
              padding: '2px 8px',
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            IGN ON
          </span>
        ) : null}
        {vehicle.doorOpen ? (
          <span
            style={{
              fontSize: 10,
              background: '#fef2f2',
              color: '#dc2626',
              padding: '2px 8px',
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            DOOR OPEN
          </span>
        ) : null}
      </div>

      {lastLine}
    </div>
  );
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
            <GpsVehiclePopupBody vehicle={v} />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
