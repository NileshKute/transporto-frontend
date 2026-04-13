'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { whatsappMetaApi, type MetaContact } from '@/lib/api/whatsapp-meta';

type DriverOpt = { id: string; name: string };
type ClientOpt = { id: string; name: string };

function extractDrivers(body: unknown): DriverOpt[] {
  const raw = Array.isArray(body)
    ? body
    : (body as { data?: unknown })?.data != null
      ? (body as { data: unknown }).data
      : body;
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((d: Record<string, unknown>) => ({
      id: String(d.id ?? ''),
      name: String(d.name ?? d.fullName ?? 'Driver'),
    }))
    .filter((d) => d.id);
}

function extractClients(body: unknown): ClientOpt[] {
  const raw = Array.isArray(body)
    ? body
    : (body as { data?: unknown })?.data != null
      ? (body as { data: unknown }).data
      : body;
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((c: Record<string, unknown>) => ({
      id: String(c.id ?? ''),
      name: String(c.name ?? c.companyName ?? 'Client'),
    }))
    .filter((c) => c.id);
}

export function ContactLinkModal({
  isOpen,
  onClose,
  contact,
}: {
  isOpen: boolean;
  onClose: () => void;
  contact: MetaContact | null;
}) {
  const qc = useQueryClient();
  const [driverId, setDriverId] = useState('');
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    if (isOpen && contact) {
      setDriverId(contact.driverId ?? '');
      setClientId(contact.clientId ?? '');
    }
  }, [isOpen, contact]);

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ['whatsapp-meta', 'drivers-options'],
    queryFn: async () => {
      const r = await api.get('/drivers', { params: { limit: 500, page: 1 } });
      return extractDrivers(r.data);
    },
    enabled: isOpen,
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['whatsapp-meta', 'clients-options'],
    queryFn: async () => {
      const r = await api.get('/clients');
      return extractClients(r.data);
    },
    enabled: isOpen,
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!contact?.id) throw new Error('No contact');
      await whatsappMetaApi.linkContact(contact.id, {
        driverId: driverId || null,
        clientId: clientId || null,
      });
    },
    onSuccess: async () => {
      toast.success('Contact linked');
      await qc.invalidateQueries({ queryKey: ['whatsapp-meta', 'contacts'] });
      await qc.invalidateQueries({ queryKey: ['whatsapp-meta', 'thread', contact?.id] });
      onClose();
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast.error(typeof msg === 'string' ? msg : 'Failed to link contact');
    },
  });

  if (!contact) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link contact" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 font-['Rajdhani']">
          Associate this WhatsApp conversation with a driver and/or client record.
        </p>
        <div>
          <label className="block text-xs font-medium text-[#7A9AB8] mb-1 font-['Barlow_Condensed'] uppercase tracking-wider">
            Driver
          </label>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            disabled={driversLoading}
            className="w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm text-[#0D2847] bg-white focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 font-['Rajdhani']"
          >
            <option value="">— None —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#7A9AB8] mb-1 font-['Barlow_Condensed'] uppercase tracking-wider">
            Client
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={clientsLoading}
            className="w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm text-[#0D2847] bg-white focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 font-['Rajdhani']"
          >
            <option value="">— None —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] text-sm font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#F4F6F8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => linkMutation.mutate()}
            disabled={linkMutation.isPending}
            className="px-4 py-2 rounded-lg bg-[#1565C0] text-white text-sm font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50"
          >
            {linkMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
