import { getSupabaseAdmin } from './supabase'
import type { CombineResult, Lang, LocalizedText, MasteryCategory, Rarity } from './types'

// Source-of-truth lookup: cek pasangan di tabel `recipes` yang sudah di-generate
// offline (byas-gen). Kalau ketemu -> hasil instan, gratis, deterministik.
// Kalau miss -> kembalikan null supaya route jatuh ke cache lama lalu Mimo.

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
function safeRarity(value: unknown): Rarity {
  return RARITIES.includes(value as Rarity) ? (value as Rarity) : 'common'
}

// DB menyimpan `domain` bebas (ratusan nilai), bukan 8 kategori game. Petakan via
// tier -> MasteryCategory (best-fit) supaya konsisten dengan UI mastery.
const TIER_CATEGORY: MasteryCategory[] = [
  'chemistry',    // 1  Atoms
  'chemistry',    // 2  Molecules
  'materials',    // 3  Materials
  'geology',      // 4  Environment
  'chemistry',    // 5  Organic Chemistry
  'biology',      // 6  Life
  'biology',      // 7  Intelligence
  'knowledge',    // 8  Knowledge
  'technology',   // 9  Tools
  'civilization', // 10 Agriculture
  'civilization', // 11 Settlements
  'technology',   // 12 Industry
  'technology',   // 13 Technology
  'civilization', // 14 Civilization
  'space',        // 15 Space Age
]

// Game pakai id SIMBOL untuk 8 starter (H, O, ...), DB pakai slug nama lengkap.
// Jembatani keduanya di sini.
const STARTER_ID_MAP: Record<string, string> = {
  h: 'hydrogen', o: 'oxygen', c: 'carbon', n: 'nitrogen',
  si: 'silicon', fe: 'iron', s: 'sulfur', p: 'phosphorus',
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// Normalisasi id runtime -> id-space DB.
function toDbId(id: string): string {
  const k = id.trim().toLowerCase()
  return STARTER_ID_MAP[k] || slug(id)
}

export async function lookupRecipe(aId: string, bId: string): Promise<CombineResult | null> {
  const db = getSupabaseAdmin()
  if (!db) return null
  try {
    // recipes PK = pasangan tak-berurut yang sudah di-sort saat import.
    const [a, b] = [toDbId(aId), toDbId(bId)].sort()
    const { data: rec, error: e1 } = await db
      .from('recipes')
      .select('output_id')
      .eq('input_a_id', a)
      .eq('input_b_id', b)
      .maybeSingle()
    if (e1 || !rec?.output_id) return null

    const { data: disc, error: e2 } = await db
      .from('discoveries')
      .select('id, name_en, emoji, tier, rarity, explanation, fun_fact')
      .eq('id', rec.output_id)
      .single()
    if (e2 || !disc) return null

    const { data: i18nRows } = await db
      .from('discovery_i18n')
      .select('lang, name, explanation, fun_fact')
      .eq('discovery_id', disc.id)

    const byLang: Record<string, { name?: string; explanation?: string; fun_fact?: string }> = {}
    for (const r of i18nRows || []) byLang[(r as { lang: string }).lang] = r

    // Catatan jujur: generator hanya mengisi explanation/fun_fact dalam EN.
    // Baris id/cn hanya punya `name`; teksnya di-fallback ke kosong.
    const mk = (lang: Lang): LocalizedText => {
      const row = byLang[lang]
      return {
        result: row?.name || disc.name_en,
        explanation: row?.explanation || (lang === 'en' ? disc.explanation : '') || '',
        fun_fact: row?.fun_fact || (lang === 'en' ? disc.fun_fact : '') || '',
      }
    }
    const i18n: Record<Lang, LocalizedText> = { id: mk('id'), en: mk('en'), cn: mk('cn') }
    const tier = Number(disc.tier) || 1

    return {
      result: i18n.en.result,
      formula: null, // generator tidak menyimpan rumus kimia
      emoji: disc.emoji || '\u2728',
      explanation: i18n.en.explanation,
      fun_fact: i18n.en.fun_fact,
      rarity: safeRarity(disc.rarity),
      category: TIER_CATEGORY[tier - 1] || 'chemistry',
      tier,
      difficulty: Math.max(1, Math.min(5, Math.ceil(tier / 3))),
      ingredients: [aId, bId],
      reacted: true,
      i18n,
    }
  } catch {
    return null
  }
}
