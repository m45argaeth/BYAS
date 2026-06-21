import type { Discovery, Stats } from './types'
import { discoveryKey } from './localize'

// Kunci localStorage dipakai bareng antar halaman.
export const INV_KEY = 'byas_inventory'
export const MIMO_KEY = 'byas_mimo_key'
export const DISCOVERIES_KEY = 'byas_discoveries'
export const STATS_KEY = 'byas_stats'

const EMPTY_STATS: Stats = {
  currentStreak: 0,
  bestStreak: 0,
  lastPlayed: null,
  displayName: null,
}

export function loadDiscoveries(): Discovery[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DISCOVERIES_KEY)
    return raw ? (JSON.parse(raw) as Discovery[]) : []
  } catch {
    return []
  }
}

// Simpan penemuan baru. Dedup berdasarkan identitas bahan (bukan nama hasil yang
// bisa berbeda antar bahasa). Return true kalau benar-benar baru.
export function saveDiscovery(d: Discovery): boolean {
  if (typeof window === 'undefined') return false
  try {
    const all = loadDiscoveries()
    const key = discoveryKey(d)
    if (all.some((x) => discoveryKey(x) === key)) return false
    all.push(d)
    localStorage.setItem(DISCOVERIES_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

// Timpa seluruh koleksi lokal (dipakai setelah sync dengan cloud).
export function saveAllDiscoveries(ds: Discovery[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DISCOVERIES_KEY, JSON.stringify(ds))
  } catch {}
}

export function loadStats(): Stats {
  if (typeof window === 'undefined') return { ...EMPTY_STATS }
  try {
    const raw = localStorage.getItem(STATS_KEY)
    return raw ? { ...EMPTY_STATS, ...(JSON.parse(raw) as Stats) } : { ...EMPTY_STATS }
  } catch {
    return { ...EMPTY_STATS }
  }
}

export function saveStats(s: Stats): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s))
  } catch {}
}
