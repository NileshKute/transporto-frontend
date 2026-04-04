'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  buildRcPreview,
  coerceVehicleRcPatch,
  extractRcDataFromResponse,
  rcVerificationToastMessage,
  type RcPreviewResult,
} from '@/lib/rcVerification';
import { RcVerificationPreviewModal } from '@/components/vehicles/RcVerificationPreviewModal';

const outlineBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border-2 border-[#1565C0] bg-white text-[#1565C0] hover:bg-[#E3F2FD] font-['Barlow_Condensed'] uppercase tracking-wider text-xs sm:text-sm transition-colors disabled:opacity-60 disabled:pointer-events-none";

export function VerifyRcForVehicleButton({
  vehicleId,
  currentVehicle,
  onApplied,
  compact,
  className = '',
}: {
  vehicleId: string;
  currentVehicle: Record<string, unknown>;
  onApplied: () => void;
  compact?: boolean;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState<RcPreviewResult | null>(null);
  const [applying, setApplying] = useState(false);

  const verify = async () => {
    setLoading(true);
    const tid = toast.loading('Verifying with government database...');
    try {
      const res = await api.post(`/vehicles/${vehicleId}/verify-rc`);
      const fetched = extractRcDataFromResponse(res.data);
      const p = buildRcPreview(currentVehicle, fetched);
      setPreview(p);
      setModalOpen(true);
      toast.dismiss(tid);
    } catch (e) {
      toast.dismiss(tid);
      toast.error(rcVerificationToastMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!preview || preview.updateCount === 0) return;
    setApplying(true);
    try {
      const body = coerceVehicleRcPatch(preview.applyPatch);
      await api.put(`/vehicles/${vehicleId}`, body);
      toast.success('Vehicle updated from RC data');
      setModalOpen(false);
      setPreview(null);
      onApplied();
    } catch (e) {
      const ax = e as { response?: { data?: { message?: string } } };
      toast.error(ax.response?.data?.message || 'Failed to apply RC updates');
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void verify()}
        disabled={loading || !vehicleId}
        title={compact ? 'Verify RC online' : undefined}
        className={`${outlineBtnClass} ${compact ? 'p-2' : 'px-3 py-2'} ${className}`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <ShieldCheck className="w-4 h-4 shrink-0" />}
        {!compact && <span>Verify RC</span>}
      </button>
      <RcVerificationPreviewModal
        isOpen={modalOpen}
        onClose={() => {
          if (!applying) {
            setModalOpen(false);
            setPreview(null);
          }
        }}
        preview={preview}
        applying={applying}
        onApply={apply}
      />
    </>
  );
}

export function VerifyRcAutofillButton({
  regNumber,
  currentForm,
  setForm,
  className = '',
}: {
  regNumber: string;
  currentForm: Record<string, unknown>;
  setForm: Dispatch<SetStateAction<Record<string, unknown>>>;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState<RcPreviewResult | null>(null);
  const [applying, setApplying] = useState(false);

  const trimmed = regNumber.trim().toUpperCase();

  const verify = async () => {
    if (!trimmed) {
      toast.error('Enter registration number first');
      return;
    }
    setLoading(true);
    const tid = toast.loading('Verifying with government database...');
    try {
      const res = await api.post('/vehicles/verify-rc-number', { vehicleNumber: trimmed });
      const fetched = extractRcDataFromResponse(res.data);
      const p = buildRcPreview(currentForm, fetched);
      setPreview(p);
      setModalOpen(true);
      toast.dismiss(tid);
    } catch (e) {
      toast.dismiss(tid);
      toast.error(rcVerificationToastMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      const patch = coerceVehicleRcPatch(preview.applyPatch);
      setForm((prev) => ({ ...prev, ...patch }));
      toast.success('Form auto-filled from RC. Review and create when ready.');
      setModalOpen(false);
      setPreview(null);
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void verify()}
        disabled={loading || !trimmed}
        className={`${outlineBtnClass} px-3 py-2 whitespace-nowrap ${className}`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <ShieldCheck className="w-4 h-4 shrink-0" />}
        <span>Verify &amp; auto-fill</span>
      </button>
      <RcVerificationPreviewModal
        isOpen={modalOpen}
        onClose={() => {
          if (!applying) {
            setModalOpen(false);
            setPreview(null);
          }
        }}
        preview={preview}
        applying={applying}
        onApply={apply}
      />
    </>
  );
}
