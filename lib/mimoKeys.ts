// System-side Mimo API key rotation with simple rate-limit cooldown.
// Player BYOK key always takes priority over system keys.

const rateLimited = new Map<string, number>()
const COOLDOWN_MS = 60_000

export function markRateLimited(key: string) {
  rateLimited.set(key, Date.now() + COOLDOWN_MS)
}

function isAvailable(key: string): boolean {
  const until = rateLimited.get(key)
  if (!until) return true
  if (Date.now() > until) {
    rateLimited.delete(key)
    return true
  }
  return false
}

function systemKeys(): string[] {
  const raw = process.env.MIMO_KEYS || ''
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

export function resolveKeys(playerKey?: string): string[] {
  if (playerKey && playerKey.trim()) return [playerKey.trim()]
  const all = systemKeys()
  const available = all.filter(isAvailable)
  const pool = available.length ? available : all
  return shuffle(pool)
}
