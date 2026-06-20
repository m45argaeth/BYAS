// System API keys from env (comma-separated), with simple rotation + rate-limit cooldown.
const SYSTEM_KEYS = (process.env.MIMO_KEYS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const COOLDOWN_MS = 60_000
const cooldown = new Map<string, number>()

export function markRateLimited(key: string): void {
  cooldown.set(key, Date.now() + COOLDOWN_MS)
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

function availableSystemKeys(): string[] {
  const now = Date.now()
  const avail = SYSTEM_KEYS.filter((k) => (cooldown.get(k) ?? 0) < now)
  return avail.length ? avail : SYSTEM_KEYS
}

export function pickSystemKey(): string | undefined {
  return shuffle(availableSystemKeys())[0]
}

// Returns the ordered list of keys to try. BYOK (player key) takes priority and is used alone.
export function resolveKeys(playerKey?: string): string[] {
  if (playerKey) return [playerKey]
  return shuffle(availableSystemKeys())
}
