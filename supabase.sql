create table if not exists public.ta_members (
  id text primary key,
  name text not null,
  role text,
  color text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ta_goals (
  id text primary key,
  member_id text not null references public.ta_members(id) on delete cascade,
  title text not null,
  deadline date,
  milestones jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ta_wins (
  id text primary key,
  member_id text not null references public.ta_members(id) on delete cascade,
  title text not null,
  note text,
  date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.ta_photos (
  id text primary key,
  member_id text not null references public.ta_members(id) on delete cascade,
  caption text,
  image_data text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ta_settings (
  id text primary key default 'shared',
  title text not null,
  subtitle text not null,
  updated_at timestamptz not null default now()
);

insert into public.ta_settings (id, title, subtitle)
values ('shared', 'Our Achievements', 'TA team dashboard — set goals, move through milestones, and celebrate wins together.')
on conflict (id) do nothing;

alter table public.ta_members enable row level security;
alter table public.ta_goals enable row level security;
alter table public.ta_wins enable row level security;
alter table public.ta_photos enable row level security;
alter table public.ta_settings enable row level security;

create policy "public read members" on public.ta_members for select using (true);
create policy "public insert members" on public.ta_members for insert with check (true);
create policy "public update members" on public.ta_members for update using (true) with check (true);

create policy "public read goals" on public.ta_goals for select using (true);
create policy "public insert goals" on public.ta_goals for insert with check (true);
create policy "public update goals" on public.ta_goals for update using (true) with check (true);

create policy "public read wins" on public.ta_wins for select using (true);
create policy "public insert wins" on public.ta_wins for insert with check (true);

create policy "public read photos" on public.ta_photos for select using (true);
create policy "public insert photos" on public.ta_photos for insert with check (true);
create policy "public delete photos" on public.ta_photos for delete using (true);

create policy "public read settings" on public.ta_settings for select using (true);
create policy "public upsert settings" on public.ta_settings for insert with check (true);
create policy "public update settings" on public.ta_settings for update using (true) with check (true);

grant usage on schema public to anon, authenticated;

grant select, insert, update on public.ta_members to anon, authenticated;
grant select, insert, update on public.ta_goals to anon, authenticated;
grant select, insert on public.ta_wins to anon, authenticated;
grant select, insert, delete on public.ta_photos to anon, authenticated;
grant select, insert, update on public.ta_settings to anon, authenticated;

alter publication supabase_realtime add table public.ta_members;
alter publication supabase_realtime add table public.ta_goals;
alter publication supabase_realtime add table public.ta_wins;
alter publication supabase_realtime add table public.ta_photos;
alter publication supabase_realtime add table public.ta_settings;
