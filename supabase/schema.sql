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

-- Koleksi / Pokedex per user (Fase 2). Tiap baris = 1 penemuan unik.
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

-- RLS: user cuma bisa baca/tulis koleksinya sendiri.
alter table user_discoveries enable row level security;

drop policy if exists "own_discoveries" on user_discoveries;
create policy "own_discoveries" on user_discoveries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
