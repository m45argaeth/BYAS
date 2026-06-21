import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { makeInputKey, getCachedCombo, saveComboLang } from '@/lib/cache'
import { resolveKeys, markRateLimited } from '@/lib/mimoKeys'
import type { CombineResult, Lang, LocalizedText, MasteryCategory, Rarity } from '@/lib/types'

export const runtime = 'nodejs'

const LANGS: Lang[] = ['id', 'en', 'cn']

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const CATEGORIES: MasteryCategory[] = ['chemistry', 'materials', 'geology', 'biology', 'knowledge', 'technology', 'civilization', 'space']

function safeRarity(value: unknown): Rarity {
  return RARITIES.includes(value as Rarity) ? (value as Rarity) : 'common'
}

function safeCategory(value: unknown): MasteryCategory {
  return CATEGORIES.includes(value as MasteryCategory) ? (value as MasteryCategory) : 'chemistry'
}

function safeTier(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(15, Math.round(n)))
}

function str(v: unknown, fb = ''): string {
  return v === undefined || v === null ? fb : String(v)
}

function pickText(obj: unknown): LocalizedText {
  const o = (obj && typeof obj === 'object' ? obj : {}) as Record<string, unknown>
  return {
    result: str(o.result),
    explanation: str(o.explanation),
    fun_fact: str(o.fun_fact),
    hint: o.hint ? String(o.hint) : undefined,
    progression: o.progression ? String(o.progression) : undefined,
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {}

  const aId = String(body.aId ?? body.a ?? '').trim()
  const bId = String(body.bId ?? body.b ?? '').trim()
  const aName = String(body.aName ?? aId).trim()
  const bName = String(body.bName ?? bId).trim()
  if (!aId || !bId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const baseKey = makeInputKey([aId, bId])
  const cached = await getCachedCombo(baseKey)
  if (cached) return NextResponse.json(cached)

  const playerKey = req.headers.get('x-mimo-key') || undefined
  const keys = resolveKeys(playerKey)
  if (!keys.length) {
    return NextResponse.json({ error: playerKey ? 'invalid_player_key' : 'no_key' }, { status: 400 })
  }

  const selfCombo = aId.trim().toLowerCase() === bId.trim().toLowerCase()

  const schema = `{
  "emoji": "a single emoji that represents the result",
  "formula": "chemical formula if it is a real molecule/compound, otherwise null",
  "rarity": "common | uncommon | rare | epic | legendary | mythic",
  "category": "chemistry | materials | geology | biology | knowledge | technology | civilization | space",
  "tier": 1,
  "difficulty": 1,
  "reacted": true,
  "text": {
    "id": { "result": "...", "explanation": "...", "progression": "...", "fun_fact": "...", "hint": "..." },
    "en": { "result": "...", "explanation": "...", "progression": "...", "fun_fact": "...", "hint": "..." },
    "cn": { "result": "...", "explanation": "...", "progression": "...", "fun_fact": "...", "hint": "..." }
  }
}`

  const prompt =
    'You are the core discovery engine for BYAS (Bring Your Alchemy Skill).\n' +
    'Your purpose is NOT to simulate chemistry. Your purpose is to generate meaningful scientific discoveries that let players progress from 8 fundamental elements (H, O, C, N, Si, Fe, S, P) all the way to civilization and the space age.\n' +
    'The game should feel like Little Alchemy, Infinite Craft, and a Scientific Discovery Simulator, while staying grounded in science whenever possible.\n\n' +
    'CORE PHILOSOPHY: never ask "what is the most chemically accurate result?". Instead ask "what discovery best advances the player\'s understanding and progression?". The game is discovery-first, science-inspired, educational, and progression-focused. It is NOT a chemistry simulator, academic database, or compound encyclopedia.\n\n' +
    'PRIORITY ORDER when picking a result: 1) Discovery value, 2) Progression value, 3) Educational value, 4) Scientific accuracy. Accuracy supports gameplay and must never create boring dead ends.\n\n' +
    'Combine these two specimens (treat A+B exactly the same as B+A):\n' +
    '- ' + aName + ' (' + aId + ')\n' +
    '- ' + bName + ' (' + bId + ')\n\n' +
    (selfCombo
      ? 'SELF-COMBINATION: this is A + A. Self-combinations are valid and encouraged when they progress (e.g. H+H -> Hydrogen Gas, O+O -> Oxygen Gas, N+N -> Nitrogen Gas, Amino Acid+Amino Acid -> Peptide, Cell+Cell -> Tissue, Village+Village -> Town, Knowledge+Knowledge -> Science, Science+Science -> Research, Technology+Technology -> Advanced Technology, Rocket+Rocket -> Space Program). Only set reacted=false if doubling truly yields no meaningful progression.\n\n'
      : '') +
    'DISCOVERY CATEGORIES (pick the single best fit for "category"): chemistry (molecule, compound, acid, base, gas), materials (sand, glass, metal, alloy, ceramic, semiconductor, polymer), geology (rock, soil, mineral, volcano, mountain), biology (amino acid, protein, DNA, RNA, cell, tissue, organ, plant, animal, human), knowledge (observation, measurement, knowledge, science, mathematics, research), technology (tool, agriculture, writing, engineering, industry, electricity, electronics, computing, AI), civilization (settlement, village, town, city, government, trade, economy, nation), space (rocket, satellite, space station, fusion, colony, interplanetary travel, interstellar travel).\n\n' +
    'PROGRESSION TIERS for "tier" (1-15): 1 Elements, 2 Molecules, 3 Materials, 4 Environment, 5 Organic Chemistry, 6 Life, 7 Intelligence, 8 Knowledge, 9 Tools, 10 Agriculture, 11 Settlements, 12 Industry, 13 Technology, 14 Civilization, 15 Space Age. Prefer results that move the player UPWARD in tier. The result tier should usually be >= the higher tier of the two inputs.\n\n' +
    'ANTI DEAD-END RULE: avoid obscure compounds unless they unlock progression. Bad: Water+Silica -> Silicic Acid. Good: Water+Silica -> Sand (sand -> glass -> optics -> microscope -> biology -> medicine).\n' +
    'CHAIN POTENTIAL RULE: every discovery should unlock at least 2 plausible future combinations. Prefer broadly useful results (e.g. Glass) over one-time dead ends.\n' +
    'HUMAN KNOWLEDGE RULE: once Human exists, abstract concepts unlock (Human+Observation -> Knowledge, Knowledge+Knowledge -> Science, Science+Measurement -> Mathematics, Research+Engineering -> Innovation, Innovation+Technology -> Advanced Technology).\n' +
    'SCALE-UP RULE: scaling is valid progression (Cell -> Tissue -> Organ -> Organism; Settlement -> Village -> Town -> City -> Metropolis; Knowledge -> Science -> Research -> Innovation; Rocket -> Space Program -> Space Agency -> Spaceflight).\n' +
    'REALISM RULE: prefer real science, but if strict chemistry blocks progression choose the scientifically-inspired discovery instead (e.g. accept Water+Silicon -> Sand). Only reject when the result would be scientifically absurd.\n' +
    'SPACE AGE RULE: late-game combinations should be able to reach Rocket, Satellite, Orbital Station, Fusion Energy, Planetary Colony, Terraforming, and interplanetary/interstellar travel, all traceable back to the 8 starting elements.\n\n' +
    'Set "formula" to a real chemical formula ONLY when the result is an actual molecule/compound; otherwise use null (most materials, life, knowledge, civilization and space results have null formula). Rarer, higher-tier, more transformative discoveries should get higher rarity; mythic should be very rare. "difficulty" is an integer 1-5.\n\n' +
    'Respond ONLY with a JSON object of this exact shape:\n' + schema + '\n\n' +
    'emoji, formula, rarity, category, tier, difficulty and reacted are language-independent and must be identical regardless of language.\n' +
    'Inside "text", write the fields THREE times: "id" in Bahasa Indonesia, "en" in English, "cn" in Simplified Chinese (\u7b80\u4f53\u4e2d\u6587). "result" is the discovery name, "explanation" is a short explanation, "progression" is one short sentence on why this discovery advances progression / what it unlocks next, "fun_fact" is a short fun fact, and "hint" nudges toward a good next combination. Keep meaning identical across languages; only the language differs.\n' +
    'If the combination genuinely has no meaningful discovery or progression, set "reacted" to false and still fill a short explanation in all three languages.'

  let lastStatus = 0
  for (const key of keys) {
    try {
      const client = new OpenAI({
        apiKey: key,
        baseURL: 'https://api.xiaomimimo.com/v1',
        defaultHeaders: { 'api-key': key },
      })
      const completion = await client.chat.completions.create({
        model: 'mimo-v2.5-pro',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.72,
      })
      const text = completion.choices[0]?.message?.content ?? '{}'
      const parsed = JSON.parse(text)
      const rarity = safeRarity(parsed.rarity)
      const category = safeCategory(parsed.category)
      const tier = safeTier(parsed.tier)
      const difficulty = Math.max(1, Math.min(5, Number(parsed.difficulty ?? 1)))
      const reacted = parsed.reacted !== false
      const formula = parsed.formula ? String(parsed.formula) : null
      const emoji = String(parsed.emoji ?? '✨')

      const raw = (parsed.text && typeof parsed.text === 'object' ? parsed.text : {}) as Record<string, unknown>
      const texts: Record<Lang, LocalizedText> = {
        id: pickText(raw.id),
        en: pickText(raw.en),
        cn: pickText(raw.cn),
      }
      // Back-fill any missing language so the client always has all three.
      const fallback = texts.en.result ? texts.en : texts.id.result ? texts.id : texts.cn
      for (const l of LANGS) {
        if (!texts[l].result) texts[l] = { ...fallback }
      }
      const canonical = texts.en.result ? texts.en : fallback

      const result: CombineResult = {
        result: canonical.result || 'Unknown Discovery',
        formula,
        emoji,
        explanation: canonical.explanation,
        fun_fact: canonical.fun_fact,
        rarity,
        category,
        tier,
        difficulty,
        hint: canonical.hint,
        progression: canonical.progression,
        ingredients: [aId, bId],
        reacted,
        i18n: texts,
      }

      if (reacted) {
        for (const l of LANGS) {
          await saveComboLang(baseKey, l, {
            result: texts[l].result,
            formula,
            emoji,
            explanation: texts[l].explanation,
            fun_fact: texts[l].fun_fact,
            rarity,
            reacted,
            category,
            tier,
            difficulty,
            hint: texts[l].hint,
            progression: texts[l].progression,
            ingredients: [aId, bId],
          }).catch(() => {})
        }
      }
      return NextResponse.json(result)
    } catch (e: unknown) {
      const err = e as { status?: number; statusCode?: number }
      lastStatus = err?.status ?? err?.statusCode ?? 0
      if (lastStatus === 429) {
        markRateLimited(key)
        continue
      }
      if (lastStatus === 401 && playerKey) {
        return NextResponse.json({ error: 'invalid_player_key' }, { status: 400 })
      }
      continue
    }
  }
  return NextResponse.json({ error: 'all_keys_failed', status: lastStatus }, { status: 503 })
}
