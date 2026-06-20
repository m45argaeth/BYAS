import type { Discovery } from './types'
import { loadDiscoveries, saveAllDiscoveries } from './storage'
import { pullCloudDiscoveries, pushManyCloudDiscoveries } from './cloud'

// Sync dua arah: gabung koleksi lokal + cloud, simpan ke lokal, dan push yang
// belum ada di cloud. Mengembalikan koleksi hasil merge.
export async function syncDiscoveries(userId: string): Promise<Discovery[]> {
  const local = loadDiscoveries()
  const cloud = await pullCloudDiscoveries(userId)

  const byKey = new Map<string, Discovery>()
  for (const d of [...cloud, ...local]) {
    const k = d.result.toLowerCase()
    const existing = byKey.get(k)
    // Pertahankan timestamp penemuan paling awal.
    if (!existing || d.discoveredAt < existing.discoveredAt) byKey.set(k, d)
  }
  const merged = [...byKey.values()]
  saveAllDiscoveries(merged)

  const cloudKeys = new Set(cloud.map((d) => d.result.toLowerCase()))
  const localOnly = merged.filter((d) => !cloudKeys.has(d.result.toLowerCase()))
  if (localOnly.length) await pushManyCloudDiscoveries(userId, localOnly)

  return merged
}
