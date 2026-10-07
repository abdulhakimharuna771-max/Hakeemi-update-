'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { CircleAlert, RefreshCw } from 'lucide-react';

import { Button, buttonStyles } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';

/**
 * Portal error boundary.
 *
 * Anything already saved stays saved — drafts live in the database, not in this
 * component — so the applicant is told that plainly and offered a retry.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Portal error:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader
          title="Something went wrong loading this page"
          description="This is a display problem, not a data problem."
        />
        <CardBody className="space-y-4">
          <Alert variant="error" title="What happened">
            The portal could not load the information it needed. Nothing you have entered has been lost — your
            registration is saved in the programme database as you complete each step.
          </Alert>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={reset}>
              <RefreshCw aria-hidden="true" className="size-4" />
              Try again
            </Button>
            <Link href="/portal/dashboard" className={buttonStyles('secondary', 'md')}>
              Back to dashboard
            </Link>
          </div>

          {error.digest ? (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <CircleAlert aria-hidden="true" className="size-3.5" />
              Reference for support: <code className="font-mono">{error.digest}</code>
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
