-- Cache kombinasi: kunci utama pasangan elemen yang sudah diurutkan.
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

-- Inventory / koleksi per pemain (dipakai mulai Fase 2 dengan auth).
create table if not exists player_elements (
  user_id uuid not null,
  element text not null,
  discovered_at timestamptz default now(),
  primary key (user_id, element)
);
