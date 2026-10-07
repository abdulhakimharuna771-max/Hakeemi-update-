'use client';

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  CloudUpload,
  Info,
  LoaderCircle,
  Save,
  Send,
  TriangleAlert,
} from 'lucide-react';

import { DocumentUploader } from '@/components/portal/document-uploader';
import { LocationFields, type LocationNames, type LocationValue } from '@/components/portal/location-fields';
import { TagInput } from '@/components/portal/tag-input';
import { buttonStyles } from '@/components/ui/button';
import { Card, CardBody, CardHeader, DescriptionItem, DescriptionList } from '@/components/ui/card';
import { Alert, ProgressBar, StatusBadge } from '@/components/ui/feedback';
import { FieldCheckbox, FieldInput, FieldSelect, FieldTextarea } from '@/components/ui/form-controls';
import { saveApplicationDraft, submitApplication } from '@/app/portal/actions';
import { isEditableStatus } from '@/lib/forms';
import { APPLICATION_STEPS, CATEGORY_ICONS, stepForFieldKey } from '@/lib/constants';
import { STAGE_OPTIONS } from '@/lib/validation/application';
import { PHONE_MESSAGE, PHONE_PATTERN } from '@/lib/validation/auth';
import { cn, humanizeCode } from '@/lib/utils';
import type {
  ApplicantCategory,
  ApplicationChecklist,
  ApplicationDocument,
  ApplicationStatusRow,
  DocumentType,
  LocationOption,
  SupportNeed,
} from '@/lib/types';
import type { ApplicantApplication } from '@/lib/data/applicant';

/* -------------------------------------------------------------------------- */
/* Local form model                                                           */
/* -------------------------------------------------------------------------- */

interface WizardValues {
  full_name: string;
  phone: string;
  date_of_birth: string;
  address: string;
  category_id: string;
  state_id: string;
  lga_id: string;
  ward_id: string;
  community: string;
  project_name: string;
  project_description: string;
  problem_statement: string;
  opportunity_statement: string;
  current_stage: string;
  target_beneficiaries: string;
  expected_impact: string;
  skills: string[];
  category_details: Record<string, string>;
  support_needs: string[];
  support_details: Record<string, string>;
  terms_accepted: boolean;
  accuracy_confirmed: boolean;
}

type Errors = Record<string, string>;

function initialValues(
  application: ApplicantApplication | null,
  selectedSupportNeeds: { code: string; details: string | null }[]
): WizardValues {
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(application?.category_details ?? {})) {
    details[key] = value === null || value === undefined ? '' : String(value);
  }

  return {
    full_name: application?.full_name ?? '',
    phone: application?.phone ?? '',
    date_of_birth: application?.date_of_birth ?? '',
    address: application?.address ?? '',
    category_id: application?.category_id ? String(application.category_id) : '',
    state_id: application?.state_id ? String(application.state_id) : '',
    lga_id: application?.lga_id ? String(application.lga_id) : '',
    ward_id: application?.ward_id ? String(application.ward_id) : '',
    community: application?.community ?? '',
    project_name: application?.project_name ?? '',
    project_description: application?.project_description ?? '',
    problem_statement: application?.problem_statement ?? '',
    opportunity_statement: application?.opportunity_statement ?? '',
    current_stage: application?.current_stage ?? '',
    target_beneficiaries: application?.target_beneficiaries ?? '',
    expected_impact: application?.expected_impact ?? '',
    skills: application?.skills ?? [],
    category_details: details,
    support_needs: selectedSupportNeeds.map((need) => need.code),
    support_details: Object.fromEntries(
      selectedSupportNeeds
        .filter((need) => need.details)
        .map((need) => [need.code, need.details as string])
    ),
    terms_accepted: application?.terms_accepted ?? false,
    accuracy_confirmed: application?.accuracy_confirmed ?? false,
  };
}

/** Labels for the client-side checklist, mirroring application_field_checklist(). */
const FIELD_LABELS: Record<string, string> = {
  full_name: 'Full name',
  phone: 'Phone number',
  address: 'Address',
  date_of_birth: 'Date of birth',
  category_id: 'Applicant category',
  state_id: 'State',
  lga_id: 'Local Government Area',
  ward_id: 'Ward',
  community: 'Community',
  project_name: 'Business / project / idea name',
  project_description: 'Description',
  problem_statement: 'Problem being solved',
  opportunity_statement: 'Opportunity addressed',
  current_stage: 'Current stage',
  target_beneficiaries: 'Target beneficiaries / customers',
  skills: 'Skills involved',
  expected_impact: 'Expected impact',
  support_needs: 'At least one support need',
  terms_accepted: 'Accuracy confirmed and terms accepted',
};

const REQUIRED: Record<string, string> = {
  full_name: 'Enter your full name',
  phone: 'Enter your phone number',
  address: 'Enter your residential address',
  category_id: 'Select the category that best describes you',
  state_id: 'Select your state',
  lga_id: 'Select your local government area',
  ward_id: 'Select your ward',
  project_name: 'Give your business, project or idea a name',
  project_description: 'Describe your project in at least 30 characters',
  problem_statement: 'Describe the problem in at least 20 characters',
  current_stage: 'Select the current stage',
};


/** Same rule the server applies: strip separators, then test the Nigerian pattern. */
function isValidPhone(raw: string) {
  return PHONE_PATTERN.test(raw.replace(/[\s()-]/g, ''));
}

/* -------------------------------------------------------------------------- */
/* Wizard                                                                     */
/* -------------------------------------------------------------------------- */

export function ApplicationWizard({
  application,
  checklist: initialChecklist,
  selectedSupportNeeds,
  categories,
  supportNeeds,
  documentTypes,
  documents,
  states,
  statuses,
  contactEmail,
  profileDefaults,
  initialLocationNames,
}: {
  application: ApplicantApplication | null;
  checklist: ApplicationChecklist | null;
  selectedSupportNeeds: { code: string; details: string | null }[];
  categories: ApplicantCategory[];
  supportNeeds: SupportNeed[];
  documentTypes: DocumentType[];
  documents: ApplicationDocument[];
  states: LocationOption[];
  statuses: ApplicationStatusRow[];
  contactEmail: string;
  profileDefaults: { full_name: string | null; phone: string | null; date_of_birth: string | null; address: string | null };
  initialLocationNames: LocationNames;
}) {
  const router = useRouter();

  const [values, setValues] = useState<WizardValues>(() => {
    const initial = initialValues(application, selectedSupportNeeds);
    // A brand new application starts from the profile so step 1 is mostly done.
    if (!application) {
      initial.full_name ||= profileDefaults.full_name ?? '';
      initial.phone ||= profileDefaults.phone ?? '';
      initial.date_of_birth ||= profileDefaults.date_of_birth ?? '';
      initial.address ||= profileDefaults.address ?? '';
    }
    return initial;
  });

  const [locationNames, setLocationNames] = useState<LocationNames>(initialLocationNames);
  const [applicationId, setApplicationId] = useState<string | null>(application?.id ?? null);
  const [applicationNumber, setApplicationNumber] = useState<string | null>(application?.application_number ?? null);
  const [status, setStatus] = useState(application?.status ?? 'DRAFT');
  const [checklist, setChecklist] = useState<ApplicationChecklist | null>(initialChecklist);
  const [step, setStep] = useState(() => {
    const resume = application?.current_step ?? 1;
    return Math.min(Math.max(resume || 1, 1), APPLICATION_STEPS.length);
  });
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<{ variant: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const [submitting, startSubmitting] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const stepTopRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const category = useMemo(
    () => categories.find((item) => String(item.id) === values.category_id) ?? null,
    [categories, values.category_id]
  );

  const supportNeedByCode = useMemo(() => new Map(supportNeeds.map((need) => [need.code, need])), [supportNeeds]);

  const readOnly = !isEditableStatus(status);

  /**
   * Outstanding required fields.
   *
   * `get_application_checklist` is authoritative once a draft exists, but before
   * the first save there is nothing in the database to ask — so the same rules
   * are also evaluated here. The union of both lists is shown, which means a
   * brand-new applicant is never told their empty registration is complete.
   */
  const missing = useMemo(() => {
    const keys = new Set(checklist?.missing_fields ?? []);
    for (const entry of APPLICATION_STEPS) {
      for (const key of Object.keys(validateStep(entry.number))) keys.add(key);
    }
    return [...keys];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklist, values, category, supportNeedByCode]);

  /* ---------------------------------------------------------------- setters */

  const setField = useCallback(<K extends keyof WizardValues>(key: K, value: WizardValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }, []);

  const setDetail = useCallback((key: string, value: string) => {
    setValues((current) => ({
      ...current,
      category_details: { ...current.category_details, [key]: value },
    }));
    setErrors((current) => {
      const field = `detail:${key}`;
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const toggleSupport = useCallback((code: string) => {
    setValues((current) => {
      const has = current.support_needs.includes(code);
      const supportNeedsNext = has
        ? current.support_needs.filter((entry) => entry !== code)
        : [...current.support_needs, code];
      const details = { ...current.support_details };
      if (has) delete details[code];
      return { ...current, support_needs: supportNeedsNext, support_details: details };
    });
    setErrors((current) => {
      if (!current.support_needs) return current;
      const next = { ...current };
      delete next.support_needs;
      return next;
    });
  }, []);

  const setLocation = useCallback((next: LocationValue, names: LocationNames) => {
    setLocationNames(names);
    setValues((current) => ({
      ...current,
      state_id: next.stateId ? String(next.stateId) : '',
      lga_id: next.lgaId ? String(next.lgaId) : '',
      ward_id: next.wardId ? String(next.wardId) : '',
    }));
    setErrors((current) => {
      const cleaned = { ...current };
      delete cleaned.state_id;
      delete cleaned.lga_id;
      delete cleaned.ward_id;
      return cleaned;
    });
  }, []);

  /* -------------------------------------------------------------- validation */

  function validateStep(target: number): Errors {
    const found: Errors = {};

    if (target === 1) {
      if (values.full_name.trim().length < 3) found.full_name = REQUIRED.full_name;
      else if (!/\s/.test(values.full_name.trim())) found.full_name = 'Enter both your first and last name';
      if (!values.phone.trim()) found.phone = REQUIRED.phone;
      else if (!isValidPhone(values.phone)) found.phone = PHONE_MESSAGE;
      if (values.address.trim().length < 6) found.address = REQUIRED.address;
      if (values.date_of_birth) {
        const parsed = new Date(values.date_of_birth);
        const age =
          (Date.now() - parsed.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (Number.isNaN(parsed.getTime()) || age < 10 || age > 100) {
          found.date_of_birth = 'Enter a valid date of birth';
        }
      }
    }

    if (target === 2 && !values.category_id) found.category_id = REQUIRED.category_id;

    if (target === 3) {
      if (!values.state_id) found.state_id = REQUIRED.state_id;
      if (!values.lga_id) found.lga_id = REQUIRED.lga_id;
      if (!values.ward_id) found.ward_id = REQUIRED.ward_id;
    }

    if (target === 4) {
      if (values.project_name.trim().length < 3) found.project_name = REQUIRED.project_name;
      if (values.project_description.trim().length < 30) found.project_description = REQUIRED.project_description;
      if (values.problem_statement.trim().length < 20) found.problem_statement = REQUIRED.problem_statement;
      if (!values.current_stage) found.current_stage = REQUIRED.current_stage;

      // Category-specific questions, straight from the database schema.
      for (const field of category?.detail_schema ?? []) {
        if (!field.required) continue;
        const value = (values.category_details[field.key] ?? '').trim();
        if (!value) {
          found[`detail:${field.key}`] = `${field.label} is required`;
          continue;
        }
        if (field.type === 'number' && !/^\d{1,9}$/.test(value)) {
          found[`detail:${field.key}`] = 'Enter a whole number';
        }
      }
    }

    if (target === 5) {
      if (values.support_needs.length === 0) found.support_needs = 'Select at least one type of support you need';
      for (const code of values.support_needs) {
        const need = supportNeedByCode.get(code);
        if (need?.requires_details && !(values.support_details[code] ?? '').trim()) {
          found[`support_details.${code}`] = 'Describe the support you need here';
        }
      }
    }

    if (target === 7) {
      if (!values.terms_accepted) found.terms_accepted = 'You must accept the declaration before submitting';
      if (!values.accuracy_confirmed) found.accuracy_confirmed = 'Please confirm that your information is accurate';
    }

    return found;
  }

  /* ------------------------------------------------------------------ saving */

  function payloadForStep(target: number): Record<string, unknown> {
    const payload: Record<string, unknown> = { current_step: Math.min(Math.max(target, 1), 7) };

    if (target === 1) {
      Object.assign(payload, {
        full_name: values.full_name,
        phone: values.phone,
        date_of_birth: values.date_of_birth,
        address: values.address,
      });
    }
    if (target === 2) payload.category_id = values.category_id;
    if (target === 3) {
      Object.assign(payload, {
        state_id: values.state_id,
        lga_id: values.lga_id,
        ward_id: values.ward_id,
        community: values.community,
      });
    }
    if (target === 4) {
      Object.assign(payload, {
        project_name: values.project_name,
        project_description: values.project_description,
        problem_statement: values.problem_statement,
        opportunity_statement: values.opportunity_statement,
        current_stage: values.current_stage,
        target_beneficiaries: values.target_beneficiaries,
        expected_impact: values.expected_impact,
        skills: values.skills,
        category_details: values.category_details,
      });
    }
    if (target === 5) {
      Object.assign(payload, {
        support_needs: values.support_needs.map((code) => ({
          code,
          details: (values.support_details[code] ?? '').trim() || undefined,
        })),
      });
    }
    if (target === 7) {
      Object.assign(payload, {
        terms_accepted: values.terms_accepted,
        accuracy_confirmed: values.accuracy_confirmed,
      });
    }

    return payload;
  }

  /**
   * Persist one step.
   *
   * Returns true when the save succeeded. On failure the entered values stay in
   * state exactly as they were, so a single failed request never costs the
   * applicant their work.
   */
  function persist(target: number, options: { advance?: boolean } = {}): Promise<boolean> {
    const payload = payloadForStep(target);

    return new Promise<boolean>((resolve) => {
      startSaving(async () => {
        const result = await saveApplicationDraft(payload);

        if (!result.ok) {
          setNotice({ variant: 'error', message: `${result.error} Your information is still here — you can try again.` });
          if (result.missingFields && result.missingFields.length > 0) {
            const target2 = Math.min(...result.missingFields.map(stepForFieldKey));
            if (target2 < target) {
              setNotice({
                variant: 'warning',
                message: `Step ${target2} still needs attention before this step can be completed. Your work has been saved.`,
              });
            }
          }
          resolve(false);
          return;
        }

        setApplicationId(result.data.application.id);
        setApplicationNumber(result.data.application.application_number);
        setStatus(result.data.application.status);
        if (result.data.checklist) setChecklist(result.data.checklist);
        setSavedAt(new Date().toISOString());
        setNotice({ variant: 'success', message: 'Progress saved.' });

        if (options.advance) {
          const next = Math.min(target + 1, APPLICATION_STEPS.length);
          setStep(next);
          window.setTimeout(() => stepTopRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 40);
        }
        router.refresh();
        resolve(true);
      });
    });
  }

  function goNext() {
    const found = validateStep(step);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setNotice({ variant: 'error', message: 'Please correct the highlighted fields before continuing.' });
      // Move focus to the offending control when there is one (input, select or
      // textarea); for a radio group or checkbox the summary itself is focused.
      window.setTimeout(() => {
        const control = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (control) {
          control.focus();
          return;
        }
        noticeRef.current?.focus();
      }, 30);
      return;
    }

    setErrors({});
    setNotice(null);

    // Step 6 holds no form data of its own — documents upload immediately.
    if (step === 6) {
      void persist(7, { advance: true });
      return;
    }

    void persist(step, { advance: true });
  }

  function goBack() {
    setNotice(null);
    setErrors({});
    setStep((current) => Math.max(1, current - 1));
    window.setTimeout(() => stepTopRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 40);
  }

  function jumpTo(target: number) {
    if (target === step) return;
    setNotice(null);
    setErrors({});
    setStep(target);
  }

  function handleSubmit() {
    const found = validateStep(7);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setNotice({ variant: 'error', message: 'Please confirm the declaration before submitting.' });
      return;
    }

    setErrors({});
    setNotice(null);

    if (!applicationId) {
      setNotice({ variant: 'error', message: 'Your draft has not been saved yet. Please go back a step and try again.' });
      return;
    }

    startSubmitting(async () => {
      // Save the declaration first so the database sees the confirmed flags.
      const saved = await saveApplicationDraft(payloadForStep(7));
      if (!saved.ok) {
        setNotice({ variant: 'error', message: `${saved.error} Your information has been saved.` });
        return;
      }

      const result = await submitApplication(applicationId);
      if (!result.ok) {
        const steps = (result.missingFields ?? []).map(stepForFieldKey);
        const earliest = steps.length > 0 ? Math.min(...steps) : null;
        setNotice({
          variant: 'error',
          message: `${result.error} Your information has been saved.`,
        });
        if (result.missingFields?.length) {
          setErrors(
            Object.fromEntries(result.missingFields.map((field) => [field, 'Still required'])),
          );
          if (earliest) setStep(earliest);
        }
        return;
      }

      setStatus(result.data.application.status);
      setApplicationNumber(result.data.application.application_number);
      setNotice({ variant: 'success', message: 'Your application has been submitted.' });
      router.refresh();
      router.push('/portal/dashboard?submitted=1');
    });
  }

  /* -------------------------------------------------------------------- view */

  const stepMeta = APPLICATION_STEPS.find((entry) => entry.number === step)!;
  const nextStep = APPLICATION_STEPS.find((entry) => entry.number === step + 1);
  const busy = saving || submitting;

  const applicableDocumentTypes = documentTypes.filter(
    (type) =>
      !type.applies_to_categories ||
      type.applies_to_categories.length === 0 ||
      (category ? type.applies_to_categories.includes(category.code) : true)
  );

  const summaryRows = useMemo(
    () => [
      { step: 1, label: 'Full name', value: values.full_name },
      { step: 1, label: 'Phone', value: values.phone },
      { step: 1, label: 'Date of birth', value: values.date_of_birth },
      { step: 1, label: 'Address', value: values.address },
      { step: 2, label: 'Category', value: category?.name ?? '' },
      {
        step: 3,
        label: 'State, LGA and ward',
        value: [locationNames.state, locationNames.lga, locationNames.ward].filter(Boolean).join(' · '),
      },
      { step: 3, label: 'Community', value: values.community },
      { step: 4, label: 'Project name', value: values.project_name },
      { step: 4, label: 'Description', value: values.project_description },
      { step: 4, label: 'Problem', value: values.problem_statement },
      { step: 4, label: 'Opportunity', value: values.opportunity_statement },
      { step: 4, label: 'Stage', value: values.current_stage },
      { step: 4, label: 'Beneficiaries', value: values.target_beneficiaries },
      { step: 4, label: 'Skills', value: values.skills.join(', ') },
      { step: 4, label: 'Expected impact', value: values.expected_impact },
      ...(category?.detail_schema ?? []).map((field) => ({
        step: 4,
        label: field.label,
        value: values.category_details[field.key] ?? '',
      })),
      {
        step: 5,
        label: 'Support needed',
        value: values.support_needs
          .map((code) => supportNeedByCode.get(code)?.name ?? code)
          .join(', '),
      },
    ],
    [values, category, supportNeedByCode, locationNames]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Step rail (desktop) */}
      <nav aria-label="Registration steps" className="hidden lg:block">
        <ol className="sticky top-24 space-y-1">
          {APPLICATION_STEPS.map((entry) => {
            const isCurrent = entry.number === step;
            const reached = Boolean(checklist?.fields.some((field) => field.step === entry.number && field.done));
            const outstanding = missing.some((field) => stepForFieldKey(field) === entry.number);

            return (
              <li key={entry.key}>
                <button
                  type="button"
                  onClick={() => jumpTo(entry.number)}
                  disabled={readOnly}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                    isCurrent ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                    readOnly && 'cursor-default'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      isCurrent
                        ? 'bg-white text-navy-900'
                        : reached
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                    )}
                  >
                    {reached && !isCurrent ? <CircleCheck className="size-3.5" /> : String(entry.number).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{entry.label}</span>
                  {outstanding && !isCurrent ? (
                    <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0 text-amber-500" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div ref={stepTopRef} className="min-w-0 scroll-mt-24 space-y-5">
        {/* Header: progress + status */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-navy-700">
                Step {String(step).padStart(2, '0')} of {String(APPLICATION_STEPS.length).padStart(2, '0')}
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">{stepMeta.title}</h1>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge
                status={status}
                label={statuses.find((row) => row.code === status)?.label ?? null}
                tone={statuses.find((row) => row.code === status)?.tone ?? null}
              />
              {applicationNumber ? (
                <span className="tabular text-xs font-semibold text-navy-800">{applicationNumber}</span>
              ) : null}
            </div>
          </div>

          <ProgressBar value={checklist?.completion_percent ?? 0} label="Registration complete" tone="emerald" />

          {/* Mobile step strip */}
          <ol className="flex gap-1 overflow-x-auto pb-1 lg:hidden" aria-label="Registration steps">
            {APPLICATION_STEPS.map((entry) => (
              <li key={entry.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => jumpTo(entry.number)}
                  disabled={readOnly}
                  aria-current={entry.number === step ? 'step' : undefined}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold',
                    entry.number === step
                      ? 'bg-navy-900 text-white'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200'
                  )}
                >
                  {String(entry.number).padStart(2, '0')} {entry.label}
                </button>
              </li>
            ))}
          </ol>
        </div>

        {notice ? (
          <div ref={noticeRef} tabIndex={-1} className="rounded-md focus-visible:outline-none">
            <Alert variant={notice.variant}>{notice.message}</Alert>
          </div>
        ) : null}

        {readOnly ? (
          <Alert variant="info" title="This application has been submitted">
            It can no longer be edited here. Use{' '}
            <Link href="/track" className="font-semibold underline underline-offset-2">
              application tracking
            </Link>{' '}
            to follow its progress.
          </Alert>
        ) : null}

        {/* ------------------------------------------------------------- steps */}
        <Card>
          {step === 1 ? (
            <>
              <CardHeader title="Your details" description="Exactly as they should appear on your record." />
              <CardBody className="space-y-5">
                <FieldInput
                  id="full_name"
                  name="full_name"
                  label="Full name"
                  required
                  autoComplete="name"
                  value={values.full_name}
                  onChange={(event) => setField('full_name', event.target.value)}
                  error={errors.full_name}
                  disabled={readOnly || busy}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldInput
                    id="phone"
                    name="phone"
                    type="tel"
                    label="Phone number"
                    required
                    autoComplete="tel"
                    placeholder="0803 000 0000"
                    value={values.phone}
                    onChange={(event) => setField('phone', event.target.value)}
                    error={errors.phone}
                    disabled={readOnly || busy}
                  />
                  <FieldInput
                    id="date_of_birth"
                    name="date_of_birth"
                    type="date"
                    label="Date of birth"
                    optionalLabel="optional"
                    autoComplete="bday"
                    value={values.date_of_birth}
                    onChange={(event) => setField('date_of_birth', event.target.value)}
                    error={errors.date_of_birth}
                    disabled={readOnly || busy}
                  />
                </div>
                <FieldTextarea
                  id="address"
                  name="address"
                  label="Residential address"
                  required
                  rows={3}
                  autoComplete="street-address"
                  placeholder="House number, street, area, town"
                  value={values.address}
                  onChange={(event) => setField('address', event.target.value)}
                  error={errors.address}
                  disabled={readOnly || busy}
                />
                <div className="rounded-md bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email address</p>
                  <p className="mt-0.5 text-sm text-navy-900">{contactEmail}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Taken from your verified account. Contact the programme office to change it.
                  </p>
                </div>
              </CardBody>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <CardHeader
                title="Choose your category"
                description="This decides which follow-up questions you will be asked. Choose the one that best describes you."
              />
              <CardBody>
                <fieldset aria-describedby={errors.category_id ? 'category-error' : undefined}>
                  <legend className="sr-only">Applicant category</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {categories.map((item) => {
                      const Icon = item.icon ? (CATEGORY_ICONS[item.icon] ?? Info) : Info;
                      const selected = values.category_id === String(item.id);

                      return (
                        <label
                          key={item.id}
                          className={cn(
                            'flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors',
                            selected
                              ? 'border-navy-700 bg-navy-50 ring-1 ring-navy-700'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                            (readOnly || busy) && 'cursor-not-allowed opacity-70'
                          )}
                        >
                          <input
                            type="radio"
                            name="category_id"
                            value={String(item.id)}
                            checked={selected}
                            disabled={readOnly || busy}
                            onChange={() => setField('category_id', String(item.id))}
                            className="sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={cn(
                              'flex size-10 shrink-0 items-center justify-center rounded-md',
                              selected ? 'bg-navy-900 text-white' : 'bg-slate-100 text-navy-800'
                            )}
                          >
                            <Icon className="size-5" strokeWidth={1.9} />
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                              {item.name}
                              {selected ? <CircleCheck aria-hidden="true" className="size-4 text-navy-700" /> : null}
                            </span>
                            {item.short_description ? (
                              <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                                {item.short_description}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {errors.category_id ? (
                    <p id="category-error" role="alert" className="mt-3 text-sm font-medium text-red-700">
                      {errors.category_id}
                    </p>
                  ) : null}
                </fieldset>
              </CardBody>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <CardHeader
                title="Where you are based"
                description="Used for programme planning and to route your application to the right regional team."
              />
              <CardBody>
                <LocationFields
                  states={states}
                  value={{
                    stateId: values.state_id ? Number(values.state_id) : null,
                    lgaId: values.lga_id ? Number(values.lga_id) : null,
                    wardId: values.ward_id ? Number(values.ward_id) : null,
                  }}
                  onChange={setLocation}
                  errors={errors}
                  community={values.community}
                  disabled={readOnly || busy}
                  idPrefix="application-location"
                />
              </CardBody>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <CardHeader
                title="Your business, project or innovation"
                description="Write plainly. Reviewers are looking for a clear problem and a realistic approach, not polished language."
              />
              <CardBody className="space-y-5">
                <FieldInput
                  id="project_name"
                  name="project_name"
                  label="Name"
                  required
                  value={values.project_name}
                  onChange={(event) => setField('project_name', event.target.value)}
                  error={errors.project_name}
                  disabled={readOnly || busy}
                  placeholder="A short working name"
                />
                <FieldTextarea
                  id="project_description"
                  name="project_description"
                  label="Description"
                  required
                  rows={5}
                  value={values.project_description}
                  onChange={(event) => setField('project_description', event.target.value)}
                  error={errors.project_description}
                  hint={`${values.project_description.trim().length} of 3000 characters · at least 30`}
                  disabled={readOnly || busy}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldTextarea
                    id="problem_statement"
                    name="problem_statement"
                    label="Problem being solved"
                    required
                    rows={4}
                    value={values.problem_statement}
                    onChange={(event) => setField('problem_statement', event.target.value)}
                    error={errors.problem_statement}
                    hint="Who is affected, and how?"
                    disabled={readOnly || busy}
                  />
                  <FieldTextarea
                    id="opportunity_statement"
                    name="opportunity_statement"
                    label="Opportunity or market"
                    optionalLabel="optional"
                    rows={4}
                    value={values.opportunity_statement}
                    onChange={(event) => setField('opportunity_statement', event.target.value)}
                    error={errors.opportunity_statement}
                    hint="What makes this worth doing now?"
                    disabled={readOnly || busy}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldSelect
                    id="current_stage"
                    name="current_stage"
                    label="Current stage"
                    required
                    value={values.current_stage}
                    onChange={(event) => setField('current_stage', event.target.value)}
                    error={errors.current_stage}
                    disabled={readOnly || busy}
                  >
                    <option value="">Select the current stage</option>
                    {STAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </FieldSelect>
                  <FieldInput
                    id="target_beneficiaries"
                    name="target_beneficiaries"
                    label="Target beneficiaries or customers"
                    optionalLabel="optional"
                    value={values.target_beneficiaries}
                    onChange={(event) => setField('target_beneficiaries', event.target.value)}
                    error={errors.target_beneficiaries}
                    disabled={readOnly || busy}
                    placeholder="e.g. smallholder farmers in Oyo State"
                  />
                </div>

                {/* Category-specific questions — these come from the database. */}
                {category && category.detail_schema.length > 0 ? (
                  <div className="border-t border-slate-200 pt-5">
                    <h3 className="text-sm font-semibold text-navy-900">
                      About your {category.name.toLowerCase()} work
                    </h3>
                    <p className="mb-4 mt-0.5 text-xs text-slate-500">
                      These questions are specific to the category you selected.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {category.detail_schema.map((field) => {
                        const fieldError = errors[`detail:${field.key}`];
                        const value = values.category_details[field.key] ?? '';
                        const wide = field.type === 'textarea';
                        const common = {
                          id: `detail-${field.key}`,
                          label: field.label,
                          required: Boolean(field.required),
                          optionalLabel: field.required ? undefined : 'optional',
                          error: fieldError,
                          disabled: readOnly || busy,
                          fieldClassName: wide ? 'sm:col-span-2' : undefined,
                        };

                        if (field.type === 'select') {
                          return (
                            <FieldSelect
                              key={field.key}
                              {...common}
                              value={value}
                              onChange={(event) => setDetail(field.key, event.target.value)}
                            >
                              <option value="">Select an option</option>
                              {(field.options ?? []).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </FieldSelect>
                          );
                        }

                        if (field.type === 'textarea') {
                          return (
                            <FieldTextarea
                              key={field.key}
                              {...common}
                              rows={4}
                              placeholder={field.placeholder}
                              hint={field.help}
                              value={value}
                              onChange={(event) => setDetail(field.key, event.target.value)}
                            />
                          );
                        }

                        return (
                          <FieldInput
                            key={field.key}
                            {...common}
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            inputMode={field.type === 'number' ? 'numeric' : undefined}
                            placeholder={field.placeholder}
                            hint={field.help}
                            value={value}
                            onChange={(event) => setDetail(field.key, event.target.value)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="border-t border-slate-200 pt-5">
                  <TagInput
                    id="skills"
                    label="Skills involved"
                    hint="Press Enter after each one. Add the skills you or your team bring to this work."
                    value={values.skills}
                    onChange={(next) => setField('skills', next)}
                    disabled={readOnly || busy}
                  />
                </div>

                <FieldTextarea
                  id="expected_impact"
                  name="expected_impact"
                  label="Expected impact"
                  optionalLabel="optional"
                  rows={3}
                  value={values.expected_impact}
                  onChange={(event) => setField('expected_impact', event.target.value)}
                  error={errors.expected_impact}
                  hint="What changes for the people you are serving if this succeeds?"
                  disabled={readOnly || busy}
                />
              </CardBody>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <CardHeader
                title="Support needed"
                description="Select everything that would help. This guides how the programme matches support — it is not a promise of funding."
              />
              <CardBody className="space-y-5">
                <fieldset>
                  <legend className="sr-only">Support needs</legend>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {supportNeeds.map((need) => {
                      const selected = values.support_needs.includes(need.code);
                      return (
                        <label
                          key={need.code}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors',
                            selected ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50',
                            (readOnly || busy) && 'cursor-not-allowed opacity-70'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={readOnly || busy}
                            onChange={() => toggleSupport(need.code)}
                            className="mt-0.5 size-4 rounded border-slate-300 text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-navy-900">{need.name}</span>
                            {need.description ? (
                              <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                                {need.description}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {errors.support_needs ? (
                    <p role="alert" className="mt-3 text-sm font-medium text-red-700">
                      {errors.support_needs}
                    </p>
                  ) : null}
                </fieldset>

                {values.support_needs
                  .filter((code) => supportNeedByCode.get(code)?.requires_details)
                  .map((code) => (
                    <FieldTextarea
                      key={code}
                      id={`support-details-${code}`}
                      label={`Tell us more about "${supportNeedByCode.get(code)?.name}"`}
                      required
                      rows={3}
                      value={values.support_details[code] ?? ''}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          support_details: { ...current.support_details, [code]: event.target.value },
                        }))
                      }
                      error={errors[`support_details.${code}`]}
                      disabled={readOnly || busy}
                    />
                  ))}
              </CardBody>
            </>
          ) : null}

          {step === 6 ? (
            <>
              <CardHeader
                title="Supporting documents"
                description="Optional at this stage. Anything you add is stored privately and is only visible to you and the review team."
              />
              <CardBody>
                {applicationId ? (
                  <DocumentUploader
                    applicationId={applicationId}
                    documentTypes={applicableDocumentTypes}
                    documents={documents}
                    editable={!readOnly}
                  />
                ) : (
                  <Alert variant="info">
                    Complete the earlier steps first — your draft needs to exist before files can be attached to it.
                  </Alert>
                )}
              </CardBody>
            </>
          ) : null}

          {step === 7 ? (
            <>
              <CardHeader
                title="Review and submit"
                description="Check everything below. After you submit, the application becomes read-only and cannot be edited."
              />
              <CardBody className="space-y-5">
                {missing.length > 0 ? (
                  <Alert variant="warning" title="Some required information is still missing">
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
                      {missing.map((field) => {
                        const detailKey = field.startsWith('detail:') ? field.slice('detail:'.length) : null;
                        const label =
                          checklist?.fields.find((entry) => entry.key === field)?.label ??
                          (detailKey
                            ? (category?.detail_schema.find((entry) => entry.key === detailKey)?.label ?? detailKey)
                            : null) ??
                          FIELD_LABELS[field] ??
                          humanizeCode(field.replace(/^support_details\./, ''));
                        const target = stepForFieldKey(field);
                        return (
                          <li key={field}>
                            <button
                              type="button"
                              onClick={() => jumpTo(target)}
                              className="font-semibold underline underline-offset-2"
                            >
                              {label}
                            </button>{' '}
                            <span className="text-slate-600">
                              (step {target}: {APPLICATION_STEPS.find((entry) => entry.number === target)?.label})
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </Alert>
                ) : (
                  <Alert variant="success" title="Everything required is complete">
                    Review the summary, accept the declaration below, and submit.
                  </Alert>
                )}

                <DescriptionList columns={1}>
                  {summaryRows.map((row) => (
                    <DescriptionItem
                      key={`${row.step}-${row.label}`}
                      term={
                        <button
                          type="button"
                          onClick={() => jumpTo(row.step)}
                          className="text-left font-medium text-navy-800 underline-offset-2 hover:underline"
                        >
                          {row.label}
                          <span className="sr-only">
                            {' '}
                            — edit (step {row.step}:{' '}
                            {APPLICATION_STEPS.find((entry) => entry.number === row.step)?.label})
                          </span>
                        </button>
                      }
                    >
                      <span className="whitespace-pre-line">
                        {row.value?.toString().trim() ? row.value : <span className="text-slate-400">Not provided</span>}
                      </span>
                    </DescriptionItem>
                  ))}
                  <DescriptionItem term="Documents attached">
                    {documents.length > 0 ? `${documents.length} file(s)` : <span className="text-slate-400">None</span>}
                  </DescriptionItem>
                </DescriptionList>

                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <FieldCheckbox
                    id="accuracy_confirmed"
                    label="I confirm that the information I have provided is accurate and complete to the best of my knowledge."
                    checked={values.accuracy_confirmed}
                    onChange={(event) => setField('accuracy_confirmed', event.target.checked)}
                    disabled={readOnly || busy}
                  />
                  <FieldCheckbox
                    id="terms_accepted"
                    label="I accept that the programme may contact me about this application, and that submitting it does not guarantee selection or funding."
                    checked={values.terms_accepted}
                    onChange={(event) => setField('terms_accepted', event.target.checked)}
                    disabled={readOnly || busy}
                  />
                  {errors.accuracy_confirmed || errors.terms_accepted ? (
                    <p role="alert" className="text-sm font-medium text-red-700">
                      {errors.accuracy_confirmed ?? errors.terms_accepted}
                    </p>
                  ) : null}
                </div>
              </CardBody>
            </>
          ) : null}
        </Card>

        {/* ------------------------------------------------------------ actions */}
        {!readOnly ? (
          <div className="sticky bottom-16 z-20 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-5 lg:bottom-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {step > 1 ? (
                  <button type="button" onClick={goBack} disabled={busy} className={buttonStyles('ghost', 'md')}>
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    Back
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void persist(step)}
                  disabled={busy}
                  className={buttonStyles('ghost', 'md', 'text-slate-600')}
                >
                  {saving ? (
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <Save aria-hidden="true" className="size-4" />
                  )}
                  Save and finish later
                </button>
              </div>

              <div className="flex items-center gap-3">
                {savedAt ? (
                  <span aria-live="polite" className="hidden text-xs text-slate-500 sm:inline">
                    Saved
                  </span>
                ) : null}

                {step < APPLICATION_STEPS.length ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={busy}
                    aria-busy={busy || undefined}
                    className={buttonStyles('accent', 'md')}
                  >
                    {saving ? (
                      <>
                        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        {step === 1 ? 'Save and continue' : 'Continue'}
                        <ArrowRight aria-hidden="true" className="size-4" />
                        {nextStep ? <span className="sr-only"> to step {nextStep.number}: {nextStep.title}</span> : null}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={busy}
                    aria-busy={submitting || undefined}
                    className={buttonStyles('accent', 'lg')}
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        <Send aria-hidden="true" className="size-4" />
                        Submit application
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <p className="flex items-start gap-2 text-xs text-slate-500">
          <CloudUpload aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          Your progress is saved to the programme database as you move between steps. If a save fails, your
          answers stay on this page so nothing is lost.
        </p>
      </div>
    </div>
  );
}
