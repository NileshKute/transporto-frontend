'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { usePermission } from '@/hooks/usePermission';
import { safe } from '@/lib/utils';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/Breadcrumbs';
import {
  LayoutDashboard, Truck, Users, Route, Fuel, Wrench,
  AlertTriangle, Shield, Snowflake, Clock, MessageSquare,
  LogOut, Bell, Search, Menu, X, ChevronRight, Building2, FileText,
  BookOpen, Wallet, Settings, Upload, CreditCard, MapPin,
} from 'lucide-react';

const navGroups = [
  {
    label: 'OPERATIONS',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/vehicles', icon: Truck, label: 'Vehicles' },
      { href: '/gps', icon: MapPin, label: 'GPS Tracking' },
      { href: '/drivers', icon: Users, label: 'Drivers' },
      { href: '/trips', icon: Route, label: 'Trips' },
      { href: '/fuel', icon: Fuel, label: 'Fuel' },
    ]
  },
  {
    label: 'FUEL',
    items: [
      { href: '/bpcl', icon: Fuel, label: 'BPCL Transactions' },
      { href: '/bpcl/import', icon: Upload, label: 'Import BPCL Data' },
      { href: '/bpcl/cards', icon: CreditCard, label: 'Card Management' },
    ],
  },
  {
    label: 'MONITORING',
    items: [
      { href: '/maintenance', icon: Wrench, label: 'Vehicle Maintenance' },
      { href: '/emergencies', icon: AlertTriangle, label: 'Emergencies' },
      { href: '/insurance', icon: Shield, label: 'Insurance' },
      { href: '/cold-storage', icon: Snowflake, label: 'Cold Storage' },
    ]
  },
  {
    label: 'ACCOUNTS',
    items: [
      { href: '/driver-ledger', icon: BookOpen, label: 'Driver Ledger' },
      { href: '/salary', icon: Wallet, label: 'Salary' },
    ]
  },
  {
    label: 'SALES',
    items: [
      { href: '/clients', icon: Building2, label: 'Clients' },
      { href: '/invoices', icon: FileText, label: 'Invoices' },
      { href: '/quotations', icon: FileText, label: 'Quotations' },
    ]
  },
  {
    label: 'SYSTEM',
    items: [
      { href: '/shifts', icon: Clock, label: 'Shifts' },
      { href: '/whatsapp', icon: MessageSquare, label: 'WhatsApp' },
    ]
  },
];

const adminNavGroup = {
  label: 'ADMIN',
  items: [
    { href: '/admin/users', icon: Users, label: 'User Management' },
    { href: '/admin/permissions', icon: Settings, label: 'Permissions' },
    { href: '/admin/maintenance-types', icon: Wrench, label: 'Maintenance Types' },
  ],
};

function getPageTitle(pathname: string | null) {
  const p = pathname ?? '';
  if (p.startsWith('/clients')) return p === '/clients' ? 'Clients' : 'Client';
  if (p.startsWith('/invoices')) {
    if (p === '/invoices') return 'Invoices';
    if (p === '/invoices/create') return 'Create Invoice';
    if (p.endsWith('/edit')) return 'Edit Invoice';
    return 'Invoice';
  }
  if (p.startsWith('/quotations')) {
    if (p === '/quotations') return 'Quotations';
    if (p === '/quotations/new') return 'New Quotation';
    if (p === '/quotations/import') return 'Import Quotations';
    if (p.endsWith('/edit')) return 'Edit Quotation';
    return 'Quotation';
  }
  const map: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/vehicles': 'Vehicles',
    '/drivers': 'Drivers',
    '/trips': 'Trips',
    '/fuel': 'Fuel',
    '/bpcl': 'BPCL Transactions',
    '/bpcl/import': 'Import BPCL Data',
    '/bpcl/cards': 'Card Management',
    '/maintenance': 'Vehicle Maintenance',
    '/admin/maintenance-types': 'Maintenance Types',
    '/admin/users': 'User Management',
    '/emergencies': 'Emergencies',
    '/insurance': 'Insurance',
    '/cold-storage': 'Cold Storage',
    '/shifts': 'Shifts',
    '/whatsapp': 'WhatsApp',
    '/driver-ledger': 'Driver Ledger',
    '/salary': 'Salary',
    '/admin/permissions': 'Permissions',
    '/quotations': 'Quotations',
    '/quotations/new': 'New Quotation',
    '/quotations/import': 'Import Quotations',
  };
  return map[p] || 'Dashboard';
}

/** Breadcrumb builder — pathname coerced; labels are always plain strings for React children. */
function buildBreadcrumbItems(pathname: string | null, pageTitle: string): BreadcrumbItem[] {
  const p = pathname ?? '';
  const items: BreadcrumbItem[] = [{ label: 'Dashboard', href: '/dashboard' }];
  if (p === '/dashboard') return items;
  if (p.startsWith('/clients')) {
    items.push({ label: 'Clients', href: '/clients' });
    if (p !== '/clients') items.push({ label: p.includes('/edit') ? 'Edit' : 'Detail' });
    return items;
  }
  if (p.startsWith('/invoices')) {
    items.push({ label: 'Invoices', href: '/invoices' });
    if (p === '/invoices/create') items.push({ label: 'Create' });
    else if (p.endsWith('/edit')) items.push({ label: 'Edit' });
    else if (p !== '/invoices') items.push({ label: 'Detail' });
    return items;
  }
  if (p.startsWith('/quotations')) {
    items.push({ label: 'Quotations', href: '/quotations' });
    if (p === '/quotations/new') items.push({ label: 'New' });
    else if (p === '/quotations/import') items.push({ label: 'Import' });
    else if (p.endsWith('/edit')) items.push({ label: 'Edit' });
    else if (p !== '/quotations') items.push({ label: 'Detail' });
    return items;
  }
  if (p.startsWith('/vehicles')) {
    items.push({ label: 'Vehicles', href: '/vehicles' });
    if (p !== '/vehicles') items.push({ label: 'Detail' });
    return items;
  }
  if (p.startsWith('/gps')) {
    items.push({ label: 'GPS Live Tracking', href: '/gps' });
    return items;
  }
  if (p.startsWith('/drivers')) {
    items.push({ label: 'Drivers', href: '/drivers' });
    if (p !== '/drivers') items.push({ label: 'Detail' });
    return items;
  }
  if (p.startsWith('/trips')) {
    items.push({ label: 'Trips', href: '/trips' });
    return items;
  }
  if (p.startsWith('/fuel')) {
    items.push({ label: 'Fuel', href: '/fuel' });
    return items;
  }
  if (p.startsWith('/bpcl')) {
    if (p === '/bpcl') {
      items.push({ label: 'BPCL Transactions', href: '/bpcl' });
      return items;
    }
    items.push({ label: 'BPCL', href: '/bpcl' });
    if (p === '/bpcl/import') items.push({ label: 'Import BPCL Data' });
    else if (p === '/bpcl/cards') items.push({ label: 'Card Management' });
    return items;
  }
  if (p.startsWith('/maintenance')) {
    items.push({ label: 'Maintenance', href: '/maintenance' });
    return items;
  }
  if (p.startsWith('/emergencies')) {
    items.push({ label: 'Emergencies', href: '/emergencies' });
    return items;
  }
  if (p.startsWith('/insurance')) {
    items.push({ label: 'Insurance', href: '/insurance' });
    return items;
  }
  if (p.startsWith('/cold-storage')) {
    items.push({ label: 'Cold Storage', href: '/cold-storage' });
    return items;
  }
  if (p.startsWith('/shifts')) {
    items.push({ label: 'Shifts', href: '/shifts' });
    return items;
  }
  if (p.startsWith('/whatsapp')) {
    items.push({ label: 'WhatsApp', href: '/whatsapp' });
    return items;
  }
  if (p.startsWith('/driver-ledger')) {
    items.push({ label: 'Driver Ledger', href: '/driver-ledger' });
    return items;
  }
  if (p.startsWith('/salary')) {
    items.push({ label: 'Salary', href: '/salary' });
    return items;
  }
  if (p.startsWith('/admin/users')) {
    items.push({ label: 'User Management', href: '/admin/users' });
    return items;
  }
  if (p.startsWith('/admin/permissions')) {
    items.push({ label: 'Permissions', href: '/admin/permissions' });
    return items;
  }
  if (p.startsWith('/admin/maintenance-types')) {
    items.push({ label: 'Maintenance Types', href: '/admin/maintenance-types' });
    return items;
  }
  items.push({ label: pageTitle });
  return items;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const quotationsReadAllowed = usePermission('quotations', 'read');
  const showQuotationsNav =
    isLoading || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || quotationsReadAllowed;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useIdleTimeout(300000); // 5 minutes

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

  const breadcrumbItems = useMemo(
    () => buildBreadcrumbItems(pathname, pageTitle),
    [pathname, pageTitle]
  );

  const userDisplayName = useMemo(() => {
    const n = safe(user?.name);
    return n === '—' ? 'User' : n;
  }, [user?.name]);

  const userInitials = useMemo(() => {
    const n = safe(user?.name);
    if (!n || n === '—') return 'U';
    return n
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => c[0])
      .join('')
      .slice(0, 2) || 'U';
  }, [user?.name]);

  const userDisplayRole = useMemo(() => {
    if (typeof user?.role === 'string') return user.role.replace(/_/g, ' ');
    const r = safe(user?.role);
    return r === '—' ? 'Role' : r;
  }, [user?.role]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-[#1565C0] rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <p className="text-[#7A9AB8] text-sm font-['Rajdhani']">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F6F8]">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - G K Enterprise */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-[#0D2847] text-white z-50 flex flex-col
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 mb-2 border-b border-[#1A4A7A]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#0D2847] to-[#1A4A7A] flex items-center justify-center border border-[#1A4A7A] relative">
              <span className="font-['Bebas_Neue'] text-2xl text-white">G</span>
              <span className="font-['Bebas_Neue'] text-2xl text-[#42A5F5]">K</span>
              <div className="absolute -bottom-1 left-0 right-0 h-[3px] bg-[#42A5F5] rounded-full" />
            </div>
            <div>
              <div className="font-['Oswald'] text-sm font-bold text-white tracking-wider">G K ENTERPRISE</div>
              <div className="font-['Barlow_Condensed'] text-[9px] leading-tight text-[#42A5F5] tracking-[0.12em] uppercase">
                Fleet owners &amp; cold chain logistics specialists
              </div>
            </div>
            <button className="ml-auto lg:hidden text-[#64B5F6] hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navGroups.map(group => (
            <div key={group.label}>
              <p className="font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-widest text-[#7A9AB8] px-3 mb-2">{group.label}</p>
              <div className="space-y-1">
                {group.items
                  .filter((item) => (item.href === '/quotations' ? showQuotationsNav : true))
                  .map(item => {
                  const path = pathname ?? '';
                  const isActive =
                    item.href === '/dashboard'
                      ? path === '/dashboard'
                      : path === item.href || path.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-['Barlow_Condensed'] uppercase tracking-wider transition-all duration-150 ${
                        isActive
                          ? 'bg-[#1565C0]/20 text-white border-l-[3px] border-[#42A5F5] pl-[9px]'
                          : 'text-[#64B5F6] hover:bg-[#1A4A7A]/30 hover:text-white'
                      }`}
                    >
                      <item.icon size={18} className="text-[#42A5F5] flex-shrink-0" />
                      <span>{String(item.label)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <div>
              <p className="font-['Barlow_Condensed'] text-[10px] font-semibold uppercase tracking-widest text-[#7A9AB8] px-3 mb-2">{adminNavGroup.label}</p>
              <div className="space-y-1">
                {adminNavGroup.items.map(item => {
                  const path = pathname ?? '';
                  const isActive = path === item.href || path.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-['Barlow_Condensed'] uppercase tracking-wider transition-all duration-150 ${
                        isActive
                          ? 'bg-[#1565C0]/20 text-white border-l-[3px] border-[#42A5F5] pl-[9px]'
                          : 'text-[#64B5F6] hover:bg-[#1A4A7A]/30 hover:text-white'
                      }`}
                    >
                      <item.icon size={18} className="text-[#42A5F5] flex-shrink-0" />
                      <span>{String(item.label)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-[#1A4A7A]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#1565C0] flex items-center justify-center text-sm font-bold font-['Rajdhani']">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate font-['Rajdhani']">{userDisplayName}</p>
              <p className="text-[11px] text-[#7A9AB8] font-['Rajdhani']">{userDisplayRole}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#64B5F6] hover:text-white hover:bg-[#1A4A7A]/50 transition-colors font-['Barlow_Condensed'] uppercase tracking-wider"
          >
            <LogOut size={16} className="text-[#42A5F5]" />
            <span>Sign Out</span>
          </button>
          <p className="font-['Rajdhani'] text-xs text-[#7A9AB8] mt-3 text-center">Since 2019 · Navi Mumbai</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col lg:ml-64">
        <header className="h-16 bg-gradient-to-r from-[#0A1628] via-[#0D2847] to-[#1A4A7A] flex flex-col sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between px-4 lg:px-6 flex-1">
            <div className="flex items-center gap-3">
              <button className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-[#64B5F6]" onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
              </button>
              <div>
                <h1 className="font-['Oswald'] text-xl font-bold text-white tracking-wide uppercase">{pageTitle}</h1>
                <div className="flex items-center gap-1 text-xs text-[#64B5F6] font-['Rajdhani'] mt-0.5">
                  <Breadcrumbs items={breadcrumbItems} variant="dark" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center bg-white/10 rounded-full px-4 py-2 w-60 border border-[#1A4A7A]">
                <Search size={16} className="text-[#64B5F6] mr-2 flex-shrink-0" />
                <input className="bg-transparent text-sm text-white placeholder:text-[#7A9AB8] outline-none w-full font-['Rajdhani']" placeholder="Search..." />
              </div>
              <button className="relative p-2 rounded-full hover:bg-white/10 text-[#64B5F6]">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#DC2626] rounded-full" />
              </button>
              <div className="w-9 h-9 rounded-full bg-[#1565C0] flex items-center justify-center text-sm font-bold text-white font-['Rajdhani']">
                {userInitials[0] || 'U'}
              </div>
            </div>
          </div>
          <div className="h-[3px] w-full bg-gradient-to-r from-[#1565C0] to-[#42A5F5]" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#F4F6F8] page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
