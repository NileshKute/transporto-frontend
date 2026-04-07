import api from '@/lib/api';

/** Paths are relative to NEXT_PUBLIC_API_URL (includes `/api`). */
export const quotationsApi = {
  list: (filters?: Record<string, unknown>) => api.get('/quotations', { params: filters }),
  get: (id: string) => api.get(`/quotations/${id}`),
  create: (data: unknown) => api.post('/quotations', data),
  update: (id: string, data: unknown) => api.put(`/quotations/${id}`, data),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/quotations/${id}/status`, { status, notes }),
  convertToInvoice: (id: string, payload?: unknown) =>
    api.post(`/quotations/${id}/convert-to-invoice`, payload ?? {}),
  delete: (id: string) => api.delete(`/quotations/${id}`),
  downloadPdf: (id: string) => api.get(`/quotations/${id}/pdf`, { responseType: 'blob' }),
  getStats: () => api.get('/quotations/stats'),
  import: (data: unknown) => api.post('/quotations/import', data),
};
