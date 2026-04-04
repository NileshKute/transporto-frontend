export type GpsVehicleStatus = 'MOVING' | 'HALTED' | 'LONG_HALT' | 'OFFLINE' | 'IDLE';

export function vehicleReg(v: GpsVehicle): string {
  return String(v.regNumber ?? v.registrationNumber ?? 'Unknown');
}

export interface GpsVehicle {
  regNumber?: string;
  registrationNumber?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  temperature?: number | null;
  status?: GpsVehicleStatus | string;
  location?: string;
  movingSince?: string;
  haltedSince?: string;
  noDataSince?: string;
  acOn?: boolean;
  ignitionOn?: boolean;
  doorOpen?: boolean;
  lastUpdated?: string;
}
