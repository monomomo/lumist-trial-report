alter table public.teacher_configs
add column if not exists employment_type text;

alter table public.teacher_configs
drop constraint if exists teacher_configs_employment_type_check;

alter table public.teacher_configs
add constraint teacher_configs_employment_type_check
check (employment_type is null or employment_type in ('full_time', 'part_time'));
