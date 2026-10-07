import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  CircleAlert,
  FileText,
  Info,
  ListChecks,
  SquarePen,
  UserRound,
} from 'lucide-react';

import { NotificationList } from '@/components/portal/notification-list';
import { StatusTracker } from '@/components/portal/status-tracker';
import { buttonStyles } from '@/components/ui/button';
import { Card, CardBody, CardHeader, DescriptionItem, DescriptionList } from '@/components/ui/card';
import { Alert, EmptyState, ProgressBar, StatusBadge } from '@/components/ui/feedback';
import { requireVerifiedUser } from '@/lib/auth';
import { getApplicantApplication, getApplicationChecklist, getNotifications } from '@/lib/data/applicant';
import { getActiveCategories, getApplicationStatuses, getOpenProgram } from '@/lib/data/reference';
import { APPLICATION_STEPS } from '@/lib/constants';
import { isEditableStatus } from '@/lib/forms';
import { formatDate, formatDateTime } from '@/lib/utils';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { user, profile } = await requireVerifiedUser();
  const { submitted } = await searchParams;

  const program = await getOpenProgram();
  const application = program ? await getApplicantApplication(program.id) : await getApplicantApplication();

  const [checklist, notifications, statuses, categories] = await Promise.all([
    application ? getApplicationChecklist(application.id) : Promise.resolve(null),
    getNotifications(user.id, 4),
    getApplicationStatuses(),
    getActiveCategories(),
  ]);

  const category = categories.find((item) => item.id === application?.category_id) ?? null;
  const statusRow = statuses.find((row) => row.code === application?.status) ?? null;

  const isDraft = application ? isEditableStatus(application.status) : false;
  const needsMoreInfo = application?.status === 'MORE_INFORMATION_REQUIRED';

  const nextStep = (() => {
    const missing = checklist?.missing_fields ?? [];
    if (missing.length === 0) return APPLICATION_STEPS[APPLICATION_STEPS.length - 1];
    const numbers = missing.map((field) => {
      if (field.startsWith('detail:')) return 4;
      const map: Record<string, number> = { support_needs: 5, terms_accepted: 7 };
      return map[field] ?? 1;
    });
    const target = Math.min(...numbers);
    return APPLICATION_STEPS.find((step) => step.number === target) ?? APPLICATION_STEPS[0];
  })();

  const firstName = (profile.full_name ?? '').trim().split(/\s+/)[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            {firstName ? `Welcome back, ${firstName}` : 'Applicant dashboard'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {program
              ? `Your registration for ${program.name}.`
              : 'Registration is not currently open on this deployment.'}
          </p>
        </div>
        <StatusBadge
          status={application?.status ?? null}
          label={statusRow?.label ?? null}
          tone={statusRow?.tone ?? null}
          className="text-xs"
        />
      </div>

      {submitted === '1' && application?.submitted_at ? (
        <Alert variant="success" title="Your application has been submitted">
          Your application ID is{' '}
          <span className="tabular font-semibold">{application.application_number ?? 'being generated'}</span>. Keep
          it for any correspondence with the programme office. You can follow every stage from{' '}
          <Link href="/track" className="font-semibold underline underline-offset-2">
            application tracking
          </Link>
          .
        </Alert>
      ) : null}

      {application && !application.address && !application.phone ? (
        <Alert variant="info" title="Complete your profile">
          Your contact details are used on your application. Keeping them accurate means we can reach you about
          your submission.{' '}
          <Link href="/portal/profile" className="font-semibold underline underline-offset-2">
            Update your profile
          </Link>
        </Alert>
      ) : null}

      {!application ? (
        <EmptyState
          icon={SquarePen}
          title="You have not started a registration yet"
          description={
            program
              ? 'Registration takes about fifteen minutes across seven short steps. You can save your progress at any point and continue later.'
              : 'Registration opens when the programme opens. Check back, or follow the programme for announcements.'
          }
          action={
            program ? (
              <Link href="/portal/application" className={buttonStyles('accent', 'lg')}>
                Start registration
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader
                title={isDraft ? 'Your registration in progress' : 'Your application'}
                description={
                  isDraft
                    ? 'Saved automatically as you go. Nothing is submitted until you complete the review step.'
                    : 'Submitted applications are read-only. Contact the programme office if something needs to change.'
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
                {needsMoreInfo && application.review_notes ? (
                  <Alert variant="warning" title="More information is required">
                    <span className="whitespace-pre-line">{application.review_notes}</span>
                  </Alert>
                ) : null}

                <DescriptionList columns={2}>
                  <DescriptionItem term="Application ID">
                    {application.application_number ? (
                      <span className="tabular font-semibold text-navy-900">{application.application_number}</span>
                    ) : (
                      <span className="text-slate-500">Assigned when you submit</span>
                    )}
                  </DescriptionItem>
                  <DescriptionItem term="Applicant category">
                    {category ? category.name : <span className="text-slate-500">Not selected yet</span>}
                  </DescriptionItem>
                  <DescriptionItem term="Programme">
                    {program ? program.name : '—'}
                  </DescriptionItem>
                  <DescriptionItem term={application.submitted_at ? 'Submitted' : 'Last saved'}>
                    {formatDateTime(application.submitted_at ?? application.updated_at)}
                  </DescriptionItem>
                </DescriptionList>

                {isDraft && checklist ? (
                  <div className="space-y-2">
                    <ProgressBar
                      value={checklist.completion_percent}
                      label="Registration complete"
                      tone="emerald"
                    />
                    <p className="text-xs text-slate-600">
                      {checklist.missing_fields.length === 0
                        ? 'Everything required has been completed — continue to the review step to submit.'
                        : `${checklist.missing_fields.length} required ${
                            checklist.missing_fields.length === 1 ? 'item is' : 'items are'
                          } still outstanding.`}
                    </p>
                  </div>
                ) : null}

                {isDraft ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Link href="/portal/application" className={buttonStyles('accent', 'md')}>
                      <SquarePen aria-hidden="true" className="size-4" />
                      {checklist && checklist.completion_percent > 0 ? 'Continue registration' : 'Start registration'}
                    </Link>
                    <p className="text-xs text-slate-500">
                      Next up: step {nextStep.number} — {nextStep.title}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Link href="/track" className={buttonStyles('secondary', 'md')}>
                      <ListChecks aria-hidden="true" className="size-4" />
                      Track this application
                    </Link>
                    <Link href="/portal/documents" className={buttonStyles('ghost', 'md')}>
                      <FileText aria-hidden="true" className="size-4" />
                      Supporting documents
                    </Link>
                  </div>
                )}
              </CardBody>
            </Card>

            {!isDraft ? (
              <Card>
                <CardHeader
                  title="Application progress"
                  description="Each stage below is recorded against your application as it happens."
                />
                <CardBody>
                  <StatusTracker statuses={statuses} current={application.status} />
                </CardBody>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Your profile" />
              <CardBody className="space-y-4">
                <ProgressBar value={profile.profile_completion} label="Profile complete" />
                <DescriptionList columns={1}>
                  <DescriptionItem term="Full name">
                    {profile.full_name ?? <span className="text-slate-500">Not provided</span>}
                  </DescriptionItem>
                  <DescriptionItem term="Phone">
                    {profile.phone ?? <span className="text-slate-500">Not provided</span>}
                  </DescriptionItem>
                  <DescriptionItem term="Email">{user.email}</DescriptionItem>
                </DescriptionList>
                <Link href="/portal/profile" className={buttonStyles('secondary', 'sm', 'w-full')}>
                  <UserRound aria-hidden="true" className="size-4" />
                  Manage profile
                </Link>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Notifications"
                action={
                  <Link
                    href="/portal/notifications"
                    className="text-xs font-semibold text-navy-800 hover:underline"
                  >
                    View all
                  </Link>
                }
              />
              <CardBody className={notifications.length > 0 ? 'p-0' : undefined}>
                {notifications.length > 0 ? (
                  <NotificationList notifications={notifications} showMarkAll={false} />
                ) : (
                  <EmptyState
                    icon={Bell}
                    title="Nothing yet"
                    description="Status changes and requests from the review team will appear here."
                    className="border-0 bg-transparent px-0 py-2"
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody className="flex gap-3 text-sm text-slate-600">
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-navy-700" />
                <p>
                  Only you can see this application. Programme staff never ask for your password, and we never
                  publish applicant details.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {!program ? (
        <Alert variant="info" title="Programme status">
          The programme record has not been published yet, so registration cannot be started. Run the database
          seed (<code className="font-mono text-xs">supabase/seed</code>) or publish a programme row.
        </Alert>
      ) : null}

      {application?.submitted_at === null && application.status === 'DRAFT' ? (
        <p className="text-xs text-slate-500">
          Draft started {formatDate(application.created_at)} · last saved {formatDateTime(application.updated_at)}
        </p>
      ) : null}

      {!application && profile.profile_completion < 100 ? (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-4">
            <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy-900">Complete your profile first</p>
              <p className="mt-0.5 text-sm text-slate-600">
                Your profile details are copied into a new application, which saves you time on step 1.
              </p>
            </div>
            <Link href="/portal/profile" className={buttonStyles('secondary', 'sm')}>
              Go to profile
            </Link>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
