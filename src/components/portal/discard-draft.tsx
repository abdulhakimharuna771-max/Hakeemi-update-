'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { discardDraft } from '@/app/portal/actions';

/**
 * Discard an unsubmitted draft.
 *
 * Deliberately two-step: the first click only reveals the confirmation, so a
 * stray click cannot destroy a partially completed registration. Only a DRAFT
 * can be removed — the database refuses anything else, and a submitted
 * application is never deletable from the portal.
 */
export function DiscardDraft({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-red-700"
      >
        Discard this draft
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
      <Alert variant="error" title="Discard this draft?">
        Everything you have entered for this registration is deleted and cannot be recovered.
      </Alert>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="danger"
          size="sm"
          loading={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await discardDraft(applicationId);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setConfirming(false);
              router.push('/portal/dashboard');
              router.refresh();
            });
          }}
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Yes, discard it
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
          Keep my draft
        </Button>
      </div>

      {error ? <p className="text-sm font-medium text-red-800">{error}</p> : null}
    </div>
  );
}
