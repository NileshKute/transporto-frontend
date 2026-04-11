'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = L.Icon.Default.prototype as any;
  if (proto._getIconUrl) delete proto._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 1) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 15 });
  }, [map, positions]);
  return null;
}

const startIcon = L.divIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#16A34A;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
/** End / latest position */
const endCurrentIcon = L.divIcon({
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#1565C0;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export type GpsPathPoint = { lat: number; lng: number; recordedAt?: string };

export function VehicleGpsPathMap({ points }: { points: GpsPathPoint[] }) {
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  const positions = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points],
  );

  const center = positions[0] ?? [19.076, 72.8777];
  const start = positions[0];
  const last = positions[positions.length - 1];

  if (!points.length) {
    return (
      <div className="h-[320px] rounded-xl border border-[#E0E8F0] bg-[#F4F6F8] flex items-center justify-center text-sm text-[#7A9AB8] font-['Rajdhani']">
        No GPS points in the last 7 days
      </div>
    );
  }

  return (
    <div className="h-[360px] rounded-xl border border-[#E0E8F0] overflow-hidden z-0">
      <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {positions.length >= 2 && (
          <Polyline positions={positions} pathOptions={{ color: '#1565C0', weight: 4, opacity: 0.85 }} />
        )}
        {positions.length === 1 ? (
          <Marker position={start} icon={endCurrentIcon} />
        ) : (
          <>
            <Marker position={start} icon={startIcon} />
            <Marker position={last} icon={endCurrentIcon} />
          </>
        )}
        <FitBounds positions={positions} />
        <ZoomControl position="bottomright" />
      </MapContainer>
    </div>
  );
}
