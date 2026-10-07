import { ProfileForm } from '@/components/portal/profile-form';
import { Alert } from '@/components/ui/feedback';
import { requireVerifiedUser } from '@/lib/auth';
import { getStates } from '@/lib/data/reference';

export const metadata = { title: 'My profile' };

export default async function ProfilePage() {
  const { user, profile } = await requireVerifiedUser();
  const states = await getStates();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">My profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your profile is your account record. It is separate from an application, and it is never shown to other
          applicants.
        </p>
      </div>

      {states.length === 0 ? (
        <Alert variant="warning" title="Location data unavailable">
          The state list could not be loaded, so location fields are disabled. Your other details can still be
          saved.
        </Alert>
      ) : null}

      <ProfileForm profile={profile} email={user.email ?? ''} states={states} />
    </div>
  );
}
