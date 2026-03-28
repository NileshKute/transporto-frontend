interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE:          { bg: 'bg-[#16A34A]/10', text: 'text-[#16A34A]', dot: 'bg-[#16A34A]' },
  AVAILABLE:       { bg: 'bg-[#16A34A]/10', text: 'text-[#16A34A]', dot: 'bg-[#16A34A]' },
  COMPLETED:       { bg: 'bg-[#16A34A]/10', text: 'text-[#16A34A]', dot: 'bg-[#16A34A]' },
  RESOLVED:        { bg: 'bg-[#16A34A]/10', text: 'text-[#16A34A]', dot: 'bg-[#16A34A]' },
  NORMAL:          { bg: 'bg-[#16A34A]/10', text: 'text-[#16A34A]', dot: 'bg-[#16A34A]' },
  IN_PROGRESS:     { bg: 'bg-[#1565C0]/10', text: 'text-[#1565C0]', dot: 'bg-[#1565C0]' },
  ON_TRIP:         { bg: 'bg-[#1565C0]/10', text: 'text-[#1565C0]', dot: 'bg-[#1565C0]' },
  PROCESSING:      { bg: 'bg-[#1565C0]/10', text: 'text-[#1565C0]', dot: 'bg-[#1565C0]' },
  SCHEDULED:       { bg: 'bg-[#42A5F5]/10', text: 'text-[#42A5F5]', dot: 'bg-[#42A5F5]' },
  IDLE:            { bg: 'bg-[#42A5F5]/10', text: 'text-[#42A5F5]', dot: 'bg-[#42A5F5]' },
  IN_MAINTENANCE:  { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]' },
  WARNING:         { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]' },
  EXPIRING_SOON:   { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]' },
  CRITICAL:        { bg: 'bg-[#DC2626]/10', text: 'text-[#DC2626]', dot: 'bg-[#DC2626]' },
  BREAKDOWN:       { bg: 'bg-[#DC2626]/10', text: 'text-[#DC2626]', dot: 'bg-[#DC2626]' },
  PENDING:         { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]' },
  EXPIRED:         { bg: 'bg-[#DC2626]/10', text: 'text-[#DC2626]', dot: 'bg-[#DC2626]' },
  CANCELLED:       { bg: 'bg-[#7A9AB8]/10', text: 'text-[#7A9AB8]', dot: 'bg-[#7A9AB8]' },
  TERMINATED:      { bg: 'bg-[#7A9AB8]/10', text: 'text-[#7A9AB8]', dot: 'bg-[#7A9AB8]' },
  OFFLINE:         { bg: 'bg-[#7A9AB8]/10', text: 'text-[#7A9AB8]', dot: 'bg-[#7A9AB8]' },
  RECEIVED:        { bg: 'bg-[#42A5F5]/10', text: 'text-[#42A5F5]', dot: 'bg-[#42A5F5]' },
  PROCESSED:       { bg: 'bg-[#16A34A]/10', text: 'text-[#16A34A]', dot: 'bg-[#16A34A]' },
  FAILED:          { bg: 'bg-[#DC2626]/10', text: 'text-[#DC2626]', dot: 'bg-[#DC2626]' },
  IGNORED:         { bg: 'bg-[#7A9AB8]/10', text: 'text-[#7A9AB8]', dot: 'bg-[#7A9AB8]' },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const s = typeof status === 'string' ? status : String(status ?? 'UNKNOWN');
  const config = statusConfig[s] || { bg: 'bg-[#42A5F5]/10', text: 'text-[#42A5F5]', dot: 'bg-[#42A5F5]' };
  const sizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium border border-transparent font-['Barlow_Condensed'] ${config.bg} ${config.text} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${
        s === 'WARNING' || s === 'CRITICAL' ? 'animate-pulse' : ''
      }`} />
      {s.replace(/_/g, ' ')}
    </span>
  );
}
