-- =============================================================================
-- Migration 0005 — Row Level Security, grants and dashboard-ready views
--
-- Principles
--   * RLS is enabled on every applicant-owned table. A request with only the
--     anon key and a user session can never read another applicant's rows.
--   * Admin access is expressed as a policy (is_admin()) so Phase 3 can use the
--     same tables — but no admin UI or admin grant is exposed here.
--   * RLS is never FORCEd: SECURITY DEFINER routines owned by the database
--     owner (save_application_draft, submit_application) must be able to write
--     protected columns. Authorisation for those routines is checked
--     explicitly inside each function body.
-- Safe to run more than once (idempotent).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles                    enable row level security;
alter table public.applications                enable row level security;
alter table public.application_support_needs   enable row level security;
alter table public.application_documents       enable row level security;
alter table public.application_status_history  enable row level security;
alter table public.notifications               enable row level security;
alter table public.locations                   enable row level security;
alter table public.applicant_categories        enable row level security;
alter table public.support_needs               enable row level security;
alter table public.document_types              enable row level security;
alter table public.programs                    enable row level security;
alter table public.application_statuses        enable row level security;

-- ---------------------------------------------------------------------------
-- Schema + table privileges
-- RLS filters rows; grants decide whether a role may touch the table at all.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- The public visitor may read reference data only, never applicants.
grant select on public.locations            to anon, authenticated;
grant select on public.applicant_categories to anon, authenticated;
grant select on public.support_needs        to anon, authenticated;
grant select on public.document_types       to anon, authenticated;
grant select on public.programs             to anon, authenticated;
grant select on public.application_statuses to anon, authenticated;

-- Applicants act on their own rows only (RLS decides which rows).
grant select, insert, update, delete on public.profiles                   to authenticated;
grant select, insert, update, delete on public.applications               to authenticated;
grant select, insert, update, delete on public.application_support_needs  to authenticated;
grant select, insert, update, delete on public.application_documents      to authenticated;
grant select, insert on public.application_status_history                 to authenticated;
grant select, update on public.notifications                              to authenticated;

-- Admins additionally need to write review data and reference data.
grant insert, update, delete on public.applications               to authenticated;
grant insert, update, delete on public.application_support_needs  to authenticated;
grant insert, update, delete on public.application_documents      to authenticated;
grant update, delete on public.application_status_history         to authenticated;
grant insert, update, delete on public.notifications              to authenticated;
grant insert, update, delete on public.locations                  to authenticated;
grant insert, update, delete on public.applicant_categories       to authenticated;
grant insert, update, delete on public.support_needs              to authenticated;
grant insert, update, delete on public.document_types             to authenticated;
grant insert, update, delete on public.programs                   to authenticated;
grant insert, update, delete on public.application_statuses       to authenticated;

-- Sequence privileges for identity columns.
grant usage, select on all sequences in schema public to authenticated;

-- Anon must not be able to read applicant data even by mistake.
revoke all on public.profiles                   from anon;
revoke all on public.applications               from anon;
revoke all on public.application_support_needs  from anon;
revoke all on public.application_documents      from anon;
revoke all on public.application_status_history from anon;
revoke all on public.notifications              from anon;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_admin_manage on public.profiles;
create policy profiles_admin_manage on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------
drop policy if exists applications_select_own on public.applications;
create policy applications_select_own on public.applications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- An applicant may only ever create a pristine draft: no number, no
-- submission timestamp, status pinned to DRAFT.
drop policy if exists applications_insert_own_draft on public.applications;
create policy applications_insert_own_draft on public.applications
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'DRAFT'
    and application_number is null
    and submitted_at is null
  );

-- Editable while it is a draft, or when a reviewer has asked for more
-- information. Status itself cannot move: WITH CHECK keeps it in the same set.
drop policy if exists applications_update_own_draft on public.applications;
create policy applications_update_own_draft on public.applications
  for update to authenticated
  using (user_id = auth.uid() and status in ('DRAFT', 'MORE_INFORMATION_REQUIRED'))
  with check (user_id = auth.uid() and status in ('DRAFT', 'MORE_INFORMATION_REQUIRED'));

drop policy if exists applications_delete_own_draft on public.applications;
create policy applications_delete_own_draft on public.applications
  for delete to authenticated
  using (user_id = auth.uid() and status = 'DRAFT');

drop policy if exists applications_admin_manage on public.applications;
create policy applications_admin_manage on public.applications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- application_support_needs
-- ---------------------------------------------------------------------------
drop policy if exists support_needs_select_own on public.application_support_needs;
create policy support_needs_select_own on public.application_support_needs
  for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id and (a.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists support_needs_write_own_draft on public.application_support_needs;
create policy support_needs_write_own_draft on public.application_support_needs
  for all to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.user_id = auth.uid()
        and a.status in ('DRAFT', 'MORE_INFORMATION_REQUIRED')
    )
  )
  with check (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.user_id = auth.uid()
        and a.status in ('DRAFT', 'MORE_INFORMATION_REQUIRED')
    )
  );

drop policy if exists support_needs_admin_manage on public.application_support_needs;
create policy support_needs_admin_manage on public.application_support_needs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- application_documents
-- ---------------------------------------------------------------------------
drop policy if exists documents_select_own on public.application_documents;
create policy documents_select_own on public.application_documents
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists documents_insert_own on public.application_documents;
create policy documents_insert_own on public.application_documents
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.user_id = auth.uid()
        and a.status in ('DRAFT', 'MORE_INFORMATION_REQUIRED')
    )
  );

drop policy if exists documents_update_own on public.application_documents;
create policy documents_update_own on public.application_documents
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists documents_delete_own on public.application_documents;
create policy documents_delete_own on public.application_documents
  for delete to authenticated
  using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.user_id = auth.uid()
        and a.status in ('DRAFT', 'MORE_INFORMATION_REQUIRED')
    )
  );

-- ---------------------------------------------------------------------------
-- application_status_history
-- Applicants see only timeline entries marked visible. Internal reviewer notes
-- never leave the admin side.
-- ---------------------------------------------------------------------------
drop policy if exists status_history_select_applicant on public.application_status_history;
create policy status_history_select_applicant on public.application_status_history
  for select to authenticated
  using (
    visible_to_applicant
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = auth.uid()
    )
  );

drop policy if exists status_history_admin_manage on public.application_status_history;
create policy status_history_admin_manage on public.application_status_history
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_admin_manage on public.notifications;
create policy notifications_admin_manage on public.notifications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reference data — readable by everyone, writable by admins only.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'locations', 'applicant_categories', 'support_needs',
    'document_types', 'programs', 'application_statuses'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_public_read', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_admin_manage', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_manage', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RPC surface
--
-- The application number allocator is deliberately not callable from a client:
-- numbers are minted only inside submit_application.
-- ---------------------------------------------------------------------------
revoke execute on function public.generate_application_number() from public, anon, authenticated;
revoke execute on function public.save_application_draft(jsonb, bigint) from public, anon;
revoke execute on function public.submit_application(uuid) from public, anon;
revoke execute on function public.get_application_checklist(uuid) from public, anon;
revoke execute on function public.application_public_json(public.applications) from public, anon;

grant execute on function public.save_application_draft(jsonb, bigint) to authenticated;
grant execute on function public.submit_application(uuid) to authenticated;
grant execute on function public.get_application_checklist(uuid) to authenticated;
grant execute on function public.application_public_json(public.applications) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_privileged_writer() to authenticated;
grant execute on function public.application_field_checklist(public.applications) to authenticated;
grant execute on function public.application_missing_fields(public.applications) to authenticated;
grant execute on function public.validate_category_details(bigint, jsonb) to authenticated;
grant execute on function public.resolve_geography(bigint, bigint, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Views for the future Patron/Admin dashboard.
--
-- security_invoker = true is essential: the view runs with the caller's
-- privileges and RLS, so an applicant querying it still sees only their own
-- row, while an admin sees everything. Analytics never become a leak.
-- ---------------------------------------------------------------------------
drop view if exists public.v_applications_overview;
create view public.v_applications_overview
with (security_invoker = true)
as
select
  a.id,
  a.application_number,
  a.status,
  s.label                       as status_label,
  s.tone                        as status_tone,
  s.sort_order                  as status_sort_order,
  a.user_id,
  p.full_name                   as applicant_name,
  p.phone                       as applicant_phone,
  a.contact_email,
  c.code                        as category_code,
  c.name                        as category_name,
  pr.code                       as program_code,
  pr.name                       as program_name,
  st.id                         as state_id,
  st.name                       as state_name,
  lg.id                         as lga_id,
  lg.name                       as lga_name,
  wd.id                         as ward_id,
  wd.name                       as ward_name,
  a.community,
  a.project_name,
  a.project_description,
  a.problem_statement,
  a.opportunity_statement,
  a.current_stage,
  a.target_beneficiaries,
  a.skills,
  a.expected_impact,
  a.category_details,
  coalesce(needs.needs, '{}'::text[]) as support_needs,
  a.completion_percent,
  a.submitted_at,
  a.reviewed_at,
  a.decided_at,
  a.created_at,
  a.updated_at
from public.applications a
join public.profiles p            on p.id = a.user_id
join public.programs pr           on pr.id = a.program_id
left join public.applicant_categories c on c.id = a.category_id
left join public.application_statuses s on s.code = a.status
left join public.locations st     on st.id = a.state_id
left join public.locations lg     on lg.id = a.lga_id
left join public.locations wd     on wd.id = a.ward_id
left join lateral (
  select array_agg(sn.code order by sn.sort_order) as needs
  from public.application_support_needs asn
  join public.support_needs sn on sn.id = asn.support_need_id
  where asn.application_id = a.id
) needs on true;

comment on view public.v_applications_overview is
  'Dashboard-ready application rows. security_invoker keeps RLS in force for the caller.';

drop view if exists public.v_application_status_counts;
create view public.v_application_status_counts
with (security_invoker = true)
as
select
  a.program_id,
  a.status,
  coalesce(s.label, a.status::text) as status_label,
  coalesce(s.sort_order, 999)      as status_sort_order,
  count(*)::bigint                 as application_count
from public.applications a
left join public.application_statuses s on s.code = a.status
group by a.program_id, a.status, s.label, s.sort_order;

drop view if exists public.v_support_need_demand;
create view public.v_support_need_demand
with (security_invoker = true)
as
select
  sn.id,
  sn.code,
  sn.name,
  count(asn.application_id)::bigint as application_count
from public.support_needs sn
left join public.application_support_needs asn on asn.support_need_id = sn.id
where sn.is_active
group by sn.id, sn.code, sn.name, sn.sort_order
order by sn.sort_order;

drop view if exists public.v_applications_by_location;
create view public.v_applications_by_location
with (security_invoker = true)
as
select
  st.id   as state_id,
  st.name as state_name,
  lg.id   as lga_id,
  lg.name as lga_name,
  a.community,
  count(*)::bigint as application_count
from public.applications a
left join public.locations st on st.id = a.state_id
left join public.locations lg on lg.id = a.lga_id
group by st.id, st.name, lg.id, lg.name, a.community;

grant select on public.v_applications_overview     to authenticated;
grant select on public.v_application_status_counts to authenticated;
grant select on public.v_support_need_demand       to authenticated;
grant select on public.v_applications_by_location  to authenticated;

-- ---------------------------------------------------------------------------
-- Index for the Phase 3 admin search workspace.
-- ---------------------------------------------------------------------------
create index if not exists applications_search_idx
  on public.applications
  using gin (
    to_tsvector(
      'english',
      coalesce(project_name, '') || ' ' ||
      coalesce(project_description, '') || ' ' ||
      coalesce(problem_statement, '') || ' ' ||
      coalesce(full_name, '')
    )
  );
