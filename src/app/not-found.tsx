import Link from 'next/link';
import { SearchX } from 'lucide-react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { buttonStyles } from '@/components/ui/button';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <SiteHeader />
      <main id="main-content" className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-700">Error 404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900">That page could not be found</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The link may be out of date, or the page may have moved. Nothing about your registration has changed.
        </p>

        <ul className="mt-6 space-y-2 text-sm">
          <li>
            <Link href="/" className={buttonStyles('primary', 'md')}>
              Programme home
            </Link>
          </li>
          <li>
            <Link href="/portal/dashboard" className={buttonStyles('secondary', 'md')}>
              Applicant dashboard
            </Link>
          </li>
          <li>
            <Link href="/track" className={buttonStyles('ghost', 'md')}>
              <SearchX aria-hidden="true" className="size-4" />
              Track my application
            </Link>
          </li>
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
