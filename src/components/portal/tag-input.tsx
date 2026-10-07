'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { Input } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

/**
 * Small free-text tag input.
 *
 * Skills are open-ended, so rather than inventing a fixed taxonomy we let an
 * applicant type their own and store them as a text array.
 */
export function TagInput({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  placeholder = 'Type a skill and press Enter',
  max = 15,
  disabled = false,
}: {
  id: string;
  name?: string;
  label: string;
  hint?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const commit = (raw: string) => {
    const candidate = raw.trim().replace(/,+$/, '').trim();
    if (!candidate) return;

    if (value.some((item) => item.toLowerCase() === candidate.toLowerCase())) {
      setDraft('');
      return;
    }
    if (value.length >= max) {
      setNotice(`You can add up to ${max} items.`);
      return;
    }

    onChange([...value, candidate.slice(0, 60)]);
    setDraft('');
    setNotice(null);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-navy-900">
        {label}
      </label>

      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => {
            const next = event.target.value;
            setNotice(null);
            // A pasted comma-separated list becomes several tags at once.
            if (next.includes(',')) {
              next.split(',').forEach(commit);
              return;
            }
            setDraft(next);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(draft);
            }
            if (event.key === 'Backspace' && draft === '' && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
        />
        <button
          type="button"
          onClick={() => commit(draft)}
          disabled={disabled || draft.trim().length === 0}
          className="h-11 shrink-0 rounded-md bg-slate-100 px-3.5 text-sm font-semibold text-navy-800 hover:bg-slate-200 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* The array is what the form actually submits. */}
      {name ? <input type="hidden" name={name} value={value.join(',')} /> : null}

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2 pt-1">
          {value.map((item) => (
            <li key={item}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((entry) => entry !== item))}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-800',
                  'ring-1 ring-inset ring-navy-100 hover:bg-navy-100 disabled:opacity-60'
                )}
              >
                {item}
                <X aria-hidden="true" className="size-3.5" />
                <span className="sr-only">Remove {item}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {notice ? (
        <p role="alert" className="text-xs font-medium text-amber-700">
          {notice}
        </p>
      ) : null}

      {hint && !notice ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
