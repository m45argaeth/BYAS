import { getSupabaseAdmin } from './supabase'
import type { CombineResult, Lang, LocalizedText, MasteryCategory, Rarity } from './types'

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const CATEGORIES: MasteryCategory[] = ['organic', 'inorganic', 'metals', 'gases', 'biology', 'energy', 'industrial']
const LANGS: Lang[] = ['id', 'en', 'cn']

function safeRarity(value: unknown): Rarity {
  return RARITIES.includes(value as Rarity) ? (value as Rarity) : 'common'
}

function safeCategory(value: unknown): MasteryCategory | undefined {
  return CATEGORIES.includes(value as MasteryCategory) ? (value as MasteryCategory) : undefined
}

// Build a stable, order-independent base key for a pair of element ids.
// Each language is stored as a separate row keyed `${baseKey}:${lang}`.
export function makeInputKey(parts: string[]): string {
  return parts
    .map((p) => p.trim().toLowerCase())
    .sort()
    .join('+')
}

// Returns a fully multilingual combo only when ALL languages are cached.
// Otherwise null, so the route regenerates and back-fills every language.
export async function getCachedCombo(baseKey: string): Promise<CombineResult | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  try {
    const keys = LANGS.map((l) => `${baseKey}:${l}`)
    const { data, error } = await sb
      .from('combinations')
      .select('input_key, result, formula, emoji, explanation, fun_fact, rarity, reacted, category, difficulty, hint, ingredients')
      .in('input_key', keys)
    if (error || !data) return null
    const byLang: Record<string, any> = {}
    for (const row of data) {
      const lang = String(row.input_key).split(':').pop() as string
      byLang[lang] = row
    }
    if (!LANGS.every((l) => byLang[l])) return null
    const base = byLang.en ?? byLang.id ?? data[0]
    const i18n: Partial<Record<Lang, LocalizedText>> = {}
    for (const l of LANGS) {
      const r = byLang[l]
      i18n[l] = {
        result: r.result,
        explanation: r.explanation ?? '',
        fun_fact: r.fun_fact ?? '',
        hint: r.hint ?? undefined,
      }
    }
    return {
      result: base.result,
      formula: base.formula ?? null,
      emoji: base.emoji ?? '✨',
      explanation: base.explanation ?? '',
      fun_fact: base.fun_fact ?? '',
      rarity: safeRarity(base.rarity),
      category: safeCategory(base.category),
      difficulty: base.difficulty ?? undefined,
      hint: base.hint ?? undefined,
      ingredients: Array.isArray(base.ingredients) ? base.ingredients : undefined,
      reacted: base.reacted !== false,
      i18n,
    }
  } catch {
    return null
  }
}

export interface ComboLangRow {
  result: string
  formula: string | null
  emoji: string
  explanation: string
  fun_fact: string
  rarity: Rarity
  reacted: boolean
  category?: MasteryCategory
  difficulty?: number
  hint?: string
  ingredients?: string[]
}

// Save one language row for a combo. Called once per language so the next lookup
// is an instant cache hit in every language.
export async function saveComboLang(baseKey: string, lang: Lang, r: ComboLangRow): Promise<void> {
  const sb = getSupabaseAdmin()
  if (!sb) return
  try {
    await sb.from('combinations').upsert(
      {
        input_key: `${baseKey}:${lang}`,
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
