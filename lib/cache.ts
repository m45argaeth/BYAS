import { getSupabaseAdmin } from './supabase'
import type { CombineResult, MasteryCategory, Rarity } from './types'

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const CATEGORIES: MasteryCategory[] = ['organic', 'inorganic', 'metals', 'gases', 'biology', 'energy', 'industrial']

function safeRarity(value: unknown): Rarity {
  return RARITIES.includes(value as Rarity) ? (value as Rarity) : 'common'
}

function safeCategory(value: unknown): MasteryCategory | undefined {
  return CATEGORIES.includes(value as MasteryCategory) ? (value as MasteryCategory) : undefined
}

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
      .select('result, formula, emoji, explanation, fun_fact, rarity, reacted, category, difficulty, hint, ingredients')
      .eq('input_key', inputKey)
      .maybeSingle()
    if (error || !data) return null
    return {
      result: data.result,
      formula: data.formula ?? null,
      emoji: data.emoji ?? '✨',
      explanation: data.explanation ?? '',
      fun_fact: data.fun_fact ?? '',
      rarity: safeRarity(data.rarity),
      category: safeCategory(data.category),
      difficulty: data.difficulty ?? undefined,
      hint: data.hint ?? undefined,
      ingredients: Array.isArray(data.ingredients) ? data.ingredients : undefined,
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
        category: r.category,
        difficulty: r.difficulty,
        hint: r.hint,
        ingredients: r.ingredients ?? [],
      },
      { onConflict: 'input_key' },
    )
  } catch {
    // ignore cache write failures
  }
}
