import type { Discovery } from './types'

// Kunci localStorage dipakai bareng antar halaman.
export const INV_KEY = 'byas_inventory'
export const MIMO_KEY = 'byas_mimo_key'
export const DISCOVERIES_KEY = 'byas_discoveries'

export function loadDiscoveries(): Discovery[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DISCOVERIES_KEY)
    return raw ? (JSON.parse(raw) as Discovery[]) : []
  } catch {
    return []
  }
}

// Simpan penemuan baru (dedup berdasarkan nama hasil). Return true kalau benar-benar baru.
export function saveDiscovery(d: Discovery): boolean {
  if (typeof window === 'undefined') return false
  try {
    const all = loadDiscoveries()
    if (all.some((x) => x.result.toLowerCase() === d.result.toLowerCase())) return false
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
