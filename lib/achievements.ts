import type { Discovery, Stats } from './types'
import { levelFromXp, totalXpFromDiscoveries } from './progress'

export interface AchievementDef {
  id: string
  emoji: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first', emoji: '🌱' },
  { id: 'ten', emoji: '🔟' },
  { id: 'collector', emoji: '📦' },
  { id: 'legendary', emoji: '👑' },
  { id: 'streak7', emoji: '🔥' },
  { id: 'level5', emoji: '⭐' },
]

export function computeUnlocked(discoveries: Discovery[], stats: Stats): string[] {
  const out: string[] = []
  const n = discoveries.length
  const level = levelFromXp(totalXpFromDiscoveries(discoveries))
  if (n >= 1) out.push('first')
  if (n >= 10) out.push('ten')
  if (n >= 25) out.push('collector')
  if (discoveries.some((d) => d.rarity === 'legendary')) out.push('legendary')
  if (stats.bestStreak >= 7) out.push('streak7')
  if (level >= 5) out.push('level5')
  return out
}

const ACH_KEY = 'byas_achievements'

export function loadSeen(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(ACH_KEY) || '[]') as string[]
  } catch {
    return []
  }
}

export function saveSeen(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ACH_KEY, JSON.stringify(ids))
  } catch {}
}
