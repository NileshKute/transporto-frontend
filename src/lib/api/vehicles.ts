import api from '@/lib/api';

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

  getGpsHistory: (id: string) => api.get(`/vehicles/${id}/gps-history`),
};
