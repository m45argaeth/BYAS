import type { Discovery, MasteryCategory, Rarity, Stats } from './types'

export const XP_BY_RARITY: Record<Rarity, number> = {
  common: 10,
  uncommon: 25,
  rare: 50,
  epic: 100,
  legendary: 250,
  mythic: 500,
}

export const MASTERY_LABEL: Record<MasteryCategory, string> = {
  organic: 'Organic Chemistry',
  inorganic: 'Inorganic Chemistry',
  metals: 'Metals',
  gases: 'Gases',
  biology: 'Biology',
  energy: 'Energy',
  industrial: 'Industrial Materials',
}

export function xpForDiscovery(d: { rarity: Rarity; xp?: number; difficulty?: number }): number {
  const base = XP_BY_RARITY[d.rarity] ?? 10
  const difficultyBonus = Math.max(0, (d.difficulty ?? 1) - 1) * 5
  return d.xp ?? base + difficultyBonus
}

// Bonus XP berdasarkan streak aktif, di-cap supaya tidak meledak.
export function streakXpBonus(streak: number): number {
  return Math.min(Math.max(0, streak), 10) * 2
}

// XP final untuk discovery baru: rarity + difficulty + streak bonus.
// Nilai ini disimpan ke disc.xp supaya total XP tetap konsisten saat dihitung ulang.
export function xpForNewDiscovery(d: { rarity: Rarity; difficulty?: number }, streak: number): number {
  const base = XP_BY_RARITY[d.rarity] ?? 10
  const difficultyBonus = Math.max(0, (d.difficulty ?? 1) - 1) * 5
  return base + difficultyBonus + streakXpBonus(streak)
}

export function totalXpFromDiscoveries(discoveries: Discovery[]): number {
  return discoveries.reduce((sum, d) => sum + xpForDiscovery(d), 0)
}

// Total XP = XP dari discoveries + bonus XP (daily challenge, quest, dsb).
export function totalXp(discoveries: Discovery[], stats?: { bonusXp?: number }): number {
  return totalXpFromDiscoveries(discoveries) + (stats?.bonusXp ?? 0)
}

// Milestone koleksi yang konsisten dengan achievement & research rank.
export const COLLECTION_MILESTONES = [10, 25, 50, 100, 250, 500, 1000]

export function nextMilestone(count: number): number {
  for (const m of COLLECTION_MILESTONES) if (count < m) return m
  return COLLECTION_MILESTONES[COLLECTION_MILESTONES.length - 1]
}

export function labReputation(discoveries: Discovery[], stats: Stats): number {
  const rarityWeight = discoveries.reduce((sum, d) => {
    if (d.rarity === 'mythic') return sum + 250
    if (d.rarity === 'legendary') return sum + 120
    if (d.rarity === 'epic') return sum + 70
    if (d.rarity === 'rare') return sum + 35
    return sum + 10
  }, 0)
  return totalXpFromDiscoveries(discoveries) + rarityWeight + (stats.bestStreak ?? 0) * 12
}

export function researchRank(level: number, discoveryCount: number): string {
  if (level >= 30 || discoveryCount >= 500) return 'Alchemy Legend'
  if (level >= 22 || discoveryCount >= 250) return 'Master Chemist'
  if (level >= 16 || discoveryCount >= 100) return 'Senior Chemist'
  if (level >= 10 || discoveryCount >= 50) return 'Field Researcher'
  if (level >= 6 || discoveryCount >= 20) return 'Junior Chemist'
  if (level >= 3 || discoveryCount >= 8) return 'Lab Assistant'
  return 'Novice Researcher'
}

export function masteryBreakdown(discoveries: Discovery[]): Array<{ category: MasteryCategory; count: number; pct: number }> {
  const categories = Object.keys(MASTERY_LABEL) as MasteryCategory[]
  return categories.map((category) => {
    const count = discoveries.filter((d) => (d.category ?? guessCategory(d)) === category).length
    return { category, count, pct: Math.min(100, count * 10) }
  })
}

export function guessCategory(d: { result?: string; formula?: string | null; category?: MasteryCategory }): MasteryCategory {
  if (d.category) return d.category
  const text = `${d.result ?? ''} ${d.formula ?? ''}`.toLowerCase()
  if (/(carbon|methane|ethanol|glucose|organic|ch4|c2h|c6h)/.test(text)) return 'organic'
  if (/(sodium|iron|metal|alloy|na|fe|cu|al)/.test(text)) return 'metals'
  if (/(gas|oxygen|hydrogen|nitrogen|co2|o2|h2|n2)/.test(text)) return 'gases'
  if (/(protein|dna|cell|bio|life)/.test(text)) return 'biology'
  if (/(energy|plasma|battery|fuel|heat)/.test(text)) return 'energy'
  if (/(plastic|cement|steel|glass|industrial)/.test(text)) return 'industrial'
  return 'inorganic'
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
