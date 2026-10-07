-- =============================================================================
-- Migration 0007 — Enquiries from the public contact form
--
-- The programme office may not have published contact channels yet, so the
-- landing page Contact section stores enquiries instead of displaying a
-- decorative, non-functional form. Messages are private: anyone may send one,
-- only an admin may read them (Phase 3 dashboard).
-- Safe to run more than once (idempotent).
-- =============================================================================

create table if not exists public.contact_messages (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  email        text not null,
  phone        text,
  subject      text,
  message      text not null,
  -- Optional link to a signed-in sender, so Phase 3 can see context.
  user_id      uuid references auth.users(id) on delete set null,
  is_handled   boolean not null default false,
  handled_at   timestamptz,
  created_at   timestamptz not null default now(),
  constraint contact_messages_name_len   check (char_length(full_name) between 2 and 160),
  constraint contact_messages_email_len  check (char_length(email) between 5 and 254),
  constraint contact_messages_email_like check (email like '%@%.%'),
  constraint contact_messages_phone_len  check (phone is null or char_length(phone) <= 32),
  constraint contact_messages_subject_len check (subject is null or char_length(subject) <= 200),
  constraint contact_messages_message_len check (char_length(message) between 10 and 2000),
  constraint contact_messages_handled_state check (
    (is_handled = false and handled_at is null) or (is_handled = true and handled_at is not null)
  )
);

create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_unhandled_idx
  on public.contact_messages (created_at desc) where is_handled = false;

alter table public.contact_messages enable row level security;

-- Anyone (signed in or not) may send one message. Nobody can read them back.
drop policy if exists contact_messages_public_insert on public.contact_messages;
create policy contact_messages_public_insert on public.contact_messages
  for insert to anon, authenticated
  with check (true);

drop policy if exists contact_messages_admin_read on public.contact_messages;
create policy contact_messages_admin_read on public.contact_messages
  for select to authenticated
  using (public.is_admin());

drop policy if exists contact_messages_admin_update on public.contact_messages;
create policy contact_messages_admin_update on public.contact_messages
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant insert on public.contact_messages to anon, authenticated;
grant select, update on public.contact_messages to authenticated;

comment on table public.contact_messages is
  'Public enquiries. Insert-only for the public; readable by admins in the Phase 3 dashboard.';
