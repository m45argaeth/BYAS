import OpenAI from 'openai'
import type { NextRequest } from 'next/server'
import { resolveKeys, markRateLimited } from '@/lib/mimoKeys'
import { getCachedCombo, saveCombo, makeInputKey } from '@/lib/cache'
import type { CombineResult } from '@/lib/types'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `Kamu adalah engine game combine kimia santai ala Little Alchemy berbahasa Indonesia.
Diberi dua elemen, hasilkan satu hasil kombinasi yang masuk akal secara kimia ringan atau sains populer.
Balas HANYA dengan JSON valid tanpa teks lain, dengan field:
- result: nama elemen/senyawa hasil (string, singkat)
- formula: rumus kimia kalau ada, selain itu null
- emoji: satu emoji yang mewakili hasil
- explanation: 1-2 kalimat penjelasan, santai
- fun_fact: 1 fakta menarik singkat
- rarity: salah satu dari common, uncommon, rare, legendary
- reacted: boolean, set false kalau dua elemen mustahil bereaksi
Jangan tulis apa pun di luar JSON.`

export async function POST(req: NextRequest) {
  let body: { a?: string; b?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 })
  }

  const a = (body.a ?? '').trim()
  const b = (body.b ?? '').trim()
  if (!a || !b) return Response.json({ error: 'missing_elements' }, { status: 400 })

  const inputKey = makeInputKey(a, b)

  // 1) Cek cache dulu — kalau ada, balikin tanpa panggil AI sama sekali.
  const cached = await getCachedCombo(inputKey)
  if (cached) return Response.json({ ...cached, cached: true })

  // 2) Tentukan key: BYOK kalau ada, kalau nggak fallback ke rotasi key sistem.
  const playerKey = req.headers.get('x-mimo-key') ?? undefined
  const keys = resolveKeys(playerKey)
  if (!keys.length) return Response.json({ error: 'no_key' }, { status: 503 })

  for (const key of keys) {
    try {
      const client = new OpenAI({
        apiKey: key,
        baseURL: 'https://api.xiaomimimo.com/v1',
        defaultHeaders: { 'api-key': key },
      })
      const completion = await client.chat.completions.create({
        model: 'mimo-v2.5-pro',
        response_format: { type: 'json_object' },
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Combine: ${a} + ${b}` },
        ],
      })
      const raw = completion.choices[0]?.message?.content
      if (!raw) throw new Error('empty_response')
      const data = JSON.parse(raw) as CombineResult
      await saveCombo(inputKey, data)
      return Response.json({ ...data, cached: false })
    } catch (e: any) {
      if (e?.status === 429) {
        markRateLimited(key)
        continue
      }
      // BYOK gagal: jangan diam-diam pakai key sistem (anti-abuse).
      if (playerKey) return Response.json({ error: 'invalid_player_key' }, { status: 401 })
      // Key sistem error non-429 → coba key berikutnya.
    }
  }

  return Response.json({ error: 'all_keys_failed' }, { status: 503 })
}
