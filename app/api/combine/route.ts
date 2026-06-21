import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { makeInputKey, getCachedCombo, saveComboLang } from '@/lib/cache'
import { resolveKeys, markRateLimited } from '@/lib/mimoKeys'
import type { CombineResult, Lang, LocalizedText, MasteryCategory, Rarity } from '@/lib/types'

export const runtime = 'nodejs'

const LANGS: Lang[] = ['id', 'en', 'cn']

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const CATEGORIES: MasteryCategory[] = ['organic', 'inorganic', 'metals', 'gases', 'biology', 'energy', 'industrial']

function safeRarity(value: unknown): Rarity {
  return RARITIES.includes(value as Rarity) ? (value as Rarity) : 'common'
}

function safeCategory(value: unknown): MasteryCategory {
  return CATEGORIES.includes(value as MasteryCategory) ? (value as MasteryCategory) : 'inorganic'
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

  const schema = `{
  "emoji": "a single emoji that represents the result",
  "formula": "chemical formula, or null if not applicable",
  "rarity": "common | uncommon | rare | epic | legendary | mythic",
  "category": "organic | inorganic | metals | gases | biology | energy | industrial",
  "difficulty": 1,
  "reacted": true,
  "text": {
    "id": { "result": "...", "explanation": "...", "fun_fact": "...", "hint": "..." },
    "en": { "result": "...", "explanation": "...", "fun_fact": "...", "hint": "..." },
    "cn": { "result": "...", "explanation": "...", "fun_fact": "...", "hint": "..." }
  }
}`

  const prompt =
    'You are the chemistry engine for BYAS, a futuristic scientific discovery game.\n' +
    'The game should feel like Little Alchemy, but educational and grounded in chemistry.\n' +
    'Combine these two specimens:\n' +
    '- ' + aName + ' (' + aId + ')\n' +
    '- ' + bName + ' (' + bId + ')\n\n' +
    'Decide whether they realistically react, combine, form a known compound/material, or create a chemistry-inspired discovery.\n' +
    'Never present fictional chemistry as guaranteed real science. If it is game-inspired, say so briefly in the explanation.\n' +
    'Respond ONLY with a JSON object of this exact shape:\n' +
    schema + '\n' +
    'difficulty must be an integer from 1 to 5. Mythic should be very rare.\n' +
    'emoji, formula, rarity, category, difficulty and reacted are language-independent and must be identical regardless of language.\n' +
    'Inside "text", write result, explanation, fun_fact and hint THREE times: "id" in Bahasa Indonesia, "en" in English, "cn" in Simplified Chinese (简体中文). Keep the meaning identical across all three languages; only the language differs.\n' +
    'If they do not react or it makes no sense, set "reacted" to false and still give a short explanation in all three languages.'

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
        difficulty,
        hint: canonical.hint,
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
            difficulty,
            hint: texts[l].hint,
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
