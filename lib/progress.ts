import type { Discovery, Rarity, Stats } from './types'

// XP yang didapat per penemuan, berdasarkan rarity.
export const XP_BY_RARITY: Record<Rarity, number> = {
  common: 10,
  uncommon: 25,
  rare: 60,
  legendary: 150,
}

// Total XP diturunkan dari koleksi -> selalu konsisten walau habis sync.
export function totalXpFromDiscoveries(ds: Discovery[]): number {
  return ds.reduce((sum, d) => sum + (XP_BY_RARITY[d.rarity] ?? 10), 0)
}

// XP kumulatif yang dibutuhkan untuk MENCAPAI sebuah level (level mulai dari 1).
// Kurva landai: increment antar level naik linear (100, 200, 300, ...).
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return 50 * (level - 1) * level
}

export function levelFromXp(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  return level
}

export interface LevelProgress {
  level: number
  into: number
  span: number
  pct: number
  totalXp: number
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp)
  const cur = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const into = xp - cur
  const span = next - cur
  return {
    level,
    into,
    span,
    pct: span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 100,
    totalXp: xp,
  }
}

// ---- Streak ----

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function dayDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round((db.getTime() - da.getTime()) / 86_400_000)
}

// Catat bahwa pemain main hari ini. Streak naik kalau main berurutan,
// reset ke 1 kalau bolong. Return objek SAMA kalau sudah main hari ini.
export function recordPlay(stats: Stats, today = todayStr()): Stats {
  if (stats.lastPlayed === today) return stats
  let currentStreak = 1
  if (stats.lastPlayed && dayDiff(stats.lastPlayed, today) === 1) {
    currentStreak = stats.currentStreak + 1
  }
  return {
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    lastPlayed: today,
  }
}
