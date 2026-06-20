import { getSupabaseAdmin } from './supabase'
import type { CombineResult } from './types'

// Canonical key for a pair of element ids (order-independent, case-insensitive).
export function makeInputKey(ids: string[]): string {
  return [...ids].map((s) => s.trim().toLowerCase()).sort().join('+')
}

export async function getCachedCombo(inputKey: string): Promise<CombineResult | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { data, error } = await sb
    .from('combinations')
    .select('result, formula, emoji, explanation, fun_fact, rarity, reacted')
    .eq('input_key', inputKey)
    .maybeSingle()
  if (error || !data) return null
  return data as unknown as CombineResult
}

export async function saveCombo(inputKey: string, r: CombineResult): Promise<void> {
  const sb = getSupabaseAdmin()
  if (!sb) return
  await sb.from('combinations').upsert(
    {
      input_key: inputKey,
      result: r.result,
      formula: r.formula,
      emoji: r.emoji,
      explanation: r.explanation,
      fun_fact: r.fun_fact,
      rarity: r.rarity,
      reacted: r.reacted,
    },
    { onConflict: 'input_key' },
  )
}
