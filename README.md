# ⚗️ BYAS — Bring Your Alchemy Skill

Game kimia bergaya *Little Alchemy*, tapi pakai reaksi kimia nyata. Pilih dua unsur/senyawa, tekan **Combine**, dan AI (Mimo) menentukan hasil reaksinya lengkap dengan rumus, penjelasan, fun fact, dan tingkat kelangkaan.

## ✨ Fitur

- **Combine berbasis AI** — hasil reaksi di-generate oleh model `mimo-v2.5-pro`.
- **Unsur dasar**: Hidrogen (H), Oksigen (O), Karbon (C), Nitrogen (N), Sulfur (S), Natrium (Na).
- **Koleksi / Pokedex** — semua penemuan tersimpan & dikelompokkan per rarity.
- **XP, Level & Streak** — progress harian dengan streak.
- **Leaderboard** — ranking berdasarkan total XP, username diatur sendiri.
- **Achievements** — 6 badge dengan notifikasi pop-up.
- **Share card** — bikin kartu penemuan (canvas) buat dibagikan / di-download.
- **Sound effects** — efek suara sintetik (Web Audio), bisa dimatikan.
- **Dark / Light mode** — toggle tema, tersimpan di browser.
- **Multi bahasa** — ID / EN / CN, termasuk bahasa output AI.
- **BYOK** — pakai API key Mimo sendiri, atau pakai rotasi key sistem.
- **Sinkron cloud** — login email (Supabase) buat simpan koleksi lintas device.
- **Local-first** — tetap jalan tanpa login (data di localStorage).

## 🗒️ Tech stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS (dark mode via class + CSS variables)
- Supabase (auth email + Postgres + RLS)
- Mimo API (OpenAI-compatible) untuk generasi reaksi

## 🚀 Setup

### 1. Install

```bash
npm install
```

### 2. Environment variables

Salin `.env.example` jadi `.env.local` lalu isi:

```
MIMO_KEYS=sk-key1,sk-key2,sk-key3,sk-key4,sk-key5
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

- `MIMO_KEYS`: daftar API key sistem (dipisah koma). Generate di https://platform.xiaomimimo.com/#/console/api-keys
- Tiga var Supabase opsional: tanpa itu, cache/auth/cloud mati tapi game tetap jalan secara lokal.

### 3. Database (Supabase)

Jalankan isi `supabase/schema.sql` di **SQL Editor** Supabase.

Matikan verifikasi email biar bisa langsung main:
**Authentication → Sign In / Providers → Email → nonaktifkan “Confirm email”.**

### 4. Jalankan / Deploy

```bash
npm run dev
```

Deploy paling gampang lewat **Vercel**: import repo ini, set environment variables di atas, lalu deploy. Setiap push ke `main` otomatis ter-deploy.

## 🎮 Cara main

1. Pilih dua elemen (tap untuk pilih, tap lagi untuk batal).
2. Tekan **Combine**.
3. Lihat hasil reaksi, kumpulkan penemuan, naikkan level, dan kejar achievement.

## 📁 Struktur singkat

- `app/` — halaman (home, pokedex, leaderboard) + API route `combine`.
- `components/` — modal & UI (Discovery, Auth, ApiKey, Settings, dll).
- `lib/` — logika game (elements, progress, rarity, share, sound, i18n, theme, cloud sync, dll).
- `supabase/schema.sql` — skema database + RLS.

---

Dibuat buat eksperimen, belajar kimia, dan having fun. 🧪
