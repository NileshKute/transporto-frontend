'use client';

import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapThemes, type MapThemeKey } from './mapThemes';
import { buildTruckMarkerDivIcon } from './truckIcons';
import {
  buildSpeedColoredSegments,
  type GpsRoutePoint,
  type HaltEvent,
  type OverspeedPoint,
} from './routeHistoryUtils';

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

function startEndIcon(kind: 'start' | 'end', timeLabel: string): L.DivIcon {
  const color = kind === 'start' ? '#22c55e' : '#b91c1c';
  const label = kind === 'start' ? 'Start' : 'End';
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="width:24px;height:24px;border-radius:50%;background:${color};color:#fff;font:bold 10px system-ui;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${kind === 'start' ? '▶' : '■'}</div>
      <span style="font:600 9px system-ui;color:#0D2847;background:#fff;padding:1px 4px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.2);white-space:nowrap">${label} ${timeLabel}</span>
    </div>`,
    className: 'route-end-marker',
    iconSize: [72, 44],
    iconAnchor: [36, 22],
    popupAnchor: [0, -20],
  });
}

const overspeedIcon = L.divIcon({
  html: `<div style="font-size:14px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))">⚠️</div>`,
  className: 'route-warn-marker',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function FitBoundsEffect({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) return;
    const b = L.latLngBounds(positions);
    map.fitBounds(b, { padding: [48, 48], maxZoom: 14 });
  }, [map, positions]);
  return null;
}

function FlyToEffect({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], 15, { duration: 0.55 });
  }, [map, target?.lat, target?.lng]);
  return null;
}

export function RouteHistoryMap({
  points,
  currentIndex,
  halts,
  overspeed,
  mapTheme,
  vehicleIconType,
  flyToTarget,
}: {
  points: (GpsRoutePoint & { latitude: number; longitude: number })[];
  currentIndex: number;
  halts: HaltEvent[];
  overspeed: OverspeedPoint[];
  mapTheme: MapThemeKey;
  vehicleIconType?: string;
  flyToTarget: { lat: number; lng: number } | null;
}) {
  useEffect(() => {
    fixLeafletDefaultIcons();
  }, []);

  const theme = mapThemes[mapTheme];

  const segments = useMemo(() => buildSpeedColoredSegments(points), [points]);

  const allPositions = useMemo(
    () => points.map((p) => [p.latitude, p.longitude] as [number, number]),
    [points]
  );

  const current = points[Math.min(Math.max(0, currentIndex), Math.max(0, points.length - 1))];
  const playbackIcon = useMemo(() => {
    if (!current) return null;
    return buildTruckMarkerDivIcon({
      iconType: vehicleIconType,
      status: String(current.status || 'MOVING'),
      direction: current.direction,
      badges: {},
    });
  }, [current, vehicleIconType]);

  const startTimeLabel = useMemo(() => {
    if (!points[0]) return '';
    const ms = new Date(points[0].deviceTimestamp || points[0].recordedAt || 0).getTime();
    if (Number.isNaN(ms)) return '';
    return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(
      new Date(ms)
    );
  }, [points]);

  const endTimeLabel = useMemo(() => {
    const last = points[points.length - 1];
    if (!last) return '';
    const ms = new Date(last.deviceTimestamp || last.recordedAt || 0).getTime();
    if (Number.isNaN(ms)) return '';
    return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(
      new Date(ms)
    );
  }, [points]);

  const startIcon = useMemo(() => startEndIcon('start', startTimeLabel), [startTimeLabel]);
  const endIcon = useMemo(() => startEndIcon('end', endTimeLabel), [endTimeLabel]);

  if (points.length === 0) {
    return (
      <div className="h-full min-h-[280px] flex items-center justify-center bg-[#E8EEF4] text-[#7A9AB8] text-sm font-['Rajdhani']">
        Load a route to see the map
      </div>
    );
  }

  const center = allPositions[0] ?? [19.05, 73.1];

  return (
    <MapContainer center={center} zoom={11} className="h-full w-full z-0 min-h-[280px]" scrollWheelZoom>
      <TileLayer key={mapTheme} attribution={theme.attribution} url={theme.url} />
      <ZoomControl position="bottomleft" />
      <FitBoundsEffect positions={allPositions} />
      <FlyToEffect target={flyToTarget} />

      {segments.map((seg, i) => (
        <Polyline
          key={`seg-${i}`}
          positions={seg.positions}
          pathOptions={{ color: seg.color, weight: 4, opacity: 0.82 }}
        />
      ))}

      {halts.map((h, i) => (
        <CircleMarker
          key={`halt-${i}`}
          center={[h.lat, h.lng]}
          radius={8}
          pathOptions={{ color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.85, weight: 2 }}
        >
          <Popup>
            <div className="text-sm font-['Rajdhani'] min-w-[180px]">
              <p className="font-bold text-[#0D2847]">Halt</p>
              <p className="text-gray-600 mt-1">
                {new Date(h.startMs).toLocaleString('en-IN', { hour12: true })} –{' '}
                {new Date(h.endMs).toLocaleString('en-IN', { hour12: true })}
              </p>
              <p className="text-gray-700 mt-1">{Math.round(h.durationMs / 60000)} min</p>
              <p className="text-gray-500 text-xs mt-1">{h.location}</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {overspeed.map((o, i) => (
        <Marker key={`os-${i}`} position={[o.lat, o.lng]} icon={overspeedIcon}>
          <Popup>
            <div className="text-sm font-['Rajdhani']">
              <p className="font-bold text-orange-700">Overspeed</p>
              <p>{Math.round(o.speed)} km/h</p>
              <p className="text-xs text-gray-500">{o.location}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {points.length > 0 && (
        <Marker position={[points[0].latitude, points[0].longitude]} icon={startIcon} />
      )}
      {points.length > 1 && (
        <Marker
          position={[points[points.length - 1].latitude, points[points.length - 1].longitude]}
          icon={endIcon}
        />
      )}

      {current && playbackIcon && (
        <Marker
          key={`pb-${currentIndex}-${current.latitude}-${current.longitude}`}
          position={[current.latitude, current.longitude]}
          icon={playbackIcon}
        />
      )}
    </MapContainer>
  );
}
