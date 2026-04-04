'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { vehicleReg as reg, type GpsVehicle } from './types';

function markerColor(status: string | undefined): string {
  switch (status) {
    case 'MOVING':
      return '#22c55e';
    case 'HALTED':
    case 'LONG_HALT':
      return '#ef4444';
    case 'OFFLINE':
      return '#9ca3af';
    case 'IDLE':
      return '#f97316';
    default:
      return '#6b7280';
  }
}

function makeStatusIcon(status: string | undefined): L.DivIcon {
  const color = markerColor(status);
  return L.divIcon({
    className: 'gps-leaflet-marker',
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -8],
  });
}

function fixLeafletDefaultIcons() {
  // Leaflet 1.x default icon paths break under bundlers; merge CDN URLs.
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
}: {
  vehicles: GpsVehicle[];
  selectedVehicle: GpsVehicle | null;
  onMarkerClick: (v: GpsVehicle) => void;
}) {
  useEffect(() => {
    fixLeafletDefaultIcons();
  }, []);

  const selectedReg = selectedVehicle ? reg(selectedVehicle) : null;

  const mappable = useMemo(
    () => vehicles.filter((v) => validCoord(v.latitude, v.longitude)),
    [vehicles]
  );

  const tempClass = (t: number) => {
    if (t < 0) return 'text-blue-600';
    if (t > 10) return 'text-red-600';
    return 'text-green-600';
  };

  return (
    <MapContainer
      center={[19.05, 73.1]}
      zoom={10}
      className="h-full w-full z-0"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewSync vehicles={vehicles} selectedReg={selectedReg} />
      {mappable.map((v) => (
        <Marker
          key={reg(v)}
          position={[v.latitude as number, v.longitude as number]}
          icon={makeStatusIcon(v.status)}
          eventHandlers={{
            click: () => onMarkerClick(v),
          }}
        >
          <Popup>
            <div className="min-w-[200px] text-sm font-['Rajdhani'] text-[#0D2847]">
              <p className="font-bold">{reg(v)}</p>
              <p className="text-xs mt-1">
                Speed: <span className="font-medium">{v.speed ?? '—'} km/h</span>
              </p>
              {v.temperature != null && (
                <p className="text-xs">
                  Temp:{' '}
                  <span className={`font-medium ${tempClass(Number(v.temperature))}`}>
                    {v.temperature}°C
                  </span>
                </p>
              )}
              <p className="text-xs">
                Status: <span className="font-medium">{v.status ?? '—'}</span>
              </p>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{v.location || '—'}</p>
              {v.status === 'MOVING' && v.movingSince && (
                <p className="text-xs text-gray-500 mt-1">Moving: {v.movingSince}</p>
              )}
              {(v.status === 'HALTED' || v.status === 'LONG_HALT') && v.haltedSince && (
                <p className="text-xs text-gray-500 mt-1">Halted: {v.haltedSince}</p>
              )}
              {v.acOn != null && (
                <p className="text-xs mt-1">AC: {v.acOn ? 'On' : 'Off'}</p>
              )}
              {v.ignitionOn != null && (
                <p className="text-xs">Ignition: {v.ignitionOn ? 'On' : 'Off'}</p>
              )}
              {v.doorOpen != null && (
                <p className="text-xs">Door: {v.doorOpen ? 'Open' : 'Closed'}</p>
              )}
              {v.lastUpdated && (
                <p className="text-[10px] text-gray-400 mt-1">Updated: {v.lastUpdated}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
