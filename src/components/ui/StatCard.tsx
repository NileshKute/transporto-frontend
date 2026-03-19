import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  iconColor: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'cyan';
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendDirection?: 'up' | 'down';
}

const colorMap = {
  blue:   { bg: 'bg-[#42A5F5]/10',    text: 'text-[#42A5F5]' },
  green:  { bg: 'bg-[#16A34A]/10',    text: 'text-[#16A34A]' },
  purple: { bg: 'bg-[#1565C0]/10',    text: 'text-[#1565C0]' },
  amber:  { bg: 'bg-[#F59E0B]/10',    text: 'text-[#F59E0B]' },
  red:    { bg: 'bg-[#DC2626]/10',    text: 'text-[#DC2626]' },
  cyan:   { bg: 'bg-[#42A5F5]/10',    text: 'text-[#42A5F5]' },
};

export function StatCard({ icon: Icon, iconColor, title, value, subtitle, trend, trendDirection }: StatCardProps) {
  const c = colorMap[iconColor] || colorMap.blue;
  const trendUp = trendDirection ? trendDirection === 'up' : (trend !== undefined && trend >= 0);

  return (
    <div className="bg-white rounded-xl p-5 border border-[#E0E8F0] shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${c.text}`} />
        </div>
        {trend !== undefined && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full font-['Barlow_Condensed'] ${
            trendUp ? 'text-[#16A34A] bg-[#16A34A]/10' : 'text-[#DC2626] bg-[#DC2626]/10'
          }`}>
            {trendUp ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="font-['Oswald'] text-3xl font-bold text-[#0D2847]">{value}</p>
        <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-[2px] text-[#7A9AB8] mt-1">{title}</p>
        {subtitle && <p className="font-['Rajdhani'] text-xs text-[#7A9AB8] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
