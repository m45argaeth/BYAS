'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Discovery } from '@/lib/types'
import { loadDiscoveries } from '@/lib/storage'
import { syncDiscoveries } from '@/lib/sync'
import { useAuth } from '@/lib/useAuth'
import { RARITY_ORDER, RARITY_TEXT } from '@/lib/rarity'
import { DiscoveryModal } from '@/components/DiscoveryModal'
import { useI18n } from '@/lib/i18n'

export default function PokedexPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [selected, setSelected] = useState<Discovery | null>(null)

  useEffect(() => {
    setDiscoveries(loadDiscoveries())
    if (!user) return
    let cancelled = false
    syncDiscoveries(user.id).then((merged) => {
      if (!cancelled) setDiscoveries(merged)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const grouped = useMemo(() => {
    const map: Record<string, Discovery[]> = {}
    for (const r of RARITY_ORDER) map[r] = []
    for (const d of discoveries) (map[d.rarity] ?? (map[d.rarity] = [])).push(d)
    return map
  }, [discoveries])

  const total = discoveries.length

  return (
    <main className='mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6'>
      <header className='flex items-center justify-between gap-2'>
        <div className='min-w-0'>
          <h1 className='truncate text-2xl font-extrabold tracking-tight'>📒 {t('pokedex.title')}</h1>
          <p className='text-xs text-muted'>{t('pokedex.count', { n: total })}</p>
        </div>
        <Link href='/' className='rounded-full card-2 px-3 py-1.5 text-xs hover:opacity-80'>
          {t('pokedex.back')}
        </Link>
      </header>

      {total > 0 ? (
        <div className='mt-4 flex flex-wrap gap-2'>
          {RARITY_ORDER.map((r) => {
            const cls = 'rounded-full card px-3 py-1 text-xs font-medium ' + RARITY_TEXT[r]
            return (
              <span key={r} className={cls}>
                {t('rarity.' + r)}: {grouped[r]?.length ?? 0}
              </span>
            )
          })}
        </div>
      ) : null}

      {total === 0 ? (
        <div className='mt-20 text-center text-muted'>
          <p className='text-4xl'>🧪</p>
          <p className='mt-3 text-sm'>{t('pokedex.emptyDesc')}</p>
          <Link
            href='/'
            className='mt-4 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500'
          >
            {t('pokedex.start')}
          </Link>
        </div>
      ) : (
        <div className='mt-6 space-y-8'>
          {RARITY_ORDER.map((r) => {
            const items = grouped[r] ?? []
            if (!items.length) return null
            const headCls = 'mb-3 text-sm font-bold uppercase tracking-widest ' + RARITY_TEXT[r]
            return (
              <section key={r}>
                <h2 className={headCls}>
                  {t('rarity.' + r)} · {items.length}
                </h2>
                <div className='grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6'>
                  {items.map((d) => (
                    <button
                      key={d.result}
                      onClick={() => setSelected(d)}
                      className='flex flex-col items-center gap-1 rounded-xl border border-base card p-3 text-center transition hover:opacity-80 active:scale-95'
                    >
                      <span className='text-3xl'>{d.emoji}</span>
                      <span className='text-xs font-medium'>{d.result}</span>
                      {d.formula ? <span className='font-mono text-[10px] text-muted'>{d.formula}</span> : null}
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {selected ? <DiscoveryModal result={selected} isNew={false} onClose={() => setSelected(null)} /> : null}
    </main>
  )
}
