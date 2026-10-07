import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CircleCheck,
  Globe,
  GraduationCap,
  Handshake,
  Lightbulb,
  ShieldCheck,
  Sprout,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';

import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { SetupNotice } from '@/components/layout/setup-notice';
import { CategoryGrid } from '@/components/landing/category-grid';
import { ContactForm } from '@/components/landing/contact-form';
import { FaqSection } from '@/components/landing/faq';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/feedback';
import { getActiveCategories, getActiveSupportNeeds, getOpenProgram } from '@/lib/data/reference';
import { getSession } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { APPLICATION_STEPS } from '@/lib/constants';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: `${siteConfig.organisation} — ${siteConfig.programName}`,
  description: siteConfig.supportingMessage,
};

const ACCESS_ICONS = [
  BookOpen,
  Handshake,
  TrendingUp,
  Store,
  Globe,
  Users,
  Briefcase,
  GraduationCap,
  Lightbulb,
  Sprout,
  ShieldCheck,
];

export default async function LandingPage() {
  const configured = isSupabaseConfigured();
  const [session, categories, supportNeeds, program] = await Promise.all([
    getSession(),
    getActiveCategories(),
    getActiveSupportNeeds(),
    getOpenProgram(),
  ]);

  const registrationOpen = program !== null;

  return (
    <>
      <SiteHeader signedIn={Boolean(session)} />

      <main id="main-content" className="flex-1">
        {/* ---------------------------------------------------------------- Hero */}
        <section className="border-b border-slate-200 bg-navy-950">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
              <div>
                <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                  {siteConfig.organisation}
                </p>

                <h1 className="mt-4 font-serif text-3xl leading-[1.12] tracking-[-0.02em] text-white sm:text-4xl lg:text-5xl">
                  {siteConfig.programName}
                </h1>

                <p className="mt-6 font-serif text-2xl leading-snug text-white sm:text-3xl">
                  {siteConfig.headline}
                </p>

                <p className="mt-5 max-w-2xl text-base leading-relaxed text-navy-100 sm:text-lg">
                  {siteConfig.supportingMessage}
                </p>

                {!configured ? (
                  <div className="mt-8">
                    <SetupNotice />
                  </div>
                ) : null}

                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Link
                    href="/register"
                    className={buttonStyles(
                      'primary',
                      'lg',
                      'bg-white text-navy-950 hover:bg-navy-100 active:bg-white w-full sm:w-auto'
                    )}
                  >
                    Start registration
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>

                  <Link
                    href="/login"
                    className={buttonStyles(
                      'secondary',
                      'lg',
                      'w-full border-0 bg-transparent text-white ring-1 ring-inset ring-navy-600 hover:bg-navy-900 sm:w-auto'
                    )}
                  >
                    Login
                  </Link>

                  <Link
                    href="/track"
                    className="inline-flex items-center justify-center gap-1.5 px-2 py-3 text-sm font-semibold text-navy-100 underline decoration-navy-600 underline-offset-4 hover:text-white hover:decoration-white"
                  >
                    Track application
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </div>
              </div>

              {/* Programme facts, read from the database — not invented figures. */}
              <Card className="self-start border-navy-800 bg-navy-900 p-6 text-white shadow-none">
                <h2 className="text-2xs font-semibold uppercase tracking-[0.12em] text-emerald-300">
                  Programme focus
                </h2>

                <ul className="mt-4 flex flex-wrap gap-2">
                  {siteConfig.focusAreas.map((area) => (
                    <li
                      key={area}
                      className="rounded-full bg-navy-800 px-3 py-1.5 text-xs font-medium text-navy-50 ring-1 ring-inset ring-navy-700"
                    >
                      {area}
                    </li>
                  ))}
                </ul>

                <dl className="mt-7 space-y-4 border-t border-navy-800 pt-6 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-navy-200">Registration</dt>
                    <dd className="text-right font-semibold text-white">
                      {registrationOpen ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-400" />
                          Open
                        </span>
                      ) : (
                        <span className="text-navy-100">Not currently open</span>
                      )}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-navy-200">Application form</dt>
                    <dd className="text-right font-semibold text-white">
                      {APPLICATION_STEPS.length} steps, saved as you go
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-navy-200">Applicant categories</dt>
                    <dd className="tabular text-right font-semibold text-white">
                      {categories.length > 0 ? categories.length : '—'}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-navy-200">Coverage</dt>
                    <dd className="text-right font-semibold text-white">
                      All 36 states and the FCT
                    </dd>
                  </div>
                </dl>

                <p className="mt-6 border-t border-navy-800 pt-5 text-xs leading-relaxed text-navy-200">
                  Progress is saved to your account as you complete each step, so you can continue
                  later from any device.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- About */}
        <section id="about" className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
              <SectionHeading
                eyebrow="About the programme"
                title="A development programme built around the ideas people already have"
              />

              <div className="space-y-5 text-base leading-relaxed text-slate-700">
                <p>
                  The {siteConfig.programName} identifies students, youth, entrepreneurs, farmers,
                  professionals and innovators, collects their information and ideas, and connects
                  them to development programmes, training, mentorship and opportunities.
                </p>
                <p>
                  The programme operates across {siteConfig.focusAreas.length} connected areas —{' '}
                  {siteConfig.focusAreas.join(', ').toLowerCase()}. Rather than treating each of those
                  in isolation, it works on the links between them: a final year project that becomes
                  a business, a farm that reaches a better market, a professional who mentors the next
                  cohort.
                </p>
                <p>
                  This platform is the registration and applicant portal for that work. It is not a
                  form that disappears into an inbox: every application is stored, tracked and given a
                  status you can follow, and each applicant keeps a private record of everything they
                  submitted.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- Who can register */}
        <section id="who-can-register" className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading
              eyebrow="Who can register"
              title="Five categories, each with its own questions"
              description="Select the category that best describes you. The registration form adapts to it, so you only answer questions that are relevant to your situation."
            />

            <div className="mt-10">
              <CategoryGrid categories={categories} />
            </div>

            <p className="mt-8 text-sm leading-relaxed text-slate-600">
              Categories are managed in the programme database, so additional categories can be
              published without changing this page.
            </p>
          </div>
        </section>

        {/* --------------------------------------------------------- Access */}
        <section id="access" className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading
              eyebrow="What participants can access"
              title="Support you can request when you register"
              description="During registration you tell us which kinds of support are useful to you. These are the areas the programme works in — the list is maintained in the programme database."
            />

            {supportNeeds.length > 0 ? (
              <ul className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                {supportNeeds.map((need, index) => {
                  const Icon = ACCESS_ICONS[index % ACCESS_ICONS.length];
                  return (
                    <li key={need.code} className="flex items-start gap-3.5">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-navy-50 ring-1 ring-navy-100">
                        <Icon aria-hidden="true" className="size-4 text-navy-800" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{need.name}</p>
                        {need.description ? (
                          <p className="mt-1 text-sm leading-relaxed text-slate-600">
                            {need.description}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-8 text-sm text-slate-600">
                Support areas are being published. They appear here as soon as they are available.
              </p>
            )}
          </div>
        </section>

        {/* ---------------------------------------------------- How it works */}
        <section id="how-it-works" className="border-b border-slate-200 bg-navy-950">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
                How it works
              </p>
              <h2 className="mt-2.5 font-serif text-2xl leading-tight tracking-[-0.015em] text-white sm:text-3xl">
                Seven steps, saved as you go
              </h2>
              <p className="mt-3 text-base leading-relaxed text-navy-100">
                You can move backwards and forwards between steps, and leave at any point. Everything
                you enter is saved to your account before you move on.
              </p>
            </div>

            <ol className="mt-11 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
              {APPLICATION_STEPS.map((step) => (
                <li key={step.key} className="border-t border-navy-800 pt-5">
                  <p className="tabular text-sm font-semibold text-emerald-300">
                    {String(step.number).padStart(2, '0')}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">{step.title}</p>
                </li>
              ))}
              <li className="border-t border-navy-800 pt-5">
                <p className="tabular text-sm font-semibold text-emerald-300">08</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  Application ID issued and tracked
                </p>
              </li>
            </ol>

            <div className="mt-12 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className={buttonStyles(
                  'primary',
                  'lg',
                  'bg-white text-navy-950 hover:bg-navy-100 active:bg-white w-full sm:w-auto'
                )}
              >
                Start registration
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/track"
                className={buttonStyles(
                  'secondary',
                  'lg',
                  'w-full border-0 bg-transparent text-white ring-1 ring-inset ring-navy-600 hover:bg-navy-900 sm:w-auto'
                )}
              >
                Track an existing application
              </Link>
            </div>
          </div>
        </section>

        {/* --------------------------------- Innovation & Entrepreneurship */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
              <div>
                <SectionHeading
                  eyebrow="Innovation & entrepreneurship"
                  title="From a final year project to something that operates"
                />
                <div className="mt-5 space-y-5 text-base leading-relaxed text-slate-700">
                  <p>
                    Many strong ideas stall between the classroom and the market. The programme is
                    designed around that gap: it records what stage an idea has reached, what problem
                    it addresses, and what support would move it forward.
                  </p>
                  <p>
                    Student projects, business ventures and early-stage innovations are registered
                    side by side, because they face overlapping obstacles — access to training,
                    equipment, technology, markets and partnership.
                  </p>
                </div>
              </div>

              <ul className="space-y-4 self-center">
                {[
                  {
                    icon: Lightbulb,
                    title: 'Ideas are recorded properly',
                    body: 'Problem, opportunity, stage, beneficiaries, skills and expected impact — captured once and reusable.',
                  },
                  {
                    icon: Briefcase,
                    title: 'Business stage is explicit',
                    body: 'Business owners state their stage, type and main challenge, so support can be matched to reality.',
                  },
                  {
                    icon: GraduationCap,
                    title: 'Academic work is included',
                    body: 'Institution, department and final year project status are captured for student applicants.',
                  },
                  {
                    icon: TrendingUp,
                    title: 'Progress is tracked, not assumed',
                    body: 'Every status change is recorded with its date and shown on your dashboard.',
                  },
                ].map((item) => (
                  <li key={item.title}>
                    <Card className="flex items-start gap-4 p-5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 ring-1 ring-emerald-100">
                        <item.icon aria-hidden="true" className="size-4.5 text-emerald-800" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{item.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.body}</p>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- Youth & community */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
              <div>
                <SectionHeading
                  eyebrow="Youth development"
                  title="Skills, mentorship and a route into industry"
                />
                <p className="mt-5 text-base leading-relaxed text-slate-700">
                  Young people register with the skills they already have and the goals they are
                  working towards — training, mentorship, digital skills, career development or a
                  first market. The programme uses that record to connect people with opportunities
                  rather than asking them to start over.
                </p>
                <ul className="mt-6 space-y-3">
                  {['Digital skills', 'Career development', 'Mentorship', 'Training'].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
                      <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-700" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:border-l lg:border-slate-200 lg:pl-10">
                <SectionHeading
                  eyebrow="Community development"
                  title="Registered where people actually live"
                />
                <p className="mt-5 text-base leading-relaxed text-slate-700">
                  Every applicant is registered by state, local government area, ward and community,
                  using official Nigerian geography covering all 36 states and the Federal Capital
                  Territory. That is what makes it possible to understand where needs are concentrated
                  and to direct development work deliberately instead of by guesswork.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    'State, LGA and ward captured on every application',
                    'Community recorded for local programme delivery',
                    'Farmer applicants detail farming type, products and stage',
                    'Support demand recorded per applicant, not in aggregate',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
                      <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-700" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- FAQ */}
        <section id="faq" className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading
              eyebrow="Questions"
              title="Frequently asked questions"
              description="If your question is not answered here, send it to the programme office using the contact form below."
            />
            <div className="mt-10">
              <FaqSection />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- Contact */}
        <section id="contact" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading
              eyebrow="Contact"
              title="Talk to the programme office"
              description="Ask about eligibility, the registration process, documents or anything you are unsure about before applying."
            />
            <div className="mt-10">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
