import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

import { ApplicationWizard } from '@/components/portal/application-wizard';
import { buttonStyles } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { requireVerifiedUser } from '@/lib/auth';
import {
  getApplicantApplication,
  getApplicationChecklist,
  getApplicationDocuments,
  getApplicationSupportNeeds,
} from '@/lib/data/applicant';
import {
  getActiveCategories,
  getActiveDocumentTypes,
  getActiveSupportNeeds,
  getApplicationStatuses,
  getLocationNamesByIds,
  getOpenProgram,
  getStates,
} from '@/lib/data/reference';

export const metadata = { title: 'My registration' };

export default async function ApplicationPage() {
  const { user, profile } = await requireVerifiedUser();
  const program = await getOpenProgram();

  const application = program
    ? await getApplicantApplication(program.id)
    : await getApplicantApplication();

  const [categories, supportNeeds, documentTypes, states, statuses] = await Promise.all([
    getActiveCategories(),
    getActiveSupportNeeds(),
    getActiveDocumentTypes(),
    getStates(),
    getApplicationStatuses(),
  ]);

  const [checklist, documents, selectedSupportNeeds, locationNameMap] = await Promise.all([
    application ? getApplicationChecklist(application.id) : Promise.resolve(null),
    application ? getApplicationDocuments(application.id) : Promise.resolve([]),
    application ? getApplicationSupportNeeds(application.id) : Promise.resolve([]),
    getLocationNamesByIds([application?.state_id, application?.lga_id, application?.ward_id]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Registration</h1>
          <p className="mt-1 text-sm text-slate-600">
            {program ? program.name : 'No programme is currently accepting registrations.'}
          </p>
        </div>
        <Link href="/portal/dashboard" className={buttonStyles('ghost', 'sm')}>
          Back to dashboard
        </Link>
      </div>

      {!program ? (
        <Alert variant="warning" title="Registration is not open">
          The programme record is either unpublished, closed or outside its intake window, so a registration
          cannot be created right now. Your existing application, if any, is shown below for reference only.
        </Alert>
      ) : null}

      {program && categories.length === 0 ? (
        <Alert variant="warning" title="Categories are being published">
          Applicant categories are not available yet, so the category step is disabled. Please try again shortly —
          the programme office is preparing the registration data.
        </Alert>
      ) : null}

      {program && supportNeeds.length === 0 ? (
        <Alert variant="warning" title="Support areas are being published">
          The list of support areas has not been published yet.
        </Alert>
      ) : null}

      {!profile.full_name ? (
        <Alert variant="info" title="Complete your profile first">
          <span className="flex flex-wrap items-center gap-2">
            <TriangleAlert aria-hidden="true" className="size-4" />
            <span>
              Your name and contact details are pre-filled from your profile.{' '}
              <Link href="/portal/profile" className="font-semibold underline underline-offset-2">
                Add them now
              </Link>{' '}
              to save time on step 1.
            </span>
          </span>
        </Alert>
      ) : null}

      <ApplicationWizard
        application={application}
        checklist={checklist}
        selectedSupportNeeds={selectedSupportNeeds.map((need) => ({
          code: need.support_needs?.code ?? '',
          details: need.details,
        }))}
        categories={categories}
        supportNeeds={supportNeeds}
        documentTypes={documentTypes}
        documents={documents}
        states={states}
        statuses={statuses}
        contactEmail={application?.contact_email ?? user.email ?? ''}
        profileDefaults={{
          full_name: profile.full_name,
          phone: profile.phone,
          date_of_birth: profile.date_of_birth,
          address: profile.address,
        }}
        initialLocationNames={{
          state: application?.state_id ? locationNameMap.get(application.state_id) : undefined,
          lga: application?.lga_id ? locationNameMap.get(application.lga_id) : undefined,
          ward: application?.ward_id ? locationNameMap.get(application.ward_id) : undefined,
        }}
      />
    </div>
  );
}
