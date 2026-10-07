import type { ReactNode } from 'react';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { TONE_CLASSES, statusFallback } from '@/lib/constants';
import type { ApplicationStatus, StatusTone } from '@/lib/types';

/**
 * Feedback surfaces.
 *
 * Errors are always rendered as live regions so they are announced rather than
 * only shown, and every failure offers the applicant a way forward.
 */

type AlertVariant = 'error' | 'success' | 'warning' | 'info';

const ALERT_STYLES: Record<AlertVariant, { className: string; icon: typeof Info }> = {
  error: { className: 'border-red-200 bg-red-50 text-red-900', icon: CircleX },
  success: { className: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CircleCheck },
  warning: { className: 'border-amber-200 bg-amber-50 text-amber-900', icon: TriangleAlert },
  info: { className: 'border-navy-200 bg-navy-50 text-navy-900', icon: Info },
};

export function Alert({
  variant = 'info',
  title,
  children,
  action,
  className,
}: {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { className: styles, icon: Icon } = ALERT_STYLES[variant];

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md border px-4 py-3', styles, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" strokeWidth={2} />
      <div className="min-w-0 flex-1 space-y-1.5">
        {title ? <p className="text-sm font-semibold">{title}</p> : null}
        {children ? <div className="text-sm leading-relaxed break-words">{children}</div> : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Status pill whose label and tone come from the database. */
export function StatusBadge({
  status,
  label,
  tone,
  className,
}: {
  status: ApplicationStatus | null | undefined;
  label?: string | null;
  tone?: StatusTone | null;
  className?: string;
}) {
  const fallback = statusFallback(status);
  return (
    <Badge tone={tone ?? fallback.tone} className={className}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />
      {label ?? fallback.label}
    </Badge>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: typeof Info;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-6 py-10 text-center',
        className
      )}
    >
      {Icon ? (
        <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
          <Icon aria-hidden="true" className="size-5 text-slate-500" strokeWidth={1.75} />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-navy-900">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Slim progress bar used for profile/application completion. */
export function ProgressBar({
  value,
  label,
  className,
  tone = 'navy',
}: {
  value: number;
  label?: string;
  className?: string;
  tone?: 'navy' | 'emerald';
}) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className={className}>
      {label ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-slate-600">{label}</span>
          <span className="tabular text-xs font-semibold text-navy-900">{safe}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Completion'}
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', tone === 'navy' ? 'bg-navy-700' : 'bg-emerald-600')}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-slate-600">
      <span
        aria-hidden="true"
        className={cn('size-4 animate-spin rounded-full border-2 border-slate-300 border-t-navy-700', className)}
      />
      <span>{label}</span>
    </span>
  );
}

/** Large, quiet eyebrow + heading pair used by every landing section. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  as: Heading = 'h2',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow ? (
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-emerald-800">{eyebrow}</p>
      ) : null}
      <Heading
        className={cn(
          'font-serif text-2xl leading-tight tracking-[-0.015em] text-navy-900 sm:text-3xl',
          eyebrow && 'mt-2.5'
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}
