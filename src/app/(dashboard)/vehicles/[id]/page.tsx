'use client';
import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate, formatDateDdMmYyyy, formatInrTwoDecimals, formatKm, safe, safeNumber } from '@/lib/utils';
import {
  formatEmissionShort,
  formatOwnerSerialDisplay,
  hasDisplayValue,
  parseRcStatusTone,
  pickVehicleField,
  vehicleClassLabel,
} from '@/lib/vehicleDisplay';
import { ArrowLeft, Truck, Shield, FileCheck, Car, Receipt, ScrollText } from 'lucide-react';
import { VerifyRcForVehicleButton } from '@/components/vehicles/RcVerifyButtons';

const TABS = ['Trips', 'Fuel', 'Maintenance', 'Insurance', 'Doc Status', 'Documents'];

function parseVehicleMaintenanceList(res: unknown): any[] {
  const root = res && typeof res === 'object' ? (res as Record<string, unknown>) : {};
  const inner = root.data !== undefined ? root.data : root;
  if (Array.isArray(inner)) return inner;
  const b = inner && typeof inner === 'object' ? (inner as Record<string, unknown>) : {};
  if (Array.isArray(b.data)) return b.data as any[];
  if (Array.isArray(b.records)) return b.records as any[];
  return [];
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
  const [tab, setTab] = useState('Trips');
  const [maintCategory, setMaintCategory] = useState<'TRUCK' | 'REEFER'>('TRUCK');
  const vehicleId = id != null ? String(id) : '';

  const { data: v, isLoading } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => api.get(`/vehicles/${id}`).then(r => r.data),
  });

  const { data: maintTruck = [] } = useQuery({
    queryKey: ['vehicle-maintenance-vehicle', vehicleId, 'TRUCK'],
    queryFn: async () => {
      const r = await api.get(`/vehicle-maintenance/vehicle/${vehicleId}`, { params: { category: 'TRUCK' } });
      return parseVehicleMaintenanceList(r.data);
    },
    enabled: !!vehicleId && tab === 'Maintenance',
  });

  const { data: maintReefer = [] } = useQuery({
    queryKey: ['vehicle-maintenance-vehicle', vehicleId, 'REEFER'],
    queryFn: async () => {
      const r = await api.get(`/vehicle-maintenance/vehicle/${vehicleId}`, { params: { category: 'REEFER' } });
      return parseVehicleMaintenanceList(r.data);
    },
    enabled: !!vehicleId && tab === 'Maintenance',
  });

  const { data: maintCostRaw } = useQuery({
    queryKey: ['vehicle-maintenance-cost-summary', vehicleId],
    queryFn: async () => {
      const r = await api.get(`/vehicle-maintenance/cost-summary/${vehicleId}`);
      return r.data?.data ?? r.data;
    },
    enabled: !!vehicleId && tab === 'Maintenance',
  });

  const maintCost = maintCostRaw && typeof maintCostRaw === 'object' ? (maintCostRaw as Record<string, unknown>) : {};
  const truckMaintTotal = safeNumber(
    maintCost.truckTotal ?? maintCost.TRUCK ?? maintCost.truck ?? maintCost.truckCost,
    0
  );
  const reeferMaintTotal = safeNumber(
    maintCost.reeferTotal ?? maintCost.REEFER ?? maintCost.reefer ?? maintCost.reeferCost,
    0
  );

  if (isLoading) return <LoadingSpinner />;
  if (!v) return <EmptyState message="Vehicle not found" />;

  const vr = v as Record<string, unknown>;

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
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'text-[#42A5F5] border-b-2 border-[#42A5F5]' : 'text-[#1A4A7A] hover:text-[#0D2847]'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          {tab === 'Trips' && (
            <table>
              <thead><tr><th>Trip #</th><th>Date</th><th>Route</th><th>Distance</th><th>Status</th></tr></thead>
              <tbody>
                {v.trips?.map((t: any) => (
                  <tr key={String(t.id ?? '')}>
                    <td className="font-mono text-xs text-[#42A5F5]">{safe(t.tripNumber)}</td>
                    <td className="text-[#1A4A7A] font-['Barlow_Condensed'] text-xs">{formatDate(t.date)}</td>
                    <td className="text-[#1A4A7A] text-xs">
                      {safe(t.startLocation)} → {t.endLocation != null && t.endLocation !== '' ? safe(t.endLocation) : '...'}
                    </td>
                    <td className="text-[#1A4A7A] font-['Barlow_Condensed']">
                      {Number.isFinite(safeNumber(t.distanceKm, NaN)) ? `${safeNumber(t.distanceKm)} km` : '—'}
                    </td>
                    <td><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
                {!v.trips?.length && <tr><td colSpan={5}><EmptyState message="No trips" /></td></tr>}
              </tbody>
            </table>
          )}
          {tab === 'Fuel' && (
            <table>
              <thead><tr><th>Entry #</th><th>Date</th><th>Liters</th><th>Rate/L</th><th>Total</th><th>Station</th></tr></thead>
              <tbody>
                {v.fuelEntries?.map((f: any) => (
                  <tr key={String(f.id ?? '')}>
                    <td className="font-mono text-xs text-[#F59E0B]">{safe(f.entryNumber)}</td>
                    <td className="text-xs text-[#1A4A7A] font-['Barlow_Condensed']">{formatDate(f.date)}</td>
                    <td className="text-[#1A4A7A]">{safeNumber(f.liters, 0).toFixed(2)}L</td>
                    <td className="text-[#1A4A7A] font-['Barlow_Condensed']">₹{safeNumber(f.ratePerLiter, 0).toFixed(2)}</td>
                    <td className="text-[#16A34A] font-medium">{formatCurrency(safeNumber(f.totalCost, 0))}</td>
                    <td className="text-[#1A4A7A] font-['Barlow_Condensed'] text-xs">{typeof f.fuelStation === 'string' ? f.fuelStation : safe(f.fuelStation)}</td>
                  </tr>
                ))}
                {!v.fuelEntries?.length && <tr><td colSpan={6}><EmptyState message="No fuel entries" /></td></tr>}
              </tbody>
            </table>
          )}
          {tab === 'Maintenance' && (
            <div className="p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3">
                  <div className="bg-[#1565C0]/10 border border-[#1565C0]/25 rounded-xl px-4 py-3 min-w-[140px]">
                    <p className="text-[10px] font-['Barlow_Condensed'] uppercase text-[#1A4A7A]">🚛 Truck spend</p>
                    <p className="font-['Oswald'] text-lg font-bold text-[#0D2847]">{formatInrTwoDecimals(truckMaintTotal)}</p>
                  </div>
                  <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-xl px-4 py-3 min-w-[140px]">
                    <p className="text-[10px] font-['Barlow_Condensed'] uppercase text-cyan-800">❄️ Reefer spend</p>
                    <p className="font-['Oswald'] text-lg font-bold text-[#0D2847]">{formatInrTwoDecimals(reeferMaintTotal)}</p>
                  </div>
                </div>
                <Link
                  href={`/maintenance?vehicleId=${encodeURIComponent(vehicleId)}&open=add`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1565C0] text-white text-sm font-['Barlow_Condensed'] uppercase tracking-wider hover:bg-[#0D2847]"
                >
                  + Add record
                </Link>
              </div>
              <div className="flex gap-1 bg-[#F4F6F8] rounded-lg p-1 w-fit">
                {(['TRUCK', 'REEFER'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setMaintCategory(c)}
                    className={`px-4 py-2 rounded-md text-xs font-['Barlow_Condensed'] font-semibold uppercase tracking-wider transition-colors ${
                      maintCategory === c ? 'bg-white text-[#1565C0] shadow-sm' : 'text-[#1A4A7A] hover:text-[#0D2847]'
                    }`}
                  >
                    {c === 'TRUCK' ? '🚛 Truck' : '❄️ Reefer'}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto border border-[#E0E8F0] rounded-xl">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Date</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Type</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Description</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Cost</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">
                        {maintCategory === 'TRUCK' ? 'KM' : 'Hours'}
                      </th>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#1A4A7A]">Garage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(maintCategory === 'TRUCK' ? maintTruck : maintReefer).map((m: any) => {
                      const typeLabel = m.maintenanceType?.name
                        ? `${m.maintenanceType.icon ? `${m.maintenanceType.icon} ` : ''}${safe(m.maintenanceType.name)}`
                        : typeof m.type === 'string'
                          ? m.type.replace(/_/g, ' ')
                          : safe(m.type);
                      const cost = safeNumber(m.totalCost ?? m.cost, 0);
                      const kmOrH =
                        maintCategory === 'TRUCK'
                          ? Number.isFinite(safeNumber(m.odometerKm, NaN))
                            ? `${safeNumber(m.odometerKm).toLocaleString('en-IN')} km`
                            : '—'
                          : Number.isFinite(safeNumber(m.runningHours, NaN))
                            ? `${safeNumber(m.runningHours).toLocaleString('en-IN')} hrs`
                            : '—';
                      return (
                        <tr key={String(m.id ?? '')} className="border-b border-[#E0E8F0] hover:bg-[#F4F6F8]/50">
                          <td className="px-4 py-2 text-xs text-[#1A4A7A] font-['Rajdhani'] whitespace-nowrap">
                            {formatDateDdMmYyyy(m.date)}
                          </td>
                          <td className="px-4 py-2 text-sm text-[#0D2847]">{typeLabel}</td>
                          <td className="px-4 py-2 text-xs text-[#1A4A7A] max-w-[200px] truncate">{safe(m.description)}</td>
                          <td className="px-4 py-2 text-sm font-mono font-semibold text-[#16A34A]">{formatInrTwoDecimals(cost)}</td>
                          <td className="px-4 py-2 text-xs font-mono text-[#1A4A7A]">{kmOrH}</td>
                          <td className="px-4 py-2 text-xs text-[#1A4A7A]">{safe(m.garage)}</td>
                        </tr>
                      );
                    })}
                    {(maintCategory === 'TRUCK' ? maintTruck : maintReefer).length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6">
                          <EmptyState
                            message={`No ${maintCategory === 'TRUCK' ? 'truck' : 'reefer'} maintenance yet`}
                            description="Add a record from the maintenance book"
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'Insurance' && (
            <table>
              <thead><tr><th>Provider</th><th>Policy #</th><th>Type</th><th>Premium</th><th>Expiry</th><th>Status</th></tr></thead>
              <tbody>
                {v.insurance?.map((i: any) => (
                  <tr key={String(i.id ?? '')}>
                    <td className="text-[#0D2847] font-medium">{safe(i.provider)}</td>
                    <td className="font-mono text-xs text-[#1A4A7A] font-['Barlow_Condensed']">{safe(i.policyNumber)}</td>
                    <td className="text-xs text-[#1A4A7A] font-['Barlow_Condensed']">{safe(i.type)}</td>
                    <td className="text-[#16A34A]">{formatCurrency(safeNumber(i.premium, 0))}</td>
                    <td className="text-xs text-[#1A4A7A] font-['Barlow_Condensed']">{formatDate(i.endDate)}</td>
                    <td><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
                {!v.insurance?.length && <tr><td colSpan={6}><EmptyState message="No insurance" /></td></tr>}
              </tbody>
            </table>
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
              ) : <EmptyState message="No documents" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
