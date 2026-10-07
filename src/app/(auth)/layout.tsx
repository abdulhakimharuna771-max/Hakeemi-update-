import Link from 'next/link';
import { CircleCheck } from 'lucide-react';

import { LogoMark } from '@/components/layout/logo';
import { siteConfig } from '@/lib/site-config';

const ASSURANCES = [
  'Your progress is saved to your account as you complete each step.',
  'Your application and documents are visible only to you and the review team.',
  'You can track every stage of your application from your dashboard.',
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <aside className="bg-navy-950 px-5 py-8 sm:px-8 lg:flex lg:flex-col lg:justify-between lg:px-10 lg:py-12">
        <div>
          <Link href="/" className="inline-block rounded-sm">
            <span className="flex items-center gap-3">
              {/* Decorative here — the organisation and programme names sit beside it. */}
              <span aria-hidden="true">
                <LogoMark className="size-10" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-bold uppercase tracking-[0.03em] text-white">
                  {siteConfig.organisation}
                </span>
                <span className="text-xs text-navy-200">{siteConfig.programNameShort}</span>
              </span>
            </span>
          </Link>

          {/* Not a heading: the page's own title is the single <h1> on each
              auth screen, so this stays a styled paragraph. */}
          <p className="mt-8 font-serif text-2xl leading-snug text-white lg:mt-12 lg:text-3xl">
            {siteConfig.headline}
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-navy-100">
            {siteConfig.supportingMessage}
          </p>
        </div>

        <ul className="mt-8 hidden space-y-3 lg:mt-12 lg:block">
          {ASSURANCES.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-navy-100">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-400" />
              {item}
            </li>
          ))}
        </ul>
      </aside>

      <main id="main-content" className="flex flex-1 flex-col bg-white px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
        <div className="mx-auto w-full max-w-md flex-1">{children}</div>
        <p className="mx-auto mt-10 w-full max-w-md text-xs text-slate-500">
          <Link href="/" className="hover:text-navy-900 hover:underline">
            ← Back to the programme page
          </Link>
        </p>
      </main>
    </div>
  );
}
