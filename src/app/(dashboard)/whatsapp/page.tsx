'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDateTime, formatTime } from '@/lib/utils';
import { MessageSquare, Fuel, AlertTriangle, MapPin, Route, MessageCircle, Send, User } from 'lucide-react';

// --- Types ---
type MessageDirection = 'inbound' | 'outbound';
type ParsedType = 'TRIP_START' | 'TRIP_END' | 'FUEL' | 'EMERGENCY' | 'LOCATION' | 'GENERAL' | string;

interface WhatsAppMessage {
  id: string;
  fromPhone: string;
  toPhone?: string;
  message: string;
  body?: string;
  receivedAt: string;
  sentAt?: string;
  status?: string;
  parsedType?: ParsedType | null;
  parsedData?: Record<string, unknown>;
  confidence?: number | null;
  direction?: MessageDirection;
  driver?: { id: string; name: string } | null;
}

interface WhatsAppListResponse {
  data: WhatsAppMessage[];
  total: number;
  totalPages: number;
}

interface DriverSummary {
  id: string;
  name: string;
  phone: string;
}

// --- Message type badges (color-coded) ---
const MESSAGE_TYPE_BADGES: Record<string, { label: string; className: string; icon: typeof MessageCircle }> = {
  TRIP_START:  { label: 'Trip Start',  className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Route },
  TRIP_END:    { label: 'Trip End',    className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Route },
  TRIP:        { label: 'Trip',        className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Route },
  FUEL:        { label: 'Fuel',        className: 'bg-amber-100 text-amber-800 border-amber-200', icon: Fuel },
  EMERGENCY:   { label: 'Emergency',   className: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
  LOCATION:    { label: 'Location',    className: 'bg-violet-100 text-violet-800 border-violet-200', icon: MapPin },
  GENERAL:     { label: 'General',     className: 'bg-slate-100 text-slate-700 border-slate-200', icon: MessageCircle },
};

function getTypeBadge(parsedType: ParsedType | null | undefined) {
  const key = (parsedType || 'GENERAL').toUpperCase().replace(/-/g, '_');
  return MESSAGE_TYPE_BADGES[key] || MESSAGE_TYPE_BADGES.GENERAL;
}

// --- Helpers ---
function toWhatsAppTo(phone: string): string {
  const p = phone.replace(/\D/g, '');
  if (p.startsWith('91')) return `whatsapp:+${p}`;
  if (p.length === 10) return `whatsapp:+91${p}`;
  return `whatsapp:+${p}`;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const today = new Date();
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

const POLL_INTERVAL_MS = 30_000;

export default function WhatsAppPage() {
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<DriverSummary | null>(null);
  const [sendText, setSendText] = useState('');
  const [sending, setSending] = useState(false);
  const [optimisticOutbound, setOptimisticOutbound] = useState<WhatsAppMessage[]>([]);
  const queryClient = useQueryClient();

  // Paginated list (existing list view)
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['whatsapp', page, filterType, filterStatus],
    queryFn: () =>
      api
        .get<WhatsAppListResponse>('/whatsapp', {
          params: { page, limit: 20, parsedType: filterType || undefined, status: filterStatus || undefined },
        })
        .then((r) => r.data),
  });

  // Full dataset for stats, driver list, and chat (poll every 30s)
  const { data: fullData, isLoading: fullLoading } = useQuery({
    queryKey: ['whatsapp-full'],
    queryFn: () =>
      api
        .get<WhatsAppListResponse>('/whatsapp', { params: { limit: 300 } })
        .then((r) => r.data),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const messages = fullData?.data ?? [];
  const isLoading = listLoading;

  // Stats from full data
  const stats = useMemo(() => {
    const today = messages.filter((m) => isToday(m.receivedAt));
    const processed = messages.filter((m) => m.status === 'PROCESSED');
    const pending = messages.filter((m) => m.status === 'RECEIVED' || m.status === 'PROCESSING');
    const driversSet = new Map<string, DriverSummary>();
    messages.forEach((m) => {
      const phone = m.fromPhone || '';
      const key = m.driver?.id || phone;
      if (!key) return;
      driversSet.set(key, {
        id: m.driver?.id || key,
        name: m.driver?.name || 'Unknown',
        phone,
      });
    });
    return {
      totalToday: today.length,
      parsedPct: messages.length ? Math.round((processed.length / messages.length) * 100) : 0,
      pendingReview: pending.length,
      activeDrivers: driversSet.size,
    };
  }, [messages]);

  // Unique drivers for sidebar (from full data + stable order)
  const driversList = useMemo(() => {
    const map = new Map<string, DriverSummary>();
    messages.forEach((m) => {
      const id = m.driver?.id || m.fromPhone;
      const name = m.driver?.name || 'Unknown';
      if (!map.has(id)) map.set(id, { id, name, phone: m.fromPhone });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [messages]);

  // Conversation for selected driver (inbound from API + outbound optimistic)
  const conversationMessages = useMemo(() => {
    if (!selectedDriver) return [];
    const fromApi = messages.filter(
      (m) => (m.driver?.id && m.driver.id === selectedDriver.id) || m.fromPhone === selectedDriver.phone
    );
    const outbound = optimisticOutbound.filter(
      (m) => (m.driver?.id && m.driver.id === selectedDriver.id) || m.toPhone === selectedDriver.phone
    );
    const combined: WhatsAppMessage[] = [
      ...fromApi.map((m) => ({ ...m, direction: (m.direction || 'inbound') as MessageDirection })),
      ...outbound.map((m) => ({ ...m, direction: 'outbound' as MessageDirection })),
    ];
    combined.sort((a, b) => new Date(a.receivedAt || a.sentAt || 0).getTime() - new Date(b.receivedAt || b.sentAt || 0).getTime());
    return combined;
  }, [selectedDriver, messages, optimisticOutbound]);

  const sendMessage = useCallback(async () => {
    if (!selectedDriver || !sendText.trim()) return;
    const to = toWhatsAppTo(selectedDriver.phone);
    const body = sendText.trim();
    setSending(true);
    const tempId = `opt-${Date.now()}`;
    const optimistic: WhatsAppMessage = {
      id: tempId,
      fromPhone: '',
      toPhone: selectedDriver.phone,
      message: body,
      body,
      receivedAt: new Date().toISOString(),
      direction: 'outbound',
      driver: { id: selectedDriver.id, name: selectedDriver.name },
    };
    setOptimisticOutbound((prev) => [...prev, { ...optimistic }]);
    setSendText('');
    try {
      await api.post('/whatsapp/send', {
        to,
        body,
        driverId: selectedDriver.id,
      });
      await queryClient.invalidateQueries({ queryKey: ['whatsapp'] });
      setOptimisticOutbound((prev) => prev.filter((m) => m.id !== tempId));
    } catch (e) {
      setOptimisticOutbound((prev) => prev.filter((m) => m.id !== tempId));
      setSendText(body);
    } finally {
      setSending(false);
    }
  }, [selectedDriver, sendText, queryClient]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">WhatsApp</h2>
        <p className="text-sm text-slate-500">Parsed incoming messages from drivers</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Messages today</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalToday}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Parsed %</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.parsedPct}%</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pending review</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.pendingReview}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active drivers</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.activeDrivers}</p>
        </div>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Left: driver list + filters + message list */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3">
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              className="h-10 w-40 rounded-lg border border-slate-300 text-sm text-slate-700"
            >
              <option value="">All Types</option>
              {['fuel', 'emergency', 'trip', 'general'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="h-10 w-40 rounded-lg border border-slate-300 text-sm text-slate-700"
            >
              <option value="">All Statuses</option>
              {['RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Driver list (sidebar on left when not selected, or above list) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Drivers</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {driversList.length === 0 && !fullLoading && (
                <p className="p-4 text-sm text-slate-500">No drivers yet</p>
              )}
              {driversList.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDriver(d)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${
                    selectedDriver?.id === d.id ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">{d.name}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">{d.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message list (existing cards) */}
          {isLoading ? (
            <LoadingSpinner />
          ) : !listData?.data?.length ? (
            <EmptyState
              message="No WhatsApp messages"
              description="Messages from drivers via Twilio webhook will appear here"
            />
          ) : (
            <div className="space-y-4">
              {listData.data.map((msg: WhatsAppMessage) => {
                const badge = getTypeBadge(msg.parsedType);
                const Icon = badge.icon;
                return (
                  <div
                    key={msg.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-xl flex-shrink-0 ${badge.className}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm">
                              {msg.driver?.name || 'Unknown Driver'}
                            </span>
                            <span className="font-mono text-xs text-slate-500">{msg.fromPhone}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-medium border ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {msg.status && <StatusBadge status={msg.status} />}
                            <span className="text-xs text-slate-500">
                              {formatDateTime(msg.receivedAt)}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 font-mono">
                          &quot;{msg.message}&quot;
                        </p>

                        {msg.parsedData && Object.keys(msg.parsedData).length > 0 && (
                          <div className="flex flex-wrap gap-3 mb-2">
                            {Object.entries(msg.parsedData)
                              .filter(([_, v]) => v != null)
                              .map(([k, v]) => (
                                <div
                                  key={k}
                                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700"
                                >
                                  <p className="text-xs text-slate-500 capitalize">
                                    {k.replace(/([A-Z])/g, ' $1')}
                                  </p>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {String(v)}
                                  </p>
                                </div>
                              ))}
                          </div>
                        )}

                        {msg.confidence != null && (
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-slate-500">Confidence:</span>
                            <div className="flex-1 max-w-[120px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  msg.confidence >= 0.8
                                    ? 'bg-emerald-500'
                                    : msg.confidence >= 0.6
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                }`}
                                style={{ width: `${msg.confidence * 100}%` }}
                              />
                            </div>
                            <span
                              className={`text-xs font-bold ${
                                msg.confidence >= 0.8
                                  ? 'text-emerald-600'
                                  : msg.confidence >= 0.6
                                    ? 'text-amber-600'
                                    : 'text-red-600'
                              }`}
                            >
                              {Math.round(msg.confidence * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {listData && (
            <Pagination
              page={page}
              totalPages={listData.totalPages}
              total={listData.total}
              limit={20}
              onPageChange={setPage}
            />
          )}
        </div>

        {/* Right: Chat panel when driver selected */}
        <div className="w-full lg:w-[380px] flex-shrink-0 flex flex-col">
          {selectedDriver ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[520px]">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{selectedDriver.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{selectedDriver.phone}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]">
                {conversationMessages.length === 0 && (
                  <p className="text-center text-slate-500 text-sm py-8">No messages yet. Send one below.</p>
                )}
                {conversationMessages.map((msg) => {
                  const isOut = msg.direction === 'outbound';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm ${
                          isOut
                            ? 'bg-[#d9fdd3] text-slate-900'
                            : 'bg-white text-slate-900 border border-slate-200'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message || msg.body}</p>
                        <p className={`text-[10px] mt-1 ${isOut ? 'text-slate-500' : 'text-slate-400'}`}>
                          {formatTime(msg.receivedAt || msg.sentAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 border-t border-slate-200 bg-white rounded-b-xl">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sendText}
                    onChange={(e) => setSendText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 min-w-0 rounded-lg border border-slate-300 text-sm py-2.5 px-3"
                    disabled={sending}
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!sendText.trim() || sending}
                    className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center h-[520px] text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium">Select a driver</p>
              <p className="text-sm text-slate-500 mt-1">Choose a driver from the list to view and send messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
