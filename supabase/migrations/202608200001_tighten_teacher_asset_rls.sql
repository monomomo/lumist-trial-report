drop policy if exists "teacher_configs_read_authenticated" on public.teacher_configs;
drop policy if exists "teacher_assets_read_authenticated" on storage.objects;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'teacher_configs' and policyname = 'lumist_teacher_configs_select_own'
  ) then
    create policy "lumist_teacher_configs_select_own"
    on public.teacher_configs for select
    to authenticated
    using ((select auth.uid()) = teacher_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'lumist_teacher_assets_read_own'
  ) then
    create policy "lumist_teacher_assets_read_own"
    on storage.objects for select
    to authenticated
    using (
      bucket_id = 'teacher-assets'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );
  end if;
end
$$;
