-- =============================================================================
-- Migration 0006 — Private document storage
--
-- Documents are never public. The bucket is private, and object access is
-- restricted to the owning applicant (by the first path segment, which is their
-- auth user id) or an admin. The portal displays documents through short-lived
-- signed URLs generated server-side.
--
-- Files are stored as:  <user_id>/<application_id>/<document_code>/<file>
--
-- This migration is a no-op on a database without the storage schema, so it is
-- safe to run anywhere.
-- =============================================================================

do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'storage schema not present — skipping storage setup';
    return;
  end if;

  -- Private bucket with a server-enforced size cap and MIME allow-list. The
  -- client validates the same rules for a good user experience; these are the
  -- rules that actually cannot be bypassed.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'applicant-documents',
    'applicant-documents',
    false,
    5242880, -- 5 MB
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
  on conflict (id) do update
    set public             = false,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  if not exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'objects') then
    raise notice 'storage.objects not present — bucket created, policies skipped';
    return;
  end if;

  execute 'alter table storage.objects enable row level security';

  -- Applicants may only write inside their own user-id folder.
  execute 'drop policy if exists applicant_documents_insert_own on storage.objects';
  execute $p$
    create policy applicant_documents_insert_own on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'applicant-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  execute 'drop policy if exists applicant_documents_select_own on storage.objects';
  execute $p$
    create policy applicant_documents_select_own on storage.objects
      for select to authenticated
      using (
        bucket_id = 'applicant-documents'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or public.is_admin()
        )
      )
  $p$;

  execute 'drop policy if exists applicant_documents_update_own on storage.objects';
  execute $p$
    create policy applicant_documents_update_own on storage.objects
      for update to authenticated
      using (
        bucket_id = 'applicant-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'applicant-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  execute 'drop policy if exists applicant_documents_delete_own on storage.objects';
  execute $p$
    create policy applicant_documents_delete_own on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'applicant-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;
end $$;
