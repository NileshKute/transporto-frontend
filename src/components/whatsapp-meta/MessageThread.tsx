'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2, MapPin } from 'lucide-react';
import { whatsappMetaApi, extractArray, type MetaContact, type MetaMessage } from '@/lib/api/whatsapp-meta';

function normalizeMessages(body: unknown): MetaMessage[] {
  const raw = extractArray<Record<string, unknown>>(body, ['data', 'messages']);
  return raw.map((m) => {
    const fromMe = m.fromMe === true || m.from_me === true;
    const dirRaw = String(m.direction ?? '').toUpperCase();
    let direction: string =
      dirRaw === 'OUTBOUND' || dirRaw === 'OUT'
        ? 'OUTBOUND'
        : dirRaw === 'INBOUND' || dirRaw === 'IN'
          ? 'INBOUND'
          : fromMe
            ? 'OUTBOUND'
            : 'INBOUND';
    return {
    id: String(m.id ?? ''),
    fromMe,
    direction,
    type: typeof m.type === 'string' ? m.type : 'TEXT',
    body: (m.body ?? m.text ?? m.messageBody) as string | null | undefined,
    text: m.text as string | null | undefined,
    status: (m.status as string) ?? null,
    createdAt: (m.createdAt ?? m.timestamp ?? m.sentAt) as string | null | undefined,
    timestamp: m.timestamp as string | null | undefined,
    mediaUrl: (m.mediaUrl ?? m.media_url) as string | null | undefined,
    mediaId: (m.mediaId ?? m.media_id) as string | null | undefined,
    latitude: m.latitude != null ? Number(m.latitude) : null,
    longitude: m.longitude != null ? Number(m.longitude) : null,
  };
  });
}

function messageText(m: MetaMessage): string {
  const t = m.body ?? m.text;
  return typeof t === 'string' ? t : '';
}

function messageTime(m: MetaMessage): string {
  const iso = m.createdAt ?? m.timestamp;
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isInbound(m: MetaMessage): boolean {
  if (m.fromMe === true) return false;
  const d = String(m.direction ?? '').toUpperCase();
  if (d === 'OUTBOUND' || d === 'OUT') return false;
  if (d === 'INBOUND' || d === 'IN') return true;
  return true;
}

function OutboundStatus({ status }: { status: string | null | undefined }) {
  const s = String(status ?? 'SENT').toUpperCase();
  if (s === 'FAILED' || s === 'ERROR') {
    return <span className="text-red-500 text-[10px] ml-1">!</span>;
  }
  if (s === 'READ') {
    return <span className="text-blue-600 text-[10px] ml-0.5">✓✓</span>;
  }
  if (s === 'DELIVERED') {
    return <span className="text-gray-500 text-[10px] ml-0.5">✓✓</span>;
  }
  return <span className="text-gray-500 text-[10px] ml-0.5">✓</span>;
}

export function MessageThread({
  contact,
  onOpenLinkModal,
}: {
  contact: MetaContact | null;
  onOpenLinkModal: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    data: messages = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['whatsapp-meta', 'thread', contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [] as MetaMessage[];
      const r = await whatsappMetaApi.getThread(contact.id, { page: 1, limit: 200 });
      const list = normalizeMessages(r.data);
      return list.sort((a, b) => {
        const ta = new Date(a.createdAt ?? a.timestamp ?? 0).getTime();
        const tb = new Date(b.createdAt ?? b.timestamp ?? 0).getTime();
        return ta - tb;
      });
    },
    enabled: !!contact?.id,
    refetchInterval: 5000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, contact?.id]);

  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#ECEFF2] min-h-[200px]">
        <p className="text-[#7A9AB8] text-sm font-['Rajdhani']">Select a conversation</p>
      </div>
    );
  }

  const phone = contact.waId;
  const title = contact.displayName?.trim() || phone || 'Contact';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#ECEFF2]">
      <header className="flex-shrink-0 px-4 py-3 bg-white border-b border-[#E0E8F0] flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="font-['Oswald'] text-lg font-semibold text-[#0D2847] truncate">{title}</h3>
          <p className="text-xs text-[#7A9AB8] font-['Rajdhani'] truncate">{phone}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {contact.driver?.name && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-[#1565C0]/10 text-[#1565C0] font-['Barlow_Condensed']">
                Driver: {contact.driver.name}
              </span>
            )}
            {contact.client?.name && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide bg-[#42A5F5]/15 text-[#0D2847] font-['Barlow_Condensed']">
                Client: {contact.client.name}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenLinkModal}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1565C0] text-white text-sm font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] transition-colors"
        >
          <Link2 className="w-4 h-4" />
          Link
        </button>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`h-12 rounded-lg max-w-[80%] ${i % 2 ? 'ml-auto bg-green-100/50' : 'bg-gray-100'}`} />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-red-600 text-sm font-['Rajdhani']">
            Failed to load messages.
            <button type="button" onClick={() => void refetch()} className="block mx-auto mt-2 text-[#1565C0] underline">
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-[#7A9AB8] text-sm font-['Rajdhani'] py-8">No messages in this thread.</p>
        ) : (
          messages.map((m) => {
            const inbound = isInbound(m);
            const typ = String(m.type ?? 'TEXT').toUpperCase();
            return (
              <div key={m.id} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm ${
                    inbound ? 'bg-gray-100 text-gray-900 rounded-tl-sm' : 'bg-green-100 text-gray-900 rounded-tr-sm'
                  }`}
                >
                  {typ === 'IMAGE' || typ === 'MEDIA' ? (
                    <div className="space-y-2">
                      {m.mediaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.mediaUrl}
                          alt=""
                          className="max-w-full rounded-lg max-h-48 object-cover"
                        />
                      ) : (
                        <div className="px-3 py-6 bg-gray-200/80 rounded-lg text-center text-xs text-gray-600">
                          Image
                          {m.mediaId ? <span className="block mt-1 font-mono text-[10px] truncate">{m.mediaId}</span> : null}
                        </div>
                      )}
                      {messageText(m) ? <p className="text-sm whitespace-pre-wrap break-words">{messageText(m)}</p> : null}
                    </div>
                  ) : typ === 'LOCATION' || (m.latitude != null && m.longitude != null) ? (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-[#1565C0] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-[#0D2847]">Location shared</p>
                        {m.latitude != null && m.longitude != null && (
                          <p className="text-xs text-gray-600 mt-1 font-mono">
                            {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">{messageText(m) || '—'}</p>
                  )}
                  <div
                    className={`flex items-center gap-1 mt-1 text-[10px] text-gray-500 ${
                      inbound ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    <span>{messageTime(m)}</span>
                    {!inbound && <OutboundStatus status={m.status} />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
