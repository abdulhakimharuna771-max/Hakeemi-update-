import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Form controls.
 *
 * Accessibility is wired in rather than left to each form: the label is always
 * associated, hints and errors are linked through aria-describedby, and invalid
 * fields expose aria-invalid so screen readers announce the error.
 */

const CONTROL_BASE =
  'w-full rounded-md border bg-white px-3 text-navy-900 shadow-xs transition-colors ' +
  'placeholder:text-slate-400 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

const CONTROL_IDLE = 'border-slate-300 hover:border-slate-400 focus:border-navy-600';
const CONTROL_INVALID = 'border-red-400 bg-red-50/40 focus:border-red-600';

interface FieldProps {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  className?: string;
}

export function Field({
  id,
  label,
  children,
  hint,
  error,
  required,
  optionalLabel,
  className,
}: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-navy-900">
        {label}
        {required ? (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        ) : null}
        {!required && optionalLabel ? (
          <span className="ml-1.5 text-xs font-normal text-slate-500">{optionalLabel}</span>
        ) : null}
      </label>

      {children}

      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-slate-500">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium leading-relaxed text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

interface InputProps extends ComponentPropsWithRef<'input'> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(CONTROL_BASE, 'h-11', invalid ? CONTROL_INVALID : CONTROL_IDLE, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        CONTROL_BASE,
        'resize-y py-2.5 leading-relaxed',
        invalid ? CONTROL_INVALID : CONTROL_IDLE,
        className
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

interface SelectProps extends ComponentPropsWithRef<'select'> {
  invalid?: boolean;
}

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        CONTROL_BASE,
        'h-11 appearance-none bg-no-repeat pr-9',
        invalid ? CONTROL_INVALID : CONTROL_IDLE,
        className
      )}
      style={{
        // A single inline chevron keeps the control consistent without shipping
        // an icon component into every form.
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.75rem center',
      }}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

interface CheckboxProps extends ComponentPropsWithRef<'input'> {
  invalid?: boolean;
}

export function Checkbox({ className, invalid, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        'size-5 shrink-0 cursor-pointer rounded border-slate-300 text-navy-800',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        invalid && 'border-red-400',
        className
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

/** Labelled input with hint/error wiring — the standard building block. */
interface FieldInputProps extends InputProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  fieldClassName?: string;
}

export function FieldInput({
  id,
  label,
  hint,
  error,
  required,
  optionalLabel,
  fieldClassName,
  ...inputProps
}: FieldInputProps) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      className={fieldClassName}
    >
      <Input id={id} invalid={Boolean(error)} aria-describedby={describedBy(id, hint, error)} {...inputProps} />
    </Field>
  );
}

interface FieldTextareaProps extends TextareaProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  fieldClassName?: string;
}

export function FieldTextarea({
  id,
  label,
  hint,
  error,
  required,
  optionalLabel,
  fieldClassName,
  ...textareaProps
}: FieldTextareaProps) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      className={fieldClassName}
    >
      <Textarea
        id={id}
        invalid={Boolean(error)}
        aria-describedby={describedBy(id, hint, error)}
        {...textareaProps}
      />
    </Field>
  );
}

interface FieldSelectProps extends SelectProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  children: ReactNode;
  fieldClassName?: string;
}

export function FieldSelect({
  id,
  label,
  hint,
  error,
  required,
  optionalLabel,
  children,
  fieldClassName,
  ...selectProps
}: FieldSelectProps) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      className={fieldClassName}
    >
      <Select
        id={id}
        invalid={Boolean(error)}
        aria-describedby={describedBy(id, hint, error)}
        {...selectProps}
      >
        {children}
      </Select>
    </Field>
  );
}

interface FieldCheckboxProps extends CheckboxProps {
  id: string;
  label: ReactNode;
  error?: string;
}

export function FieldCheckbox({ id, label, error, className, ...checkboxProps }: FieldCheckboxProps) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          className={cn('mt-0.5', className)}
          invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...checkboxProps}
        />
        <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-navy-900">
          {label}
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 pl-8 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
