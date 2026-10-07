'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, FileText, LayoutDashboard, User, ClipboardList } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface PortalNavItem {
  href: string;
  label: string;
  /** Short label for the mobile bottom bar. */
  shortLabel: string;
  icon: typeof Bell;
  badge?: number;
}

export function buildPortalNav(unreadCount: number): PortalNavItem[] {
  return [
    { href: '/portal/dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
    { href: '/portal/application', label: 'My application', shortLabel: 'Application', icon: ClipboardList },
    { href: '/portal/documents', label: 'Documents', shortLabel: 'Documents', icon: FileText },
    {
      href: '/portal/notifications',
      label: 'Notifications',
      shortLabel: 'Alerts',
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { href: '/portal/profile', label: 'Profile', shortLabel: 'Profile', icon: User },
  ];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop navigation, with the unread notification count always visible. */
export function PortalNav({ items }: { items: PortalNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Portal" className="hidden lg:block">
      <ul className="flex items-center gap-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-navy-50 text-navy-900'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-navy-900'
                )}
              >
                <item.icon aria-hidden="true" className="size-4" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
                {item.badge ? (
                  <span className="tabular ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-2xs font-bold text-white">
                    {item.badge > 9 ? '9+' : item.badge}
                    <span className="sr-only"> unread notifications</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Mobile bottom navigation.
 *
 * A real app-style tab bar rather than a squeezed desktop menu, sized for
 * thumbs and respecting the home-indicator safe area.
 */
export function PortalMobileNav({ items }: { items: PortalNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Portal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center gap-1 px-1 py-2.5 text-2xs font-medium transition-colors',
                  active ? 'text-navy-900' : 'text-slate-500'
                )}
              >
                <span className="relative">
                  <item.icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                  {item.badge ? (
                    <span className="absolute -right-2 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-4 text-white">
                      {item.badge > 9 ? '9+' : item.badge}
                      <span className="sr-only"> unread</span>
                    </span>
                  ) : null}
                </span>
                <span className={cn(active && 'font-semibold')}>{item.shortLabel}</span>
                {active ? (
                  <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-navy-800" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
