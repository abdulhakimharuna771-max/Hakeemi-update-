import Link from 'next/link';
import { FileText } from 'lucide-react';

import { DocumentUploader } from '@/components/portal/document-uploader';
import { buttonStyles } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { requireVerifiedUser } from '@/lib/auth';
import { getApplicantApplication, getApplicationDocuments } from '@/lib/data/applicant';
import { getActiveDocumentTypes, getActiveCategories } from '@/lib/data/reference';
import { isEditableStatus } from '@/lib/forms';

export const metadata = { title: 'Documents' };

export default async function DocumentsPage() {
  await requireVerifiedUser();

  const application = await getApplicantApplication();

  const [documentTypes, categories] = await Promise.all([getActiveDocumentTypes(), getActiveCategories()]);
  const documents = application ? await getApplicationDocuments(application.id) : [];
  const category = categories.find((item) => item.id === application?.category_id) ?? null;

  const applicable = documentTypes.filter(
    (type) =>
      !type.applies_to_categories ||
      type.applies_to_categories.length === 0 ||
      (category ? type.applies_to_categories.includes(category.code) : true)
  );

  const editable = isEditableStatus(application?.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Supporting documents</h1>
        <p className="mt-1 text-sm text-slate-600">
          Files are stored in a private area of the programme database. Only you and the review team can open them,
          and links are temporary.
        </p>
      </div>

      {!application ? (
        <EmptyState
          icon={FileText}
          title="Start your registration first"
          description="Documents are attached to an application, so begin (or continue) your registration and come back to this step."
          action={
            <Link href="/portal/application" className={buttonStyles('accent', 'md')}>
              Go to registration
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader
            title="Uploads"
            description={
              editable
                ? 'Each file is validated before upload — accepted types and sizes are shown against each item.'
                : 'This application has been submitted, so its documents are read-only.'
            }
          />
          <CardBody className="space-y-4">
            {!editable ? (
              <Alert variant="info">
                Documents on a submitted application can no longer be added or removed. If the review team needs
                something else, they will request it through your notifications.
              </Alert>
            ) : null}

            <DocumentUploader
              applicationId={application.id}
              documentTypes={applicable}
              documents={documents}
              editable={editable}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
