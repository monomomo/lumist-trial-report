create extension if not exists pgcrypto;

alter table public.profiles
add column if not exists display_name text,
add column if not exists updated_at timestamptz not null default now();

create table if not exists public.reports (
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
  teacher_snapshot jsonb not null default '{}'::jsonb,
  pdf_path text,
  status text not null default 'draft' check (status in ('draft', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher_configs (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  public_name text not null,
  title text,
  summary text,
  bio jsonb not null default '[]'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  subjects jsonb not null default '[]'::jsonb,
  photo_path text,
  qr_path text,
  updated_at timestamptz not null default now()
);

alter table public.teacher_configs
add column if not exists summary text,
add column if not exists sections jsonb not null default '[]'::jsonb,
add column if not exists subjects jsonb not null default '[]'::jsonb;

alter table public.reports
add column if not exists teacher_snapshot jsonb not null default '{}'::jsonb;

create index if not exists reports_teacher_id_updated_at_idx on public.reports(teacher_id, updated_at desc);
create index if not exists reports_student_name_idx on public.reports(student_name);

create or replace function public.set_lumist_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reports_lumist_updated_at on public.reports;
create trigger reports_lumist_updated_at
before update on public.reports
for each row execute function public.set_lumist_updated_at();

drop trigger if exists teacher_configs_lumist_updated_at on public.teacher_configs;
create trigger teacher_configs_lumist_updated_at
before update on public.teacher_configs
for each row execute function public.set_lumist_updated_at();

alter table public.reports enable row level security;
alter table public.teacher_configs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and policyname = 'lumist_reports_select_own'
  ) then
    create policy "lumist_reports_select_own"
    on public.reports for select
    to authenticated
    using ((select auth.uid()) = teacher_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and policyname = 'lumist_reports_insert_own'
  ) then
    create policy "lumist_reports_insert_own"
    on public.reports for insert
    to authenticated
    with check ((select auth.uid()) = teacher_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and policyname = 'lumist_reports_update_own'
  ) then
    create policy "lumist_reports_update_own"
    on public.reports for update
    to authenticated
    using ((select auth.uid()) = teacher_id)
    with check ((select auth.uid()) = teacher_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports' and policyname = 'lumist_reports_delete_own'
  ) then
    create policy "lumist_reports_delete_own"
    on public.reports for delete
    to authenticated
    using ((select auth.uid()) = teacher_id);
  end if;

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
    where schemaname = 'public' and tablename = 'teacher_configs' and policyname = 'lumist_teacher_configs_insert_own'
  ) then
    create policy "lumist_teacher_configs_insert_own"
    on public.teacher_configs for insert
    to authenticated
    with check ((select auth.uid()) = teacher_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'teacher_configs' and policyname = 'lumist_teacher_configs_update_own'
  ) then
    create policy "lumist_teacher_configs_update_own"
    on public.teacher_configs for update
    to authenticated
    using ((select auth.uid()) = teacher_id)
    with check ((select auth.uid()) = teacher_id);
  end if;
end
$$;

insert into storage.buckets (id, name, public)
values ('teacher-assets', 'teacher-assets', false)
on conflict (id) do nothing;

do $$
begin
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

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'lumist_teacher_assets_write_own'
  ) then
    create policy "lumist_teacher_assets_write_own"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'teacher-assets'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );
  end if;
end
$$;

update public.profiles
set display_name = 'Amber'
where id = 'b7ec88c5-447e-4f9b-88ea-34f59fa3db03';

insert into public.teacher_configs (
  teacher_id,
  public_name,
  title,
  summary,
  bio,
  sections,
  subjects
)
values (
  'b7ec88c5-447e-4f9b-88ea-34f59fa3db03',
  'Amber',
  'AP 数学与计算机课程导师',
  '数学、计算机与工程实践背景兼备，注重知识体系、真实题型与长期学科发展的结合。',
  '[
    "华盛顿大学数学专业本科，佐治亚理工大学计算机硕士，专业课程平均绩点 3.8/4.0；AP Calculus BC 5 分、SAT 数学满分。",
    "拥有 4 年以上 Lumist 导师经验，累计辅导学生上百位，熟悉北美高中与 AP 课程体系。",
    "曾供职于华为成都研究所与联想集团，具备扎实的数学、计算机和工程实践背景。",
    "注重知识体系与真实题型结合，通过个性化规划处理学生薄弱点，并兼顾考试表现与长期学科发展。"
  ]'::jsonb,
  '[
    {
      "title": "教育与专业背景",
      "content": ["华盛顿大学数学专业本科，佐治亚理工大学计算机硕士，专业课程平均绩点 3.8/4.0；AP Calculus BC 5 分、SAT 数学满分。"]
    },
    {
      "title": "教学与行业经验",
      "content": ["拥有 4 年以上 Lumist 导师经验，累计辅导学生上百位；曾供职于华为成都研究所与联想集团。"]
    },
    {
      "title": "擅长领域",
      "content": ["AP Precalculus、AP Calculus AB/BC、SAT 数学、AP Computer Science A、Java、Python、数据结构与算法。"]
    },
    {
      "title": "教学风格",
      "content": ["注重知识体系与真实题型结合，通过个性化规划处理学生薄弱点，并兼顾考试表现与长期学科发展。"]
    }
  ]'::jsonb,
  '[
    "AP Precalculus",
    "AP Calculus AB",
    "AP Calculus BC",
    "AP Computer Science A",
    "SAT 数学"
  ]'::jsonb
)
on conflict (teacher_id) do update
set
  public_name = excluded.public_name,
  title = excluded.title,
  summary = excluded.summary,
  bio = excluded.bio,
  sections = excluded.sections,
  subjects = excluded.subjects,
  updated_at = now();
