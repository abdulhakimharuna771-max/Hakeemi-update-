'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

import { Button, buttonStyles } from '@/components/ui/button';

/**
 * Root error boundary.
 *
 * Keeps the failure honest and small: an apology, a retry, and a way back —
 * never a stack trace or an invented apology message about saved data.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-16">
      <main id="main-content" className="w-full max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-700">
          Something went wrong
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          This page could not be displayed
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The problem is on our side. If you were completing a registration, your saved progress is unaffected —
          sign in again and continue from where you stopped.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reset} size="md">
            <RefreshCw aria-hidden="true" className="size-4" />
            Try again
          </Button>
          <Link href="/" className={buttonStyles('secondary', 'md')}>
            Back to the programme page
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-6 text-xs text-slate-500">
            Reference: <code className="font-mono">{error.digest}</code>
          </p>
        ) : null}
      </main>
    </div>
  );
}
