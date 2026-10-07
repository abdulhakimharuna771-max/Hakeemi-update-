'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';

import { LocationFields, type LocationValue } from '@/components/portal/location-fields';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert, ProgressBar } from '@/components/ui/feedback';
import { FieldInput } from '@/components/ui/form-controls';
import { updateProfile } from '@/app/portal/actions';
import type { LocationOption, Profile } from '@/lib/types';

type Feedback =
  | { variant: 'success'; message: string }
  | { variant: 'error'; message: string; fieldErrors?: Record<string, string> }
  | null;

export function ProfileForm({
  profile,
  email,
  states,
}: {
  profile: Profile;
  email: string;
  states: LocationOption[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [completion, setCompletion] = useState(profile.profile_completion);
  const [location, setLocation] = useState<LocationValue>({
    stateId: profile.state_id,
    lgaId: profile.lga_id,
    wardId: profile.ward_id,
  });

  const fieldErrors = feedback?.variant === 'error' ? feedback.fieldErrors : undefined;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFeedback(null);

    startTransition(async () => {
      const result = await updateProfile(formData);

      if (!result.ok) {
        setFeedback({ variant: 'error', message: result.error, fieldErrors: result.fieldErrors });
        return;
      }

      setCompletion(result.data.completion);
      setFeedback({ variant: 'success', message: 'Your profile has been updated.' });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Personal details"
        description="These details are copied into a new application so you do not have to re-enter them."
      />
      <form ref={formRef} onSubmit={handleSubmit} noValidate>
        <CardBody className="space-y-5">
          {feedback ? (
            <Alert variant={feedback.variant === 'success' ? 'success' : 'error'}>
              {feedback.message}
            </Alert>
          ) : null}

          <ProgressBar value={completion} label="Profile complete" tone="emerald" />

          <FieldInput
            id="profile-full-name"
            name="full_name"
            label="Full name"
            required
            autoComplete="name"
            defaultValue={profile.full_name ?? ''}
            error={fieldErrors?.full_name}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldInput
              id="profile-phone"
              name="phone"
              type="tel"
              label="Phone number"
              autoComplete="tel"
              placeholder="0803 000 0000"
              defaultValue={profile.phone ?? ''}
              error={fieldErrors?.phone}
            />
            <FieldInput
              id="profile-dob"
              name="date_of_birth"
              type="date"
              label="Date of birth"
              optionalLabel="optional"
              autoComplete="bday"
              defaultValue={profile.date_of_birth ?? ''}
              error={fieldErrors?.date_of_birth}
            />
          </div>

          <FieldInput
            id="profile-address"
            name="address"
            label="Residential address"
            autoComplete="street-address"
            placeholder="House number, street, area"
            defaultValue={profile.address ?? ''}
            error={fieldErrors?.address}
          />

          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-semibold text-navy-900">Location</h3>
            <p className="mb-4 mt-0.5 text-xs text-slate-500">
              Used for programme planning and to place your application in the right region.
            </p>
            <LocationFields
              states={states}
              value={location}
              onChange={setLocation}
              errors={fieldErrors}
              community={profile.community}
              disabled={pending}
              idPrefix="profile-location"
            />
          </div>

          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-semibold text-navy-900">Email address</h3>
            <p className="mt-0.5 text-sm text-slate-600">{email}</p>
            <p className="mt-1 text-xs text-slate-500">
              Your email identifies your account and cannot be changed here. Contact the programme office if it
              needs to be corrected.
            </p>
          </div>
        </CardBody>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <Button type="submit" loading={pending}>
            <Save aria-hidden="true" className="size-4" />
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
