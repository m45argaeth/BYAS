import { getSupabaseAdmin } from './supabase'
import type { CombineResult } from './types'

// Normalisasi pasangan elemen biar A+B dan B+A ketemu cache yang sama.
export function makeInputKey(a: string, b: string): string {
  return [a, b].map((s) => s.trim().toLowerCase()).sort().join('+')
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
  return data as CombineResult
}

export async function saveCombo(inputKey: string, data: CombineResult): Promise<void> {
  const sb = getSupabaseAdmin()
  if (!sb) return
  await sb.from('combinations').upsert(
    {
      input_key: inputKey,
      result: data.result,
      formula: data.formula,
      emoji: data.emoji,
      explanation: data.explanation,
      fun_fact: data.fun_fact,
      rarity: data.rarity,
      reacted: data.reacted,
    },
    { onConflict: 'input_key' },
  )
}
