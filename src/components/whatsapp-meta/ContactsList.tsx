'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Search } from 'lucide-react';
import { whatsappMetaApi, extractArray, type MetaContact } from '@/lib/api/whatsapp-meta';

function initials(name: string | undefined | null, waId: string): string {
  const n = (name ?? '').trim();
  if (n.length >= 2) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const digits = waId.replace(/\D/g, '');
  return digits.slice(-2) || '??';
}

function formatListTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function normalizeContacts(body: unknown): MetaContact[] {
  const raw = extractArray<Record<string, unknown>>(body, ['data', 'contacts']);
  return raw.map((r) => ({
    id: String(r.id ?? ''),
    waId: String(r.waId ?? r.wa_id ?? ''),
    displayName: (r.displayName ?? r.display_name) as string | null | undefined,
    lastMessagePreview: (r.lastMessagePreview ?? r.last_message_preview) as string | null | undefined,
    lastMessageAt: (r.lastMessageAt ?? r.last_message_at) as string | null | undefined,
    driverId: (r.driverId ?? r.driver_id) as string | null | undefined,
    clientId: (r.clientId ?? r.client_id) as string | null | undefined,
    driver: (r.driver as MetaContact['driver']) ?? null,
    client: (r.client as MetaContact['client']) ?? null,
  }));
}

export function ContactsList({
  search,
  onSearchChange,
  selectedId,
  onSelect,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  selectedId: string | null;
  onSelect: (c: MetaContact) => void;
}) {
  const { data: contacts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['whatsapp-meta', 'contacts', search],
    queryFn: async () => {
      const r = await whatsappMetaApi.getContacts({
        search: search.trim() || undefined,
        page: 1,
        limit: 100,
      });
      return normalizeContacts(r.data);
    },
  });

  const sorted = useMemo(() => {
    return [...contacts].sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });
  }, [contacts]);

  return (
    <div className="flex flex-col h-full bg-white border-r border-[#E0E8F0] w-[320px] flex-shrink-0">
      <div className="p-4 border-b border-[#E0E8F0]">
        <h2 className="font-['Oswald'] text-lg font-bold text-[#0D2847] tracking-wide mb-3">WhatsApp Meta</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A9AB8]" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E0E8F0] text-sm text-[#0D2847] placeholder:text-[#7A9AB8] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 font-['Rajdhani']"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-[#E0E8F0] rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4 text-center text-sm text-red-600 font-['Rajdhani']">
            Failed to load contacts.
            <button
              type="button"
              onClick={() => void refetch()}
              className="block mx-auto mt-2 text-[#1565C0] underline"
            >
              Retry
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-[#7A9AB8]">
            <MessageCircle className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-['Rajdhani']">No conversations yet</p>
          </div>
        ) : (
          sorted.map((c) => {
            const active = selectedId === c.id;
            const label = c.displayName?.trim() || c.waId || 'Unknown';
            const preview = (c.lastMessagePreview ?? '').trim() || '—';
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                className={`w-full text-left px-4 py-3 flex gap-3 border-b border-[#F4F6F8] transition-colors ${
                  active ? 'bg-[#0D2847]/5' : 'hover:bg-[#F4F6F8]'
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-[#1565C0]/15 flex items-center justify-center text-sm font-bold text-[#1565C0] flex-shrink-0 font-['Rajdhani']">
                  {initials(c.displayName, c.waId)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2 items-baseline">
                    <span className="font-medium text-[#0D2847] text-sm truncate font-['Rajdhani']">{label}</span>
                    <span className="text-[10px] text-[#7A9AB8] flex-shrink-0 font-['Rajdhani']">
                      {formatListTime(c.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-xs text-[#7A9AB8] truncate mt-0.5 font-['Rajdhani']">{preview}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
