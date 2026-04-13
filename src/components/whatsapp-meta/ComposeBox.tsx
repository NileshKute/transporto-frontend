'use client';

import { useState, KeyboardEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { whatsappMetaApi, type MetaContact } from '@/lib/api/whatsapp-meta';

function apiErrorMessage(e: unknown): string {
  if (!e || typeof e !== 'object') return 'Send failed';
  const ax = e as { response?: { data?: { message?: string } } };
  const m = ax.response?.data?.message;
  return typeof m === 'string' ? m : 'Send failed. If the 24-hour window expired, use a template message.';
}

export function ComposeBox({ contact }: { contact: MetaContact | null }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');

  const sendMutation = useMutation({
    mutationFn: async (payload: { to: string; text: string }) => {
      await whatsappMetaApi.sendText(payload.to, payload.text);
    },
    onSuccess: async () => {
      setText('');
      await qc.invalidateQueries({ queryKey: ['whatsapp-meta', 'thread', contact?.id] });
      await qc.invalidateQueries({ queryKey: ['whatsapp-meta', 'contacts'] });
    },
    onError: (e: unknown) => {
      toast.error(apiErrorMessage(e));
    },
  });

  const handleSend = () => {
    if (!contact?.waId) {
      toast.error('No WhatsApp ID for this contact');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMutation.mutate({ to: contact.waId, text: trimmed });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!contact) {
    return null;
  }

  return (
    <div className="flex-shrink-0 border-t border-[#E0E8F0] bg-white p-3">
      <div className="flex gap-2 items-end max-w-5xl mx-auto">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          rows={2}
          disabled={sendMutation.isPending}
          className="flex-1 min-h-[44px] max-h-32 resize-y rounded-xl border border-[#E0E8F0] px-3 py-2 text-sm text-[#0D2847] placeholder:text-[#7A9AB8] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 font-['Rajdhani'] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sendMutation.isPending || !text.trim()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1565C0] text-white text-sm font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
        >
          {sendMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          Send
        </button>
      </div>
    </div>
  );
}
