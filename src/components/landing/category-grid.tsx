import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { CATEGORY_ICONS } from '@/lib/constants';
import type { ApplicantCategory } from '@/lib/types';

/**
 * Applicant categories, rendered from the database.
 *
 * Adding a category in the database makes it appear here and in the
 * registration wizard, with no code change.
 */
export function CategoryGrid({ categories }: { categories: ApplicantCategory[] }) {
  if (categories.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Categories are being published"
        description="Applicant categories are loaded from the programme database. Once they are published they will be listed here."
      />
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => {
        const Icon = CATEGORY_ICONS[category.icon ?? ''] ?? Users;

        return (
          <Card as="li" key={category.code} className="flex flex-col p-6 transition-shadow hover:shadow-sm">
            <span className="flex size-10 items-center justify-center rounded-md bg-navy-50 ring-1 ring-navy-100">
              <Icon aria-hidden="true" className="size-5 text-navy-800" strokeWidth={1.75} />
            </span>

            <h3 className="mt-4 text-base font-semibold tracking-[-0.01em] text-navy-900">
              {category.name}
            </h3>

            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              {category.short_description ?? category.description}
            </p>

            <Link
              href={`/register?category=${encodeURIComponent(category.code)}`}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-800 hover:text-navy-950 hover:underline"
            >
              Register as {category.name.toLowerCase()}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Card>
        );
      })}
    </ul>
  );
}
