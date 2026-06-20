import type { Discovery, Stats } from './types'

export interface Achievement {
  id: string
  emoji: string
  title: string
  description: string
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', emoji: '🧪', title: 'First Reaction', description: 'Complete your first experiment' },
  { id: 'ten', emoji: '🧭', title: 'Explorer', description: 'Discover 10 items' },
  { id: 'researcher', emoji: '🔬', title: 'Researcher', description: 'Discover 100 items' },
  { id: 'chemist', emoji: '⚗️', title: 'Chemist', description: 'Discover 250 items' },
  { id: 'master', emoji: '🧬', title: 'Master Chemist', description: 'Discover 500 items' },
  { id: 'legend', emoji: '🌌', title: 'Alchemy Legend', description: 'Discover 1000 items' },
  { id: 'rare', emoji: '💎', title: 'Rare Signal', description: 'Discover your first Rare item' },
  { id: 'legendary', emoji: '👑', title: 'Legendary Find', description: 'Discover a Legendary item' },
  { id: 'mythic', emoji: '🪐', title: 'Impossible Matter', description: 'Discover a Mythic item' },
  { id: 'streak7', emoji: '🔥', title: 'Stable Chain', description: 'Maintain a 7-day streak' },
  { id: 'level5', emoji: '⭐', title: 'Rising Researcher', description: 'Reach Level 5' },
]

// Returns the set of unlocked achievement ids given current progress.
export function computeUnlocked(discoveries: Discovery[], stats: Stats, level: number): Set<string> {
  const unlocked = new Set<string>()
  const count = discoveries.length
  const hasRare = discoveries.some((d) => ['rare', 'epic', 'legendary', 'mythic'].includes(d.rarity))
  const hasLegendary = discoveries.some((d) => d.rarity === 'legendary')
  const hasMythic = discoveries.some((d) => d.rarity === 'mythic')

  if (count >= 1) unlocked.add('first')
  if (count >= 10) unlocked.add('ten')
  if (count >= 100) unlocked.add('researcher')
  if (count >= 250) unlocked.add('chemist')
  if (count >= 500) unlocked.add('master')
  if (count >= 1000) unlocked.add('legend')
  if (hasRare) unlocked.add('rare')
  if (hasLegendary) unlocked.add('legendary')
  if (hasMythic) unlocked.add('mythic')
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
    localStorage.setItem(KEY, JSON.stringify(Array.from(ids)))
  } catch {}
}
