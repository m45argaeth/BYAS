-- Cache kombinasi global (diakses server pakai service role).
create table if not exists combinations (
  id uuid primary key default gen_random_uuid(),
  input_key text unique not null,
  result text not null,
  formula text,
  emoji text,
  explanation text,
  fun_fact text,
  rarity text,
  reacted boolean default true,
  category text,
  difficulty int default 1,
  hint text,
  ingredients jsonb default '[]'::jsonb,
  discovered_by uuid,
  created_at timestamptz default now()
);

alter table combinations add column if not exists category text;
alter table combinations add column if not exists difficulty int default 1;
alter table combinations add column if not exists hint text;
alter table combinations add column if not exists ingredients jsonb default '[]'::jsonb;

-- (legacy) inventory sederhana per pemain.
create table if not exists player_elements (
  user_id uuid not null,
  element text not null,
  discovered_at timestamptz default now(),
  primary key (user_id, element)
);

-- Koleksi / Pokedex per user. Tiap baris = 1 penemuan unik.
create table if not exists user_discoveries (
  user_id uuid not null references auth.users (id) on delete cascade,
  result text not null,
  formula text,
  emoji text,
  explanation text,
  fun_fact text,
  rarity text,
  category text,
  difficulty int default 1,
  xp int default 10,
  hint text,
  ingredients jsonb default '[]'::jsonb,
  discovered_at timestamptz default now(),
  primary key (user_id, result)
);

alter table user_discoveries add column if not exists category text;
alter table user_discoveries add column if not exists difficulty int default 1;
alter table user_discoveries add column if not exists xp int default 10;
alter table user_discoveries add column if not exists hint text;
alter table user_discoveries add column if not exists ingredients jsonb default '[]'::jsonb;

alter table user_discoveries enable row level security;
drop policy if exists "own_discoveries" on user_discoveries;
create policy "own_discoveries" on user_discoveries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Progres pemain: streak + total XP + username (buat leaderboard).
create table if not exists player_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak int default 0,
  best_streak int default 0,
  last_played date,
  total_xp int default 0,
  display_name text,
  hint_tokens int default 0,
  lab_reputation int default 0,
  completed_daily_challenges jsonb default '[]'::jsonb,
  failed_experiments int default 0,
  updated_at timestamptz default now()
);

-- Untuk deployment lama: tambahkan kolom baru bila belum ada.
alter table player_stats add column if not exists total_xp int default 0;
alter table player_stats add column if not exists display_name text;
alter table player_stats add column if not exists hint_tokens int default 0;
alter table player_stats add column if not exists lab_reputation int default 0;
alter table player_stats add column if not exists completed_daily_challenges jsonb default '[]'::jsonb;
alter table player_stats add column if not exists failed_experiments int default 0;

alter table player_stats enable row level security;

-- Leaderboard: semua orang boleh BACA, tapi nulis hanya row sendiri.
drop policy if exists "own_stats" on player_stats;
drop policy if exists "stats_public_read" on player_stats;
drop policy if exists "stats_insert_own" on player_stats;
drop policy if exists "stats_update_own" on player_stats;
create policy "stats_public_read" on player_stats for select using (true);
create policy "stats_insert_own" on player_stats
  for insert
  with check (auth.uid() = user_id);
create policy "stats_update_own" on player_stats
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
