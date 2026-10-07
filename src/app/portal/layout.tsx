import Link from 'next/link';
import { LogOut } from 'lucide-react';

import { signOutAction } from '@/app/auth/actions';
import { LogoMark } from '@/components/layout/logo';
import { PortalMobileNav, PortalNav, buildPortalNav } from '@/components/portal/portal-nav';
import { buttonStyles } from '@/components/ui/button';
import { requireVerifiedUser } from '@/lib/auth';
import { getUnreadNotificationCount } from '@/lib/data/applicant';
import { siteConfig } from '@/lib/site-config';
import { initialsOf } from '@/lib/utils';

/**
 * Applicant portal shell.
 *
 * requireVerifiedUser() runs on the server for every portal page, so an
 * unverified or signed-out visitor can never render this layout — the proxy
 * redirect is only a convenience on top of this check.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireVerifiedUser();
  const unreadCount = await getUnreadNotificationCount(user.id);
  const navItems = buildPortalNav(unreadCount);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/portal/dashboard" className="flex min-w-0 items-center gap-3 rounded-sm">
            <LogoMark className="size-9" />
            <span className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="truncate text-sm font-bold uppercase tracking-[0.03em] text-navy-900">
                {siteConfig.organisation}
              </span>
              <span className="truncate text-xs text-slate-600">Applicant portal</span>
            </span>
          </Link>

          <PortalNav items={navItems} />

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2.5 md:flex">
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center rounded-full bg-navy-100 text-xs font-bold text-navy-800"
              >
                {initialsOf(profile.full_name || user.email)}
              </span>
              <span className="flex max-w-40 flex-col leading-tight">
                <span className="truncate text-sm font-semibold text-navy-900">
                  {profile.full_name ?? 'Applicant'}
                </span>
                <span className="truncate text-xs text-slate-500">{user.email}</span>
              </span>
            </div>

            <form action={signOutAction}>
              <button type="submit" className={buttonStyles('ghost', 'sm', 'gap-2')}>
                <LogOut aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
                <span className="sr-only sm:hidden">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-8 lg:pb-10">
        {children}
      </main>

      <PortalMobileNav items={navItems} />
    </div>
  );
}
