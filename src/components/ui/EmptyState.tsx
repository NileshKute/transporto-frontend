import { PackageOpen, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  description?: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ message = 'No data found', description, icon: Icon = PackageOpen, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-[#F4F6F8] flex items-center justify-center mb-4 border border-[#E0E8F0]">
        <Icon className="w-8 h-8 text-[#7A9AB8]" />
      </div>
      <p className="font-['Oswald'] font-medium text-[#0D2847]">{message}</p>
      {description && <p className="font-['Rajdhani'] text-[#7A9AB8] text-sm mt-1">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-lg bg-[#1565C0] text-white font-['Barlow_Condensed'] font-semibold uppercase tracking-wider hover:bg-[#0D2847] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
