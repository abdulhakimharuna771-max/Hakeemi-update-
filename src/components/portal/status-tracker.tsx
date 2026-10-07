import { Circle, CircleCheck, CircleDot } from 'lucide-react';

import { cn } from '@/lib/utils';
import { statusFallback } from '@/lib/constants';
import type { ApplicationStatus, ApplicationStatusRow } from '@/lib/types';

/**
 * Application progress tracker.
 *
 * The stages, their order and their labels all come from
 * application_statuses in the database, so the lifecycle can be extended
 * without touching this component. Only applicant-visible stages are shown.
 */
export function StatusTracker({
  statuses,
  current,
  className,
}: {
  statuses: ApplicationStatusRow[];
  current: ApplicationStatus;
  className?: string;
}) {
  const visible = statuses
    .filter((row) => row.visible_to_applicant)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (visible.length === 0) {
    const fallback = statusFallback(current);
    return (
      <p className={cn('text-sm text-slate-600', className)}>
        Current status: <strong className="font-semibold text-navy-900">{fallback.label}</strong>
      </p>
    );
  }

  const currentRow = visible.find((row) => row.code === current);
  const currentIndex = currentRow ? visible.indexOf(currentRow) : -1;

  // A terminal outcome (Rejected/Completed) is the end of the line: showing
  // later stages after it would be misleading.
  const terminal = Boolean(currentRow?.is_terminal);
  const stages = terminal && currentIndex >= 0 ? visible.slice(0, currentIndex + 1) : visible;

  const currentDescription = currentRow?.description ?? null;

  return (
    <div className={className}>
      <ol className="space-y-0.5">
        {stages.map((stage) => {
          const index = visible.indexOf(stage);
          const isCurrent = stage.code === current;
          const isDone = currentIndex >= 0 && index < currentIndex;
          const isRejected = isCurrent && stage.tone === 'danger';

          return (
            <li
              key={stage.code}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex items-start gap-3 rounded-md px-2.5 py-2.5',
                isCurrent && 'bg-navy-50 ring-1 ring-inset ring-navy-100'
              )}
            >
              <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                {isCurrent ? (
                  <CircleDot
                    className={cn('size-4.5', isRejected ? 'text-red-600' : 'text-navy-700')}
                    strokeWidth={2.5}
                  />
                ) : isDone ? (
                  <CircleCheck className="size-4.5 text-emerald-600" strokeWidth={2.25} />
                ) : (
                  <Circle className="size-4.5 text-slate-300" strokeWidth={2} />
                )}
              </span>

              <span className="min-w-0">
                <span
                  className={cn(
                    'block text-sm',
                    isCurrent ? 'font-semibold text-navy-900' : isDone ? 'text-slate-700' : 'text-slate-500'
                  )}
                >
                  {stage.label}
                </span>
                {isCurrent && currentDescription ? (
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                    {currentDescription}
                  </span>
                ) : null}
              </span>

              <span className="sr-only">
                {isCurrent ? 'Current stage' : isDone ? 'Completed stage' : 'Not yet reached'}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
