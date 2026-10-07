-- =============================================================================
-- Migration 0003 — Core applicant tables
--
--   auth.users  ->  profiles  ->  applications  ->  application_documents
--                                                  application_support_needs
--                                                  application_status_history
--                                   notifications
--
-- Authentication data is never duplicated: profile identity is the auth user id.
-- Safe to run more than once (idempotent).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profiles — one row per authenticated user, created automatically on signup.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  role               public.user_role not null default 'applicant',
  full_name          text,
  phone              text,
  date_of_birth      date,
  address            text,
  state_id           bigint references public.locations(id) on delete restrict,
  lga_id             bigint references public.locations(id) on delete restrict,
  ward_id            bigint references public.locations(id) on delete restrict,
  community          text,
  profile_completion smallint not null default 0,
  last_seen_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint profiles_profile_completion_check
    check (profile_completion between 0 and 100),
  constraint profiles_full_name_len_check
    check (full_name is null or char_length(full_name) <= 160),
  constraint profiles_phone_len_check
    check (phone is null or char_length(phone) <= 32)
);

create index if not exists profiles_role_idx on public.profiles (role);

comment on table public.profiles is
  'Applicant profile, 1:1 with auth.users. Role drives future admin authorisation.';

-- ---------------------------------------------------------------------------
-- Applications — the dossier. One application per applicant per program.
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id                  uuid primary key default gen_random_uuid(),
  -- Assigned only at submission (see submit_application). NULL while DRAFT.
  application_number  text unique,
  user_id             uuid not null references auth.users(id) on delete cascade,
  program_id          bigint not null references public.programs(id) on delete restrict,
  category_id         bigint references public.applicant_categories(id) on delete restrict,
  status              public.application_status not null default 'DRAFT',
  current_step        smallint not null default 1,
  completion_percent  smallint not null default 0,

  -- Step 1 — Personal information
  full_name           text,
  phone               text,
  contact_email       text,
  date_of_birth       date,
  address             text,

  -- Step 3 — Location
  state_id            bigint references public.locations(id) on delete restrict,
  lga_id              bigint references public.locations(id) on delete restrict,
  ward_id             bigint references public.locations(id) on delete restrict,
  community           text,

  -- Step 4 — Business / Project / Innovation (common fields)
  project_name        text,
  project_description text,
  problem_statement   text,
  opportunity_statement text,
  current_stage       text,
  target_beneficiaries text,
  skills              text[],
  expected_impact     text,
  -- Category-specific answers, validated against applicant_categories.detail_schema.
  category_details    jsonb not null default '{}'::jsonb,

  -- Step 7 — Declaration
  terms_accepted      boolean not null default false,
  accuracy_confirmed  boolean not null default false,
  terms_accepted_at   timestamptz,

  -- Lifecycle
  submitted_at        timestamptz,
  reviewed_at         timestamptz,
  decided_at          timestamptz,
  -- Feedback the applicant is meant to see (surfaced through notifications).
  review_notes        text,
  -- Reviewer workspace only; never exposed to applicants.
  internal_notes      text,
  missing_fields      text[],

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint applications_current_step_check check (current_step between 1 and 7),
  constraint applications_completion_percent_check check (completion_percent between 0 and 100),
  constraint applications_category_details_is_object check (jsonb_typeof(category_details) = 'object'),
  -- A draft must not carry a number or a submission timestamp; conversely a
  -- submitted application must carry both. This makes an invalid state unstorable.
  constraint applications_draft_state_check check (
    (status = 'DRAFT' and application_number is null and submitted_at is null)
    or (status <> 'DRAFT' and application_number is not null and submitted_at is not null)
  ),
  constraint applications_user_program_unique unique (user_id, program_id)
);

create index if not exists applications_user_id_idx      on public.applications (user_id);
create index if not exists applications_status_idx       on public.applications (status);
create index if not exists applications_program_id_idx   on public.applications (program_id);
create index if not exists applications_category_id_idx  on public.applications (category_id);
create index if not exists applications_state_id_idx     on public.applications (state_id);
create index if not exists applications_lga_id_idx       on public.applications (lga_id);
create index if not exists applications_ward_id_idx      on public.applications (ward_id);
create index if not exists applications_submitted_at_idx on public.applications (submitted_at desc);
create index if not exists applications_created_at_idx   on public.applications (created_at desc);

comment on table public.applications is
  'Applicant dossier: draft while being completed, then an immutable-of-status record under review.';

-- ---------------------------------------------------------------------------
-- Application <-> support needs (Step 5)
-- ---------------------------------------------------------------------------
create table if not exists public.application_support_needs (
  application_id  uuid not null references public.applications(id) on delete cascade,
  support_need_id bigint not null references public.support_needs(id) on delete restrict,
  details         text,
  created_at      timestamptz not null default now(),
  primary key (application_id, support_need_id)
);

create index if not exists application_support_needs_need_idx
  on public.application_support_needs (support_need_id);

comment on table public.application_support_needs is
  'Structured, queryable support requests so the future dashboard can group demand by support type.';

-- ---------------------------------------------------------------------------
-- Documents (Step 6) — metadata only; bytes live in private Supabase Storage.
-- ---------------------------------------------------------------------------
create table if not exists public.application_documents (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references public.applications(id) on delete cascade,
  -- Denormalised owner so storage/document policies stay a single-table check.
  owner_id         uuid not null references auth.users(id) on delete cascade,
  document_type_id bigint references public.document_types(id) on delete restrict,
  storage_path     text not null unique,
  file_name        text not null,
  file_size        bigint not null,
  mime_type        text not null,
  review_status    text not null default 'PENDING',
  review_notes     text,
  uploaded_at      timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint application_documents_review_status_check
    check (review_status in ('PENDING', 'ACCEPTED', 'REJECTED')),
  constraint application_documents_file_size_check check (file_size > 0)
);

create index if not exists application_documents_application_idx
  on public.application_documents (application_id) where deleted_at is null;
create index if not exists application_documents_owner_idx
  on public.application_documents (owner_id);

comment on table public.application_documents is
  'Metadata for files in the private applicant-documents bucket. Bytes are never public.';

-- ---------------------------------------------------------------------------
-- Status history — the auditable timeline behind the applicant tracker.
-- ---------------------------------------------------------------------------
create table if not exists public.application_status_history (
  id                  bigint generated by default as identity primary key,
  application_id      uuid not null references public.applications(id) on delete cascade,
  from_status         public.application_status,
  to_status           public.application_status not null,
  note                text,
  visible_to_applicant boolean not null default true,
  changed_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists application_status_history_application_idx
  on public.application_status_history (application_id, created_at desc);

comment on column public.application_status_history.visible_to_applicant is
  'false marks reviewer-only timeline entries that must never render in the applicant portal.';

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  type           public.notification_type not null default 'GENERAL',
  title          text not null,
  body           text,
  action_url     text,
  severity       text not null default 'info',
  is_read        boolean not null default false,
  read_at        timestamptz,
  created_at     timestamptz not null default now(),
  constraint notifications_severity_check
    check (severity in ('info', 'success', 'warning', 'danger')),
  constraint notifications_read_state_check
    check ((is_read = false and read_at is null) or (is_read = true and read_at is not null))
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where is_read = false;

comment on table public.notifications is
  'In-app notification feed. Delivery is in-app only in Phase 1 (no email sender is configured).';
