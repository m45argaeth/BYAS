// SERVER ONLY. Jangan pernah import file ini dari komponen client.
const SYSTEM_KEYS = (process.env.MIMO_KEYS ?? '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean)

// key -> timestamp (ms) kapan key boleh dipakai lagi setelah kena rate limit.
const cooldown = new Map<string, number>()

function pickSystemKey(): string | null {
  const now = Date.now()
  const available = SYSTEM_KEYS.filter((k) => (cooldown.get(k) ?? 0) <= now)
  const pool = available.length ? available : SYSTEM_KEYS
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

export function markRateLimited(key: string, ms = 60_000): void {
  cooldown.set(key, Date.now() + ms)
}

// BYOK: kalau pemain punya key sendiri, pakai itu TANPA fallback ke sistem.
// Kalau nggak, kembalikan semua key sistem terurut (rotasi) buat dicoba sampai sukses.
export function resolveKeys(playerKey?: string): string[] {
  if (playerKey && playerKey.startsWith('sk-')) return [playerKey]
  const first = pickSystemKey()
  if (!first) return []
  return [first, ...SYSTEM_KEYS.filter((k) => k !== first)]
}
