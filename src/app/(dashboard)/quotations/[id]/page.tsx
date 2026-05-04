'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { quotationsApi } from '@/lib/api/quotations';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatIndianCurrency, formatDate } from '@/lib/utils';
import { displayText, toArray } from '@/lib/displayText';
import { pickQuotationPayload, readQuoteDateFromRecord, readStringArray } from '@/lib/quotations/normalize';
import { QUOTATION_STATUSES, STATUS_BADGE_CLASSES, VEHICLE_QUOTE_TYPE_OPTIONS } from '@/lib/quotations/constants';
import { ArrowLeft, Download, Pencil, FileOutput, RefreshCw, ArrowLeftRight } from 'lucide-react';
import toast from 'react-hot-toast';

const inputClass =
  'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-[#0D2847] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20 font-["Rajdhani"] text-sm';

function vehicleLabel(type: string, other?: string): string {
  if (!type) return '—';
  if (type === 'OTHER' && other) return other;
  const o = VEHICLE_QUOTE_TYPE_OPTIONS.find((x) => x.value === type);
  return o?.label ?? type.replace(/_/g, ' ');
}

function readNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Prefer business `quoteDate`; fall back to `createdAt` when missing (show ~ in UI). */
function formatDetailQuoteDate(q: Record<string, unknown>): { text: string; isEstimated: boolean } {
  const quoteIso = readQuoteDateFromRecord(q);
  const createdAt = String(q.createdAt ?? q.created_at ?? '').trim();
  if (quoteIso) {
    const d = new Date(quoteIso);
    if (!Number.isNaN(d.getTime())) {
      return { text: formatDate(d), isEstimated: false };
    }
  }
  if (createdAt) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) {
      return { text: formatDate(d), isEstimated: true };
    }
  }
  return { text: '—', isEstimated: false };
}

interface TimelineEntry {
  label: string;
  at: string;
  notes?: string;
}

function parseTimeline(q: Record<string, unknown>): TimelineEntry[] {
  const raw = q.statusHistory ?? q.status_history ?? q.statusChanges ?? q.auditLog ?? q.history;
  const arr = toArray<unknown>(raw);
  if (arr.length) {
    return arr
      .map((row): TimelineEntry | null => {
        if (!row || typeof row !== 'object') return null;
        const r = row as Record<string, unknown>;
        const at = String(r.at ?? r.createdAt ?? r.timestamp ?? r.date ?? '');
        const status = displayText(r.status ?? r.toStatus ?? r.newStatus, '');
        const notes = typeof r.notes === 'string' ? r.notes : displayText(r.note, '');
        return {
          label: status || 'Update',
          at: at || '',
          notes: notes || undefined,
        };
      })
      .filter((x): x is TimelineEntry => x != null);
  }
  const st = displayText(q.status, '');
  const updated = String(q.updatedAt ?? q.updated_at ?? q.createdAt ?? q.created_at ?? '');
  if (st && updated) return [{ label: `Status: ${st}`, at: updated }];
  return [];
}

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const qc = useQueryClient();

  const [statusModal, setStatusModal] = useState<{ open: boolean; nextStatus: string }>({ open: false, nextStatus: '' });
  const [statusNotes, setStatusNotes] = useState('');
  const [changeStatusOpen, setChangeStatusOpen] = useState(false);
  const [pickedStatus, setPickedStatus] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: raw, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['quotation', id],
    queryFn: async () => {
      const res = await quotationsApi.get(id);
      return res.data;
    },
    enabled: !!id,
  });

  const q = useMemo(() => pickQuotationPayload(raw), [raw]) as Record<string, unknown> | null;

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const loadPdfPreview = async () => {
    if (!id) return;
    setPdfLoading(true);
    try {
      const res = await quotationsApi.downloadPdf(id);
      const url = URL.createObjectURL(res.data);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      toast.error('Could not load PDF preview');
    } finally {
      setPdfLoading(false);
    }
  };

  const statusMutation = useMutation({
    mutationFn: ({ status, notes }: { status: string; notes?: string }) => quotationsApi.updateStatus(id, status, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotation', id] });
      qc.invalidateQueries({ queryKey: ['quotations-list'] });
      qc.invalidateQueries({ queryKey: ['quotations-stats'] });
      toast.success('Status updated');
      setStatusModal({ open: false, nextStatus: '' });
      setStatusNotes('');
      setChangeStatusOpen(false);
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? displayText((e as { response?: { data?: { message?: unknown } } }).response?.data?.message, '')
          : '';
      toast.error(msg || 'Status update failed');
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => quotationsApi.convertToInvoice(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotation', id] });
      qc.invalidateQueries({ queryKey: ['quotations-list'] });
      qc.invalidateQueries({ queryKey: ['invoices-list'] });
      toast.success('Invoice created');
      setConvertOpen(false);
      const data = res.data?.data ?? res.data;
      const invId =
        data && typeof data === 'object' && data !== null && 'invoiceId' in data
          ? String((data as { invoiceId: unknown }).invoiceId)
          : data && typeof data === 'object' && data !== null && 'id' in data
            ? String((data as { id: unknown }).id)
            : '';
      if (invId) router.push(`/invoices/${invId}`);
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? displayText((e as { response?: { data?: { message?: unknown } } }).response?.data?.message, '')
          : '';
      toast.error(msg || 'Conversion failed');
    },
  });

  const openPdfTab = async () => {
    if (!id) return;
    try {
      const res = await quotationsApi.downloadPdf(id);
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  const errMsg =
    error && typeof error === 'object' && 'response' in error
      ? displayText((error as { response?: { data?: { message?: unknown } } }).response?.data?.message, '')
      : '';

  if (!id) {
    return (
      <div className="p-8 text-center font-['Rajdhani'] text-[#7A9AB8]">
        Invalid quotation.
        <Link href="/quotations" className="block mt-4 text-[#1565C0] hover:underline">
          Back to list
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner text="Loading quotation…" />
      </div>
    );
  }

  if (isError || !q) {
    return (
      <div className="rounded-lg border border-[#E0E8F0] bg-white p-8 text-center space-y-4">
        <p className="font-['Oswald'] text-[#0D2847]">Could not load quotation</p>
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">{errMsg || 'It may have been deleted.'}</p>
        <button type="button" onClick={() => void refetch()} className="px-4 py-2 rounded-lg border border-[#1565C0] text-[#1565C0] mr-2 font-['Barlow_Condensed'] uppercase">
          Retry
        </button>
        <Link href="/quotations" className="inline-block px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase">
          Back
        </Link>
      </div>
    );
  }

  const statusStr = displayText(q.status, 'DRAFT');
  const isDraft = statusStr === 'DRAFT';
  const sourceType = displayText(q.sourceType ?? q.source_type, '');
  const canEdit = isDraft || sourceType === 'imported';
  const isSent = statusStr === 'SENT';
  const isAccepted = statusStr === 'ACCEPTED';
  const badge = STATUS_BADGE_CLASSES[statusStr] ?? 'bg-[#7A9AB8]/15 text-[#5C6F82]';
  const quoteNumber = displayText(q.quoteNumber ?? q.quote_number, '—');
  const client = q.client && typeof q.client === 'object' ? (q.client as Record<string, unknown>) : null;
  const clientName = client ? displayText(client.name, '—') : displayText(q.clientName ?? q.client_name, '—');
  const timeline = parseTimeline(q);
  const loadLocs = readStringArray(q.loadLocations ?? q.load_locations);

  const openStatus = (nextStatus: string) => {
    setStatusNotes('');
    setStatusModal({ open: true, nextStatus });
  };

  const openChangeStatusPicker = () => {
    const alternatives = QUOTATION_STATUSES.filter((s) => s !== statusStr);
    setPickedStatus(alternatives[0] ?? 'SENT');
    setStatusNotes('');
    setChangeStatusOpen(true);
  };

  const submitStatus = () => {
    if (!statusModal.nextStatus) return;
    statusMutation.mutate({ status: statusModal.nextStatus, notes: statusNotes.trim() || undefined });
  };

  const submitPickedStatus = () => {
    if (!pickedStatus) return;
    statusMutation.mutate({ status: pickedStatus, notes: statusNotes.trim() || undefined });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => router.back()} className="p-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8] shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-['Oswald'] text-2xl font-bold text-[#0D2847] tracking-wide">{quoteNumber}</h1>
            <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">{clientName}</p>
          </div>
          <span className={`inline-flex self-center px-3 py-1 rounded-full text-xs font-['Barlow_Condensed'] font-semibold uppercase ${badge}`}>
            {statusStr.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          {canEdit && (
            <Link
              href={`/quotations/${id}/edit`}
              className="inline-flex flex-1 sm:flex-none min-w-0 justify-center items-center gap-2 px-4 py-2 rounded-lg border border-[#1565C0] text-[#1565C0] font-['Barlow_Condensed'] font-semibold uppercase text-sm hover:bg-[#1565C0]/5"
            >
              <Pencil className="w-4 h-4 shrink-0" /> Edit
            </Link>
          )}
          <button
            type="button"
            onClick={() => openChangeStatusPicker()}
            className="inline-flex flex-1 sm:flex-none min-w-0 justify-center items-center gap-2 px-4 py-2 rounded-lg border border-[#0D2847] text-[#0D2847] font-['Barlow_Condensed'] font-semibold uppercase text-sm hover:bg-[#F4F6F8]"
          >
            <ArrowLeftRight className="w-4 h-4 shrink-0" /> Change status
          </button>
          <button
            type="button"
            onClick={() => void openPdfTab()}
            className="inline-flex flex-1 sm:flex-none min-w-0 justify-center items-center gap-2 px-4 py-2 rounded-lg border border-[#42A5F5] text-[#42A5F5] font-['Barlow_Condensed'] font-semibold uppercase text-sm hover:bg-[#42A5F5]/10"
          >
            <Download className="w-4 h-4 shrink-0" /> Download PDF
          </button>
          {isAccepted && (
            <button
              type="button"
              onClick={() => setConvertOpen(true)}
              className="inline-flex flex-1 sm:flex-none min-w-0 justify-center items-center gap-2 px-4 py-2 rounded-lg bg-[#7C3AED] text-white font-['Barlow_Condensed'] font-semibold uppercase text-sm hover:bg-[#6d28d9]"
            >
              <FileOutput className="w-4 h-4 shrink-0" /> Convert to invoice
            </button>
          )}
          <div className="relative inline-flex flex-1 sm:flex-none min-w-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => void loadPdfPreview()}
              disabled={pdfLoading}
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-4 py-2 rounded-lg bg-[#0D2847] text-white font-['Barlow_Condensed'] font-semibold uppercase text-sm hover:bg-[#1565C0] disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${pdfLoading ? 'animate-spin' : ''}`} /> PDF preview
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isDraft && (
          <button
            type="button"
            onClick={() => openStatus('SENT')}
            className="flex-1 sm:flex-none min-w-0 px-4 py-2 rounded-lg bg-[#42A5F5] text-white font-['Barlow_Condensed'] uppercase text-sm hover:bg-[#1565C0]"
          >
            Mark as sent
          </button>
        )}
        {isSent && (
          <>
            <button
              type="button"
              onClick={() => openStatus('ACCEPTED')}
              className="flex-1 sm:flex-none min-w-0 px-4 py-2 rounded-lg bg-[#16A34A] text-white font-['Barlow_Condensed'] uppercase text-sm hover:bg-[#15803d]"
            >
              Mark as accepted
            </button>
            <button
              type="button"
              onClick={() => openStatus('REJECTED')}
              className="flex-1 sm:flex-none min-w-0 px-4 py-2 rounded-lg bg-[#DC2626] text-white font-['Barlow_Condensed'] uppercase text-sm hover:bg-[#b91c1c]"
            >
              Mark as rejected
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white border border-[#E0E8F0] rounded-xl p-5 shadow-sm space-y-3 font-['Rajdhani'] text-sm text-[#0D2847]">
            <h2 className="font-['Oswald'] text-sm font-bold text-[#1565C0] uppercase tracking-wider border-b border-[#E0E8F0] pb-2">Details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <dt className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed']">Subject</dt>
                <dd>{displayText(q.subject, '—')}</dd>
              </div>
              <div>
                <dt className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed']">Attn</dt>
                <dd>{displayText(q.attnPerson ?? q.attn_person, '—')}</dd>
              </div>
              <div>
                <dt className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed']">Quote date</dt>
                <dd>
                  {(() => {
                    const { text, isEstimated } = formatDetailQuoteDate(q);
                    return (
                      <>
                        {text}
                        {isEstimated && (
                          <span className="ml-1 text-xs text-[#BA7517]" title="Estimated from record created date">
                            ~
                          </span>
                        )}
                      </>
                    );
                  })()}
                </dd>
              </div>
              <div>
                <dt className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed']">Valid until</dt>
                <dd>{q.validUntil || q.valid_until ? formatDate(String(q.validUntil ?? q.valid_until)) : '—'}</dd>
              </div>
              <div>
                <dt className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed']">Vehicle</dt>
                <dd>{vehicleLabel(displayText(q.vehicleType ?? q.vehicle_type, ''), displayText(q.vehicleTypeOther ?? q.vehicle_type_other, ''))}</dd>
              </div>
              <div>
                <dt className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed']">Monthly rate</dt>
                <dd className="font-['Oswald'] font-semibold">{formatIndianCurrency(readNum(q.monthlyRate ?? q.monthly_rate))}</dd>
              </div>
              <div>
                <dt className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed']">Capacity (kg)</dt>
                <dd>{displayText(q.loadingCapacityKg ?? q.loading_capacity_kg, '—')}</dd>
              </div>
              <div>
                <dt className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed']">Temperature °C</dt>
                <dd>{displayText(q.temperatureC ?? q.temperature_c, '—')}</dd>
              </div>
              <div>
                <dt className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed']">Fixed KM</dt>
                <dd>{displayText(q.fixedKm ?? q.fixed_km, '—')}</dd>
              </div>
              <div>
                <dt className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed']">Addl. / KM</dt>
                <dd>{readNum(q.additionalPerKmRs ?? q.additional_per_km_rs) ? formatIndianCurrency(readNum(q.additionalPerKmRs ?? q.additional_per_km_rs)) : '—'}</dd>
              </div>
              <div>
                <dt className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed']">Toll</dt>
                <dd>{q.tollIncluded ?? q.toll_included ? 'Included' : 'Extra per receipt'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed']">Load locations</dt>
                <dd>{loadLocs.length ? loadLocs.join(', ') : '—'}</dd>
              </div>
            </dl>
            <div>
              <h3 className="font-['Barlow_Condensed'] text-xs uppercase text-[#7A9AB8] mb-1">Terms</h3>
              <pre className="whitespace-pre-wrap font-['Rajdhani'] text-sm text-[#1A4A7A] bg-[#F4F6F8] rounded-lg p-3 border border-[#E0E8F0]">
                {typeof q.termsAndConditions === 'string'
                  ? q.termsAndConditions
                  : typeof q.terms_and_conditions === 'string'
                    ? q.terms_and_conditions
                    : '—'}
              </pre>
            </div>
            {typeof q.notes === 'string' && q.notes.trim() && (
              <div>
                <h3 className="font-['Barlow_Condensed'] text-xs uppercase text-[#7A9AB8] mb-1">Notes</h3>
                <p className="text-[#1A4A7A]">{q.notes}</p>
              </div>
            )}
          </div>

          {pdfUrl && (
            <div className="bg-white border border-[#E0E8F0] rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2 border-b border-[#E0E8F0] font-['Oswald'] text-sm text-[#0D2847]">PDF preview</div>
              <iframe title="Quotation PDF" src={pdfUrl} className="w-full min-h-[480px] bg-[#F4F6F8]" />
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E0E8F0] rounded-xl p-5 shadow-sm h-fit">
          <h2 className="font-['Oswald'] text-sm font-bold text-[#1565C0] uppercase tracking-wider border-b border-[#E0E8F0] pb-2 mb-4">Status history</h2>
          {timeline.length === 0 ? (
            <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">No history entries yet.</p>
          ) : (
            <ul className="space-y-4 border-l-2 border-[#42A5F5]/40 pl-4 ml-1">
              {timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#42A5F5]" />
                  <p className="font-['Barlow_Condensed'] text-xs uppercase text-[#1565C0]">{t.label}</p>
                  <p className="font-['Rajdhani'] text-xs text-[#7A9AB8]">{t.at ? formatDate(t.at) : ''}</p>
                  {t.notes && <p className="font-['Rajdhani'] text-sm text-[#0D2847] mt-1">{t.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal isOpen={changeStatusOpen} onClose={() => setChangeStatusOpen(false)} title="Change status">
        <label className="block font-['Barlow_Condensed'] text-xs uppercase text-[#7A9AB8] mb-1">New status</label>
        <select
          className={inputClass}
          value={pickedStatus}
          onChange={(e) => setPickedStatus(e.target.value)}
        >
          {QUOTATION_STATUSES.filter((s) => s !== statusStr).map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <label className="block font-['Barlow_Condensed'] text-xs uppercase text-[#7A9AB8] mb-1 mt-3">Notes (optional)</label>
        <textarea className={inputClass} rows={3} value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} />
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
          <button type="button" onClick={() => setChangeStatusOpen(false)} className="px-4 py-2 rounded-lg border border-[#E0E8F0] font-['Barlow_Condensed'] uppercase text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submitPickedStatus()}
            disabled={statusMutation.isPending || !pickedStatus}
            className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase text-sm disabled:opacity-50"
          >
            {statusMutation.isPending ? 'Saving…' : 'Update status'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={statusModal.open} onClose={() => setStatusModal({ open: false, nextStatus: '' })} title="Update status">
        <p className="text-sm text-[#7A9AB8] mb-3 font-['Rajdhani']">New status: <strong className="text-[#0D2847]">{statusModal.nextStatus.replace(/_/g, ' ')}</strong></p>
        <label className="block font-['Barlow_Condensed'] text-xs uppercase text-[#7A9AB8] mb-1">Notes (optional)</label>
        <textarea className={inputClass} rows={3} value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} />
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={() => setStatusModal({ open: false, nextStatus: '' })} className="px-4 py-2 rounded-lg border border-[#E0E8F0] font-['Barlow_Condensed'] uppercase text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submitStatus()}
            disabled={statusMutation.isPending}
            className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase text-sm disabled:opacity-50"
          >
            {statusMutation.isPending ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={convertOpen} onClose={() => setConvertOpen(false)} title="Convert to invoice">
        <p className="text-sm text-[#7A9AB8] font-['Rajdhani'] mb-4">Create an invoice from this accepted quotation. You can adjust line items on the invoice after conversion.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setConvertOpen(false)} className="px-4 py-2 rounded-lg border border-[#E0E8F0] font-['Barlow_Condensed'] uppercase text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending}
            className="px-4 py-2 rounded-lg bg-[#7C3AED] text-white font-['Barlow_Condensed'] uppercase text-sm disabled:opacity-50"
          >
            {convertMutation.isPending ? 'Creating…' : 'Generate invoice'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
