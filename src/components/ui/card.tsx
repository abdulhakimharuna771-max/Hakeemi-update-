import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Surfaces.
 *
 * Modest radii, a hairline ring and a very light shadow. Deliberately not the
 * oversized rounded "dashboard card" look.
 */

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}

export function Card({ children, className, as: Tag = 'div' }: CardProps) {
  return (
    <Tag className={cn('rounded-lg border border-slate-200 bg-white shadow-xs', className)}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
  headingLevel: Heading = 'h2',
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  headingLevel?: 'h2' | 'h3' | 'h4';
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4',
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <Heading className="text-base font-semibold tracking-[-0.01em] text-navy-900">{title}</Heading>
        {description ? <p className="text-sm leading-relaxed text-slate-600">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-t border-slate-200 bg-slate-50/60 px-5 py-3.5', className)}>
      {children}
    </div>
  );
}

/** Definition list used across the dashboard, profile and review screens. */
export function DescriptionList({
  children,
  className,
  columns = 1,
}: {
  children: ReactNode;
  className?: string;
  columns?: 1 | 2 | 3;
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-8 gap-y-5',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {children}
    </dl>
  );
}

export function DescriptionItem({
  term,
  children,
  className,
}: {
  term: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-2xs font-semibold uppercase tracking-[0.08em] text-slate-500">{term}</dt>
      <dd className="mt-1 break-words text-sm leading-relaxed text-navy-900">{children}</dd>
    </div>
  );
}
