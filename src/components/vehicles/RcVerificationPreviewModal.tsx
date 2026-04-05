'use client';

import { Modal } from '@/components/ui/Modal';
import type { RcPreviewBadge, RcPreviewResult, RcExpiryVisual } from '@/lib/rcVerification';
import { Loader2 } from 'lucide-react';

function Badge({ kind }: { kind: RcPreviewBadge }) {
  const map: Record<RcPreviewBadge, string> = {
    NEW: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    KEPT: 'bg-slate-100 text-slate-600 border border-slate-200',
    UPD: 'bg-sky-50 text-sky-800 border border-sky-200',
  };
  const label = kind === 'NEW' ? 'NEW' : kind === 'KEPT' ? 'KEPT' : 'UPD';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${map[kind]}`}>{label}</span>
  );
}

function ExpiryMark({ v }: { v: RcExpiryVisual }) {
  if (v === 'valid') return <span className="text-green-600 text-sm ml-1">✅ Valid</span>;
  if (v === 'expiring') return <span className="text-amber-600 text-sm ml-1">⚠️ Expiring</span>;
  if (v === 'expired') return <span className="text-red-600 text-sm ml-1">❌ Expired</span>;
  return null;
}

export function RcVerificationPreviewModal({
  isOpen,
  onClose,
  preview,
  applying,
  onApply,
}: {
  isOpen: boolean;
  onClose: () => void;
  preview: RcPreviewResult | null;
  applying: boolean;
  onApply: () => void | Promise<void>;
}) {
  if (!preview) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`✅ RC Verified — ${preview.regDisplay}`} size="xl">
      <div className="space-y-6 -mt-2">
        <p className="text-sm text-[#7A9AB8] font-['Rajdhani'] -mt-1">Data fetched from government database</p>

        {preview.sections.map((sec) => (
          <div key={sec.id}>
            <h4 className="font-['Barlow_Condensed'] text-[11px] font-bold uppercase tracking-widest text-[#1A4A7A] mb-3">
              {sec.title}
            </h4>
            <div className="rounded-xl border border-[#E0E8F0] divide-y divide-[#E0E8F0] overflow-hidden bg-white">
              {sec.rows.map((row) => (
                <div
                  key={`${sec.id}-${row.key}`}
                  className="grid grid-cols-1 sm:grid-cols-[minmax(140px,1fr)_2fr_auto] gap-2 sm:gap-4 px-4 py-3 items-center text-sm"
                >
                  <span className="text-[#7A9AB8] font-['Rajdhani']">{row.label}</span>
                  <div className="text-[#0D2847] font-medium min-w-0">
                    <span className="break-words">{row.value}</span>
                    {row.expiryVisual ? <ExpiryMark v={row.expiryVisual} /> : null}
                    {row.rcHint ? (
                      <p className="text-xs text-[#7A9AB8] mt-0.5 font-normal">RC: {row.rcHint}</p>
                    ) : null}
                  </div>
                  <div className="justify-self-start sm:justify-self-end">
                    <Badge kind={row.badge} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="text-xs text-[#7A9AB8] space-y-1 font-['Rajdhani'] border-t border-[#E0E8F0] pt-4">
          <p>
            <Badge kind="NEW" /> fills empty fields · <Badge kind="KEPT" /> keeps your saved values ·{' '}
            <Badge kind="UPD" /> refreshes dates, RC status, documents &amp; compliance from RC
          </p>
          <p className="font-semibold text-[#0D2847]">
            {preview.updateCount} field{preview.updateCount !== 1 ? 's' : ''} will be updated
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="px-5 py-2.5 text-sm font-medium text-[#0D2847] bg-white border border-[#E0E8F0] hover:bg-[#F4F6F8] rounded-lg transition-colors font-['Barlow_Condensed'] uppercase tracking-wider disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onApply()}
            disabled={applying || preview.updateCount === 0}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1565C0] hover:bg-[#0D2847] rounded-lg transition-colors font-['Barlow_Condensed'] uppercase tracking-wider disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {applying && <Loader2 className="w-4 h-4 animate-spin" />}
            Apply updates
          </button>
        </div>
      </div>
    </Modal>
  );
}
