'use client';
import { Modal } from './Modal';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  loading?: boolean;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  loading,
  confirmLabel = 'Delete',
  variant = 'danger',
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="p-6 text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${isDanger ? 'bg-[#DC2626]/10' : 'bg-[#42A5F5]/10'}`}>
          <AlertTriangle className={`w-6 h-6 ${isDanger ? 'text-[#DC2626]' : 'text-[#42A5F5]'}`} />
        </div>
        <h3 className="font-['Oswald'] text-lg font-semibold text-[#0D2847] mb-2">{title}</h3>
        <p className="text-[#7A9AB8] text-sm mb-6 font-['Rajdhani']">{message}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-[#0D2847] bg-white border border-[#E0E8F0] hover:bg-[#F4F6F8] rounded-lg transition-colors font-['Barlow_Condensed'] uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 text-sm font-medium text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 font-['Barlow_Condensed'] uppercase tracking-wider ${
              isDanger ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-[#1565C0] hover:bg-[#0D2847]'
            }`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
