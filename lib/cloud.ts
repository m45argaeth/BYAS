import type { Discovery } from './types'
import { getSupabaseBrowser } from './supabaseBrowser'

const COLS = 'result, formula, emoji, explanation, fun_fact, rarity, discovered_at'

function toRow(userId: string, d: Discovery) {
  return {
    user_id: userId,
    result: d.result,
    formula: d.formula,
    emoji: d.emoji,
    explanation: d.explanation,
    fun_fact: d.fun_fact,
    rarity: d.rarity,
    discovered_at: new Date(d.discoveredAt).toISOString(),
  }
}

export async function pullCloudDiscoveries(userId: string): Promise<Discovery[]> {
  const sb = getSupabaseBrowser()
  if (!sb) return []
  const { data, error } = await sb.from('user_discoveries').select(COLS).eq('user_id', userId)
  if (error || !data) return []
  return data.map((r: any) => ({
    result: r.result,
    formula: r.formula ?? null,
    emoji: r.emoji ?? '✨',
    explanation: r.explanation ?? '',
    fun_fact: r.fun_fact ?? '',
    rarity: r.rarity ?? 'common',
    reacted: true,
    discoveredAt: r.discovered_at ? new Date(r.discovered_at).getTime() : Date.now(),
  }))
}

export async function pushCloudDiscovery(userId: string, d: Discovery): Promise<void> {
  const sb = getSupabaseBrowser()
  if (!sb) return
  await sb.from('user_discoveries').upsert(toRow(userId, d), { onConflict: 'user_id,result' })
}

export async function pushManyCloudDiscoveries(userId: string, ds: Discovery[]): Promise<void> {
  const sb = getSupabaseBrowser()
  if (!sb || !ds.length) return
  await sb.from('user_discoveries').upsert(
    ds.map((d) => toRow(userId, d)),
    { onConflict: 'user_id,result' },
  )
}
