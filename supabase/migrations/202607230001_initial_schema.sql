create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'teacher' check (role in ('teacher', 'sales', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_name text not null,
  subject text not null default 'SAT 数学',
  current_score text,
  target_score text,
  exam_date_text text,
  original_notes text not null,
  report_data jsonb not null default '{}'::jsonb,
  course_plan jsonb not null default '{}'::jsonb,
  sales_follow_up jsonb not null default '{}'::jsonb,
  pdf_path text,
  status text not null default 'draft' check (status in ('draft', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teacher_configs (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  public_name text not null,
  title text,
  bio jsonb not null default '{}'::jsonb,
  photo_path text,
  qr_path text,
  updated_at timestamptz not null default now()
);

create table public.company_configs (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index reports_teacher_id_updated_at_idx on public.reports(teacher_id, updated_at desc);
create index reports_student_name_idx on public.reports(student_name);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger reports_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create trigger teacher_configs_updated_at
before update on public.teacher_configs
for each row execute function public.set_updated_at();

create trigger company_configs_updated_at
before update on public.company_configs
for each row execute function public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.teacher_configs enable row level security;
alter table public.company_configs enable row level security;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "reports_select_own"
on public.reports for select
to authenticated
using ((select auth.uid()) = teacher_id);

create policy "reports_insert_own"
on public.reports for insert
to authenticated
with check ((select auth.uid()) = teacher_id);

create policy "reports_update_own"
on public.reports for update
to authenticated
using ((select auth.uid()) = teacher_id)
with check ((select auth.uid()) = teacher_id);

create policy "reports_delete_own"
on public.reports for delete
to authenticated
using ((select auth.uid()) = teacher_id);

create policy "teacher_configs_read_authenticated"
on public.teacher_configs for select
to authenticated
using (true);

create policy "teacher_configs_update_own"
on public.teacher_configs for update
to authenticated
using ((select auth.uid()) = teacher_id)
with check ((select auth.uid()) = teacher_id);

create policy "company_configs_read_authenticated"
on public.company_configs for select
to authenticated
using (true);

create policy "company_configs_admin_all"
on public.company_configs for all
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into storage.buckets (id, name, public)
values ('teacher-assets', 'teacher-assets', false), ('report-pdfs', 'report-pdfs', false)
on conflict (id) do nothing;

create policy "teacher_assets_read_authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'teacher-assets');

create policy "teacher_assets_write_own_folder"
on storage.objects for insert
to authenticated
with check (bucket_id = 'teacher-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "report_pdfs_read_own_folder"
on storage.objects for select
to authenticated
using (bucket_id = 'report-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "report_pdfs_write_own_folder"
on storage.objects for insert
to authenticated
with check (bucket_id = 'report-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);
