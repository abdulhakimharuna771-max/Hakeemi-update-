import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // Navy carries the institutional weight of the programme.
  primary:
    'bg-navy-900 text-white shadow-sm hover:bg-navy-800 active:bg-navy-950 disabled:hover:bg-navy-900',
  // Emerald is reserved for the single most important action on a screen.
  accent:
    'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 active:bg-emerald-900 disabled:hover:bg-emerald-700',
  secondary:
    'bg-white text-navy-900 ring-1 ring-slate-300 shadow-sm hover:bg-slate-50 hover:ring-slate-400 active:bg-slate-100',
  ghost: 'bg-transparent text-navy-800 hover:bg-slate-100 active:bg-slate-200',
  danger: 'bg-red-700 text-white shadow-sm hover:bg-red-800 active:bg-red-900',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

const BASE =
  'inline-flex items-center justify-center rounded-md font-semibold tracking-[-0.01em] ' +
  'transition-colors duration-150 select-none whitespace-nowrap ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export function buttonStyles(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/**
 * Button with a built-in busy state.
 *
 * While `loading` is true the button is disabled and announces its state to
 * assistive technology, so a slow request is never silent.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <span>Working…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
