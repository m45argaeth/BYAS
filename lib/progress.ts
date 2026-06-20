import type { Discovery, Stats } from './types'

export const XP_BY_RARITY: Record<string, number> = {
  common: 10,
  uncommon: 25,
  rare: 60,
  legendary: 150,
}

export function xpForDiscovery(d: { rarity: string }): number {
  return XP_BY_RARITY[d.rarity] ?? 10
}

export function totalXpFromDiscoveries(discoveries: Discovery[]): number {
  return discoveries.reduce((sum, d) => sum + (XP_BY_RARITY[d.rarity] ?? 10), 0)
}

// Cumulative XP needed to reach a level (level starts at 1). xpForLevel(L) = 50*(L-1)*L
export function xpForLevel(level: number): number {
  return 50 * (level - 1) * level
}

export function levelFromXp(xp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  return level
}

export interface LevelProgress {
  level: number
  totalXp: number
  into: number
  span: number
  pct: number
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp)
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const span = Math.max(1, next - base)
  const into = Math.max(0, xp - base)
  const pct = Math.min(100, Math.round((into / span) * 100))
  return { level, totalXp: xp, into, span, pct }
}

export function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return d.getFullYear() + '-' + m + '-' + day
}

// Update streak for a play happening today. Returns a new Stats object.
export function recordPlay(stats: Stats): Stats {
  const today = todayStr()
  if (stats.lastPlayed === today) return stats
  let current = 1
  if (stats.lastPlayed) {
    const prev = new Date(stats.lastPlayed + 'T00:00:00')
    const now = new Date(today + 'T00:00:00')
    const diffDays = Math.round((now.getTime() - prev.getTime()) / 86400000)
    if (diffDays === 1) current = (stats.currentStreak || 0) + 1
    else if (diffDays <= 0) current = stats.currentStreak || 1
    else current = 1
  }
  const best = Math.max(stats.bestStreak ?? 0, current)
  return { ...stats, currentStreak: current, bestStreak: best, lastPlayed: today }
}
