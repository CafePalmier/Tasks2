-- Cafe Palmier shared task data. Run this once in Supabase: SQL Editor > New query > Run.
create table if not exists public.cafe_tasks (
  id text primary key,
  title text not null,
  category text not null default 'general',
  period text not null default 'weekly',
  description text not null default '',
  time_tag text not null default '',
  urgent_on jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  last_completed_at timestamptz,
  area text not null default 'General',
  task_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.cafe_day_lists (
  list_date date primary key,
  task_ids jsonb not null default '[]'::jsonb,
  custom_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.cafe_tasks enable row level security;
alter table public.cafe_day_lists enable row level security;

grant select, insert, update, delete on public.cafe_tasks to anon;
grant select, insert, update, delete on public.cafe_day_lists to anon;

drop policy if exists "Task board public access" on public.cafe_tasks;
drop policy if exists "Day lists public access" on public.cafe_day_lists;
create policy "Task board public access" on public.cafe_tasks for all to anon using (true) with check (true);
create policy "Day lists public access" on public.cafe_day_lists for all to anon using (true) with check (true);
