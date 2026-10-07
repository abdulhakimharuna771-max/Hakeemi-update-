import Link from 'next/link';
import { MapPin } from 'lucide-react';

import { ContactChannels, SocialChannels } from './contact-channels';
import { LogoMark } from './logo';
import { hasAnyContactChannel, hasAnySocialChannel, siteConfig } from '@/lib/site-config';

export function SiteFooter() {
  const year = new Date().getFullYear();
  const { contact } = siteConfig;

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-3">
              <LogoMark className="size-9" />
              <p className="text-sm font-bold uppercase leading-tight tracking-[0.03em] text-navy-900">
                {siteConfig.organisation}
              </p>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
              {siteConfig.programName}. {siteConfig.supportingMessage}
            </p>
          </div>

          <nav aria-label="Programme">
            <h2 className="text-2xs font-semibold uppercase tracking-[0.1em] text-navy-900">Programme</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/#about" className="text-slate-600 hover:text-navy-900 hover:underline">
                  About the programme
                </Link>
              </li>
              <li>
                <Link href="/#who-can-register" className="text-slate-600 hover:text-navy-900 hover:underline">
                  Who can register
                </Link>
              </li>
              <li>
                <Link href="/#access" className="text-slate-600 hover:text-navy-900 hover:underline">
                  What participants can access
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-slate-600 hover:text-navy-900 hover:underline">
                  How it works
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Registration">
            <h2 className="text-2xs font-semibold uppercase tracking-[0.1em] text-navy-900">Registration</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/register" className="text-slate-600 hover:text-navy-900 hover:underline">
                  Start registration
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-slate-600 hover:text-navy-900 hover:underline">
                  Applicant login
                </Link>
              </li>
              <li>
                <Link href="/track" className="text-slate-600 hover:text-navy-900 hover:underline">
                  Track an application
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="text-slate-600 hover:text-navy-900 hover:underline">
                  Frequently asked questions
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-2xs font-semibold uppercase tracking-[0.1em] text-navy-900">Contact</h2>
            {hasAnyContactChannel() ? (
              <>
                <ContactChannels className="mt-4 space-y-3 text-sm text-slate-600" />
                {contact.addressLines.length > 0 ? (
                  <div className="mt-3 flex items-start gap-2.5 text-sm text-slate-600">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                    <address className="not-italic leading-relaxed">
                      {contact.addressLines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </address>
                  </div>
                ) : null}
                {contact.officeHours ? (
                  <p className="mt-3 text-xs text-slate-500">{contact.officeHours}</p>
                ) : null}
              </>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Messages sent through the contact form on the programme page reach the programme office.
              </p>
            )}
            {hasAnySocialChannel() ? (
              <>
                <h2 className="mt-7 text-2xs font-semibold uppercase tracking-[0.1em] text-navy-900">Follow</h2>
                <SocialChannels className="mt-3 text-sm" />
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteConfig.organisation}. {siteConfig.programName}.
          </p>
          <p>
            Registration data is stored securely and visible only to you and the authorised review team.
          </p>
        </div>
      </div>
    </footer>
  );
}
