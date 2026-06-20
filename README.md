# ⚗️ BYAS — Bring Your Alchemy Skill

Game web *discovery* reaksi kimia santai ala Little Alchemy. Tap dua elemen, combine, dan AI (Mimo `mimo-v2.5-pro`) men-generate hasilnya — lengkap dengan penjelasan, fun fact, dan rarity. Hasil di-cache di Supabase biar konsisten dan hemat.

## ✨ Fitur Fase 1 (MVP)

- Tap-to-select 2 elemen lalu Combine
- Generate reaksi via Mimo AI (output JSON terstruktur)
- Cache kombinasi di Supabase (combo yang sama tidak panggil AI lagi)
- BYOK (Bring Your Alchemy Skill): pemain bisa pakai API key Mimo sendiri
- Fallback ke 5 key sistem dengan rotasi + cooldown saat kena rate limit
- Koleksi elemen + reveal Penemuan Baru, disimpan di localStorage

## 🔑 Cara kerja API key

1. Tiap request combine, server cek cache Supabase dulu. Kalau ada, balik tanpa AI.
2. Kalau pemain mengisi key sendiri (header `x-mimo-key`), pakai key itu.
3. Kalau tidak, ambil 1 dari `MIMO_KEYS` (rotasi acak, retry ke key lain saat 429).

Key pemain hanya disimpan di localStorage browser, tidak pernah dipersist di server.

## 🚀 Setup

```bash
npm install
cp .env.example .env
# isi MIMO_KEYS dan kredensial Supabase di .env
npm run dev
```

### Environment variables

| Variabel | Keterangan |
| --- | --- |
| `MIMO_KEYS` | 5 API key Mimo dipisah koma untuk rotasi (server-only) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key Supabase (server-only) |

### Database

Jalankan `supabase/schema.sql` di SQL editor Supabase untuk membuat tabel `combinations` dan `player_elements`.

## 🧱 Tech stack

Next.js (App Router) · React · Tailwind CSS · Supabase · Mimo AI (via OpenAI SDK) · Vercel

## 🗺️ Roadmap

- **Fase 1** — Core loop (repo ini)
- **Fase 2** — Gamification: Pokédex, rarity, XP, streak, auth
- **Fase 3** — Polish: leaderboard, achievement, share card, sound
