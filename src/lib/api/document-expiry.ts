import api from '@/lib/api';

export const documentExpiryApi = {
  getAlerts: (params?: {
    severity?: string;
    entityType?: string;
    acknowledged?: string;
    page?: number;
    limit?: number;
  }) => api.get<unknown>('/document-expiry/alerts', { params }),

  getSummary: () => api.get<unknown>('/document-expiry/summary'),

  acknowledge: (id: string) => api.post<unknown>(`/document-expiry/acknowledge/${encodeURIComponent(id)}`),

  unacknowledge: (id: string) =>
    api.post<unknown>(`/document-expiry/unacknowledge/${encodeURIComponent(id)}`),

  acknowledgeAll: () => api.post<unknown>('/document-expiry/acknowledge-all'),

  runCheck: () => api.post<unknown>('/document-expiry/check-now'),
};
