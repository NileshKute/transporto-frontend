'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { vehiclesApi } from '@/lib/api/vehicles';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { Pagination } from '@/components/ui/Pagination';
import { VehicleGpsPathMap } from '@/components/vehicles/VehicleGpsPathMap';
import { formatCurrency, formatDate, formatDateDdMmYyyy, formatInrTwoDecimals, formatKm, formatNumber, safe, safeNumber } from '@/lib/utils';
import {
  formatEmissionShort,
  formatOwnerSerialDisplay,
  hasDisplayValue,
  parseRcStatusTone,
  pickVehicleField,
  vehicleClassLabel,
} from '@/lib/vehicleDisplay';
import {
  ArrowLeft,
  Truck,
  Shield,
  FileCheck,
  Car,
  Receipt,
  ScrollText,
  IndianRupee,
  Fuel,
  Wrench,
  RefreshCw,
  Navigation,
} from 'lucide-react';
import { VerifyRcForVehicleButton } from '@/components/vehicles/RcVerifyButtons';

const TABS = [
  'Trips',
  'Fuel',
  'Toll',
  'Maintenance',
  'Insurance',
  'Doc Status',
  'Documents',
  'GPS',
] as const;

const LIST_PAGE_SIZE = 20;

const TOLL_TYPE_LABEL: Record<string, string> = {
  TOLL: 'Toll Txn',
  NON_FIN: 'Non-fin',
  SD_DEBIT: 'SD-Debit',
  OTHER: 'Other',
};

function parsePagedList(res: unknown): { rows: Record<string, unknown>[]; total: number; totalPages: number } {
  const root = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
  const body = root.data !== undefined && root.data !== null ? root.data : root;
  const inner = typeof body === 'object' && body && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const rowsRaw = Array.isArray(body)
    ? (body as Record<string, unknown>[])
    : Array.isArray(inner.data)
      ? (inner.data as Record<string, unknown>[])
      : [];
  const total = Number(inner.total ?? root.total ?? rowsRaw.length) || 0;
  const totalPages = Math.max(
    1,
    Number(inner.totalPages ?? (Math.ceil(total / LIST_PAGE_SIZE) || 1)),
  );
  return { rows: rowsRaw, total, totalPages };
}

function TabTableSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="p-4 space-y-2 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-2">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-8 flex-1 bg-[#E0E8F0] rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

function QueryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-8 text-center space-y-3">
      <p className="text-sm text-red-700 font-['Rajdhani']">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1565C0] text-white text-sm font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847]"
      >
        <RefreshCw className="w-4 h-4" /> Retry
      </button>
    </div>
  );
}

function getDocStatus(expiryDate: string | null | undefined): { label: string; color: string; bg: string; border: string } {
  if (!expiryDate) return { label: 'N/A', color: 'text-[#7A9AB8]', bg: 'bg-gray-50', border: 'border-gray-200' };
  const now = new Date();
  const exp = new Date(expiryDate);
  if (isNaN(exp.getTime())) return { label: 'N/A', color: 'text-[#7A9AB8]', bg: 'bg-gray-50', border: 'border-gray-200' };
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
  if (daysLeft < 0) return { label: 'Expired', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' };
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
  return { label: 'Valid', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' };
}

function HeaderRcStatusBadge({ status }: { status: unknown }) {
  const s = String(status ?? '').trim();
  if (!s) return null;
  const tone = parseRcStatusTone(s);
  const dot =
    tone === 'active' ? 'bg-emerald-500' : tone === 'inactive' ? 'bg-red-500' : tone === 'suspended' ? 'bg-amber-500' : 'bg-slate-400';
  const pill =
    tone === 'active'
      ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
      : tone === 'inactive'
        ? 'text-red-800 bg-red-50 border-red-200'
        : tone === 'suspended'
          ? 'text-amber-900 bg-amber-50 border-amber-200'
          : 'text-slate-700 bg-slate-100 border-slate-200';
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border font-['Barlow_Condensed'] uppercase tracking-wide ${pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} aria-hidden />
      {s.toUpperCase()}
    </span>
  );
}

function DetailSubsection({
  title,
  items,
  footer,
}: {
  title: string;
  items: { label: string; value: string }[];
  footer?: ReactNode;
}) {
  if (!items.length && !footer) return null;
  return (
    <div className="space-y-3">
      <h4 className="font-['Barlow_Condensed'] text-[11px] font-bold uppercase tracking-widest text-[#1A4A7A]">{title}</h4>
      {items.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-[#E0E8F0] bg-[#FAFBFC] px-3 py-2.5 min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-[#7A9AB8] font-['Barlow_Condensed'] mb-0.5">{label}</p>
              <p className="text-sm font-medium text-[#0D2847] break-words">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
      {footer}
    </div>
  );
}

function withUnit(val: unknown, unit: string): string | undefined {
  if (!hasDisplayValue(val)) return undefined;
  const s = String(val).trim();
  if (s.toLowerCase().endsWith(unit.toLowerCase())) return s;
  return `${s} ${unit}`;
}

function DocCard({ title, icon: Icon, fields }: { title: string; icon: any; fields: { label: string; value: string; isExpiry?: boolean }[] }) {
  const expiryField = fields.find(f => f.isExpiry);
  const status = getDocStatus(expiryField?.value === '—' ? null : expiryField?.value);

  return (
    <div className={`rounded-xl border ${status.border} ${status.bg} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#1A4A7A]" />
          <h4 className="text-sm font-semibold text-[#0D2847]">{title}</h4>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.color} ${status.bg}`}>{status.label}</span>
      </div>
      <div className="space-y-1.5">
        {fields.map(f => (
          <div key={f.label} className="flex justify-between text-xs">
            <span className="text-[#7A9AB8]">{f.label}</span>
            <span className="text-[#0D2847] font-medium">{f.isExpiry ? formatDate(f.value) : safe(f.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VehicleDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Trips');
  const [listPage, setListPage] = useState(1);
  const vehicleId = id != null ? String(id) : '';

  useEffect(() => {
    setListPage(1);
  }, [tab]);

  const { data: v, isLoading } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => api.get(`/vehicles/${id}`).then((r) => r.data),
  });

  const {
    data: summaryRaw,
    isLoading: summaryLoading,
    isError: summaryIsError,
    error: summaryQueryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['vehicle-summary', vehicleId],
    queryFn: async () => {
      const r = await vehiclesApi.getSummary(vehicleId);
      return r.data as Record<string, unknown>;
    },
    enabled: !!vehicleId,
  });

  const tripsQuery = useQuery({
    queryKey: ['vehicle-trips', vehicleId, listPage],
    queryFn: async () => {
      const r = await vehiclesApi.getTrips(vehicleId, { page: listPage, limit: LIST_PAGE_SIZE });
      return parsePagedList(r.data);
    },
    enabled: !!vehicleId && tab === 'Trips',
  });

  const fuelQuery = useQuery({
    queryKey: ['vehicle-fuel', vehicleId, listPage],
    queryFn: async () => {
      const r = await vehiclesApi.getFuelTransactions(vehicleId, { page: listPage, limit: LIST_PAGE_SIZE });
      return parsePagedList(r.data);
    },
    enabled: !!vehicleId && tab === 'Fuel',
  });

  const tollQuery = useQuery({
    queryKey: ['vehicle-toll', vehicleId, listPage],
    queryFn: async () => {
      const r = await vehiclesApi.getTollTransactions(vehicleId, { page: listPage, limit: LIST_PAGE_SIZE });
      return parsePagedList(r.data);
    },
    enabled: !!vehicleId && tab === 'Toll',
  });

  const maintQuery = useQuery({
    queryKey: ['vehicle-maint-history', vehicleId, listPage],
    queryFn: async () => {
      const r = await vehiclesApi.getMaintenanceHistory(vehicleId, { page: listPage, limit: LIST_PAGE_SIZE });
      return parsePagedList(r.data);
    },
    enabled: !!vehicleId && tab === 'Maintenance',
  });

  const gpsQuery = useQuery({
    queryKey: ['vehicle-gps-history', vehicleId],
    queryFn: async () => {
      const r = await vehiclesApi.getGpsHistory(vehicleId);
      const root = r.data as Record<string, unknown> | undefined;
      const pts = root?.points ?? root?.data;
      return Array.isArray(pts) ? pts : [];
    },
    enabled: !!vehicleId && tab === 'GPS',
  });

  if (isLoading) return <LoadingSpinner />;
  if (!v) return <EmptyState message="Vehicle not found" />;

  const vr = v as Record<string, unknown>;

  const summary = summaryRaw;
  const last30 = (summary?.last30Days as Record<string, unknown>) ?? {};
  const tollSpend30 = safeNumber(last30.tollSpend, 0);
  const tollTxn30 = safeNumber(last30.tollTxnCount, 0);
  const fuelSpend30 = safeNumber(last30.fuelSpend, 0);
  const fuelLitres30 = safeNumber(last30.fuelLitres ?? last30.litres, 0);
  const trips30 = safeNumber(last30.tripCount, 0);
  const maint30 = safeNumber(last30.maintenanceCost, 0);
  const gpsMeta = (summary?.gps as Record<string, unknown>) ?? {};
  const nextExpiry = summary?.nextExpiry as
    | { label?: string; severity?: string; daysLeft?: number }
    | null
    | undefined;
  const currentDriver = summary?.currentDriver as { id?: string; name?: string } | null | undefined;

  const insuranceRows = Array.isArray(vr.insurance) ? (vr.insurance as unknown[]) : [];

  const vehicleItems: { label: string; value: string }[] = [];
  const push = (label: string, val: unknown, format?: (s: string) => string) => {
    if (!hasDisplayValue(val)) return;
    const s = format ? format(String(val)) : String(val);
    vehicleItems.push({ label, value: s });
  };

  push('Make', pickVehicleField(vr, ['make']));
  push('Model', pickVehicleField(vr, ['model']));
  push('Variant', pickVehicleField(vr, ['variant', 'vehicleVariant']));
  push('Year', pickVehicleField(vr, ['year']));
  push('Fuel', pickVehicleField(vr, ['fuelType', 'fuel']));
  push('Body type', pickVehicleField(vr, ['bodyType', 'vehicleBodyType']));
  const emissionRaw = pickVehicleField(vr, ['emissionNorms', 'emissionStandard', 'norms']);
  if (hasDisplayValue(emissionRaw)) push('Emission', emissionRaw, formatEmissionShort);
  push('Color', pickVehicleField(vr, ['color', 'colour']));
  push('Engine', pickVehicleField(vr, ['engineNumber', 'engineNo']));
  push('Chassis', pickVehicleField(vr, ['chassisNumber', 'chassisNo']));
  const cc = pickVehicleField(vr, ['cubicCapacity', 'engineDisplacement', 'vehicleCC']);
  const ccStr = withUnit(cc, 'cc');
  if (ccStr) vehicleItems.push({ label: 'CC', value: ccStr });
  push('Cylinders', pickVehicleField(vr, ['numCylinders', 'cylinders', 'noOfCylinders']));
  push('Seats', pickVehicleField(vr, ['seatingCapacity', 'seats', 'seatCap']));
  const wb = withUnit(pickVehicleField(vr, ['wheelbase', 'wheelbaseMm']), 'mm');
  if (wb) vehicleItems.push({ label: 'Wheelbase', value: wb });
  const gvw = withUnit(pickVehicleField(vr, ['grossVehicleWeight', 'grossVehicleWeightKg', 'gvw']), 'kg');
  if (gvw) vehicleItems.push({ label: 'GVW', value: gvw });
  const ulw = withUnit(pickVehicleField(vr, ['unladenWeight', 'unladenWeightKg', 'ulw']), 'kg');
  if (ulw) vehicleItems.push({ label: 'Unladen', value: ulw });
  const load = withUnit(pickVehicleField(vr, ['loadCapacityKg', 'payload']), 'kg');
  if (load) vehicleItems.push({ label: 'Load cap.', value: load });
  if (hasDisplayValue(vr.currentKm)) vehicleItems.push({ label: 'Current KM', value: formatKm(vr.currentKm) });
  push('Tires', pickVehicleField(vr, ['numTires', 'tires']));
  if (Number.isFinite(safeNumber(vr.tankCapacityL, NaN)))
    vehicleItems.push({ label: 'Tank', value: `${safeNumber(vr.tankCapacityL)} L` });
  if (hasDisplayValue(vr.purchaseDate))
    vehicleItems.push({
      label: 'Purchase date',
      value: formatDate(vr.purchaseDate as string | Date),
    });

  const regItems: { label: string; value: string }[] = [];
  const rpush = (label: string, val: unknown, format?: (s: string) => string) => {
    if (!hasDisplayValue(val)) return;
    regItems.push({ label, value: format ? format(String(val)) : String(val) });
  };
  rpush('RC number', pickVehicleField(vr, ['rcNumber', 'regNumber']));
  const rcSt = pickVehicleField(vr, ['rcStatus', 'rc_status']);
  if (hasDisplayValue(rcSt)) {
    regItems.push({
      label: 'RC status',
      value: `● ${String(rcSt).toUpperCase()}`,
    });
  }
  const regDt = pickVehicleField(vr, ['registrationDate', 'regDate', 'dateOfRegistration']);
  if (hasDisplayValue(regDt))
    regItems.push({ label: 'Reg. date', value: formatDateDdMmYyyy(regDt as string | Date) });
  rpush('RTO', pickVehicleField(vr, ['registeredAt', 'rto', 'registeredRTO', 'registrationLocation', 'rtoName']));
  rpush('Owner', pickVehicleField(vr, ['ownerName', 'owner']));
  rpush('Father', pickVehicleField(vr, ['fatherName', 'father_name']));
  const ownSer = formatOwnerSerialDisplay(pickVehicleField(vr, ['ownerNumber', 'ownerSerial', 'ownerSerialNumber']));
  if (ownSer) regItems.push({ label: 'Owner no.', value: ownSer });
  const vclass = vehicleClassLabel(vr);
  if (vclass) regItems.push({ label: 'Class', value: vclass });

  const ownerAddr = pickVehicleField(vr, ['ownerAddress', 'address', 'registeredAddress']);
  const regFooter =
    hasDisplayValue(ownerAddr) ? (
      <div className="rounded-lg border border-[#E0E8F0] bg-white px-3 py-2.5 mt-1">
        <p className="text-[10px] uppercase tracking-wide text-[#7A9AB8] font-['Barlow_Condensed'] mb-1">Address</p>
        <p className="text-sm text-[#0D2847] break-words whitespace-pre-wrap">{String(ownerAddr)}</p>
      </div>
    ) : null;

  const financer = pickVehicleField(vr, ['financer', 'financingBank', 'hypothecation']);
  const isFinanced =
    vr.isFinanced === true ||
    vr.isFinanced === 'true' ||
    (typeof financer === 'string' && financer.trim() !== '');
  const showFinance = isFinanced || hasDisplayValue(financer);

  const bl = pickVehicleField(vr, ['blacklistStatus', 'blacklist']);
  const noc = pickVehicleField(vr, ['nocDetails', 'noc']);
  const nonUse = pickVehicleField(vr, ['nonUseStatus', 'nonUse']);
  const showCompliance = hasDisplayValue(bl) || hasDisplayValue(noc) || hasDisplayValue(nonUse);

  const complianceItems: { label: string; value: string }[] = [];
  if (showCompliance) {
    complianceItems.push({
      label: 'Blacklist',
      value: hasDisplayValue(bl) ? String(bl) : 'Clear ✅',
    });
    if (hasDisplayValue(noc)) complianceItems.push({ label: 'NOC', value: String(noc) });
    if (hasDisplayValue(nonUse)) complianceItems.push({ label: 'Non-use', value: String(nonUse) });
  }

  const variant = pickVehicleField(vr, ['variant']);
  const make = pickVehicleField(vr, ['make']);
  const model = pickVehicleField(vr, ['model']);
  const yearStr =
    vr.year != null && typeof vr.year !== 'object' ? String(vr.year) : '';
  const subtitleCore = [make, model, variant].filter(Boolean).join(' ');
  const subtitle = subtitleCore ? (yearStr ? `${subtitleCore} · ${yearStr}` : subtitleCore) : yearStr;

  const hasVehicleBlock = vehicleItems.length > 0;
  const hasRegBlock = regItems.length > 0 || !!regFooter;
  const showInfoCard = hasVehicleBlock || hasRegBlock || showFinance || showCompliance;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 text-[#7A9AB8] hover:text-[#0D2847] hover:bg-[#F4F6F8] rounded-lg transition-colors"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
          <div className="p-2 bg-[#42A5F5]/10 rounded-xl shrink-0"><Truck className="w-5 h-5 text-[#42A5F5]" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-[#0D2847] font-mono">{safe(v.regNumber)}</h2>
              <VerifyRcForVehicleButton
                vehicleId={vehicleId}
                currentVehicle={v as Record<string, unknown>}
                onApplied={() => void qc.invalidateQueries({ queryKey: ['vehicle', id] })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {subtitle ? <p className="text-sm text-[#7A9AB8]">{subtitle}</p> : null}
              <HeaderRcStatusBadge status={pickVehicleField(vr, ['rcStatus', 'rc_status'])} />
            </div>
          </div>
        </div>
        <StatusBadge status={v.status} size="md" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {summaryLoading ? (
          <span className="text-xs text-[#7A9AB8] font-['Rajdhani']">Loading status…</span>
        ) : summaryIsError ? (
          <span className="text-xs text-red-600">Summary unavailable</span>
        ) : (
          <>
            <span
              className={`inline-flex items-center gap-2 text-xs font-['Barlow_Condensed'] uppercase tracking-wider px-3 py-1.5 rounded-full border ${
                String(gpsMeta.status) === 'ONLINE'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${String(gpsMeta.status) === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-400'}`}
              />
              GPS: {String(gpsMeta.status ?? '—')}
              {gpsMeta.lastSeenMinutesAgo != null && Number.isFinite(Number(gpsMeta.lastSeenMinutesAgo)) ? (
                <span className="normal-case font-['Rajdhani'] text-[#1A4A7A]">
                  · Last seen {String(gpsMeta.lastSeenMinutesAgo)} min ago
                </span>
              ) : null}
            </span>
            {nextExpiry?.label ? (
              <span
                className={`inline-flex items-center text-xs font-['Barlow_Condensed'] uppercase tracking-wider px-3 py-1.5 rounded-full border ${
                  nextExpiry.severity === 'red'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : nextExpiry.severity === 'yellow'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                Next: {nextExpiry.label}
              </span>
            ) : null}
            {currentDriver?.id ? (
              <Link
                href={`/drivers/${encodeURIComponent(currentDriver.id)}`}
                className="inline-flex items-center text-xs font-['Rajdhani'] px-3 py-1.5 rounded-full border border-[#1565C0]/40 bg-[#E3F2FD] text-[#0D2847] hover:bg-[#BBDEFB]"
              >
                Driver: {safe(currentDriver.name)}
              </Link>
            ) : (
              <span className="text-xs text-[#7A9AB8] font-['Rajdhani']">No current driver assigned</span>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 min-w-0">
          {summaryLoading ? (
            <div className="col-span-full py-6 flex justify-center">
              <LoadingSpinner text="Loading summary…" />
            </div>
          ) : summaryIsError ? (
            <div className="col-span-full">
              <QueryError
                message={(summaryQueryError as Error)?.message ?? 'Failed to load vehicle summary'}
                onRetry={() => void refetchSummary()}
              />
            </div>
          ) : (
            <>
              <StatCard
                icon={IndianRupee}
                iconColor="amber"
                title="Toll spend (30d)"
                value={formatInrTwoDecimals(tollSpend30)}
                subtitle={tollTxn30 ? `${formatNumber(tollTxn30)} txns` : undefined}
              />
              <StatCard
                icon={Fuel}
                iconColor="cyan"
                title="Fuel spend (30d)"
                value={formatInrTwoDecimals(fuelSpend30)}
                subtitle={fuelLitres30 ? `${fuelLitres30.toLocaleString('en-IN', { maximumFractionDigits: 2 })} L` : undefined}
              />
              <StatCard
                icon={Navigation}
                iconColor="blue"
                title="Trips (30d)"
                value={String(formatNumber(trips30))}
              />
              <StatCard
                icon={Wrench}
                iconColor="purple"
                title="Maintenance (30d)"
                value={formatInrTwoDecimals(maint30)}
              />
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => void refetchSummary()}
          disabled={summaryLoading}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-[#E0E8F0] text-[#0D2847] hover:bg-[#F4F6F8] font-['Barlow_Condensed'] uppercase tracking-wider text-xs shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-[#1565C0] ${summaryLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {showInfoCard ? (
        <div className="bg-white border border-[#E0E8F0] rounded-xl p-5 space-y-8">
          <h3 className="text-sm font-semibold text-[#1A4A7A] font-['Barlow_Condensed'] uppercase tracking-wider">
            Vehicle information
          </h3>
          <DetailSubsection title="Vehicle" items={vehicleItems} />
          <DetailSubsection title="Registration & owner" items={regItems} footer={regFooter} />
          {showFinance ? (
            <div className="space-y-3">
              <h4 className="font-['Barlow_Condensed'] text-[11px] font-bold uppercase tracking-widest text-[#1A4A7A]">Finance</h4>
              <div className="rounded-xl border border-[#E0E8F0] bg-[#FAFBFC] px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#0D2847]">
                {hasDisplayValue(financer) ? (
                  <span>
                    <span className="text-[#7A9AB8] font-['Barlow_Condensed'] text-xs uppercase mr-1">Financer</span>
                    {String(financer)}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-2 text-[#7A9AB8] font-['Barlow_Condensed'] text-xs uppercase">
                  Status:
                  <span className="text-amber-900 font-semibold normal-case font-['Rajdhani'] text-sm" title="Under finance">
                    🔒
                  </span>
                </span>
              </div>
            </div>
          ) : null}
          {showCompliance ? <DetailSubsection title="Compliance" items={complianceItems} /> : null}
        </div>
      ) : null}

      <div className="bg-white border border-[#E0E8F0] rounded-xl overflow-hidden">
        <div className="flex border-b border-[#E0E8F0] overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors font-['Barlow_Condensed'] uppercase tracking-wider ${
                tab === t ? 'text-[#1565C0] border-b-2 border-[#1565C0] bg-[#F4F6F8]/50' : 'text-[#1A4A7A] hover:text-[#0D2847]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          {tab === 'Trips' && (
            <div>
              {tripsQuery.isLoading ? (
                <TabTableSkeleton cols={5} />
              ) : tripsQuery.isError ? (
                <QueryError
                  message={(tripsQuery.error as Error)?.message ?? 'Failed to load trips'}
                  onRetry={() => void tripsQuery.refetch()}
                />
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Client</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">From</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">To</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E8F0]">
                      {tripsQuery.data?.rows?.length ? (
                        tripsQuery.data.rows.map((row: Record<string, unknown>) => (
                          <tr key={String(row.id ?? '')} className="hover:bg-[#F8F9FA]">
                            <td className="px-4 py-2 text-[#0D2847] font-['Rajdhani'] whitespace-nowrap">
                              {formatDate(row.date as string)}
                            </td>
                            <td className="px-4 py-2 text-[#0D2847]">{safe(row.clientName)}</td>
                            <td className="px-4 py-2 text-[#1A4A7A] text-xs max-w-[140px] truncate">{safe(row.startLocation)}</td>
                            <td className="px-4 py-2 text-[#1A4A7A] text-xs max-w-[140px] truncate">{safe(row.endLocation)}</td>
                            <td className="px-4 py-2">
                              <StatusBadge status={safe(row.status)} />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-6">
                            <EmptyState message="No trips" />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {tripsQuery.data && tripsQuery.data.total > LIST_PAGE_SIZE ? (
                    <Pagination
                      page={listPage}
                      totalPages={tripsQuery.data.totalPages}
                      total={tripsQuery.data.total}
                      limit={LIST_PAGE_SIZE}
                      onPageChange={setListPage}
                    />
                  ) : null}
                </>
              )}
            </div>
          )}
          {tab === 'Fuel' && (
            <div>
              {fuelQuery.isLoading ? (
                <TabTableSkeleton cols={6} />
              ) : fuelQuery.isError ? (
                <QueryError
                  message={(fuelQuery.error as Error)?.message ?? 'Failed to load fuel'}
                  onRetry={() => void fuelQuery.refetch()}
                />
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Station</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">City / Loc</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Litres</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Rate</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E8F0]">
                      {fuelQuery.data?.rows?.length ? (
                        fuelQuery.data.rows.map((f: Record<string, unknown>) => (
                          <tr key={String(f.id ?? '')} className="hover:bg-[#F8F9FA]">
                            <td className="px-4 py-2 font-['Rajdhani'] text-[#0D2847] whitespace-nowrap">{formatDate(f.date as string)}</td>
                            <td className="px-4 py-2 text-xs text-[#1A4A7A]">{safe(f.fuelStation)}</td>
                            <td className="px-4 py-2 text-xs text-[#7A9AB8]">{safe(f.location ?? '—')}</td>
                            <td className="px-4 py-2 font-mono">{safeNumber(f.liters, 0).toFixed(2)}</td>
                            <td className="px-4 py-2 font-mono">{formatInrTwoDecimals(safeNumber(f.ratePerLiter, 0))}</td>
                            <td className="px-4 py-2 font-mono font-semibold text-[#16A34A]">{formatCurrency(safeNumber(f.totalCost, 0))}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-6">
                            <EmptyState message="No fuel transactions" />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {fuelQuery.data && fuelQuery.data.total > LIST_PAGE_SIZE ? (
                    <Pagination
                      page={listPage}
                      totalPages={fuelQuery.data.totalPages}
                      total={fuelQuery.data.total}
                      limit={LIST_PAGE_SIZE}
                      onPageChange={setListPage}
                    />
                  ) : null}
                </>
              )}
            </div>
          )}
          {tab === 'Toll' && (
            <div>
              {tollQuery.isLoading ? (
                <TabTableSkeleton cols={5} />
              ) : tollQuery.isError ? (
                <QueryError
                  message={(tollQuery.error as Error)?.message ?? 'Failed to load toll'}
                  onRetry={() => void tollQuery.refetch()}
                />
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Plaza</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Debit</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E8F0]">
                      {tollQuery.data?.rows?.length ? (
                        tollQuery.data.rows.map((t: Record<string, unknown>) => {
                          const typ = String(t.transactionType ?? '');
                          return (
                            <tr key={String(t.id ?? '')} className="hover:bg-[#F8F9FA]">
                              <td className="px-4 py-2 font-['Rajdhani'] whitespace-nowrap text-[#0D2847]">
                                {formatDate(t.transactionDateTime as string)}
                              </td>
                              <td className="px-4 py-2 text-xs max-w-[200px] truncate">{safe(t.plazaName)}</td>
                              <td className="px-4 py-2 text-xs">{TOLL_TYPE_LABEL[typ] ?? (typ || '—')}</td>
                              <td className="px-4 py-2 font-mono text-[#DC2626]">{formatInrTwoDecimals(safeNumber(t.debitAmt, 0))}</td>
                              <td className="px-4 py-2 font-mono">{formatInrTwoDecimals(safeNumber(t.closingBalance, 0))}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-6">
                            <EmptyState message="No toll transactions" />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {tollQuery.data && tollQuery.data.total > LIST_PAGE_SIZE ? (
                    <Pagination
                      page={listPage}
                      totalPages={tollQuery.data.totalPages}
                      total={tollQuery.data.total}
                      limit={LIST_PAGE_SIZE}
                      onPageChange={setListPage}
                    />
                  ) : null}
                </>
              )}
            </div>
          )}
          {tab === 'Maintenance' && (
            <div className="p-4 space-y-3">
              <Link
                href={`/maintenance?vehicleId=${encodeURIComponent(vehicleId)}&open=add`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1565C0] text-white text-sm font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847]"
              >
                + Add record
              </Link>
              {maintQuery.isLoading ? (
                <TabTableSkeleton cols={5} />
              ) : maintQuery.isError ? (
                <QueryError
                  message={(maintQuery.error as Error)?.message ?? 'Failed to load maintenance'}
                  onRetry={() => void maintQuery.refetch()}
                />
              ) : (
                <>
                  <div className="overflow-x-auto border border-[#E0E8F0] rounded-xl">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                          <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Date</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Type</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Description</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Cost</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Next due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maintQuery.data?.rows?.length ? (
                          maintQuery.data.rows.map((m: Record<string, unknown>) => {
                            const mt = m.type as Record<string, unknown> | undefined;
                            const typeLabel = mt?.name
                              ? `${safe(mt.icon)} ${safe(mt.name)}`.trim()
                              : safe(m.category);
                            const nextDue =
                              m.nextServiceDate != null
                                ? formatDate(m.nextServiceDate as string)
                                : m.nextServiceKm != null
                                  ? `${safeNumber(m.nextServiceKm, 0)} km`
                                  : m.nextServiceHours != null
                                    ? `${safeNumber(m.nextServiceHours, 0)} hrs`
                                    : '—';
                            return (
                              <tr key={String(m.id ?? '')} className="border-b border-[#E0E8F0] hover:bg-[#F4F6F8]/50">
                                <td className="px-4 py-2 text-xs font-['Rajdhani'] whitespace-nowrap">
                                  {formatDateDdMmYyyy(m.date as string)}
                                </td>
                                <td className="px-4 py-2 text-sm text-[#0D2847]">{typeLabel}</td>
                                <td className="px-4 py-2 text-xs text-[#1A4A7A] max-w-[220px] truncate">{safe(m.description)}</td>
                                <td className="px-4 py-2 font-mono font-semibold text-[#16A34A]">
                                  {formatInrTwoDecimals(safeNumber(m.totalCost, 0))}
                                </td>
                                <td className="px-4 py-2 text-xs text-[#1A4A7A]">{nextDue}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-6">
                              <EmptyState message="No maintenance history" description="Add a record from the maintenance book" />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {maintQuery.data && maintQuery.data.total > LIST_PAGE_SIZE ? (
                    <Pagination
                      page={listPage}
                      totalPages={maintQuery.data.totalPages}
                      total={maintQuery.data.total}
                      limit={LIST_PAGE_SIZE}
                      onPageChange={setListPage}
                    />
                  ) : null}
                </>
              )}
            </div>
          )}
          {tab === 'Insurance' && (
            <div className="p-0">
              {insuranceRows.length === 0 ? (
                <div className="p-8">
                  <EmptyState message="No insurance policies on file" />
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Provider</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Policy #</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Premium</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Expiry</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-[#1A4A7A]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E8F0]">
                    {insuranceRows.map((i) => {
                      const row = i as Record<string, unknown>;
                      return (
                        <tr key={String(row.id ?? '')}>
                          <td className="px-4 py-2 text-[#0D2847] font-medium">{safe(row.provider)}</td>
                          <td className="px-4 py-2 font-mono text-xs text-[#1A4A7A]">{safe(row.policyNumber)}</td>
                          <td className="px-4 py-2 text-xs text-[#1A4A7A]">{safe(row.type)}</td>
                          <td className="px-4 py-2 text-[#16A34A]">{formatCurrency(safeNumber(row.premium, 0))}</td>
                          <td className="px-4 py-2 text-xs text-[#1A4A7A]">{formatDate(row.endDate as string)}</td>
                          <td className="px-4 py-2">
                            <StatusBadge status={safe(row.status)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {tab === 'Doc Status' && (
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <DocCard title="PUC Certificate" icon={FileCheck} fields={[
                  { label: 'Number', value: v.pucNumber || '—' },
                  { label: 'Issue Date', value: v.pucIssueDate || '—', isExpiry: false },
                  { label: 'Expiry Date', value: v.pucExpiryDate, isExpiry: true },
                ]} />
                <DocCard title="Insurance" icon={Shield} fields={[
                  { label: 'Policy No', value: v.insurancePolicyNumber || '—' },
                  { label: 'Company', value: v.insuranceCompany || '—' },
                  { label: 'Type', value: v.insuranceType || '—' },
                  { label: 'Start Date', value: v.insuranceStartDate || '—', isExpiry: false },
                  { label: 'Expiry Date', value: v.insuranceExpiryDate, isExpiry: true },
                ]} />
                <DocCard title="Fitness Certificate" icon={Car} fields={[
                  { label: 'Number', value: v.fitnessNumber || '—' },
                  { label: 'Issue Date', value: v.fitnessIssueDate || '—', isExpiry: false },
                  { label: 'Expiry Date', value: v.fitnessExpiryDate, isExpiry: true },
                ]} />
                <DocCard title="Road Tax" icon={Receipt} fields={[
                  { label: 'Receipt No', value: v.taxReceiptNumber || '—' },
                  { label: 'Paid Date', value: v.taxPaidDate || '—', isExpiry: false },
                  { label: 'Amount', value: v.taxAmount ? `₹${Number(v.taxAmount).toLocaleString('en-IN')}` : '—' },
                  { label: 'Expiry Date', value: v.taxExpiryDate, isExpiry: true },
                ]} />
                <DocCard title="Permit" icon={ScrollText} fields={[
                  { label: 'Number', value: v.permitNumber || '—' },
                  { label: 'Type', value: v.permitType || '—' },
                  { label: 'Expiry Date', value: v.permitExpiryDate, isExpiry: true },
                ]} />
              </div>
            </div>
          )}
          {tab === 'Documents' && (
            <div className="p-6">
              {v.documents?.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {v.documents.map((d: any) => (
                    <div key={String(d.id ?? '')} className="bg-[#F4F6F8] border border-[#E0E8F0] rounded-xl p-4">
                      <p className="text-sm font-medium text-[#0D2847]">{typeof d.type === 'string' ? d.type.replace(/_/g, ' ') : safe(d.type)}</p>
                      <p className="text-xs text-[#7A9AB8] mt-1">Expires: {formatDate(d.expiryDate)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No documents" />
              )}
            </div>
          )}
          {tab === 'GPS' && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-[#7A9AB8] font-['Rajdhani']">
                Last 7 days of GPS history (polyline). Points from telematics sync.
              </p>
              {gpsQuery.isLoading ? (
                <div className="h-[360px] rounded-xl bg-[#E0E8F0] animate-pulse" />
              ) : gpsQuery.isError ? (
                <QueryError
                  message={(gpsQuery.error as Error)?.message ?? 'Failed to load GPS history'}
                  onRetry={() => void gpsQuery.refetch()}
                />
              ) : (
                <VehicleGpsPathMap
                  points={((gpsQuery.data ?? []) as { lat: number; lng: number }[]).map((p) => ({
                    lat: p.lat,
                    lng: p.lng,
                  }))}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
