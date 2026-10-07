'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

import { LogoLockup } from './logo';
import { buttonStyles } from '@/components/ui/button';
import { siteConfig } from '@/lib/site-config';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/#about', label: 'About' },
  { href: '/#who-can-register', label: 'Who can register' },
  { href: '/#access', label: 'What you get' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/#contact', label: 'Contact' },
];

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  // Following a link closes the mobile panel. This is adjusted during render
  // rather than in an effect, which avoids a second render pass with the panel
  // still open on the new route.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  // Lock background scrolling while the panel is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0 rounded-sm" aria-label={`${siteConfig.organisation} home`}>
          <LogoLockup organisation={siteConfig.organisation} program={siteConfig.programNameShort} />
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-navy-900"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/track" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-navy-900">
            Track application
          </Link>
          {signedIn ? (
            <Link href="/portal/dashboard" className={buttonStyles('primary', 'sm')}>
              My dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonStyles('secondary', 'sm')}>
                Login
              </Link>
              <Link href="/register" className={buttonStyles('accent', 'sm')}>
                Start registration
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex size-10 items-center justify-center rounded-md text-navy-900 ring-1 ring-slate-300 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
        </button>
      </div>

      <div
        id="mobile-menu"
        hidden={!open}
        className="border-t border-slate-200 bg-white lg:hidden"
      >
        <nav aria-label="Mobile" className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/track"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Track application
              </Link>
            </li>
          </ul>

          <div className={cn('mt-4 grid gap-2 border-t border-slate-200 pt-4', signedIn ? '' : 'grid-cols-1 sm:grid-cols-2')}>
            {signedIn ? (
              <Link href="/portal/dashboard" className={buttonStyles('primary', 'md', 'w-full')}>
                My dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className={buttonStyles('secondary', 'md', 'w-full')}>
                  Login
                </Link>
                <Link href="/register" className={buttonStyles('accent', 'md', 'w-full')}>
                  Start registration
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
