'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatBpclDate, formatInrTwoDecimals, formatNumber } from '@/lib/utils';
import { Upload, FileSpreadsheet, CheckCircle2, History } from 'lucide-react';
import toast from 'react-hot-toast';

type TagOpt = 'BUSINESS' | 'PERSONAL' | 'IGNORE';

interface NewCardRow {
  cardNumber: string;
  vehicleNumber?: string;
  regNumber?: string;
}

function normalizeImportResult(data: any) {
  if (!data || typeof data !== 'object') return null;
  return {
    imported: Number(data.imported ?? data.importedCount ?? 0),
    duplicatesSkipped: Number(data.duplicatesSkipped ?? data.duplicates_skipped ?? 0),
    newCardsCreated: Number(data.newCardsCreated ?? data.new_cards_created ?? 0),
    newVehiclesCreated: Number(data.newVehiclesCreated ?? data.new_vehicles_created ?? 0),
    newCards: (() => {
      const raw = data.newCards ?? data.new_cards_detected ?? data.newCardSuggestions ?? [];
      return Array.isArray(raw) ? (raw as NewCardRow[]) : [];
    })(),
  };
}

/** Prisma groupBy batch or legacy flat row */
interface ImportHistoryBatch {
  id: string;
  importBatchId: string;
  createdAt?: string;
  count: number;
  txnMin?: string;
  txnMax?: string;
  totalAmount: number;
  totalLitres: number;
}

function parseImportHistoryResponse(resData: unknown): any[] {
  if (Array.isArray(resData)) return resData;
  if (resData && typeof resData === 'object') {
    const o = resData as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.items)) return o.items;
  }
  return [];
}

function normalizeImportHistoryBatch(b: any): ImportHistoryBatch {
  const sum = b._sum ?? {};
  const min = b._min ?? {};
  const max = b._max ?? {};
  const isGroupBy =
    b.importBatchId != null ||
    b._count != null ||
    b._sum != null ||
    b._min != null ||
    b._max != null;

  if (isGroupBy) {
    const importBatchId = String(b.importBatchId ?? b.import_batch_id ?? '');
    const id = importBatchId || String(b.id ?? Math.random());
    let count = 0;
    if (typeof b._count === 'number') count = b._count;
    else if (b._count && typeof b._count === 'object') {
      const c = b._count as Record<string, unknown>;
      count = Number(c._all ?? c.id ?? Object.values(c)[0] ?? 0);
    }
    return {
      id,
      importBatchId: importBatchId || id,
      createdAt: (min.createdAt ?? min.created_at) as string | undefined,
      count: Number.isFinite(count) ? count : 0,
      txnMin: (min.txnDate ?? min.txn_date) as string | undefined,
      txnMax: (max.txnDate ?? max.txn_date) as string | undefined,
      totalAmount: Number(sum.totalAmount ?? sum.total_amount ?? 0),
      totalLitres: Number(sum.litres ?? sum.total_litres ?? sum.totalLitres ?? 0),
    };
  }

  return {
    id: String(b.id ?? b.importBatchId ?? Math.random()),
    importBatchId: String(b.importBatchId ?? b.fileName ?? b.file_name ?? b.id ?? '—'),
    createdAt: b.createdAt ?? b.created_at ?? b.importedAt,
    count: Number(b.imported ?? b.recordsImported ?? b._count ?? 0),
    txnMin: undefined,
    txnMax: undefined,
    totalAmount: 0,
    totalLitres: 0,
  };
}

const inputClass =
  'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm text-[#0D2847] font-["Rajdhani"] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20';

export default function BpclImportPage() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ReturnType<typeof normalizeImportResult>>(null);
  const [tagDrafts, setTagDrafts] = useState<Record<string, TagOpt>>({});
  const [dragOver, setDragOver] = useState(false);
  const [savingTags, setSavingTags] = useState(false);

  const { data: historyRaw, isLoading: historyLoading } = useQuery({
    queryKey: ['bpcl-import-history'],
    queryFn: async () => {
      const res = await api.get('/bpcl/import-history');
      return parseImportHistoryResponse(res.data);
    },
  });

  const history: ImportHistoryBatch[] = (historyRaw ?? []).map(normalizeImportHistoryBatch);

  const handleUpload = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      toast.error('Please choose an Excel or CSV file');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/bpcl/import', formData, { timeout: 120000 });
      const norm = normalizeImportResult(res.data);
      setResult(norm);
      const drafts: Record<string, TagOpt> = {};
      (norm?.newCards ?? []).forEach((c) => {
        const cn = String(c.cardNumber ?? '');
        if (cn) drafts[cn] = 'BUSINESS';
      });
      setTagDrafts(drafts);
      qc.invalidateQueries({ queryKey: ['bpcl-import-history'] });
      toast.success('Import complete');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        (typeof err?.response?.data === 'string' ? err.response.data : null);
      const text = typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : 'Import failed';
      setError(text);
      toast.error(text);
    } finally {
      setLoading(false);
    }
  };

  const saveBulkTags = async () => {
    const updates = Object.entries(tagDrafts).map(([cardNumber, tag]) => ({ cardNumber, tag }));
    if (!updates.length) {
      toast.error('No tags to save');
      return;
    }
    setSavingTags(true);
    try {
      await api.put('/bpcl/cards/bulk-tags', { updates });
      toast.success('Tags saved');
      setTagDrafts({});
      setResult((r) => (r ? { ...r, newCards: [] } : r));
    } catch {
      toast.error('Failed to save tags');
    } finally {
      setSavingTags(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Import BPCL Data</h2>
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">
          Upload SmartFleet Excel export. Duplicates are skipped automatically.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleUpload(f);
        }}
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? 'border-[#1565C0] bg-[#1565C0]/5' : 'border-[#E0E8F0] bg-white'
        }`}
      >
        {loading ? (
          <div className="py-8">
            <LoadingSpinner text="Processing file…" />
          </div>
        ) : (
          <>
            <FileSpreadsheet className="w-12 h-12 text-[#1565C0] mx-auto mb-4" />
            <p className="font-['Barlow_Condensed'] text-sm uppercase tracking-wider text-[#1A4A7A] mb-2">
              Drag & drop Excel or CSV
            </p>
            <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mb-4">or</p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm cursor-pointer hover:bg-[#0D2847] transition-colors">
              <Upload className="w-4 h-4" />
              Choose file
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                  e.target.value = '';
                }}
              />
            </label>
          </>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 font-['Rajdhani']">{error}</div>
      ) : null}

      {result && (
        <div className="bg-white border border-[#E0E8F0] rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-[#16A34A]">
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
            <span className="font-['Oswald'] text-lg font-bold tracking-wide">Import Complete</span>
          </div>
          <ul className="font-['Rajdhani'] text-sm text-[#0D2847] space-y-1.5">
            <li>Imported: {formatNumber(result.imported)} transactions</li>
            <li>Duplicates Skipped: {formatNumber(result.duplicatesSkipped)}</li>
            <li>New Cards Created: {formatNumber(result.newCardsCreated)}</li>
            <li>New Vehicles Created: {formatNumber(result.newVehiclesCreated)}</li>
          </ul>

          {result.newCards && result.newCards.length > 0 && (
            <div className="pt-4 border-t border-[#E0E8F0] space-y-3">
              <p className="font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#F59E0B]">
                New cards detected — please review tags
              </p>
              <div className="space-y-2">
                {result.newCards.map((c, i) => {
                  const cn = String(c.cardNumber ?? '');
                  const reg = String(c.regNumber ?? c.vehicleNumber ?? '—');
                  return (
                    <div
                      key={`${cn}-${i}`}
                      className="flex flex-wrap items-center gap-2 text-sm font-['Rajdhani'] text-[#0D2847]"
                    >
                      <span className="font-mono text-xs bg-[#F4F6F8] px-2 py-1 rounded">
                        {cn} → {reg}
                      </span>
                      <span className="text-[#7A9AB8]">Tag:</span>
                      <select
                        className={`${inputClass} w-40 py-1.5`}
                        value={tagDrafts[cn] ?? 'BUSINESS'}
                        onChange={(e) =>
                          setTagDrafts((d) => ({ ...d, [cn]: e.target.value as TagOpt }))
                        }
                      >
                        <option value="BUSINESS">BUSINESS</option>
                        <option value="PERSONAL">PERSONAL</option>
                        <option value="IGNORE">IGNORE</option>
                      </select>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={savingTags}
                  onClick={() => void saveBulkTags()}
                  className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#0D2847] disabled:opacity-50"
                >
                  {savingTags ? 'Saving…' : 'Save Tags'}
                </button>
                <Link
                  href="/bpcl"
                  className="inline-flex items-center px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#F4F6F8]"
                >
                  Go to Transactions
                </Link>
              </div>
            </div>
          )}

          {(!result.newCards || result.newCards.length === 0) && (
            <Link
              href="/bpcl"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] uppercase tracking-wider text-sm hover:bg-[#F4F6F8]"
            >
              Go to Transactions
            </Link>
          )}
        </div>
      )}

      <div className="bg-white border border-[#E0E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E0E8F0] flex items-center gap-2">
          <History className="w-4 h-4 text-[#1565C0]" />
          <span className="font-['Barlow_Condensed'] text-sm font-semibold uppercase tracking-wider text-[#1A4A7A]">
            Import history
          </span>
        </div>
        {historyLoading ? (
          <div className="p-8">
            <LoadingSpinner text="Loading history…" />
          </div>
        ) : history.length === 0 ? (
          <p className="p-6 text-sm text-[#7A9AB8] font-['Rajdhani']">No previous imports yet.</p>
        ) : (
          <ul className="divide-y divide-[#E0E8F0] max-h-[28rem] overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="px-5 py-3 space-y-1.5 font-['Rajdhani'] text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-[#7A9AB8] text-xs uppercase font-['Barlow_Condensed'] tracking-wider">Batch</span>
                    <span className="font-mono text-[#0D2847] font-medium ml-2">{h.importBatchId}</span>
                  </div>
                  <span className="text-[#7A9AB8] text-xs">
                    {h.createdAt ? formatBpclDate(h.createdAt) : '—'}
                  </span>
                </div>
                <div className="text-[#1A4A7A] text-xs flex flex-wrap gap-x-4 gap-y-1">
                  <span>{formatNumber(h.count)} transactions</span>
                  <span>
                    Period:{' '}
                    {h.txnMin || h.txnMax
                      ? `${h.txnMin ? formatBpclDate(h.txnMin) : '—'} → ${h.txnMax ? formatBpclDate(h.txnMax) : '—'}`
                      : '—'}
                  </span>
                </div>
                <div className="text-xs text-[#0D2847] flex flex-wrap gap-x-4 gap-y-1">
                  <span>{formatNumber(h.totalLitres)} L</span>
                  <span className="font-semibold text-[#16A34A]">{formatInrTwoDecimals(h.totalAmount)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
