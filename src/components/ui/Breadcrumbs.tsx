import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, variant = 'light' }: { items: BreadcrumbItem[]; variant?: 'light' | 'dark' }) {
  const isDark = variant === 'dark';
  return (
    <nav className={`flex items-center gap-1.5 font-['Rajdhani'] text-sm ${isDark ? 'text-[#64B5F6]' : 'text-[#7A9AB8]'}`}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className={isDark ? 'text-[#42A5F5]/70' : 'text-[#E0E8F0]'}>/</span>}
          {item.href ? (
            <Link href={item.href} className={isDark ? 'text-[#64B5F6] hover:text-white hover:underline' : 'text-[#42A5F5] hover:text-[#1565C0] hover:underline'}>
              {typeof item.label === 'string' ? item.label : String(item.label ?? '')}
            </Link>
          ) : (
            <span className={isDark ? 'text-white font-medium' : 'text-[#0D2847] font-medium'}>
              {typeof item.label === 'string' ? item.label : String(item.label ?? '')}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
