import { cn } from '@/lib/utils';

/**
 * Programme mark and lockup.
 *
 * A geometric monogram rather than imagery: it stays crisp at 24px, costs
 * nothing to download, and does not imply accreditation or imagery the
 * programme has not supplied.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="GIZMO DAN KAITA OFFICE PLUS"
      className={cn('size-9 shrink-0', className)}
    >
      <rect width="40" height="40" rx="8" fill="var(--color-navy-900)" />
      <path
        d="M13.5 13.2h6.8v3.1h-3.6v3.2h3.4v3.1h-3.4v5.2h-3.2V13.2Z"
        fill="#ffffff"
      />
      <path
        d="M23.2 13.2h3.3v6.3l4.3-6.3h3.7l-4.9 6.9 5.1 7.7h-3.9l-4.3-6.6v6.6h-3.3V13.2Z"
        fill="#ffffff"
      />
      <rect x="9" y="31.8" width="22" height="2.4" rx="1.2" fill="#059669" />
    </svg>
  );
}

export function LogoLockup({
  className,
  organisation,
  program,
}: {
  className?: string;
  organisation: string;
  program: string;
}) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <LogoMark />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-bold uppercase tracking-[0.03em] text-navy-900">
          {organisation}
        </span>
        <span className="truncate text-xs text-slate-600">{program}</span>
      </span>
    </span>
  );
}
