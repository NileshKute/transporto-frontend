import api from '@/lib/api';

export type MetaContact = {
  id: string;
  waId: string;
  displayName?: string | null;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
  driverId?: string | null;
  clientId?: string | null;
  driver?: { id?: string; name?: string } | null;
  client?: { id?: string; name?: string } | null;
};

export type MetaMessage = {
  id: string;
  /** When true, message was sent by us (outbound). */
  fromMe?: boolean;
  direction?: 'INBOUND' | 'OUTBOUND' | string;
  type?: string;
  body?: string | null;
  text?: string | null;
  status?: string | null;
  createdAt?: string | null;
  timestamp?: string | null;
  mediaUrl?: string | null;
  mediaId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export const whatsappMetaApi = {
  getContacts: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<unknown>('/whatsapp/meta/contacts', { params }),

  getThread: (contactId: string, params?: { page?: number; limit?: number }) =>
    api.get<unknown>(`/whatsapp/meta/contacts/${encodeURIComponent(contactId)}/messages`, { params }),

  sendText: (to: string, text: string) =>
    api.post<unknown>('/whatsapp/meta/send-text', { to, text }),

  sendTemplate: (to: string, templateName: string, languageCode: string, components?: unknown) =>
    api.post<unknown>('/whatsapp/meta/send-template', { to, templateName, languageCode, components }),

  linkContact: (contactId: string, body: { driverId?: string | null; clientId?: string | null }) =>
    api.post<unknown>(`/whatsapp/meta/contacts/${encodeURIComponent(contactId)}/link`, body),
};

/** Normalize list from various API envelope shapes. */
export function extractArray<T>(body: unknown, keys: string[] = ['data', 'contacts', 'messages']): T[] {
  if (body == null) return [];
  if (Array.isArray(body)) return body as T[];
  if (typeof body !== 'object') return [];
  const o = body as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}
