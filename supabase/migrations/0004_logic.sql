-- =============================================================================
-- Migration 0004 — Business logic: helpers, guards, triggers and RPCs
--
-- Design rules enforced here (not in the frontend):
--   * An applicant can never set their own status, application number or
--     review notes — only privileged writers (admin / service role / definer
--     RPC) can.
--   * Geography references must be internally consistent (ward belongs to LGA,
--     LGA belongs to state).
--   * Category-specific answers are validated against the category's own
--     detail_schema, so new categories are validated automatically.
--   * Application numbers are allocated only at submission, from a random
--     non-sequential space, inside the database.
-- Safe to run more than once (idempotent).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Small reusable predicates
-- ---------------------------------------------------------------------------
create or replace function public.text_present(v text)
returns boolean
language sql
immutable
as $$ select v is not null and btrim(v) <> '' $$;

comment on function public.text_present(text) is 'TRUE when a text value carries real content.';

create or replace function public.jsonb_value_present(v jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when v is null then false
    when jsonb_typeof(v) = 'null' then false
    when jsonb_typeof(v) = 'string' then btrim(v #>> '{}') <> ''
    when jsonb_typeof(v) = 'array' then jsonb_array_length(v) > 0
    when jsonb_typeof(v) = 'number' then true
    when jsonb_typeof(v) = 'boolean' then v = 'true'::jsonb
    when jsonb_typeof(v) = 'object' then v <> '{}'::jsonb
    else false
  end
$$;

create or replace function public.jsonb_to_text_array(v jsonb)
returns text[]
language sql
immutable
as $$
  select case
    when v is null or jsonb_typeof(v) <> 'array' then null
    else coalesce(
      (select array_agg(btrim(elem) order by ord)
       from jsonb_array_elements_text(v) with ordinality as t(elem, ord)
       where btrim(elem) <> ''),
      '{}'::text[]
    )
  end
$$;

-- ---------------------------------------------------------------------------
-- Authorisation helpers
--
-- is_admin() is SECURITY DEFINER on purpose: policies on public.profiles itself
-- call it, and a definer function is not subject to the caller's RLS, which
-- avoids infinite recursion.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.role in ('admin', 'super_admin') from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

comment on function public.is_admin() is
  'TRUE when the caller is an admin or super_admin. Used by RLS policies and guards.';

-- "Privileged writer" = anything that is not a plain anon/authenticated caller,
-- i.e. the service role, or a SECURITY DEFINER function owned by the database
-- owner. Column guards only apply to plain callers, so trusted server-side
-- routines can still perform their job.
create or replace function public.is_privileged_writer()
returns boolean
language sql
stable
as $$
  select current_user not in ('anon', 'authenticated') or public.is_admin();
$$;

comment on function public.is_privileged_writer() is
  'TRUE for the service role, definer-owned routines owned by the database owner, and admins.';

-- ---------------------------------------------------------------------------
-- Geography integrity
--
-- Normalises (state, lga, ward) into a consistent triple: fills missing
-- ancestry from the ward, and rejects contradictions. Used by both the
-- profiles and applications triggers so the rule exists once.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_geography(
  p_state_id bigint,
  p_lga_id bigint,
  p_ward_id bigint
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_state public.locations;
  v_lga public.locations;
  v_ward public.locations;
  v_state_id bigint := p_state_id;
  v_lga_id bigint := p_lga_id;
  v_ward_id bigint := p_ward_id;
begin
  if v_ward_id is not null then
    select * into v_ward from public.locations where id = v_ward_id;
    if v_ward.id is null or v_ward.level <> 'ward' then
      raise exception 'invalid_ward' using errcode = 'P0001';
    end if;
    if v_lga_id is not null and v_ward.parent_id <> v_lga_id then
      raise exception 'ward_lga_mismatch' using errcode = 'P0001';
    end if;
    if v_state_id is not null and v_ward.state_id <> v_state_id then
      raise exception 'ward_state_mismatch' using errcode = 'P0001';
    end if;
    v_state_id := coalesce(v_state_id, v_ward.state_id);
    v_lga_id := coalesce(v_lga_id, v_ward.lga_id);
  end if;

  if v_lga_id is not null then
    select * into v_lga from public.locations where id = v_lga_id;
    if v_lga.id is null or v_lga.level <> 'lga' then
      raise exception 'invalid_lga' using errcode = 'P0001';
    end if;
    if v_state_id is not null and v_lga.parent_id <> v_state_id then
      raise exception 'lga_state_mismatch' using errcode = 'P0001';
    end if;
    v_state_id := coalesce(v_state_id, v_lga.parent_id);
  end if;

  if v_state_id is not null then
    select * into v_state from public.locations where id = v_state_id;
    if v_state.id is null or v_state.level <> 'state' then
      raise exception 'invalid_state' using errcode = 'P0001';
    end if;
  end if;

  return jsonb_build_object('state_id', v_state_id, 'lga_id', v_lga_id, 'ward_id', v_ward_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile completion
-- ---------------------------------------------------------------------------
create or replace function public.profile_completion_percent(p public.profiles)
returns smallint
language sql
stable
as $$
  select round(
    100.0 * (
      (public.text_present(p.full_name))::int
      + (public.text_present(p.phone))::int
      + (p.date_of_birth is not null)::int
      + (public.text_present(p.address))::int
      + (p.state_id is not null)::int
      + (p.lga_id is not null)::int
      + (p.ward_id is not null)::int
      + (public.text_present(p.community))::int
    ) / 8.0
  )::smallint;
$$;

create or replace function public.profiles_recompute_completion()
returns trigger
language plpgsql
as $$
begin
  new.profile_completion := public.profile_completion_percent(new);
  return new;
end;
$$;

create or replace function public.profiles_resolve_geography()
returns trigger
language plpgsql
as $$
declare
  v_resolved jsonb;
begin
  v_resolved := public.resolve_geography(new.state_id, new.lga_id, new.ward_id);
  new.state_id := (v_resolved ->> 'state_id')::bigint;
  new.lga_id := (v_resolved ->> 'lga_id')::bigint;
  new.ward_id := (v_resolved ->> 'ward_id')::bigint;
  return new;
end;
$$;

-- Applicants must never be able to promote themselves to admin from the client.
create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'role_change_not_permitted' using errcode = 'P0001';
  end if;

  -- Derived column: not client-writable.
  new.profile_completion := old.profile_completion;
  return new;
end;
$$;

-- Signup -> profile. Mirrors the public registration metadata only.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates the matching public.profiles row when a user signs up.';

-- ---------------------------------------------------------------------------
-- Application number allocation
--
-- Non-sequential: 6 characters drawn from a 32-character unambiguous alphabet
-- using cryptographic randomness (gen_random_uuid), giving ~1.07 billion
-- combinations. Uniqueness is still enforced by the unique constraint plus a
-- retry loop. Date prefix uses the submission year.
-- ---------------------------------------------------------------------------
create or replace function public.generate_application_number()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  -- Exactly 32 characters, so `% 32` over a random byte is uniform.
  -- No 0, 1 or O: those are the characters people mis-transcribe when reading
  -- an application ID aloud or copying it from a printout.
  c_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  c_year     constant text := to_char(now(), 'YYYY');
  v_hex    text;
  v_code   text;
  v_attempt int := 0;
  i        int := 0;
begin
  -- Guard against a future edit silently breaking the uniform mapping.
  if length(c_alphabet) <> 32 or length(replace(c_alphabet, substr(c_alphabet, 1, 1), '')) <> 31 then
    raise exception 'application_number_alphabet_must_be_32_unique_characters';
  end if;

  loop
    v_attempt := v_attempt + 1;

    -- A UUIDv4 hex string: the first 12 hex characters are 6 fully random
    -- bytes (the fixed version/variant nibbles live further along).
    v_hex := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    v_code := '';
    for i in 0..5 loop
      -- 256 % 32 = 0, so the mapping is uniform (no modulo bias).
      v_code := v_code
        || substr(c_alphabet, (('x' || substr(v_hex, i * 2 + 1, 2))::bit(8)::int % 32) + 1, 1);
    end loop;

    if not exists (
      select 1 from public.applications
      where application_number = 'GKO-' || c_year || '-' || v_code
    ) then
      return 'GKO-' || c_year || '-' || v_code;
    end if;

    if v_attempt >= 12 then
      raise exception 'application_number_generation_failed' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

comment on function public.generate_application_number() is
  'Allocates a unique, non-sequential application ID such as GKO-2026-7K2M9Q.';

-- ---------------------------------------------------------------------------
-- Category detail validation
--
-- Validates category_details against the category's own detail_schema, so a
-- new category inserted as data is validated with no code change.
-- ---------------------------------------------------------------------------
create or replace function public.validate_category_details(
  p_category_id bigint,
  p_details jsonb
)
returns text[]
language plpgsql
stable
as $$
declare
  v_schema jsonb;
  v_desc jsonb;
  v_key text;
  v_type text;
  v_value jsonb;
  v_details jsonb;
  v_problems text[] := '{}';
  v_problems_unknown text[];
  v_allowed text[];
begin
  if p_category_id is null then
    return v_problems;
  end if;

  select detail_schema into v_schema
  from public.applicant_categories where id = p_category_id;

  if v_schema is null or jsonb_typeof(v_schema) <> 'array' then
    return v_problems;
  end if;

  v_details := coalesce(p_details, '{}'::jsonb);
  if jsonb_typeof(v_details) <> 'object' then
    return array['details_not_an_object'];
  end if;

  for v_desc in select * from jsonb_array_elements(v_schema) loop
    v_key := v_desc ->> 'key';
    v_type := coalesce(v_desc ->> 'type', 'text');
    v_value := v_details -> v_key;

    if coalesce((v_desc ->> 'required')::boolean, false)
       and not public.jsonb_value_present(v_value) then
      v_problems := array_append(v_problems, 'required:' || v_key);
      continue;
    end if;

    if not public.jsonb_value_present(v_value) then
      continue;
    end if;

    if v_type in ('text', 'textarea', 'date') and jsonb_typeof(v_value) <> 'string' then
      v_problems := array_append(v_problems, 'invalid_type:' || v_key);
    elsif v_type = 'number' and jsonb_typeof(v_value) <> 'number' then
      v_problems := array_append(v_problems, 'invalid_type:' || v_key);
    elsif v_type = 'select' then
      select array_agg(opt ->> 'value') into v_allowed
      from jsonb_array_elements(coalesce(v_desc -> 'options', '[]'::jsonb)) as opt;
      if v_allowed is not null
         and jsonb_typeof(v_value) = 'string'
         and not (v_value #>> '{}' = any (v_allowed)) then
        v_problems := array_append(v_problems, 'invalid_option:' || v_key);
      end if;
    end if;
  end loop;

  -- Reject stray keys so junk cannot accumulate in the dossier.
  select array_agg(k) into v_problems_unknown
  from jsonb_object_keys(v_details) as k
  where not exists (
    select 1 from jsonb_array_elements(v_schema) as d where d ->> 'key' = k
  );

  if v_problems_unknown is not null then
    v_problems := v_problems || array(
      select 'unknown:' || k from unnest(v_problems_unknown) as k
    );
  end if;

  return v_problems;
end;
$$;

-- ---------------------------------------------------------------------------
-- Application completeness
--
-- One source of truth, returned as structured data so the review step, the
-- submit RPC and the future dashboard can all use it.
-- ---------------------------------------------------------------------------
create or replace function public.application_field_checklist(a public.applications)
returns jsonb
language plpgsql
stable
as $$
declare
  v_items jsonb := '[]'::jsonb;
  v_schema jsonb;
  v_desc jsonb;
  v_key text;
  v_support_count int;
begin
  v_items := v_items || jsonb_build_object('key', 'full_name', 'label', 'Full name', 'step', 1, 'required', true, 'done', public.text_present(a.full_name));
  v_items := v_items || jsonb_build_object('key', 'phone', 'label', 'Phone number', 'step', 1, 'required', true, 'done', public.text_present(a.phone));
  v_items := v_items || jsonb_build_object('key', 'address', 'label', 'Address', 'step', 1, 'required', true, 'done', public.text_present(a.address));
  v_items := v_items || jsonb_build_object('key', 'date_of_birth', 'label', 'Date of birth', 'step', 1, 'required', false, 'done', a.date_of_birth is not null);

  v_items := v_items || jsonb_build_object('key', 'category_id', 'label', 'Applicant category', 'step', 2, 'required', true, 'done', a.category_id is not null);

  v_items := v_items || jsonb_build_object('key', 'state_id', 'label', 'State', 'step', 3, 'required', true, 'done', a.state_id is not null);
  v_items := v_items || jsonb_build_object('key', 'lga_id', 'label', 'Local Government Area', 'step', 3, 'required', true, 'done', a.lga_id is not null);
  v_items := v_items || jsonb_build_object('key', 'ward_id', 'label', 'Ward', 'step', 3, 'required', true, 'done', a.ward_id is not null);
  v_items := v_items || jsonb_build_object('key', 'community', 'label', 'Community', 'step', 3, 'required', false, 'done', public.text_present(a.community));

  v_items := v_items || jsonb_build_object('key', 'project_name', 'label', 'Business / project / idea name', 'step', 4, 'required', true, 'done', public.text_present(a.project_name));
  v_items := v_items || jsonb_build_object('key', 'project_description', 'label', 'Description', 'step', 4, 'required', true, 'done', public.text_present(a.project_description));
  v_items := v_items || jsonb_build_object('key', 'problem_statement', 'label', 'Problem being solved', 'step', 4, 'required', true, 'done', public.text_present(a.problem_statement));
  v_items := v_items || jsonb_build_object('key', 'opportunity_statement', 'label', 'Opportunity addressed', 'step', 4, 'required', false, 'done', public.text_present(a.opportunity_statement));
  v_items := v_items || jsonb_build_object('key', 'current_stage', 'label', 'Current stage', 'step', 4, 'required', true, 'done', public.text_present(a.current_stage));
  v_items := v_items || jsonb_build_object('key', 'target_beneficiaries', 'label', 'Target beneficiaries / customers', 'step', 4, 'required', false, 'done', public.text_present(a.target_beneficiaries));
  v_items := v_items || jsonb_build_object('key', 'skills', 'label', 'Skills involved', 'step', 4, 'required', false, 'done', coalesce(array_length(a.skills, 1), 0) > 0);
  v_items := v_items || jsonb_build_object('key', 'expected_impact', 'label', 'Expected impact', 'step', 4, 'required', false, 'done', public.text_present(a.expected_impact));

  select count(*) into v_support_count
  from public.application_support_needs s where s.application_id = a.id;

  v_items := v_items || jsonb_build_object('key', 'support_needs', 'label', 'At least one support need', 'step', 5, 'required', true, 'done', v_support_count > 0);
  v_items := v_items || jsonb_build_object('key', 'terms_accepted', 'label', 'Accuracy confirmed and terms accepted', 'step', 7, 'required', true, 'done', a.terms_accepted and a.accuracy_confirmed);

  -- Category-specific required fields, straight from the database schema.
  if a.category_id is not null then
    select detail_schema into v_schema
    from public.applicant_categories where id = a.category_id;

    if v_schema is not null and jsonb_typeof(v_schema) = 'array' then
      for v_desc in select * from jsonb_array_elements(v_schema) loop
        if coalesce((v_desc ->> 'required')::boolean, false) then
          v_key := v_desc ->> 'key';
          v_items := v_items || jsonb_build_object(
            'key', 'detail:' || v_key,
            'label', coalesce(v_desc ->> 'label', v_key),
            'step', 4,
            'required', true,
            'done', public.jsonb_value_present(a.category_details -> v_key)
          );
        end if;
      end loop;
    end if;
  end if;

  return v_items;
end;
$$;

create or replace function public.application_missing_fields(a public.applications)
returns text[]
language sql
stable
as $$
  select coalesce(
    array_agg(item ->> 'key' order by (item ->> 'step')::int, item ->> 'key'),
    '{}'::text[]
  )
  from jsonb_array_elements(public.application_field_checklist(a)) as item
  where (item ->> 'required')::boolean and not (item ->> 'done')::boolean;
$$;

create or replace function public.application_completion_percent(a public.applications)
returns smallint
language sql
stable
as $$
  select coalesce(
    round(
      100.0 * count(*) filter (where (item ->> 'done')::boolean)
      / nullif(count(*), 0)
    ),
    0
  )::smallint
  from jsonb_array_elements(public.application_field_checklist(a)) as item
  where (item ->> 'required')::boolean;
$$;

-- ---------------------------------------------------------------------------
-- Application triggers
-- ---------------------------------------------------------------------------
create or replace function public.applications_guard_protected_columns()
returns trigger
language plpgsql
as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  -- Security-critical: hard failure if a plain caller tries to self-advance.
  if new.status is distinct from old.status then
    raise exception 'status_change_not_permitted' using errcode = 'P0001';
  end if;
  if new.application_number is distinct from old.application_number then
    raise exception 'application_number_not_permitted' using errcode = 'P0001';
  end if;
  if new.submitted_at is distinct from old.submitted_at then
    raise exception 'submitted_at_not_permitted' using errcode = 'P0001';
  end if;

  -- Derived / reviewer-owned: silently neutralised rather than rejected, so a
  -- stale client value can never corrupt the record.
  new.reviewed_at  := old.reviewed_at;
  new.decided_at   := old.decided_at;
  new.review_notes := old.review_notes;
  new.internal_notes := old.internal_notes;
  new.missing_fields := old.missing_fields;
  new.terms_accepted_at := old.terms_accepted_at;
  new.completion_percent := old.completion_percent;
  return new;
end;
$$;

create or replace function public.applications_resolve_geography()
returns trigger
language plpgsql
as $$
declare
  v_resolved jsonb;
begin
  v_resolved := public.resolve_geography(new.state_id, new.lga_id, new.ward_id);
  new.state_id := (v_resolved ->> 'state_id')::bigint;
  new.lga_id := (v_resolved ->> 'lga_id')::bigint;
  new.ward_id := (v_resolved ->> 'ward_id')::bigint;
  return new;
end;
$$;

create or replace function public.applications_validate_category_details()
returns trigger
language plpgsql
as $$
declare
  v_problems text[];
begin
  if new.category_id is null then
    return new;
  end if;

  v_problems := public.validate_category_details(new.category_id, new.category_details);
  if array_length(v_problems, 1) > 0 then
    raise exception 'invalid_category_details' using
      errcode = 'P0001',
      detail = array_to_string(v_problems, ',');
  end if;
  return new;
end;
$$;

create or replace function public.applications_recompute_completion()
returns trigger
language plpgsql
as $$
begin
  new.completion_percent := public.application_completion_percent(new);
  return new;
end;
$$;

-- Timestamps that follow the lifecycle, so analytics has reliable dates.
create or replace function public.applications_stamp_status_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'UNDER_REVIEW' and new.reviewed_at is null then
    new.reviewed_at := now();
  end if;

  if new.status in ('APPROVED', 'REJECTED', 'SHORTLISTED') and new.decided_at is null then
    new.decided_at := now();
  end if;

  return new;
end;
$$;

-- Timeline + applicant notification for every status transition.
create or replace function public.applications_log_status_change()
returns trigger
language plpgsql
as $$
declare
  v_label text;
  v_visible boolean;
  v_type public.notification_type;
  v_severity text;
  v_title text;
  v_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select coalesce(s.label, new.status::text), s.visible_to_applicant
    into v_label, v_visible
  from public.application_statuses s where s.code = new.status;
  v_visible := coalesce(v_visible, true);

  insert into public.application_status_history (
    application_id, from_status, to_status, note, visible_to_applicant, changed_by
  ) values (
    new.id, old.status, new.status, new.review_notes, v_visible, auth.uid()
  );

  if not v_visible or new.status = 'DRAFT' then
    return new;
  end if;

  v_type := case new.status
    when 'SUBMITTED' then 'APPLICATION_SUBMITTED'::public.notification_type
    when 'MORE_INFORMATION_REQUIRED' then 'INFORMATION_REQUIRED'::public.notification_type
    when 'SHORTLISTED' then 'SHORTLISTED'::public.notification_type
    when 'APPROVED' then 'APPROVED'::public.notification_type
    when 'REJECTED' then 'REJECTED'::public.notification_type
    else 'STATUS_CHANGED'::public.notification_type
  end;

  v_severity := case new.status
    when 'APPROVED' then 'success'
    when 'SHORTLISTED' then 'success'
    when 'REJECTED' then 'danger'
    when 'MORE_INFORMATION_REQUIRED' then 'warning'
    else 'info'
  end;

  if new.status = 'SUBMITTED' then
    v_title := 'Application submitted';
    v_body := 'Your application ' || coalesce(new.application_number, '') ||
              ' has been received. You can follow its progress from your dashboard.';
  else
    v_title := 'Application status: ' || v_label;
    v_body := coalesce(
      nullif(btrim(coalesce(new.review_notes, '')), ''),
      'Your application ' || coalesce(new.application_number, '') || ' is now ' || v_label || '.'
    );
  end if;

  insert into public.notifications (user_id, application_id, type, title, body, action_url, severity)
  values (new.user_id, new.id, v_type, v_title, v_body, '/portal/dashboard', v_severity);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- application_public_json — the only shape in which an application row leaves
-- the database for an applicant.
--
-- Explicitly enumerated rather than `to_jsonb(row)`, because that would leak
-- reviewer-only columns such as internal_notes.
-- ---------------------------------------------------------------------------
create or replace function public.application_public_json(a public.applications)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', a.id,
    'application_number', a.application_number,
    'program_id', a.program_id,
    'category_id', a.category_id,
    'status', a.status,
    'current_step', a.current_step,
    'completion_percent', a.completion_percent,
    'full_name', a.full_name,
    'phone', a.phone,
    'contact_email', a.contact_email,
    'date_of_birth', a.date_of_birth,
    'address', a.address,
    'state_id', a.state_id,
    'lga_id', a.lga_id,
    'ward_id', a.ward_id,
    'community', a.community,
    'project_name', a.project_name,
    'project_description', a.project_description,
    'problem_statement', a.problem_statement,
    'opportunity_statement', a.opportunity_statement,
    'current_stage', a.current_stage,
    'target_beneficiaries', a.target_beneficiaries,
    'skills', a.skills,
    'expected_impact', a.expected_impact,
    'category_details', a.category_details,
    'terms_accepted', a.terms_accepted,
    'accuracy_confirmed', a.accuracy_confirmed,
    'terms_accepted_at', a.terms_accepted_at,
    -- Applicant-facing reviewer feedback. internal_notes is deliberately absent.
    'review_notes', a.review_notes,
    'missing_fields', a.missing_fields,
    'submitted_at', a.submitted_at,
    'reviewed_at', a.reviewed_at,
    'decided_at', a.decided_at,
    'created_at', a.created_at,
    'updated_at', a.updated_at
  );
$$;

-- ---------------------------------------------------------------------------
-- save_application_draft — the autosave / "continue later" endpoint.
--
-- A whitelist of writable keys means a client cannot smuggle protected columns
-- through the payload. Returns the full row so the UI can refresh completion
-- and missing-field state afterwards.
-- ---------------------------------------------------------------------------
create or replace function public.save_application_draft(
  p_payload jsonb,
  p_program_id bigint default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  c_scalar_keys constant text[] := array[
    'full_name', 'phone', 'date_of_birth', 'address', 'community',
    'project_name', 'project_description', 'problem_statement',
    'opportunity_statement', 'current_stage', 'target_beneficiaries',
    'expected_impact', 'terms_accepted', 'accuracy_confirmed'
  ];
  c_id_keys constant text[] := array[
    'category_id', 'state_id', 'lga_id', 'ward_id', 'current_step'
  ];
  c_all_keys constant text[] :=
    c_scalar_keys || c_id_keys || array['skills', 'category_details', 'support_needs'];

  v_uid uuid := auth.uid();
  v_program public.programs;
  v_app public.applications;
  v_unknown text[];
  v_need jsonb;
  v_code text;
  v_detail text;
  v_needs text[] := '{}';
  v_ids bigint[] := '{}';
  v_need_id bigint;
  v_requires_details boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;

  select array_agg(k) into v_unknown
  from jsonb_object_keys(p_payload) as k
  where not (k = any (c_all_keys));

  if v_unknown is not null then
    raise exception 'unknown_fields' using
      errcode = 'P0001', detail = array_to_string(v_unknown, ',');
  end if;

  -- Resolve the program: explicit id, otherwise the open program.
  if p_program_id is not null then
    select * into v_program from public.programs where id = p_program_id;
  else
    select * into v_program
    from public.programs
    where status = 'OPEN' and is_active
    order by opens_at nulls last, id
    limit 1;
  end if;

  if v_program.id is null then
    raise exception 'program_not_available' using errcode = 'P0001';
  end if;

  if not public.program_is_open(v_program) then
    raise exception 'program_closed' using errcode = 'P0001';
  end if;

  select * into v_app
  from public.applications
  where user_id = v_uid and program_id = v_program.id;

  if v_app.id is null then
    insert into public.applications (user_id, program_id, contact_email)
    values (v_uid, v_program.id, auth.jwt() ->> 'email')
    returning * into v_app;
  end if;

  if v_app.status not in ('DRAFT', 'MORE_INFORMATION_REQUIRED') then
    raise exception 'application_locked' using errcode = 'P0001';
  end if;

  -- Support needs (Step 5) — validated against the reference table.
  if p_payload ? 'support_needs' then
    if jsonb_typeof(p_payload -> 'support_needs') <> 'array' then
      raise exception 'invalid_value' using errcode = 'P0001', detail = 'support_needs';
    end if;

    for v_need in select * from jsonb_array_elements(p_payload -> 'support_needs') loop
      if jsonb_typeof(v_need) = 'string' then
        v_code := btrim(v_need #>> '{}');
        v_detail := null;
      elsif jsonb_typeof(v_need) = 'object' then
        v_code := btrim(coalesce(v_need ->> 'code', ''));
        v_detail := nullif(btrim(coalesce(v_need ->> 'details', '')), '');
      else
        raise exception 'invalid_value' using errcode = 'P0001', detail = 'support_needs';
      end if;

      if v_code = '' then
        raise exception 'invalid_value' using errcode = 'P0001', detail = 'support_needs';
      end if;

      if v_code = any (v_needs) then
        continue;
      end if;

      select s.id, s.requires_details into v_need_id, v_requires_details
      from public.support_needs s
      where s.code = v_code and s.is_active;

      if v_need_id is null then
        raise exception 'unknown_support_need' using errcode = 'P0001', detail = v_code;
      end if;

      if v_requires_details and v_detail is null then
        raise exception 'support_details_required' using errcode = 'P0001', detail = v_code;
      end if;

      v_needs := array_append(v_needs, v_code);
      v_ids := array_append(v_ids, v_need_id);

      insert into public.application_support_needs (application_id, support_need_id, details)
      values (v_app.id, v_need_id, v_detail)
      on conflict (application_id, support_need_id)
      do update set details = excluded.details;
    end loop;

    delete from public.application_support_needs s
    where s.application_id = v_app.id
      and not (s.support_need_id = any (v_ids));
  end if;

  -- Scalar text fields. An explicitly supplied key wins (including an empty
  -- string, which clears the field); absent keys are left untouched.
  v_app.full_name := case when p_payload ? 'full_name'
    then nullif(btrim(coalesce(p_payload ->> 'full_name', '')), '') else v_app.full_name end;
  v_app.phone := case when p_payload ? 'phone'
    then nullif(btrim(coalesce(p_payload ->> 'phone', '')), '') else v_app.phone end;
  v_app.address := case when p_payload ? 'address'
    then nullif(btrim(coalesce(p_payload ->> 'address', '')), '') else v_app.address end;
  v_app.community := case when p_payload ? 'community'
    then nullif(btrim(coalesce(p_payload ->> 'community', '')), '') else v_app.community end;
  v_app.project_name := case when p_payload ? 'project_name'
    then nullif(btrim(coalesce(p_payload ->> 'project_name', '')), '') else v_app.project_name end;
  v_app.project_description := case when p_payload ? 'project_description'
    then nullif(btrim(coalesce(p_payload ->> 'project_description', '')), '') else v_app.project_description end;
  v_app.problem_statement := case when p_payload ? 'problem_statement'
    then nullif(btrim(coalesce(p_payload ->> 'problem_statement', '')), '') else v_app.problem_statement end;
  v_app.opportunity_statement := case when p_payload ? 'opportunity_statement'
    then nullif(btrim(coalesce(p_payload ->> 'opportunity_statement', '')), '') else v_app.opportunity_statement end;
  v_app.current_stage := case when p_payload ? 'current_stage'
    then nullif(btrim(coalesce(p_payload ->> 'current_stage', '')), '') else v_app.current_stage end;
  v_app.target_beneficiaries := case when p_payload ? 'target_beneficiaries'
    then nullif(btrim(coalesce(p_payload ->> 'target_beneficiaries', '')), '') else v_app.target_beneficiaries end;
  v_app.expected_impact := case when p_payload ? 'expected_impact'
    then nullif(btrim(coalesce(p_payload ->> 'expected_impact', '')), '') else v_app.expected_impact end;

  if p_payload ? 'date_of_birth' then
    begin
      v_app.date_of_birth := nullif(btrim(coalesce(p_payload ->> 'date_of_birth', '')), '')::date;
    exception when others then
      raise exception 'invalid_value' using errcode = 'P0001', detail = 'date_of_birth';
    end;
  end if;

  if p_payload ? 'terms_accepted' then
    v_app.terms_accepted := coalesce((p_payload ->> 'terms_accepted')::boolean, false);
  end if;

  if p_payload ? 'accuracy_confirmed' then
    v_app.accuracy_confirmed := coalesce((p_payload ->> 'accuracy_confirmed')::boolean, false);
  end if;

  -- Structured id fields, validated by the geography trigger.
  if p_payload ? 'category_id' then
    begin
      v_app.category_id := nullif(btrim(coalesce(p_payload ->> 'category_id', '')), '')::bigint;
    exception when others then
      raise exception 'invalid_value' using errcode = 'P0001', detail = 'category_id';
    end;
    if v_app.category_id is not null and not exists (
      select 1 from public.applicant_categories c
      where c.id = v_app.category_id and c.is_active
    ) then
      raise exception 'invalid_value' using errcode = 'P0001', detail = 'category_id';
    end if;
  end if;

  if p_payload ? 'current_step' then
    begin
      v_app.current_step := nullif(btrim(coalesce(p_payload ->> 'current_step', '')), '')::smallint;
    exception when others then
      raise exception 'invalid_value' using errcode = 'P0001', detail = 'current_step';
    end;
    if v_app.current_step is null or v_app.current_step < 1 or v_app.current_step > 7 then
      raise exception 'invalid_value' using errcode = 'P0001', detail = 'current_step';
    end if;
  end if;

  if p_payload ? 'state_id' then
    begin
      v_app.state_id := nullif(btrim(coalesce(p_payload ->> 'state_id', '')), '')::bigint;
    exception when others then
      raise exception 'invalid_value' using errcode = 'P0001', detail = 'state_id';
    end;
  end if;

  if p_payload ? 'lga_id' then
    begin
      v_app.lga_id := nullif(btrim(coalesce(p_payload ->> 'lga_id', '')), '')::bigint;
    exception when others then
      raise exception 'invalid_value' using errcode = 'P0001', detail = 'lga_id';
    end;
  end if;

  if p_payload ? 'ward_id' then
    begin
      v_app.ward_id := nullif(btrim(coalesce(p_payload ->> 'ward_id', '')), '')::bigint;
    exception when others then
      raise exception 'invalid_value' using errcode = 'P0001', detail = 'ward_id';
    end;
  end if;

  if p_payload ? 'skills' then
    v_app.skills := public.jsonb_to_text_array(p_payload -> 'skills');
  end if;

  if p_payload ? 'category_details' then
    if jsonb_typeof(p_payload -> 'category_details') <> 'object' then
      raise exception 'invalid_value' using errcode = 'P0001', detail = 'category_details';
    end if;
    v_app.category_details := p_payload -> 'category_details';
  end if;

  update public.applications set
    full_name             = v_app.full_name,
    phone                 = v_app.phone,
    date_of_birth         = v_app.date_of_birth,
    address               = v_app.address,
    state_id              = v_app.state_id,
    lga_id                = v_app.lga_id,
    ward_id               = v_app.ward_id,
    community             = v_app.community,
    category_id           = v_app.category_id,
    project_name          = v_app.project_name,
    project_description   = v_app.project_description,
    problem_statement     = v_app.problem_statement,
    opportunity_statement = v_app.opportunity_statement,
    current_stage         = v_app.current_stage,
    target_beneficiaries  = v_app.target_beneficiaries,
    skills                = v_app.skills,
    expected_impact       = v_app.expected_impact,
    category_details      = v_app.category_details,
    terms_accepted        = v_app.terms_accepted,
    accuracy_confirmed    = v_app.accuracy_confirmed,
    current_step          = v_app.current_step
  where id = v_app.id
  returning * into v_app;

  return public.application_public_json(v_app);
end;
$$;

comment on function public.save_application_draft(jsonb, bigint) is
  'Creates or updates the caller''s draft application from a whitelisted payload. Safe to call on every step.';

-- ---------------------------------------------------------------------------
-- submit_application — the only path to a real application number.
-- ---------------------------------------------------------------------------
create or replace function public.submit_application(p_application_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications;
  v_missing text[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_app from public.applications where id = p_application_id;

  if v_app.id is null then
    raise exception 'application_not_found' using errcode = 'P0001';
  end if;

  if v_app.user_id <> v_uid then
    raise exception 'application_not_found' using errcode = 'P0001';
  end if;

  if v_app.status not in ('DRAFT', 'MORE_INFORMATION_REQUIRED') then
    raise exception 'already_submitted' using errcode = 'P0001';
  end if;

  v_missing := public.application_missing_fields(v_app);

  if array_length(v_missing, 1) > 0 then
    update public.applications
    set missing_fields = v_missing
    where id = v_app.id;

    raise exception 'missing_fields' using
      errcode = 'P0001',
      detail = array_to_string(v_missing, ',');
  end if;

  update public.applications set
    status             = 'SUBMITTED',
    application_number = public.generate_application_number(),
    submitted_at       = now(),
    terms_accepted_at  = case when terms_accepted then now() else null end,
    missing_fields     = null,
    current_step       = 7
  where id = v_app.id
  returning * into v_app;

  return public.application_public_json(v_app);
end;
$$;

comment on function public.submit_application(uuid) is
  'Validates completeness, allocates the application number, and moves the draft to SUBMITTED. Returns JSON; call it as a table function (PostgREST rpc()), never through (f()).* expansion, which can evaluate a volatile function more than once.';

-- ---------------------------------------------------------------------------
-- get_application_checklist — the Review step's source of truth.
--
-- Returns the caller's own checklist (never anyone else's), so the portal can
-- show exactly what is still outstanding instead of inventing its own rules,
-- and can tell the applicant which step to return to after a refused submit.
-- ---------------------------------------------------------------------------
create or replace function public.get_application_checklist(p_application_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.applications;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_app from public.applications where id = p_application_id;

  -- Deliberately the same message whether the row is missing or belongs to
  -- somebody else: guessing an id must reveal nothing.
  if v_app.id is null or (v_app.user_id <> auth.uid() and not public.is_admin()) then
    raise exception 'application_not_found' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'application_id', v_app.id,
    'status', v_app.status,
    'is_editable', v_app.status in ('DRAFT', 'MORE_INFORMATION_REQUIRED'),
    'completion_percent', v_app.completion_percent,
    'missing_fields', public.application_missing_fields(v_app),
    'fields', public.application_field_checklist(v_app)
  );
end;
$$;

comment on function public.get_application_checklist(uuid) is
  'Authoritative completeness state for one application, scoped to its owner.';

-- ---------------------------------------------------------------------------
-- Notification guards
--
-- Notification content is system-authored. An applicant may only mark their
-- own notifications read/unread; everything else is neutralised, and read_at
-- is kept consistent with is_read so the table constraint can never be a
-- source of confusing client errors.
-- ---------------------------------------------------------------------------
create or replace function public.notifications_normalize_read_state()
returns trigger
language plpgsql
as $$
begin
  if new.is_read then
    new.read_at := coalesce(new.read_at, now());
  else
    new.read_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.notifications_guard_content()
returns trigger
language plpgsql
as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  new.user_id        := old.user_id;
  new.application_id := old.application_id;
  new.type           := old.type;
  new.title          := old.title;
  new.body           := old.body;
  new.action_url     := old.action_url;
  new.severity       := old.severity;
  new.created_at     := old.created_at;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
--
-- PostgreSQL fires same-event triggers in alphabetical order, so the numeric
-- prefixes below are load-bearing: the column guard must run before the
-- derived-column recomputation that follows it.
-- ---------------------------------------------------------------------------
drop trigger if exists trg_profiles_resolve_geography on public.profiles;
drop trigger if exists trg_profiles_guard_role on public.profiles;
drop trigger if exists trg_profiles_completion on public.profiles;
drop trigger if exists trg_profiles_updated_at on public.profiles;
drop trigger if exists trg_profiles_01_guard_role on public.profiles;
drop trigger if exists trg_profiles_02_resolve_geography on public.profiles;
drop trigger if exists trg_profiles_03_completion on public.profiles;
drop trigger if exists trg_profiles_04_updated_at on public.profiles;

create trigger trg_profiles_01_guard_role
  before update on public.profiles
  for each row execute function public.profiles_guard_role();

create trigger trg_profiles_02_resolve_geography
  before insert or update on public.profiles
  for each row execute function public.profiles_resolve_geography();

create trigger trg_profiles_03_completion
  before insert or update on public.profiles
  for each row execute function public.profiles_recompute_completion();

create trigger trg_profiles_04_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_applications_guard_columns on public.applications;
drop trigger if exists trg_applications_resolve_geography on public.applications;
drop trigger if exists trg_applications_validate_details on public.applications;
drop trigger if exists trg_applications_completion on public.applications;
drop trigger if exists trg_applications_status_timestamps on public.applications;
drop trigger if exists trg_applications_updated_at on public.applications;
drop trigger if exists trg_applications_status_change on public.applications;
drop trigger if exists trg_applications_01_guard_columns on public.applications;
drop trigger if exists trg_applications_02_validate_details on public.applications;
drop trigger if exists trg_applications_03_resolve_geography on public.applications;
drop trigger if exists trg_applications_04_status_timestamps on public.applications;
drop trigger if exists trg_applications_05_completion on public.applications;
drop trigger if exists trg_applications_06_updated_at on public.applications;
drop trigger if exists trg_applications_07_status_change on public.applications;

create trigger trg_applications_01_guard_columns
  before update on public.applications
  for each row execute function public.applications_guard_protected_columns();

create trigger trg_applications_02_validate_details
  before insert or update on public.applications
  for each row execute function public.applications_validate_category_details();

create trigger trg_applications_03_resolve_geography
  before insert or update on public.applications
  for each row execute function public.applications_resolve_geography();

create trigger trg_applications_04_status_timestamps
  before update on public.applications
  for each row execute function public.applications_stamp_status_timestamps();

create trigger trg_applications_05_completion
  before insert or update on public.applications
  for each row execute function public.applications_recompute_completion();

create trigger trg_applications_06_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

create trigger trg_applications_07_status_change
  after update on public.applications
  for each row execute function public.applications_log_status_change();

-- Reference tables: keep updated_at fresh.
drop trigger if exists trg_applicant_categories_updated_at on public.applicant_categories;
create trigger trg_applicant_categories_updated_at
  before update on public.applicant_categories
  for each row execute function public.set_updated_at();

drop trigger if exists trg_support_needs_updated_at on public.support_needs;
create trigger trg_support_needs_updated_at
  before update on public.support_needs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_document_types_updated_at on public.document_types;
create trigger trg_document_types_updated_at
  before update on public.document_types
  for each row execute function public.set_updated_at();

drop trigger if exists trg_programs_updated_at on public.programs;
create trigger trg_programs_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

-- Notifications: normalise read state on insert/update, then block content
-- edits by non-privileged callers.
drop trigger if exists trg_notifications_normalize_read_state on public.notifications;
drop trigger if exists trg_notifications_01_normalize_read_state on public.notifications;
create trigger trg_notifications_01_normalize_read_state
  before insert or update on public.notifications
  for each row execute function public.notifications_normalize_read_state();

drop trigger if exists trg_notifications_guard_content on public.notifications;
drop trigger if exists trg_notifications_02_guard_content on public.notifications;
create trigger trg_notifications_02_guard_content
  before update on public.notifications
  for each row execute function public.notifications_guard_content();

-- Auth -> profiles. Created on auth.users, which Supabase owns.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
