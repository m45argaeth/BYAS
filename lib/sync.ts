import type { Discovery, Stats } from './types'
import { loadDiscoveries, saveAllDiscoveries, loadStats, saveStats } from './storage'
import { totalXp } from './progress'
import {
  pullCloudDiscoveries,
  pushManyCloudDiscoveries,
  pullStats,
  pushStats,
} from './cloud'

// Sync dua arah koleksi: gabung lokal + cloud, simpan ke lokal, push yang baru.
export async function syncDiscoveries(userId: string): Promise<Discovery[]> {
  const local = loadDiscoveries()
  const cloud = await pullCloudDiscoveries(userId)

  const byKey = new Map<string, Discovery>()
  for (const d of [...cloud, ...local]) {
    const k = d.result.toLowerCase()
    const existing = byKey.get(k)
    if (!existing || d.discoveredAt < existing.discoveredAt) byKey.set(k, d)
  }
  const merged = [...byKey.values()]
  saveAllDiscoveries(merged)

  const cloudKeys = new Set(cloud.map((d) => d.result.toLowerCase()))
  const localOnly = merged.filter((d) => !cloudKeys.has(d.result.toLowerCase()))
  if (localOnly.length) await pushManyCloudDiscoveries(userId, localOnly)

  return merged
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

// Gabung stats lokal + cloud tanpa membuang field apa pun.
// - Streak/lastPlayed diambil dari sumber dengan lastPlayed terbaru.
// - Numerik diambil nilai tertinggi (non-destruktif).
// - Array (daily/weekly/streak/mystery) digabung sebagai union.
function mergeStats(a: Stats, b: Stats | null): Stats {
  if (!b) return a
  let base = a
  if (!a.lastPlayed) base = b
  else if (b.lastPlayed && b.lastPlayed > a.lastPlayed) base = b
  return {
    currentStreak: base.currentStreak,
    bestStreak: Math.max(a.bestStreak ?? 0, b.bestStreak ?? 0),
    lastPlayed: base.lastPlayed,
    displayName: a.displayName ?? b.displayName ?? null,
    totalXp: Math.max(a.totalXp ?? 0, b.totalXp ?? 0),
    bonusXp: Math.max(a.bonusXp ?? 0, b.bonusXp ?? 0),
    coins: Math.max(a.coins ?? 0, b.coins ?? 0),
    hintTokens: Math.max(a.hintTokens ?? 0, b.hintTokens ?? 0),
    labReputation: Math.max(a.labReputation ?? 0, b.labReputation ?? 0),
    failedExperiments: Math.max(a.failedExperiments ?? 0, b.failedExperiments ?? 0),
    completedDailyChallenges: uniq([...(a.completedDailyChallenges ?? []), ...(b.completedDailyChallenges ?? [])]),
    completedWeeklyQuests: uniq([...(a.completedWeeklyQuests ?? []), ...(b.completedWeeklyQuests ?? [])]),
    claimedStreakRewards: uniq([...(a.claimedStreakRewards ?? []), ...(b.claimedStreakRewards ?? [])]),
    solvedMysteries: uniq([...(a.solvedMysteries ?? []), ...(b.solvedMysteries ?? [])]),
    mysteryHintsUsed: uniq([...(a.mysteryHintsUsed ?? []), ...(b.mysteryHintsUsed ?? [])]),
  }
}

export async function syncStats(userId: string): Promise<Stats> {
  const local = loadStats()
  const cloud = await pullStats(userId)
  const merged = mergeStats(local, cloud)
  saveStats(merged)
  await pushStats(userId, merged, totalXp(loadDiscoveries(), merged))
  return merged
}
