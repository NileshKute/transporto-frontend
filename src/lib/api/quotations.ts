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
  /** Sends JSON as multipart `file` (Blob) for backends that expect multipart upload. */
  import: async (jsonData: unknown) => {
    const jsonString = JSON.stringify(jsonData);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', blob, 'quotations_import.json');
    return api.post('/quotations/import', formData);
  },
  /** Sends the user-selected file as multipart `file` (raw upload, no client-side parse). */
  importFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/quotations/import', formData);
  },
};
