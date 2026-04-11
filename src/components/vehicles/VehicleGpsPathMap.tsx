'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
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

function FitBounds({ pathCoords }: { pathCoords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pathCoords.length < 1) return;
    if (pathCoords.length === 1) {
      map.setView(pathCoords[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(pathCoords), { padding: [40, 40], maxZoom: 15 });
  }, [map, pathCoords]);
  return null;
}

const startIcon = L.divIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#16A34A;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
/** End / current position */
const endCurrentIcon = L.divIcon({
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#1565C0;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export type GpsPathPointInput = {
  latitude?: number;
  longitude?: number;
  recordedAt?: string;
  speed?: number | null;
};

type ValidGpsPoint = {
  latitude: number;
  longitude: number;
  recordedAt?: string;
  speed?: number | null;
};

function filterValidPoints(points: GpsPathPointInput[] | null | undefined): ValidGpsPoint[] {
  return (points ?? []).filter(
    (p): p is ValidGpsPoint =>
      p != null &&
      typeof p.latitude === 'number' &&
      typeof p.longitude === 'number' &&
      !Number.isNaN(p.latitude) &&
      !Number.isNaN(p.longitude) &&
      p.latitude >= -90 &&
      p.latitude <= 90 &&
      p.longitude >= -180 &&
      p.longitude <= 180,
  );
}

export function VehicleGpsPathMap({ points }: { points: GpsPathPointInput[] }) {
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  const validPoints = useMemo(() => filterValidPoints(points), [points]);
  const pathCoords: [number, number][] = useMemo(
    () => validPoints.map((p) => [p.latitude, p.longitude]),
    [validPoints],
  );

  const center = pathCoords[0] ?? [19.076, 72.8777];
  const start = pathCoords[0];
  const last = pathCoords[pathCoords.length - 1];

  if (validPoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500 rounded-xl border border-[#E0E8F0] bg-[#F4F6F8]">
        <MapPin className="w-12 h-12 mb-2 opacity-40" />
        <p className="text-sm">No GPS history available for this vehicle</p>
        <p className="text-xs mt-1">GPS data appears when the tracker sends location updates</p>
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
        {pathCoords.length >= 2 && (
          <Polyline positions={pathCoords} pathOptions={{ color: '#1565C0', weight: 4, opacity: 0.85 }} />
        )}
        {pathCoords.length === 1 ? (
          <Marker position={start} icon={endCurrentIcon} />
        ) : (
          <>
            <Marker position={start} icon={startIcon} />
            <Marker position={last} icon={endCurrentIcon} />
          </>
        )}
        <FitBounds pathCoords={pathCoords} />
        <ZoomControl position="bottomright" />
      </MapContainer>
    </div>
  );
}
