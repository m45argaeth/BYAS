import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { makeInputKey, getCachedCombo, saveCombo } from '@/lib/cache'
import { resolveKeys, markRateLimited } from '@/lib/mimoKeys'
import type { CombineResult, MasteryCategory, Rarity } from '@/lib/types'
import { XP_BY_RARITY } from '@/lib/progress'

export const runtime = 'nodejs'

const LANG_NAME: Record<string, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
  cn: 'Simplified Chinese (简体中文)',
}

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const CATEGORIES: MasteryCategory[] = ['organic', 'inorganic', 'metals', 'gases', 'biology', 'energy', 'industrial']

function safeRarity(value: unknown): Rarity {
  return RARITIES.includes(value as Rarity) ? (value as Rarity) : 'common'
}

function safeCategory(value: unknown): MasteryCategory {
  return CATEGORIES.includes(value as MasteryCategory) ? (value as MasteryCategory) : 'inorganic'
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
  const langRaw = String(body.lang ?? 'id')
  const lang = (['id', 'en', 'cn'].includes(langRaw) ? langRaw : 'id') as 'id' | 'en' | 'cn'
  if (!aId || !bId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const inputKey = makeInputKey([aId, bId]) + ':' + lang
  const cached = await getCachedCombo(inputKey)
  if (cached) return NextResponse.json(cached)

  const playerKey = req.headers.get('x-mimo-key') || undefined
  const keys = resolveKeys(playerKey)
  if (!keys.length) {
    return NextResponse.json({ error: playerKey ? 'invalid_player_key' : 'no_key' }, { status: 400 })
  }

  const schema = `{
  "result": "short name of the resulting element, compound, material, or discovery",
  "formula": "chemical formula, or null if not applicable",
  "emoji": "a single emoji that represents the result",
  "explanation": "1-2 sentence explanation; clearly say if this is a real reaction or a game-inspired combination",
  "fun_fact": "one short educational chemistry fact",
  "rarity": "common | uncommon | rare | epic | legendary | mythic",
  "category": "organic | inorganic | metals | gases | biology | energy | industrial",
  "difficulty": 1,
  "hint": "a non-spoiler hint for finding this discovery later",
  "reacted": true or false
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
    'If they do not react or it makes no sense, set "reacted" to false and still give a short explanation.\n' +
    'Write result, explanation, fun_fact, and hint in ' + LANG_NAME[lang] + '.'

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
      const difficulty = Math.max(1, Math.min(5, Number(parsed.difficulty ?? 1)))
      const result: CombineResult = {
        result: String(parsed.result ?? 'Unknown Discovery'),
        formula: parsed.formula ? String(parsed.formula) : null,
        emoji: String(parsed.emoji ?? '✨'),
        explanation: String(parsed.explanation ?? ''),
        fun_fact: String(parsed.fun_fact ?? ''),
        rarity,
        category: safeCategory(parsed.category),
        difficulty,
        hint: parsed.hint ? String(parsed.hint) : undefined,
        ingredients: [aId, bId],
        reacted: parsed.reacted !== false,
      }
      if (result.reacted) await saveCombo(inputKey, { ...result, xp: XP_BY_RARITY[rarity] }).catch(() => {})
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
