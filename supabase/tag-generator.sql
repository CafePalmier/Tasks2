-- Apply only after approval. Does not alter existing Tasks tables or policies.
begin;
create or replace function public.tag_library_valid(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item jsonb; pair record;
begin
 if jsonb_typeof(value) <> 'object' or octet_length(value::text)>2000000
 or not (value ?& array['records','prices','deleted'])
 or (value - array['records','prices','deleted']) <> '{}'::jsonb
 or jsonb_typeof(value->'records') <> 'array' or jsonb_array_length(value->'records')>2000
 or jsonb_typeof(value->'prices') <> 'object' or jsonb_typeof(value->'deleted') <> 'array'
 or jsonb_array_length(value->'deleted')>2000 then return false; end if;
 for item in select * from jsonb_array_elements(value->'records') loop
  if jsonb_typeof(item)<>'object' or not(item ?& array['type','title','subtitle','price','ingredients','vegan','glutenFree','individualPrice','titleColor'])
  or (item - array['type','title','subtitle','price','ingredients','vegan','glutenFree','individualPrice','titleColor']) <> '{}'::jsonb
  or jsonb_typeof(item->'type')<>'string' or item->>'type' not in ('pastry','freezer','provisions')
  or jsonb_typeof(item->'title')<>'string' or length(btrim(item->>'title')) not between 1 and 200
  or jsonb_typeof(item->'subtitle')<>'string' or length(item->>'subtitle')>300
  or jsonb_typeof(item->'ingredients')<>'string' or length(item->>'ingredients')>12000
  or (item->>'type'='pastry' and length(btrim(item->>'ingredients'))=0)
  or jsonb_typeof(item->'price')<>'string' or (item->>'price') !~ '^\$[0-9]{1,7}\.[0-9]{2}$'
  or jsonb_typeof(item->'vegan')<>'boolean' or jsonb_typeof(item->'glutenFree')<>'boolean'
  or jsonb_typeof(item->'individualPrice')<>'boolean'
  or jsonb_typeof(item->'titleColor')<>'string' or item->>'titleColor' not in ('#376438','#c68b70') then return false; end if;
 end loop;
 for pair in select * from jsonb_each(value->'prices') loop
  if pair.key not in ('muffin','scone','poptart','sable','barre') or jsonb_typeof(pair.value)<>'string' or (pair.value #>> '{}') !~ '^\$[0-9]{1,7}\.[0-9]{2}$' then return false; end if;
 end loop;
 for item in select * from jsonb_array_elements(value->'deleted') loop
  if jsonb_typeof(item)<>'string' or length(item #>> '{}')>600 or (item #>> '{}') !~ '^(pastry|freezer|provisions)\|' then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
create table public.tag_generator_library (
 id integer primary key check(id=1),
 revision bigint not null default 0,
 payload jsonb not null check(public.tag_library_valid(payload)),
 updated_at timestamptz not null default now()
);
create table public.tag_generator_history (
 revision bigint primary key,
 payload jsonb not null,
 saved_at timestamptz not null default now()
);
insert into public.tag_generator_library(id,payload) values(1,'{"records":[],"prices":{},"deleted":[]}');
create function public.tag_generator_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.tag_generator_history(revision,payload) values(old.revision,old.payload);
 new.revision=old.revision+1;new.updated_at=now();return new;
end $$;
create trigger tag_generator_version before update on public.tag_generator_library
for each row execute function public.tag_generator_version();
alter table public.tag_generator_library enable row level security;
alter table public.tag_generator_history enable row level security;
revoke all on public.tag_generator_library,public.tag_generator_history from anon,authenticated;
grant select on public.tag_generator_library,public.tag_generator_history to anon;
grant update(payload) on public.tag_generator_library to anon;
create policy tag_generator_read on public.tag_generator_library for select to anon using(id=1);
create policy tag_generator_write on public.tag_generator_library for update to anon using(id=1) with check(id=1);
create policy tag_generator_history_read on public.tag_generator_history for select to anon using(true);
-- Anonymous callers cannot write history or alter revisions. Deletes are tombstones
-- within the validated payload, so bundled presets stay deleted across devices.
revoke all on function public.tag_generator_version() from public;
commit;
