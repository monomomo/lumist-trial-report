alter table public.teacher_configs
add column if not exists summary text,
add column if not exists sections jsonb not null default '[]'::jsonb,
add column if not exists subjects jsonb not null default '[]'::jsonb;

alter table public.reports
add column if not exists teacher_snapshot jsonb not null default '{}'::jsonb;
