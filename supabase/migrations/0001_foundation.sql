-- =============================================================================
-- GIZMO DAN KAITA OFFICE PLUS — Final Year Project & Innovation Development Program
-- Registration & Applicant Portal
--
-- Migration 0001 — Foundation: enum types and shared helper functions.
-- Safe to run more than once (idempotent).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('applicant', 'admin', 'super_admin');
  end if;

  -- DRAFT is the pre-submission state used by "save progress / continue later".
  -- Everything after DRAFT is the official review lifecycle.
  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type public.application_status as enum (
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'MORE_INFORMATION_REQUIRED',
      'SHORTLISTED',
      'APPROVED',
      'REJECTED',
      'IN_DEVELOPMENT',
      'COMPLETED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'location_level') then
    create type public.location_level as enum ('state', 'lga', 'ward', 'community');
  end if;

  if not exists (select 1 from pg_type where typname = 'program_status') then
    create type public.program_status as enum ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'GENERAL',
      'APPLICATION_SUBMITTED',
      'APPLICATION_RECEIVED',
      'STATUS_CHANGED',
      'INFORMATION_REQUIRED',
      'SHORTLISTED',
      'APPROVED',
      'REJECTED',
      'DOCUMENT_UPDATE',
      'PROGRAM_ANNOUNCEMENT'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Shared helper: keep updated_at accurate without relying on application code.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger that stamps updated_at.';
