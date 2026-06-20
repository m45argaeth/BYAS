import { getSupabaseAdmin } from './supabase'
import type { CombineResult, Rarity } from './types'

// Build a stable, order-independent key for a pair of element ids.
export function makeInputKey(parts: string[]): string {
  return parts
    .map((p) => p.trim().toLowerCase())
    .sort()
    .join('+')
}

export async function getCachedCombo(inputKey: string): Promise<CombineResult | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('combinations')
      .select('result, formula, emoji, explanation, fun_fact, rarity, reacted')
      .eq('input_key', inputKey)
      .maybeSingle()
    if (error || !data) return null
    return {
      result: data.result,
      formula: data.formula ?? null,
      emoji: data.emoji ?? '✨',
      explanation: data.explanation ?? '',
      fun_fact: data.fun_fact ?? '',
      rarity: (data.rarity ?? 'common') as Rarity,
      reacted: data.reacted !== false,
    }
  } catch {
    return null
  }
}

export async function saveCombo(inputKey: string, r: CombineResult): Promise<void> {
  const sb = getSupabaseAdmin()
  if (!sb) return
  try {
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
  } catch {
    // ignore cache write failures
  }
}
