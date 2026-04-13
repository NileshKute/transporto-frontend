'use client';

import { useState } from 'react';
import { ContactsList } from '@/components/whatsapp-meta/ContactsList';
import { MessageThread } from '@/components/whatsapp-meta/MessageThread';
import { ComposeBox } from '@/components/whatsapp-meta/ComposeBox';
import { ContactLinkModal } from '@/components/whatsapp-meta/ContactLinkModal';
import type { MetaContact } from '@/lib/api/whatsapp-meta';

export default function WhatsappMetaPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MetaContact | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <div className="flex flex-col -m-4 lg:-m-6" style={{ height: 'calc(100vh - 7rem)' }}>
      <div className="flex flex-1 min-h-0 rounded-xl border border-[#E0E8F0] overflow-hidden bg-white shadow-sm">
        <ContactsList
          search={search}
          onSearchChange={setSearch}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <MessageThread contact={selected} onOpenLinkModal={() => setLinkOpen(true)} />
          <ComposeBox contact={selected} />
        </div>
      </div>

      <ContactLinkModal isOpen={linkOpen} onClose={() => setLinkOpen(false)} contact={selected} />
    </div>
  );
}
