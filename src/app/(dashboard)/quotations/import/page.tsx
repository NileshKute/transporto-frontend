'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { quotationsApi } from '@/lib/api/quotations';
import { displayText, toArray } from '@/lib/displayText';
import { ArrowLeft, Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

function isAdmin(role: string | undefined) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export default function QuotationImportPage() {
  const { user, isLoading } = useAuth();
  const [fileName, setFileName] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: { message: string; index?: number }[];
    summaryRows: Record<string, unknown>[];
  } | null>(null);

  const parseFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const t = typeof reader.result === 'string' ? reader.result : '';
      setJsonText(t);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const runImport = async () => {
    let payload: unknown;
    try {
      payload = JSON.parse(jsonText || '{}');
    } catch {
      toast.error('Invalid JSON');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await quotationsApi.import(payload);
      const data = res.data?.data ?? res.data;
      const d = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      const imported = Number(d.imported ?? d.importedCount ?? 0) || 0;
      const skipped = Number(d.skipped ?? d.skippedCount ?? 0) || 0;
      const errRaw = d.errors ?? d.errorList;
      const errors = toArray<unknown>(errRaw).map((e, i) => {
        if (e && typeof e === 'object') {
          const o = e as Record<string, unknown>;
          return {
            message: displayText(o.message ?? o.error ?? o, 'Error'),
            index: typeof o.index === 'number' ? o.index : typeof o.row === 'number' ? o.row : undefined,
          };
        }
        return { message: String(e), index: undefined };
      });
      const summaryRaw = d.summary ?? d.results ?? d.rows;
      const summaryRows = toArray<unknown>(summaryRaw)
        .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>) : { message: String(r) }))
        .filter(Boolean) as Record<string, unknown>[];
      setResult({ imported, skipped, errors, summaryRows });
      toast.success(`Imported ${imported}, skipped ${skipped}`);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? displayText((e as { response?: { data?: { message?: unknown } } }).response?.data?.message, '')
          : '';
      toast.error(msg || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16 text-[#7A9AB8] font-['Rajdhani']">Loading…</div>
    );
  }

  if (!isAdmin(user?.role)) {
    return (
      <div className="max-w-lg mx-auto rounded-xl border border-[#E0E8F0] bg-white p-8 text-center space-y-4">
        <p className="font-['Oswald'] text-[#0D2847]">Admin only</p>
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8]">Historical quotation import is restricted to administrators.</p>
        <Link href="/quotations" className="inline-block text-[#1565C0] font-['Barlow_Condensed'] uppercase hover:underline">
          Back to quotations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/quotations" className="p-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8]" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Import quotations</h1>
      </div>

      <div className="bg-white border border-[#E0E8F0] rounded-xl p-5 shadow-sm space-y-4">
        <p className="font-['Rajdhani'] text-sm text-[#1A4A7A]">
          Upload a JSON file exported from your legacy system. The payload shape must match your backend import contract (e.g. an array of quotations or a wrapper object).
        </p>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#42A5F5]/40 rounded-xl py-10 px-4 cursor-pointer hover:bg-[#42A5F5]/5 transition-colors">
          <Upload className="w-10 h-10 text-[#42A5F5] mb-2" />
          <span className="font-['Barlow_Condensed'] uppercase text-sm text-[#1565C0]">Choose JSON file</span>
          {fileName && <span className="font-['Rajdhani'] text-xs text-[#7A9AB8] mt-2">{fileName}</span>}
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) parseFile(f);
            }}
          />
        </label>

        <div>
          <label className="block font-['Barlow_Condensed'] text-xs uppercase text-[#7A9AB8] mb-1">Or paste JSON</label>
          <textarea
            className="w-full min-h-[200px] rounded-lg border border-[#E0E8F0] px-3 py-2 font-mono text-xs text-[#0D2847] focus:border-[#42A5F5]"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='[ { "quoteNumber": "Q-001", ... } ]'
          />
        </div>

        <button
          type="button"
          disabled={busy || !jsonText.trim()}
          onClick={() => void runImport()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] font-semibold uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Import historical quotations
        </button>
      </div>

      {result && (
        <div className="bg-white border border-[#E0E8F0] rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="font-['Oswald'] text-sm font-bold text-[#1565C0] uppercase tracking-wider">Results</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-[#16A34A]/10 p-3">
              <p className="font-['Oswald'] text-2xl text-[#15803d]">{result.imported}</p>
              <p className="font-['Barlow_Condensed'] text-xs uppercase text-[#7A9AB8]">Imported</p>
            </div>
            <div className="rounded-lg bg-[#F59E0B]/10 p-3">
              <p className="font-['Oswald'] text-2xl text-[#c2410c]">{result.skipped}</p>
              <p className="font-['Barlow_Condensed'] text-xs uppercase text-[#7A9AB8]">Skipped</p>
            </div>
            <div className="rounded-lg bg-[#DC2626]/10 p-3">
              <p className="font-['Oswald'] text-2xl text-[#b91c1c]">{result.errors.length}</p>
              <p className="font-['Barlow_Condensed'] text-xs uppercase text-[#7A9AB8]">Errors</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <ul className="text-sm font-['Rajdhani'] text-[#DC2626] space-y-1 list-disc pl-5">
              {result.errors.map((err, i) => (
                <li key={i}>
                  {err.index != null ? `Row ${err.index}: ` : ''}
                  {err.message}
                </li>
              ))}
            </ul>
          )}
          {result.summaryRows.length > 0 && (
            <div className="overflow-x-auto border border-[#E0E8F0] rounded-lg">
              <table className="w-full text-sm font-['Rajdhani']">
                <thead>
                  <tr className="bg-[#F4F6F8] text-left text-xs uppercase font-['Barlow_Condensed'] text-[#7A9AB8]">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {result.summaryRows.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="border-t border-[#E0E8F0]">
                      <td className="px-3 py-2 text-[#7A9AB8]">{idx + 1}</td>
                      <td className="px-3 py-2 text-[#0D2847]">
                        {displayText(row.quoteNumber ?? row.quote_number ?? row.message ?? row.status, JSON.stringify(row).slice(0, 120))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.summaryRows.length > 50 && (
                <p className="px-3 py-2 text-xs text-[#7A9AB8]">Showing first 50 rows.</p>
              )}
            </div>
          )}
          <Link href="/quotations" className="inline-flex text-[#1565C0] font-['Barlow_Condensed'] uppercase text-sm hover:underline">
            View quotations list →
          </Link>
        </div>
      )}
    </div>
  );
}
