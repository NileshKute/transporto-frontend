import api from '@/lib/api';

/** Query params for `GET /toll/transactions` (paths relative to `NEXT_PUBLIC_API_URL`, which includes `/api`). */
export interface TollTransactionsParams {
  vehicleId?: string;
  /** Comma-separated registration numbers (preferred for multi-select). */
  vehicleNumber?: string;
  from?: string;
  to?: string;
  startDate?: string;
  endDate?: string;
  plaza?: string;
  plazaCode?: string;
  type?: string;
  txnType?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export const tollApi = {
  getSummary: () => api.get<unknown>('/toll/summary'),

  getTransactions: (params?: TollTransactionsParams) =>
    api.get<unknown>('/toll/transactions', { params }),

  getByVehicle: () => api.get<unknown>('/toll/by-vehicle'),

  getByPlaza: () => api.get<unknown>('/toll/by-plaza'),

  getByMonth: () => api.get<unknown>('/toll/by-month'),

  getImportHistory: () => api.get<unknown>('/toll/import-history'),

  deleteBatch: (id: string) =>
    api.delete<unknown>(`/toll/batch/${encodeURIComponent(id)}`),

  /**
   * `POST /toll/import` — multipart field name `file`.
   * Optional upload progress 0–100 for the request body upload.
   */
  importExcel: (file: File, onProgress?: (percent: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<unknown>('/toll/import', formData, {
      timeout: 120_000,
      onUploadProgress: (ev) => {
        if (ev.total != null && ev.total > 0 && onProgress) {
          onProgress(Math.round((ev.loaded * 100) / ev.total));
        }
      },
    });
  },
};
