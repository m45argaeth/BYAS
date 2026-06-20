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
  discovered_by uuid,
  created_at timestamptz default now()
);

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
  discovered_at timestamptz default now(),
  primary key (user_id, result)
);

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
  updated_at timestamptz default now()
);

-- Untuk deployment lama: tambahkan kolom baru bila belum ada.
alter table player_stats add column if not exists total_xp int default 0;
alter table player_stats add column if not exists display_name text;

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
