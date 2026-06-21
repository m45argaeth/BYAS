import type { Discovery, Stats } from './types'
import { guessCategory, todayStr } from './progress'

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function dateStrOf(ts: number): string {
  const ds = new Date(ts)
  const m = String(ds.getMonth() + 1).padStart(2, '0')
  const day = String(ds.getDate()).padStart(2, '0')
  return `${ds.getFullYear()}-${m}-${day}`
}

// Predikat pencocokan discovery untuk challenge/mystery.
function matchPredicate(d: Discovery, kind: string, param: string): boolean {
  if (kind === 'element') return new RegExp(param + '(?![a-z])').test(d.formula ?? '')
  if (kind === 'rarity') return d.rarity === param
  if (kind === 'category') return (d.category ?? guessCategory(d)) === param
  return false
}

// ===================== ISO Week =====================
export function weekId(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = Date.UTC(date.getUTCFullYear(), 0, 4)
  const week = 1 + Math.round((date.getTime() - firstThursday) / 86400000 / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function inCurrentWeek(ts: number): boolean {
  return weekId(new Date(ts)) === weekId()
}

// ===================== Weekly Quest =====================
export interface WeeklyQuest {
  id: string
  target: number
  rewardXp: number
  rewardCoins: number
  rewardHints: number
}

export function getWeeklyQuest(id: string = weekId()): WeeklyQuest {
  const seed = hashSeed(id)
  const target = 12 + (seed % 9) // 12-20 reaksi baru
  return { id, target, rewardXp: 300, rewardCoins: 120, rewardHints: 3 }
}

export function weeklyProgress(q: WeeklyQuest, discoveries: Discovery[]): number {
  return Math.min(q.target, discoveries.filter((d) => inCurrentWeek(d.discoveredAt)).length)
}

export function isWeeklyComplete(q: WeeklyQuest, discoveries: Discovery[]): boolean {
  return weeklyProgress(q, discoveries) >= q.target
}

export function isWeeklyClaimed(q: WeeklyQuest, stats: Stats): boolean {
  return (stats.completedWeeklyQuests ?? []).includes(q.id)
}

// ===================== Streak Ladder =====================
export interface StreakTier {
  days: number
  rewardXp: number
  rewardCoins: number
  rewardHints: number
}

export const STREAK_TIERS: StreakTier[] = [
  { days: 1, rewardXp: 20, rewardCoins: 10, rewardHints: 0 },
  { days: 3, rewardXp: 60, rewardCoins: 30, rewardHints: 1 },
  { days: 7, rewardXp: 150, rewardCoins: 80, rewardHints: 2 },
  { days: 14, rewardXp: 350, rewardCoins: 180, rewardHints: 3 },
  { days: 30, rewardXp: 800, rewardCoins: 400, rewardHints: 6 },
]

export function isStreakClaimed(days: number, stats: Stats): boolean {
  return (stats.claimedStreakRewards ?? []).includes(days)
}

export function isStreakReached(days: number, stats: Stats): boolean {
  return (stats.currentStreak ?? 0) >= days
}

// ===================== Mystery Research =====================
export interface Mystery {
  id: string
  riddleKey: string
  hintKey: string
  kind: 'element' | 'rarity' | 'category'
  param: string
  rewardXp: number
  rewardCoins: number
}

const MYSTERY_POOL: Array<Omit<Mystery, 'id' | 'rewardXp' | 'rewardCoins'>> = [
  { riddleKey: 'mystery.r1', hintKey: 'mystery.h1', kind: 'element', param: 'O' },
  { riddleKey: 'mystery.r2', hintKey: 'mystery.h2', kind: 'category', param: 'metals' },
  { riddleKey: 'mystery.r3', hintKey: 'mystery.h3', kind: 'element', param: 'C' },
  { riddleKey: 'mystery.r4', hintKey: 'mystery.h4', kind: 'element', param: 'N' },
  { riddleKey: 'mystery.r5', hintKey: 'mystery.h5', kind: 'category', param: 'gases' },
  { riddleKey: 'mystery.r6', hintKey: 'mystery.h6', kind: 'rarity', param: 'rare' },
]

export function getMystery(dateStr: string = todayStr()): Mystery {
  const seed = hashSeed('mystery-' + dateStr)
  const base = MYSTERY_POOL[seed % MYSTERY_POOL.length]
  return { ...base, id: dateStr, rewardXp: 120, rewardCoins: 50 }
}

export function isMysterySolved(m: Mystery, discoveries: Discovery[], dateStr: string = todayStr()): boolean {
  return discoveries.some((d) => dateStrOf(d.discoveredAt) === dateStr && matchPredicate(d, m.kind, m.param))
}

export function isMysteryClaimed(m: Mystery, stats: Stats): boolean {
  return (stats.solvedMysteries ?? []).includes(m.id)
}

export function isMysteryHintUsed(m: Mystery, stats: Stats): boolean {
  return (stats.mysteryHintsUsed ?? []).includes(m.id)
}
