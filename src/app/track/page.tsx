import Link from 'next/link';
import { ArrowRight, Clock, ListChecks, ShieldCheck } from 'lucide-react';

import { StatusTracker } from '@/components/portal/status-tracker';
import { buttonStyles } from '@/components/ui/button';
import { Card, CardBody, CardHeader, DescriptionItem, DescriptionList } from '@/components/ui/card';
import { Alert, EmptyState, StatusBadge } from '@/components/ui/feedback';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { requireVerifiedUser } from '@/lib/auth';
import { getApplicantApplication, getStatusHistory } from '@/lib/data/applicant';
import { getApplicationStatuses, getOpenProgram } from '@/lib/data/reference';
import { humanizeCode, formatDateTime } from '@/lib/utils';

export const metadata = {
  title: 'Track your application',
  description: 'Follow the progress of the application linked to your account.',
};

/**
 * Application tracking.
 *
 * Deliberately authenticated: an application number on its own is not treated
 * as a secret strong enough to unlock someone's record, so tracking follows the
 * signed-in applicant's own account instead of accepting an ID typed into a
 * public form.
 */
export default async function TrackPage() {
  const { user, profile } = await requireVerifiedUser('/track');

  const program = await getOpenProgram();
  const application = program ? await getApplicantApplication(program.id) : await getApplicantApplication();

  const [statuses, history] = await Promise.all([
    getApplicationStatuses(),
    application ? getStatusHistory(application.id) : Promise.resolve([]),
  ]);

  const statusRow = statuses.find((row) => row.code === application?.status) ?? null;
  const isDraft = application ? !application.submitted_at : false;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <SiteHeader />

      <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy-700">Tracking</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
              Your application
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Signed in as {user.email}
              {profile.full_name ? ` · ${profile.full_name}` : ''}
            </p>
          </div>
          <Link href="/portal/dashboard" className={buttonStyles('secondary', 'sm')}>
            Open dashboard
          </Link>
        </div>

        <div className="mt-6 space-y-6">
          {!application ? (
            <EmptyState
              icon={ListChecks}
              title="No application on this account yet"
              description="Once you start a registration it will appear here, and every status change will be recorded against it."
              action={
                <Link href="/portal/application" className={buttonStyles('accent', 'md')}>
                  Start registration
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              }
            />
          ) : (
            <>
              <Card>
                <CardHeader
                  title={
                    application.application_number
                      ? `Application ${application.application_number}`
                      : 'Draft application'
                  }
                  description={
                    application.application_number
                      ? 'Keep this reference for any correspondence with the programme office.'
                      : 'This registration has not been submitted yet, so it has no application number.'
                  }
                  action={
                    <StatusBadge
                      status={application.status}
                      label={statusRow?.label ?? null}
                      tone={statusRow?.tone ?? null}
                    />
                  }
                />
                <CardBody className="space-y-5">
                  {profile.role !== 'applicant' ? (
                    <Alert variant="warning" title="Reviewer access">
                      This account has reviewer privileges. Applicants only ever see their own record here.
                    </Alert>
                  ) : null}

                  {isDraft ? (
                    <Alert variant="info" title="Not yet submitted">
                      You can still edit this registration.{' '}
                      <Link href="/portal/application" className="font-semibold underline underline-offset-2">
                        Continue where you left off
                      </Link>
                      .
                    </Alert>
                  ) : null}

                  <DescriptionList columns={2}>
                    <DescriptionItem term="Current status">
                      {statusRow?.label ?? humanizeCode(application.status)}
                    </DescriptionItem>
                    <DescriptionItem term="Programme">
                      {program ? program.name : '—'}
                    </DescriptionItem>
                    <DescriptionItem term="Submitted">
                      {application.submitted_at ? formatDateTime(application.submitted_at) : 'Not submitted'}
                    </DescriptionItem>
                    <DescriptionItem term="Last updated">{formatDateTime(application.updated_at)}</DescriptionItem>
                  </DescriptionList>

                  {statusRow?.description ? (
                    <p className="rounded-md bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                      {statusRow.description}
                    </p>
                  ) : null}
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Progress"
                  description="Stages are published by the programme itself, so this list always matches the live process."
                />
                <CardBody>
                  <StatusTracker statuses={statuses} current={application.status} />
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="History" description="Recorded changes to this application, most recent first." />
                <CardBody>
                  {history.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      Nothing has been recorded yet. Activity appears here as your application moves through review.
                    </p>
                  ) : (
                    <ol className="space-y-4">
                      {history.map((entry) => (
                        <li key={entry.id} className="flex gap-3.5">
                          <span
                            aria-hidden="true"
                            className="mt-1 flex size-2.5 shrink-0 rounded-full bg-navy-700 ring-4 ring-navy-50"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-navy-900">
                              {statuses.find((row) => row.code === entry.to_status)?.label ??
                                humanizeCode(entry.to_status)}
                            </p>
                            {entry.note ? (
                              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{entry.note}</p>
                            ) : null}
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                              <Clock aria-hidden="true" className="size-3.5" />
                              <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardBody>
              </Card>
            </>
          )}

          <Card>
            <CardBody className="flex gap-3 text-sm text-slate-600">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-emerald-700" />
              <p>
                Tracking is tied to your signed-in account rather than an application number typed into a public
                form, so nobody can look up an application by guessing a reference.
              </p>
            </CardBody>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
