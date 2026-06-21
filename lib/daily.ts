import type { Discovery, Rarity, Stats } from './types'
import { todayStr } from './progress'

export interface DailyChallenge {
  id: string // date string, e.g. 2026-06-21
  kind: 'element' | 'rarity' | 'any'
  param: string
  target: number
  titleKey: string
  descKey: string
  vars: Record<string, string | number>
  rewardXp: number
  rewardCoins: number
  rewardHints: number
}

const ELEMENT_POOL = [
  { sym: 'O', label: 'Oxygen' },
  { sym: 'H', label: 'Hydrogen' },
  { sym: 'C', label: 'Carbon' },
  { sym: 'N', label: 'Nitrogen' },
  { sym: 'Na', label: 'Sodium' },
  { sym: 'S', label: 'Sulfur' },
]

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function getDailyChallenge(dateStr: string = todayStr()): DailyChallenge {
  const seed = hashSeed(dateStr)
  const kindRoll = seed % 3
  if (kindRoll === 0) {
    const el = ELEMENT_POOL[seed % ELEMENT_POOL.length]
    const target = 2 + (seed % 2) // 2-3
    return {
      id: dateStr,
      kind: 'element',
      param: el.sym,
      target,
      titleKey: 'daily.elemTitle',
      descKey: 'daily.elemDesc',
      vars: { n: target, el: el.label, sym: el.sym },
      rewardXp: 80,
      rewardCoins: 25,
      rewardHints: 1,
    }
  }
  if (kindRoll === 1) {
    const rarities: Rarity[] = ['uncommon', 'rare', 'epic']
    const r = rarities[seed % rarities.length]
    return {
      id: dateStr,
      kind: 'rarity',
      param: r,
      target: 1,
      titleKey: 'daily.rarityTitle',
      descKey: 'daily.rarityDesc',
      vars: { n: 1, r },
      rewardXp: 100,
      rewardCoins: 30,
      rewardHints: 1,
    }
  }
  const target = 3 + (seed % 3) // 3-5
  return {
    id: dateStr,
    kind: 'any',
    param: '',
    target,
    titleKey: 'daily.anyTitle',
    descKey: 'daily.anyDesc',
    vars: { n: target },
    rewardXp: 70,
    rewardCoins: 20,
    rewardHints: 1,
  }
}

// Cek apakah formula mengandung simbol unsur tertentu (disambiguasi unsur 2 huruf).
function formulaHasElement(formula: string | null | undefined, sym: string): boolean {
  if (!formula) return false
  return new RegExp(sym + '(?![a-z])').test(formula)
}

function discoveredOn(d: Discovery, dateStr: string): boolean {
  const ds = new Date(d.discoveredAt)
  const m = String(ds.getMonth() + 1).padStart(2, '0')
  const day = String(ds.getDate()).padStart(2, '0')
  return `${ds.getFullYear()}-${m}-${day}` === dateStr
}

export function dailyProgress(ch: DailyChallenge, discoveries: Discovery[], dateStr: string = todayStr()): number {
  const today = discoveries.filter((d) => discoveredOn(d, dateStr))
  let n = 0
  for (const d of today) {
    if (ch.kind === 'element' && formulaHasElement(d.formula, ch.param)) n++
    else if (ch.kind === 'rarity' && d.rarity === ch.param) n++
    else if (ch.kind === 'any') n++
  }
  return Math.min(ch.target, n)
}

export function isDailyComplete(ch: DailyChallenge, discoveries: Discovery[]): boolean {
  return dailyProgress(ch, discoveries) >= ch.target
}

export function isDailyClaimed(ch: DailyChallenge, stats: Stats): boolean {
  return (stats.completedDailyChallenges ?? []).includes(ch.id)
}
