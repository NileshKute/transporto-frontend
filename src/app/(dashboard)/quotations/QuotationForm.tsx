'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { quotationsApi } from '@/lib/api/quotations';
import { displayText, toArray } from '@/lib/displayText';
import { formatIndianCurrency } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  DEFAULT_QUOTATION_SUBJECT,
  DEFAULT_QUOTATION_TERMS,
  VEHICLE_QUOTE_TYPE_OPTIONS,
} from '@/lib/quotations/constants';
import { pickQuotationPayload, readStringArray } from '@/lib/quotations/normalize';
import { ArrowLeft, X } from 'lucide-react';
import toast from 'react-hot-toast';

const inputClass =
  'w-full rounded-lg border border-[#E0E8F0] px-3 py-2 text-[#0D2847] focus:border-[#42A5F5] focus:ring-2 focus:ring-[#42A5F5]/20 font-["Rajdhani"] text-sm';

/** +25 °C through -25 °C (51 steps) for quotation temperature. */
const QUOTATION_TEMPERATURE_OPTIONS = Array.from({ length: 51 }, (_, i) => 25 - i);

function clampQuotationTemp(n: number): number {
  return Math.max(-25, Math.min(25, Math.round(n)));
}

function sliceDate(iso: string): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

type ClientOpt = { id: string; name: string };

function normalizeClientOpt(raw: unknown): ClientOpt | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : '';
  if (!id) return null;
  return { id, name: displayText(r.name, 'Client') };
}

export default function QuotationForm({ quotationId }: { quotationId?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = !!quotationId;

  const [manualClient, setManualClient] = useState(false);
  const [clientId, setClientId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [attnPerson, setAttnPerson] = useState('');
  const [subject, setSubject] = useState(DEFAULT_QUOTATION_SUBJECT);
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validityDays, setValidityDays] = useState(30);
  const [vehicleType, setVehicleType] = useState('REEFER_VAN');
  const [vehicleTypeOther, setVehicleTypeOther] = useState('');
  const [loadingCapacityKg, setLoadingCapacityKg] = useState<number | ''>('');
  const [temperatureC, setTemperatureC] = useState<number | ''>(-20);
  const [monthlyRateInput, setMonthlyRateInput] = useState('');
  const [fixedKm, setFixedKm] = useState<number | ''>('');
  const [additionalPerKmRs, setAdditionalPerKmRs] = useState<number | ''>('');
  const [tollIncluded, setTollIncluded] = useState(false);
  const [loadLocations, setLoadLocations] = useState<string[]>([]);
  const [locationDraft, setLocationDraft] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState(DEFAULT_QUOTATION_TERMS);
  const [notes, setNotes] = useState('');
  const [hydrated, setHydrated] = useState(!isEdit);

  const { data: quotationRaw, isLoading: loadingQuotation } = useQuery({
    queryKey: ['quotation', quotationId],
    queryFn: async () => {
      const res = await quotationsApi.get(quotationId!);
      return res.data;
    },
    enabled: isEdit && !!quotationId,
  });

  const { data: clientsRaw = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      try {
        const res = await api.get('/clients');
        return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      } catch {
        return [];
      }
    },
  });

  const clientOptions = useMemo(
    () => toArray<unknown>(clientsRaw).map(normalizeClientOpt).filter((c): c is ClientOpt => c != null),
    [clientsRaw]
  );

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clientOptions;
    return clientOptions.filter((c) => c.name.toLowerCase().includes(q));
  }, [clientOptions, clientSearch]);

  useEffect(() => {
    if (!isEdit || !quotationRaw) return;
    const q = pickQuotationPayload(quotationRaw);
    if (!q) {
      setHydrated(true);
      return;
    }
    const cid = q.clientId ?? q.client_id;
    if (cid != null && String(cid)) {
      setManualClient(false);
      setClientId(String(cid));
    } else {
      setManualClient(true);
      setClientId('');
      setManualName(displayText(q.manualClientName ?? q.clientName ?? q.client_name, ''));
      setManualEmail(displayText(q.manualClientEmail ?? q.clientEmail, ''));
      setManualPhone(displayText(q.manualClientPhone ?? q.clientPhone, ''));
      setManualAddress(displayText(q.manualClientAddress ?? q.clientAddress, ''));
    }
    setAttnPerson(displayText(q.attnPerson ?? q.attn_person, ''));
    setSubject(displayText(q.subject, DEFAULT_QUOTATION_SUBJECT));
    setQuoteDate(sliceDate(String(q.quoteDate ?? q.quote_date ?? new Date().toISOString())));
    setValidityDays(Number(q.validityDays ?? q.validity_days ?? 30) || 30);
    const vt = displayText(q.vehicleType ?? q.vehicle_type, 'REEFER_VAN');
    setVehicleType(vt || 'REEFER_VAN');
    setVehicleTypeOther(displayText(q.vehicleTypeOther ?? q.vehicle_type_other, ''));
    setLoadingCapacityKg(
      q.loadingCapacityKg != null || q.loading_capacity_kg != null
        ? Number(q.loadingCapacityKg ?? q.loading_capacity_kg) || ''
        : ''
    );
    const tRaw = q.temperatureC ?? q.temperature_c;
    if (tRaw != null && tRaw !== '') {
      const n = Number(tRaw);
      setTemperatureC(Number.isFinite(n) ? clampQuotationTemp(n) : -20);
    } else {
      setTemperatureC(-20);
    }
    const mr = q.monthlyRate ?? q.monthly_rate;
    setMonthlyRateInput(mr != null && mr !== '' ? String(mr) : '');
    setFixedKm(q.fixedKm != null || q.fixed_km != null ? Number(q.fixedKm ?? q.fixed_km) || '' : '');
    setAdditionalPerKmRs(
      q.additionalPerKmRs != null || q.additional_per_km_rs != null
        ? Number(q.additionalPerKmRs ?? q.additional_per_km_rs) || ''
        : ''
    );
    setTollIncluded(Boolean(q.tollIncluded ?? q.toll_included));
    setLoadLocations(readStringArray(q.loadLocations ?? q.load_locations));
    setTermsAndConditions(
      typeof q.termsAndConditions === 'string' && q.termsAndConditions
        ? q.termsAndConditions
        : typeof q.terms_and_conditions === 'string'
          ? q.terms_and_conditions
          : DEFAULT_QUOTATION_TERMS
    );
    setNotes(typeof q.notes === 'string' ? q.notes : '');
    setHydrated(true);
  }, [isEdit, quotationRaw]);

  const validUntilLabel = useMemo(() => addDays(quoteDate, validityDays), [quoteDate, validityDays]);

  const monthlyRateNum = useMemo(() => {
    const n = Number(String(monthlyRateInput).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [monthlyRateInput]);

  const buildPayload = (status: 'DRAFT' | 'SENT') => {
    const base: Record<string, unknown> = {
      attnPerson: attnPerson.trim() || undefined,
      subject: subject.trim() || DEFAULT_QUOTATION_SUBJECT,
      quoteDate: quoteDate ? new Date(quoteDate).toISOString() : undefined,
      validityDays,
      vehicleType,
      vehicleTypeOther: vehicleType === 'OTHER' ? vehicleTypeOther.trim() || undefined : undefined,
      loadingCapacityKg: loadingCapacityKg === '' ? undefined : Number(loadingCapacityKg),
      temperatureC: temperatureC === '' ? -20 : Number(temperatureC),
      monthlyRate: monthlyRateNum,
      fixedKm: fixedKm === '' ? undefined : Number(fixedKm),
      additionalPerKmRs: additionalPerKmRs === '' ? undefined : Number(additionalPerKmRs),
      tollIncluded,
      loadLocations,
      termsAndConditions,
      notes: notes.trim() || undefined,
      status,
    };
    if (manualClient) {
      base.clientId = null;
      base.manualClient = {
        name: manualName.trim(),
        email: manualEmail.trim() || undefined,
        phone: manualPhone.trim() || undefined,
        address: manualAddress.trim() || undefined,
      };
    } else {
      base.clientId = clientId || undefined;
    }
    return base;
  };

  const saveMutation = useMutation({
    mutationFn: async ({ status }: { status: 'DRAFT' | 'SENT' }) => {
      const payload = buildPayload(status);
      if (isEdit && quotationId) {
        const res = await quotationsApi.update(quotationId, payload);
        return { res, id: quotationId };
      }
      const res = await quotationsApi.create(payload);
      const data = res.data?.data ?? res.data?.quotation ?? res.data;
      const id =
        data && typeof data === 'object' && data !== null && 'id' in data ? String((data as { id: unknown }).id) : '';
      return { res, id };
    },
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ['quotations-list'] });
      qc.invalidateQueries({ queryKey: ['quotations-stats'] });
      toast.success(isEdit ? 'Quotation updated' : 'Quotation saved');
      if (id) {
        qc.invalidateQueries({ queryKey: ['quotation', id] });
        router.push(`/quotations/${id}`);
      } else router.push('/quotations');
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? displayText((e as { response?: { data?: { message?: unknown } } }).response?.data?.message, '')
          : '';
      toast.error(msg || 'Could not save quotation');
    },
  });

  const addLocationChip = () => {
    const t = locationDraft.trim();
    if (!t || loadLocations.includes(t)) return;
    setLoadLocations([...loadLocations, t]);
    setLocationDraft('');
  };

  const removeLocation = (loc: string) => setLoadLocations(loadLocations.filter((l) => l !== loc));

  if (isEdit && (loadingQuotation || !hydrated)) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner text="Loading quotation…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/quotations"
          className="p-2 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8]"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">
          {isEdit ? 'Edit quotation' : 'New quotation'}
        </h1>
      </div>

      <form
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate({ status: 'DRAFT' });
        }}
      >
        <section className="bg-white border border-[#E0E8F0] rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="font-['Oswald'] text-sm font-bold text-[#1565C0] uppercase tracking-wider border-b border-[#E0E8F0] pb-2">
            Client details
          </h2>
          <label className="flex items-center gap-2 cursor-pointer font-['Rajdhani'] text-sm text-[#0D2847]">
            <input
              type="checkbox"
              checked={manualClient}
              onChange={(e) => setManualClient(e.target.checked)}
              className="rounded border-[#E0E8F0] text-[#1565C0] focus:ring-[#42A5F5]"
            />
            Or enter manually (new client)
          </label>
          {!manualClient ? (
            <div className="space-y-2">
              <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8]">Client</label>
              <input
                type="text"
                className={inputClass}
                placeholder="Search clients…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              <select
                className={inputClass}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required={!manualClient}
              >
                <option value="">Select client</option>
                {filteredClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">
                  Client name *
                </label>
                <input
                  className={inputClass}
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  required={manualClient}
                />
              </div>
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Email</label>
                <input type="email" className={inputClass} value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} />
              </div>
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Phone</label>
                <input className={inputClass} value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Address</label>
                <textarea className={inputClass} rows={2} value={manualAddress} onChange={(e) => setManualAddress(e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Attn person</label>
            <input className={inputClass} value={attnPerson} onChange={(e) => setAttnPerson(e.target.value)} />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Subject</label>
            <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        </section>

        <section className="bg-white border border-[#E0E8F0] rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="font-['Oswald'] text-sm font-bold text-[#1565C0] uppercase tracking-wider border-b border-[#E0E8F0] pb-2">
            Quote details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Quote date</label>
              <input type="date" className={inputClass} value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Validity (days)</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value) || 30)}
              />
            </div>
          </div>
          <p className="font-['Rajdhani'] text-sm text-[#1A4A7A] bg-[#F4F6F8] rounded-lg px-3 py-2 border border-[#E0E8F0]">
            <span className="font-semibold text-[#0D2847]">Valid until:</span> {validUntilLabel || '—'}
          </p>
        </section>

        <section className="bg-white border border-[#E0E8F0] rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="font-['Oswald'] text-sm font-bold text-[#1565C0] uppercase tracking-wider border-b border-[#E0E8F0] pb-2">
            Vehicle &amp; rates
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Vehicle type</label>
              <select className={inputClass} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                {VEHICLE_QUOTE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {vehicleType === 'OTHER' && (
              <div className="sm:col-span-2">
                <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Describe vehicle</label>
                <input className={inputClass} value={vehicleTypeOther} onChange={(e) => setVehicleTypeOther(e.target.value)} />
              </div>
            )}
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Loading capacity (kg)</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={loadingCapacityKg}
                onChange={(e) => setLoadingCapacityKg(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Temperature (°C)</label>
              <select
                className={inputClass}
                value={temperatureC === '' ? '' : String(temperatureC)}
                onChange={(e) => {
                  const v = e.target.value;
                  setTemperatureC(v === '' ? '' : Number(v));
                }}
              >
                <option value="">Select temperature</option>
                {QUOTATION_TEMPERATURE_OPTIONS.map((temp) => (
                  <option key={temp} value={temp}>
                    {temp > 0 ? `+${temp}` : temp} °C
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Monthly rate (₹)</label>
              <input
                className={inputClass}
                value={monthlyRateInput}
                onChange={(e) => setMonthlyRateInput(e.target.value)}
                placeholder="e.g. 85000"
              />
              {monthlyRateNum > 0 && (
                <p className="text-xs text-[#7A9AB8] mt-1 font-['Rajdhani']">{formatIndianCurrency(monthlyRateNum)}</p>
              )}
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Fixed KM</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={fixedKm}
                onChange={(e) => setFixedKm(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Additional per KM (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={additionalPerKmRs}
                onChange={(e) => setAdditionalPerKmRs(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <label className="flex items-center gap-2 sm:col-span-2 font-['Rajdhani'] text-sm text-[#0D2847] cursor-pointer">
              <input
                type="checkbox"
                checked={tollIncluded}
                onChange={(e) => setTollIncluded(e.target.checked)}
                className="rounded border-[#E0E8F0] text-[#1565C0]"
              />
              Toll included
            </label>
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Load locations</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {loadLocations.map((loc) => (
                <span
                  key={loc}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#42A5F5]/15 text-[#1565C0] text-sm font-['Rajdhani']"
                >
                  {loc}
                  <button type="button" onClick={() => removeLocation(loc)} className="p-0.5 hover:bg-[#42A5F5]/20 rounded" aria-label={`Remove ${loc}`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={locationDraft}
                onChange={(e) => setLocationDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLocationChip();
                  }
                }}
                placeholder="Type location, press Enter"
              />
              <button type="button" onClick={addLocationChip} className="px-4 py-2 rounded-lg bg-[#0D2847] text-white font-['Barlow_Condensed'] text-sm uppercase shrink-0">
                Add
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white border border-[#E0E8F0] rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="font-['Oswald'] text-sm font-bold text-[#1565C0] uppercase tracking-wider border-b border-[#E0E8F0] pb-2">
            Terms &amp; notes
          </h2>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Terms &amp; conditions</label>
            <textarea className={inputClass} rows={8} value={termsAndConditions} onChange={(e) => setTermsAndConditions(e.target.value)} />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-[#7A9AB8] mb-1">Notes</label>
            <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex-1 py-3 rounded-lg border-2 border-[#1565C0] text-[#1565C0] font-['Barlow_Condensed'] font-semibold uppercase tracking-wider hover:bg-[#1565C0]/5 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving…' : 'Save as draft'}
          </button>
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({ status: 'SENT' })}
            className="flex-1 py-3 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] font-semibold uppercase tracking-wider hover:bg-[#0D2847] disabled:opacity-50"
          >
            Save &amp; send
          </button>
        </div>
      </form>
    </div>
  );
}
