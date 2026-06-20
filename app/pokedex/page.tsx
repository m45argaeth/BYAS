'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Discovery } from '@/lib/types'
import { loadDiscoveries } from '@/lib/storage'
import { RARITY_ORDER, RARITY_LABEL, RARITY_TEXT } from '@/lib/rarity'
import { DiscoveryModal } from '@/components/DiscoveryModal'

export default function PokedexPage() {
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [selected, setSelected] = useState<Discovery | null>(null)

  useEffect(() => {
    setDiscoveries(loadDiscoveries())
  }, [])

  const grouped = useMemo(() => {
    const map: Record<string, Discovery[]> = {}
    for (const r of RARITY_ORDER) map[r] = []
    for (const d of discoveries) (map[d.rarity] ?? (map[d.rarity] = [])).push(d)
    return map
  }, [discoveries])

  const total = discoveries.length

  return (
    <main className='mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6'>
      <header className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-extrabold tracking-tight'>📒 Koleksi</h1>
          <p className='text-xs text-slate-400'>{total} penemuan terkumpul</p>
        </div>
        <Link
          href='/'
          className='rounded-full bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700'
        >
          ← Kembali combine
        </Link>
      </header>

      {total > 0 && (
        <div className='mt-4 flex flex-wrap gap-2'>
          {RARITY_ORDER.map((r) => (
            <span
              key={r}
              className={`rounded-full bg-slate-900 px-3 py-1 text-xs font-medium ${RARITY_TEXT[r]}`}
            >
              {RARITY_LABEL[r]}: {grouped[r]?.length ?? 0}
            </span>
          ))}
        </div>
      )}

      {total === 0 ? (
        <div className='mt-20 text-center text-slate-500'>
          <p className='text-4xl'>🧪</p>
          <p className='mt-3 text-sm'>Belum ada penemuan. Gas combine elemen dulu!</p>
          <Link
            href='/'
            className='mt-4 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500'
          >
            Mulai bereksperimen
          </Link>
        </div>
      ) : (
        <div className='mt-6 space-y-8'>
          {RARITY_ORDER.map((r) => {
            const items = grouped[r] ?? []
            if (!items.length) return null
            return (
              <section key={r}>
                <h2 className={`mb-3 text-sm font-bold uppercase tracking-widest ${RARITY_TEXT[r]}`}>
                  {RARITY_LABEL[r]} · {items.length}
                </h2>
                <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
                  {items.map((d) => (
                    <button
                      key={d.result}
                      onClick={() => setSelected(d)}
                      className='flex flex-col items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-center transition hover:border-slate-600'
                    >
                      <span className='text-3xl'>{d.emoji}</span>
                      <span className='text-xs font-medium'>{d.result}</span>
                      {d.formula && (
                        <span className='font-mono text-[10px] text-slate-500'>{d.formula}</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {selected && (
        <DiscoveryModal result={selected} isNew={false} onClose={() => setSelected(null)} />
      )}
    </main>
  )
}
