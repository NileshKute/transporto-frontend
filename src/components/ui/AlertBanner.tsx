import { AlertTriangle, AlertCircle, Info, CheckCircle, LucideIcon } from 'lucide-react';

type AlertType = 'warning' | 'danger' | 'info' | 'success';

const typeMap: Record<AlertType, { border: string; bg: string; icon: LucideIcon; iconClass: string }> = {
  warning: { border: 'border-l-[#F59E0B]', bg: 'bg-[#F59E0B]/10', icon: AlertTriangle, iconClass: 'text-[#F59E0B]' },
  danger:  { border: 'border-l-[#DC2626]',  bg: 'bg-[#DC2626]/10',  icon: AlertCircle,  iconClass: 'text-[#DC2626]' },
  info:    { border: 'border-l-[#42A5F5]', bg: 'bg-[#42A5F5]/10',    icon: Info,        iconClass: 'text-[#42A5F5]' },
  success: { border: 'border-l-[#16A34A]', bg: 'bg-[#16A34A]/10', icon: CheckCircle, iconClass: 'text-[#16A34A]' },
};

interface AlertBannerProps {
  type: AlertType;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

export function AlertBanner({ type, title, message, action }: AlertBannerProps) {
  const config = typeMap[type];
  const Icon = config.icon;
  return (
    <div className={`w-full rounded-xl border border-[#E0E8F0] border-l-4 ${config.border} ${config.bg} p-4 flex items-center justify-between gap-4 flex-wrap`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconClass}`} />
        <div>
          <p className="font-['Oswald'] font-semibold text-[#0D2847]">{title}</p>
          {message && <p className="text-sm text-[#7A9AB8] mt-0.5 font-['Rajdhani']">{message}</p>}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm font-semibold text-[#1565C0] hover:text-[#0D2847] whitespace-nowrap font-['Barlow_Condensed'] uppercase tracking-wider"
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}
