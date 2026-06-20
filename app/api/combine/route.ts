import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { makeInputKey, getCachedCombo, saveCombo } from '@/lib/cache'
import { resolveKeys, markRateLimited } from '@/lib/mimoKeys'
import type { CombineResult, Rarity } from '@/lib/types'

export const runtime = 'nodejs'

const LANG_NAME: Record<string, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
  cn: 'Simplified Chinese (简体中文)',
}

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'legendary']

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

  // 1) cache
  const cached = await getCachedCombo(inputKey)
  if (cached) return NextResponse.json(cached)

  // 2) resolve keys: player BYOK header first, else system rotation
  const playerKey = req.headers.get('x-mimo-key') || undefined
  const keys = resolveKeys(playerKey)
  if (!keys.length) {
    return NextResponse.json({ error: playerKey ? 'invalid_player_key' : 'no_key' }, { status: 400 })
  }

  const schema =
    '{\n' +
    '  "result": "short name of the resulting element/compound/material",\n' +
    '  "formula": "chemical formula, or null if not applicable",\n' +
    '  "emoji": "a single emoji that represents the result",\n' +
    '  "explanation": "1-2 sentence explanation",\n' +
    '  "fun_fact": "one short fun fact",\n' +
    '  "rarity": "common | uncommon | rare | legendary",\n' +
    '  "reacted": true or false\n' +
    '}'

  const prompt =
    'You are a fun chemistry combination game engine, like Little Alchemy but using real chemistry.\n' +
    'Combine these two items:\n' +
    '- ' + aName + ' (' + aId + ')\n' +
    '- ' + bName + ' (' + bId + ')\n\n' +
    'Decide whether they realistically react or sensibly combine into something new. ' +
    'Respond ONLY with a JSON object of this exact shape:\n' +
    schema + '\n' +
    'If they do not react or it makes no sense, set "reacted" to false and still give a short explanation. ' +
    'Write the "result", "explanation", and "fun_fact" fields in ' + LANG_NAME[lang] + '.'

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
        temperature: 0.7,
      })
      const text = completion.choices[0]?.message?.content ?? '{}'
      const parsed = JSON.parse(text)
      const rarity: Rarity = RARITIES.includes(parsed.rarity) ? parsed.rarity : 'common'
      const result: CombineResult = {
        result: String(parsed.result ?? '???'),
        formula: parsed.formula ? String(parsed.formula) : null,
        emoji: String(parsed.emoji ?? '✨'),
        explanation: String(parsed.explanation ?? ''),
        fun_fact: String(parsed.fun_fact ?? ''),
        rarity,
        reacted: parsed.reacted !== false,
      }
      if (result.reacted) await saveCombo(inputKey, result).catch(() => {})
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
