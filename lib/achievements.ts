import type { Discovery, Stats } from './types'

export interface Achievement {
  id: string
  emoji: string
  // i18n key suffix -> ach.<id>.title / ach.<id>.desc
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', emoji: '🧪' },
  { id: 'ten', emoji: '🔟' },
  { id: 'collector', emoji: '📚' },
  { id: 'legendary', emoji: '👑' },
  { id: 'streak7', emoji: '🔥' },
  { id: 'level5', emoji: '⭐' },
]

// Returns the set of unlocked achievement ids given current progress.
export function computeUnlocked(discoveries: Discovery[], stats: Stats, level: number): Set<string> {
  const unlocked = new Set<string>()
  const count = discoveries.length
  const hasLegendary = discoveries.some((d) => d.rarity === 'legendary')

  if (count >= 1) unlocked.add('first')
  if (count >= 10) unlocked.add('ten')
  if (count >= 30) unlocked.add('collector')
  if (hasLegendary) unlocked.add('legendary')
  if ((stats.bestStreak ?? 0) >= 7) unlocked.add('streak7')
  if (level >= 5) unlocked.add('level5')

  return unlocked
}

const KEY = 'byas_achievements'

export function loadSeen(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export function saveSeen(ids: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]))
  } catch {}
}
