-- Private Storage bucket for user resumes, with owner-scoped object policies.
--
-- Files are stored at `<auth.uid()>/<filename>`, so the first path segment is the
-- owner's id and the policies below scope every read/write to that folder. The
-- Settings "About" form uploads here and keeps `{ path, name }` in the profile's
-- settings.profile.resume blob. Idempotent: safe to re-run.

/* ------------------------------------------------------------------ */
/*  1. Bucket                                                          */
/* ------------------------------------------------------------------ */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,                 -- private; access via short-lived signed URLs
  5242880,               -- 5 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

/* ------------------------------------------------------------------ */
/*  2. Object policies — a user may only touch files in their folder   */
/* ------------------------------------------------------------------ */

drop policy if exists "Resume owner can read" on storage.objects;
create policy "Resume owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Resume owner can insert" on storage.objects;
create policy "Resume owner can insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Resume owner can update" on storage.objects;
create policy "Resume owner can update" on storage.objects
  for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Resume owner can delete" on storage.objects;
create policy "Resume owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
