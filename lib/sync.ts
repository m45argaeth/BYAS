import type { Discovery, Stats } from './types'
import { loadDiscoveries, saveAllDiscoveries, loadStats, saveStats } from './storage'
import { totalXpFromDiscoveries } from './progress'
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

function mergeStats(a: Stats, b: Stats | null): Stats {
  if (!b) return a
  const bestStreak = Math.max(a.bestStreak, b.bestStreak)
  // Streak dari sumber dengan lastPlayed paling baru.
  let base = a
  if (!a.lastPlayed) base = b
  else if (b.lastPlayed && b.lastPlayed > a.lastPlayed) base = b
  return {
    currentStreak: base.currentStreak,
    bestStreak,
    lastPlayed: base.lastPlayed,
    displayName: a.displayName ?? b.displayName ?? null,
  }
}

export async function syncStats(userId: string): Promise<Stats> {
  const local = loadStats()
  const cloud = await pullStats(userId)
  const merged = mergeStats(local, cloud)
  saveStats(merged)
  await pushStats(userId, merged, totalXpFromDiscoveries(loadDiscoveries()))
  return merged
}
