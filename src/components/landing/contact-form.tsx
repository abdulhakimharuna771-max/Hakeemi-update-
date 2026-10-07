'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { MapPin, Send } from 'lucide-react';

import { ContactChannels, SocialChannels } from '@/components/layout/contact-channels';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { FieldInput, FieldTextarea } from '@/components/ui/form-controls';
import {
  INITIAL_CONTACT_STATE,
  submitContactMessage,
  type ContactFormState,
} from '@/lib/actions/contact';
import { hasAnyContactChannel, hasAnySocialChannel, siteConfig } from '@/lib/site-config';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} className="w-full sm:w-auto">
      <Send aria-hidden="true" className="size-4" />
      Send message
    </Button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState<ContactFormState, FormData>(
    submitContactMessage,
    INITIAL_CONTACT_STATE
  );

  const errors = state.fieldErrors ?? {};

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
      <div>
        {state.status === 'error' && state.message ? (
          <Alert variant="error" className="mb-5">
            {state.message}
          </Alert>
        ) : null}

        {state.status === 'success' ? (
          <Alert variant="success" title="Message received" className="mb-5">
            {state.message}
          </Alert>
        ) : null}

        <form action={formAction} className="space-y-5" noValidate>
          {/* Honeypot: hidden from people, tempting to bots. */}
          <div className="absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden="true">
            <label htmlFor="contact-website">Website</label>
            <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FieldInput
              id="contact-name"
              name="full_name"
              label="Full name"
              required
              autoComplete="name"
              error={errors.full_name}
            />
            <FieldInput
              id="contact-email"
              name="email"
              type="email"
              label="Email address"
              required
              autoComplete="email"
              error={errors.email}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FieldInput
              id="contact-phone"
              name="phone"
              type="tel"
              label="Phone number"
              optionalLabel="Optional"
              autoComplete="tel"
              error={errors.phone}
            />
            <FieldInput
              id="contact-subject"
              name="subject"
              label="Subject"
              optionalLabel="Optional"
              error={errors.subject}
            />
          </div>

          <FieldTextarea
            id="contact-message"
            name="message"
            label="Your message"
            required
            rows={5}
            maxLength={2000}
            error={errors.message}
            hint="Please include enough detail for the programme office to respond usefully. Do not include passwords or bank details."
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SubmitButton />
            <p className="text-xs leading-relaxed text-slate-500">
              Messages are stored securely and read by the programme office.
            </p>
          </div>
        </form>
      </div>

      {/* Configured channels only — nothing is invented if they are unset. */}
      <aside className="lg:border-l lg:border-slate-200 lg:pl-10">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-navy-900">
          Programme office
        </h3>

        {hasAnyContactChannel() ? (
          <div className="mt-5">
            <ContactChannels className="space-y-4 text-sm text-slate-700" />
            {siteConfig.contact.addressLines.length > 0 ? (
              <div className="mt-4 flex items-start gap-3 text-sm text-slate-700">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <address className="not-italic leading-relaxed">
                  {siteConfig.contact.addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
            ) : null}
            {siteConfig.contact.officeHours ? (
              <p className="mt-4 text-sm text-slate-600">{siteConfig.contact.officeHours}</p>
            ) : null}
            {hasAnySocialChannel() ? (
              <>
                <h3 className="mt-8 text-sm font-semibold uppercase tracking-[0.08em] text-navy-900">
                  Follow the programme
                </h3>
                <SocialChannels className="mt-3 text-sm" />
              </>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 text-sm leading-relaxed text-slate-600">
            Official phone, email and office address details are being published. Until they are,
            this form is the programme office&apos;s inbound channel and every message is stored and
            reviewed.
          </p>
        )}

        <div className="mt-8 rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-navy-900">
            Already applied?
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Sign in to your dashboard to see your application status, upload documents or read
            notifications. Enquiries about a specific application move faster when you include your
            Application ID.
          </p>
        </div>
      </aside>
    </div>
  );
}
