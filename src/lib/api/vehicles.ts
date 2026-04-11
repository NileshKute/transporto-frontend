import api from '@/lib/api';

export type VehicleGpsHistoryPoint = {
  latitude: number;
  longitude: number;
  speed: number | null;
  recordedAt: string;
};

export type VehicleGpsHistoryResponse = {
  hours: number;
  since: string;
  points: VehicleGpsHistoryPoint[];
};

export const vehiclesApi = {
  get: (id: string) => api.get(`/vehicles/${id}`),

  getSummary: (id: string) => api.get(`/vehicles/${id}/summary`),

  getTrips: (id: string, params?: { page?: number; limit?: number }) =>
    api.get(`/vehicles/${id}/trips`, { params }),

  getFuelTransactions: (id: string, params?: { page?: number; limit?: number }) =>
    api.get(`/vehicles/${id}/fuel-transactions`, { params }),

  getTollTransactions: (id: string, params?: { page?: number; limit?: number }) =>
    api.get(`/vehicles/${id}/toll-transactions`, { params }),

  getMaintenanceHistory: (id: string, params?: { page?: number; limit?: number }) =>
    api.get(`/vehicles/${id}/maintenance-history`, { params }),

  getGpsHistory: (id: string, params?: { hours?: number }) =>
    api.get<VehicleGpsHistoryResponse>(`/vehicles/${id}/gps-history`, { params }),
};
