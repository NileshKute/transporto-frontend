'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  TRUCK_ICON_TYPES,
  TRUCK_ICON_LABELS,
  pickerPreviewSvg,
  normalizeTruckIconType,
  type TruckIconType,
} from './truckIcons';

export function VehicleIconPickerModal({
  open,
  onClose,
  vehicleRegLabel,
  currentIconType,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  vehicleRegLabel: string;
  currentIconType: string | undefined;
  onSave: (type: TruckIconType) => void | Promise<void>;
  saving: boolean;
}) {
  const initial = normalizeTruckIconType(currentIconType);
  const [pending, setPending] = useState<TruckIconType>(initial);

  useEffect(() => {
    if (open) setPending(normalizeTruckIconType(currentIconType));
  }, [open, currentIconType]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vehicle-icon-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col font-['Rajdhani']"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-[#0D2847] text-white shrink-0">
          <div>
            <h2 id="vehicle-icon-modal-title" className="text-lg font-bold font-['Oswald'] uppercase tracking-wide">
              Change vehicle icon
            </h2>
            <p className="text-sm text-[#64B5F6] mt-0.5">{vehicleRegLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          <p className="text-xs text-gray-500 font-['Barlow_Condensed'] uppercase tracking-wide mb-3">
            Choose shape — map color follows status (moving / halted / etc.)
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {TRUCK_ICON_TYPES.map((t) => {
              const sel = pending === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPending(t)}
                  title={TRUCK_ICON_LABELS[t]}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all hover:bg-slate-50 ${
                    sel ? 'border-[#1565C0] bg-blue-50/70 ring-2 ring-[#1565C0]/35' : 'border-gray-100'
                  }`}
                >
                  <span
                    className="flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: pickerPreviewSvg(t, 44) }}
                  />
                  <span className="text-[10px] font-['Barlow_Condensed'] font-semibold text-gray-700 leading-tight text-center line-clamp-2">
                    {TRUCK_ICON_LABELS[t]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-['Barlow_Condensed'] uppercase tracking-wide text-gray-500 mb-2">Selected</p>
            <div className="flex flex-col items-center justify-center rounded-xl bg-slate-100 py-7 px-4 border border-gray-200 gap-3">
              <span
                className="flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: pickerPreviewSvg(pending, 88) }}
              />
              <p className="text-sm font-['Barlow_Condensed'] font-bold text-[#0D2847] tracking-wide">
                {TRUCK_ICON_LABELS[pending]}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end px-5 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave(pending)}
            className="px-5 py-2 rounded-lg bg-[#1565C0] text-white text-sm font-['Barlow_Condensed'] uppercase tracking-wider font-bold hover:bg-[#0D2847] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
