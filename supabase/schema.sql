-- Cafe Palmier shared task data. Run this once in Supabase: SQL Editor > New query > Run.
create table if not exists public.cafe_tasks (
  id text primary key,
  title text not null,
  category text not null default 'general',
  period text not null default 'weekly',
  description text not null default '',
  checklist jsonb not null default '[]'::jsonb,
  time_tag text not null default '',
  urgent_on jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  last_completed_at timestamptz,
  area text not null default 'General',
  task_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.cafe_tasks add column if not exists checklist jsonb not null default '[]'::jsonb;

create table if not exists public.cafe_day_lists (
  list_date date primary key,
  task_ids jsonb not null default '[]'::jsonb,
  custom_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.cafe_tutorials (
  id text primary key,
  title text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cafe-tutorial-videos',
  'cafe-tutorial-videos',
  true,
  209715200,
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/ogg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.cafe_tasks enable row level security;
alter table public.cafe_day_lists enable row level security;
alter table public.cafe_tutorials enable row level security;

grant select, insert, update, delete on public.cafe_tasks to anon;
grant select, insert, update, delete on public.cafe_day_lists to anon;
grant select, insert, update, delete on public.cafe_tutorials to anon;

drop policy if exists "Task board public access" on public.cafe_tasks;
drop policy if exists "Day lists public access" on public.cafe_day_lists;
drop policy if exists "Tutorials public access" on public.cafe_tutorials;
create policy "Task board public access" on public.cafe_tasks for all to anon using (true) with check (true);
create policy "Day lists public access" on public.cafe_day_lists for all to anon using (true) with check (true);
create policy "Tutorials public access" on public.cafe_tutorials for all to anon using (true) with check (true);

drop policy if exists "Tutorial videos public uploads" on storage.objects;
drop policy if exists "Tutorial videos public reads" on storage.objects;
drop policy if exists "Tutorial videos public updates" on storage.objects;
drop policy if exists "Tutorial videos public deletes" on storage.objects;
create policy "Tutorial videos public reads" on storage.objects
  for select to anon using (bucket_id = 'cafe-tutorial-videos');
create policy "Tutorial videos public uploads" on storage.objects
  for insert to anon with check (bucket_id = 'cafe-tutorial-videos');
create policy "Tutorial videos public updates" on storage.objects
  for update to anon using (bucket_id = 'cafe-tutorial-videos') with check (bucket_id = 'cafe-tutorial-videos');
create policy "Tutorial videos public deletes" on storage.objects
  for delete to anon using (bucket_id = 'cafe-tutorial-videos');
