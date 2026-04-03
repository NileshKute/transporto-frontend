'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatBpclDate, formatInrTwoDecimals, formatNumber } from '@/lib/utils';
import { CreditCard, ChevronDown, ChevronRight, Trash2, CalendarRange } from 'lucide-react';
import toast from 'react-hot-toast';

type TagOpt = 'BUSINESS' | 'PERSONAL' | 'IGNORE';

interface CardRow {
  id: string;
  cardNumber: string;
  vehicleReg: string;
  currentTag: TagOpt;
  txnCount: number;
  totalLitres: number;
  totalAmount: number;
}

interface PeriodRow {
  id: string;
  tag: TagOpt;
  startDate: string;
  endDate: string;
  notes: string;
  isNew?: boolean;
}

function normalizeCard(c: any): CardRow {
  return {
    id: String(c.id),
    cardNumber: String(c.cardNumber ?? c.card_number ?? ''),
    vehicleReg: String(c.vehicleReg ?? c.regNumber ?? c.vehicle_number ?? c.assignedVehicleReg ?? '—'),
    currentTag: (c.currentTag ?? c.current_tag ?? 'BUSINESS') as TagOpt,
    txnCount: Number(c.txnCount ?? c.txn_count ?? c.transactionCount ?? 0),
    totalLitres: Number(c.totalLitres ?? c.total_litres ?? 0),
    totalAmount: Number(c.totalAmount ?? c.total_amount ?? 0),
  };
}

function normalizePeriod(p: any): PeriodRow {
  const hasId = p.id != null && String(p.id).length > 0;
  return {
    id: hasId ? String(p.id) : `tmp-${Math.random().toString(36).slice(2)}`,
    tag: (p.tag ?? p.currentTag ?? 'BUSINESS') as TagOpt,
    startDate: p.startDate ? String(p.startDate).slice(0, 10) : '',
    endDate: p.endDate ? String(p.endDate).slice(0, 10) : '',
    notes: String(p.notes ?? ''),
    isNew: !hasId,
  };
}

function tagBorderClass(tag: TagOpt) {
  if (tag === 'BUSINESS') return 'border-l-4 border-l-emerald-500';
  if (tag === 'PERSONAL') return 'border-l-4 border-l-amber-400';
  return 'border-l-4 border-l-red-500';
}

function tagDotClass(tag: TagOpt) {
  if (tag === 'BUSINESS') return 'bg-emerald-500';
  if (tag === 'PERSONAL') return 'bg-amber-400';
  return 'bg-red-500';
}

const inputClass =
  'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-sm text-[#0D2847] font-["Rajdhani"] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20';

export default function BpclCardsPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [periodModalCard, setPeriodModalCard] = useState<CardRow | null>(null);
  const [periodRows, setPeriodRows] = useState<PeriodRow[]>([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodSaving, setPeriodSaving] = useState(false);

  const { data: cardsRaw, isLoading } = useQuery({
    queryKey: ['bpcl-cards'],
    queryFn: async () => {
      const res = await api.get('/bpcl/cards');
      const raw = res.data?.data ?? res.data;
      return Array.isArray(raw) ? raw : [];
    },
  });

  const cards: CardRow[] = useMemo(() => (cardsRaw ?? []).map(normalizeCard), [cardsRaw]);

  const loadPeriodsForCard = async (cardId: string) => {
    const res = await api.get(`/bpcl/cards/${cardId}`);
    const body = res.data?.data ?? res.data;
    const periods = body?.periods ?? body?.tagPeriods ?? [];
    const list = Array.isArray(periods) ? periods.map(normalizePeriod) : [];
    setPeriodRows(list);
  };

  const summary = useMemo(() => {
    let b = 0,
      p = 0,
      i = 0;
    cards.forEach((c) => {
      if (c.currentTag === 'BUSINESS') b++;
      else if (c.currentTag === 'PERSONAL') p++;
      else i++;
    });
    return { b, p, i };
  }, [cards]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateTag = async (card: CardRow, tag: TagOpt) => {
    try {
      await api.put(`/bpcl/cards/${card.id}`, { currentTag: tag });
      toast.success('Tag updated');
      qc.invalidateQueries({ queryKey: ['bpcl-cards'] });
      qc.invalidateQueries({ queryKey: ['bpcl-cards-options'] });
    } catch {
      toast.error('Failed to update tag');
    }
  };

  const openPeriodModal = async (card: CardRow) => {
    setPeriodModalCard(card);
    setPeriodLoading(true);
    setPeriodRows([]);
    try {
      await loadPeriodsForCard(card.id);
    } catch {
      toast.error('Could not load periods');
      setPeriodRows([]);
    } finally {
      setPeriodLoading(false);
    }
  };

  const closePeriodModal = () => {
    setPeriodModalCard(null);
    setPeriodRows([]);
  };

  const addPeriodRow = () => {
    setPeriodRows((rows) => [
      ...rows,
      {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        tag: 'BUSINESS',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        notes: '',
        isNew: true,
      },
    ]);
  };

  const savePeriods = async () => {
    if (!periodModalCard) return;
    setPeriodSaving(true);
    try {
      for (const row of periodRows) {
        if (row.isNew) {
          await api.post(`/bpcl/cards/${periodModalCard.id}/periods`, {
            tag: row.tag,
            startDate: row.startDate,
            endDate: row.endDate || undefined,
            notes: row.notes || undefined,
          });
        } else {
          await api.put(`/bpcl/periods/${row.id}`, {
            tag: row.tag,
            startDate: row.startDate,
            endDate: row.endDate || undefined,
            notes: row.notes || undefined,
          });
        }
      }
      toast.success('Periods saved');
      closePeriodModal();
      qc.invalidateQueries({ queryKey: ['bpcl-cards'] });
    } catch {
      toast.error('Failed to save periods');
    } finally {
      setPeriodSaving(false);
    }
  };

  const deletePeriod = async (row: PeriodRow) => {
    if (row.isNew) {
      setPeriodRows((r) => r.filter((x) => x.id !== row.id));
      return;
    }
    const cardId = periodModalCard?.id;
    try {
      await api.delete(`/bpcl/periods/${row.id}`, {
        transformResponse: [
          (data: string) => {
            if (data == null || data === '') return null;
            try {
              return JSON.parse(data);
            } catch {
              return null;
            }
          },
        ],
      });
      toast.success('Period removed');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status && status >= 400) {
        toast.error('Failed to delete period');
      } else {
        toast.success('Period removed');
      }
    } finally {
      if (cardId) {
        await loadPeriodsForCard(cardId).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ['bpcl-cards'] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">BPCL Card Management</h2>
          <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">
            Tag cards as Business, Personal, or Ignore. Set date ranges when classification changes.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-['Rajdhani']">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[#0D2847] font-semibold">{summary.b}</span>
            <span className="text-[#7A9AB8]">Business</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-[#0D2847] font-semibold">{summary.p}</span>
            <span className="text-[#7A9AB8]">Personal</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-[#0D2847] font-semibold">{summary.i}</span>
            <span className="text-[#7A9AB8]">Ignore</span>
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner text="Loading cards…" />
        </div>
      ) : cards.length === 0 ? (
        <EmptyState message="No BPCL cards yet. Import data first." />
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const isOpen = expanded.has(card.id);
            return (
              <div
                key={card.id}
                className={`bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden ${tagBorderClass(card.currentTag)}`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(card.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F8F9FA] transition-colors"
                >
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${tagDotClass(card.currentTag)}`} />
                  {isOpen ? <ChevronDown className="w-4 h-4 text-[#7A9AB8]" /> : <ChevronRight className="w-4 h-4 text-[#7A9AB8]" />}
                  <CreditCard className="w-5 h-5 text-[#1565C0] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm font-semibold text-[#0D2847]">{card.cardNumber}</span>
                    <span className="text-[#7A9AB8] mx-2">—</span>
                    <span className="font-mono text-sm text-[#1A4A7A]">{card.vehicleReg}</span>
                    <span className="ml-3 font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#1565C0]">
                      {card.currentTag}
                    </span>
                  </div>
                  <div className="hidden sm:block text-right text-xs text-[#7A9AB8] font-['Rajdhani']">
                    {formatNumber(card.txnCount)} txns · {formatNumber(card.totalLitres)} L ·{' '}
                    {formatInrTwoDecimals(card.totalAmount)}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-0 border-t border-[#E0E8F0] bg-[#FAFBFC]">
                    <div className="flex flex-wrap gap-3 items-center py-3">
                      <span className="font-['Barlow_Condensed'] text-[10px] uppercase tracking-wider text-[#1A4A7A]">Edit tag</span>
                      <select
                        className={`${inputClass} w-40 py-1.5`}
                        value={card.currentTag}
                        onChange={(e) => void updateTag(card, e.target.value as TagOpt)}
                      >
                        <option value="BUSINESS">BUSINESS</option>
                        <option value="PERSONAL">PERSONAL</option>
                        <option value="IGNORE">IGNORE</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void openPeriodModal(card)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1565C0] text-[#1565C0] font-['Barlow_Condensed'] text-xs uppercase tracking-wider hover:bg-[#1565C0]/5"
                      >
                        <CalendarRange className="w-4 h-4" /> Manage periods
                      </button>
                    </div>
                    <p className="text-xs text-[#7A9AB8] font-['Rajdhani'] sm:hidden">
                      {formatNumber(card.txnCount)} txns · {formatNumber(card.totalLitres)} L ·{' '}
                      {formatInrTwoDecimals(card.totalAmount)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!periodModalCard}
        onClose={closePeriodModal}
        title={periodModalCard ? `Periods — ${periodModalCard.cardNumber} · ${periodModalCard.vehicleReg}` : 'Periods'}
        size="lg"
      >
        {periodLoading ? (
          <LoadingSpinner text="Loading periods…" />
        ) : (
          <div className="space-y-4">
            {periodRows.length === 0 && (
              <p className="text-sm text-[#7A9AB8] font-['Rajdhani']">No periods yet. Add one to split Business / Personal by date range.</p>
            )}
            {periodRows.map((row, idx) => (
              <div key={row.id} className="border border-[#E0E8F0] rounded-lg p-4 space-y-3 bg-[#F8F9FA]">
                <div className="flex items-center justify-between">
                  <span className="font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">
                    Period {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => void deletePeriod(row)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete period"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-['Barlow_Condensed'] uppercase text-[#7A9AB8] mb-1">From</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={row.startDate}
                      onChange={(e) =>
                        setPeriodRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, startDate: e.target.value } : r)))
                      }
                    />
                    <p className="text-[10px] text-[#7A9AB8] mt-0.5 font-['Rajdhani']">{row.startDate ? formatBpclDate(row.startDate) : ''}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-['Barlow_Condensed'] uppercase text-[#7A9AB8] mb-1">To</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={row.endDate}
                      onChange={(e) =>
                        setPeriodRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, endDate: e.target.value } : r)))
                      }
                    />
                    <p className="text-[10px] text-[#7A9AB8] mt-0.5 font-['Rajdhani']">
                      {row.endDate ? formatBpclDate(row.endDate) : 'Open-ended'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-['Barlow_Condensed'] uppercase text-[#7A9AB8] mb-1">Tag</label>
                    <select
                      className={inputClass}
                      value={row.tag}
                      onChange={(e) =>
                        setPeriodRows((rs) =>
                          rs.map((r) => (r.id === row.id ? { ...r, tag: e.target.value as TagOpt } : r))
                        )
                      }
                    >
                      <option value="BUSINESS">BUSINESS</option>
                      <option value="PERSONAL">PERSONAL</option>
                      <option value="IGNORE">IGNORE</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-['Barlow_Condensed'] uppercase text-[#7A9AB8] mb-1">Note</label>
                  <input
                    className={inputClass}
                    placeholder="e.g. Company use"
                    value={row.notes}
                    onChange={(e) =>
                      setPeriodRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, notes: e.target.value } : r)))
                    }
                  />
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={addPeriodRow}
                className="px-4 py-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] font-['Barlow_Condensed'] text-sm uppercase tracking-wider hover:bg-white"
              >
                + Add period
              </button>
              <button
                type="button"
                disabled={periodSaving}
                onClick={() => void savePeriods()}
                className="px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] text-sm uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50"
              >
                {periodSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
