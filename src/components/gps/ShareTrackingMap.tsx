'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { buildCleanMarkerDivIcon } from './truckIcons';

const DEFAULT_CENTER: [number, number] = [19.033, 73.0297];
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

/** Popup only — not used in divIcon marker HTML. */
function ShareTrackPopupBody({
  regNumber,
  speed,
  temperature,
  status,
  location,
}: {
  regNumber: string;
  speed: number;
  temperature: number | null;
  status: string;
  location: string;
}) {
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

  return (
    <div style={{ minWidth: 200, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
      <p style={{ fontWeight: 700, color: '#0D2847', margin: '0 0 6px' }}>{regNumber}</p>
      <p style={{ margin: '4px 0', color: '#475569' }}>
        Speed: <strong>{Math.round(speed)} km/h</strong>
      </p>
      <p style={{ margin: '4px 0', color: '#475569' }}>
        Temp:{' '}
        <strong style={{ color: tempColor }}>{tempStr}</strong>
      </p>
      <p style={{ margin: '4px 0', color: '#475569' }}>
        Status: <strong>{status}</strong>
      </p>
      {location ? (
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 12 }}>{location}</p>
      ) : null}
    </div>
  );
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

/** Marker only: arrow + body + reg (no speed/temp/AC). */
function createShareMarkerIcon(args: {
  status: string;
  iconType?: string;
  direction?: number | null;
  regNumber: string;
}): L.DivIcon {
  return buildCleanMarkerDivIcon({
    iconType: args.iconType,
    status: args.status || 'OFFLINE',
    direction: args.direction,
    mapRegLabel: args.regNumber,
  });
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
      createShareMarkerIcon({
        status: status || 'OFFLINE',
        iconType,
        direction,
        regNumber,
      }),
    [status, iconType, direction, regNumber]
  );

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
            <ShareTrackPopupBody
              regNumber={regNumber}
              speed={speed}
              temperature={temperature}
              status={status || '—'}
              location={location}
            />
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
