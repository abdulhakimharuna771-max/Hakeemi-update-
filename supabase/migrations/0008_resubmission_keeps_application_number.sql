-- =============================================================================
-- 0008 — Resubmission keeps the application number
--
-- An application can return to the applicant through MORE_INFORMATION_REQUIRED.
-- When they send it back, the identifier must not change: it is the reference
-- printed on nothing but their own record, and a reviewer, an email thread and
-- the applicant all refer to it. submit_application() therefore reuses the
-- existing number when there is one.
--
-- create or replace keeps this safe to apply to a database that already has the
-- earlier definition. Nothing else in the function changes.
-- =============================================================================

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
    -- Resubmitting after MORE_INFORMATION_REQUIRED keeps the number the
    -- applicant already received: it identifies the record, and changing it
    -- mid-review would invalidate anything they have already written down.
    application_number = coalesce(v_app.application_number, public.generate_application_number()),
    submitted_at       = now(),
    terms_accepted_at  = case when terms_accepted then now() else null end,
    missing_fields     = null,
    current_step       = 7
  where id = v_app.id
  returning * into v_app;

  return public.application_public_json(v_app);
end;
$$;
