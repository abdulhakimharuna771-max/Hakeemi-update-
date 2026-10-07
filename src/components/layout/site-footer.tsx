import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';

import { LogoMark } from './logo';
import { siteConfig } from '@/lib/site-config';

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
            {contact.email || contact.phone || contact.addressLines.length > 0 ? (
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {contact.email ? (
                  <li className="flex items-start gap-2.5">
                    <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                    <a href={`mailto:${contact.email}`} className="break-all hover:text-navy-900 hover:underline">
                      {contact.email}
                    </a>
                  </li>
                ) : null}
                {contact.phone ? (
                  <li className="flex items-start gap-2.5">
                    <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                    <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="hover:text-navy-900 hover:underline">
                      {contact.phone}
                    </a>
                  </li>
                ) : null}
                {contact.addressLines.length > 0 ? (
                  <li className="flex items-start gap-2.5">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                    <address className="not-italic leading-relaxed">
                      {contact.addressLines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </address>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Official contact channels are being published. Messages sent through the contact form on
                this page reach the programme office.
              </p>
            )}
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
