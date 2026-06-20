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
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-6 pb-28">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="lab-eyebrow">BYAS \u00b7 Archive</p>
          <h1 className="truncate text-2xl font-black tracking-tight">\ud83d\udcd2 {t('pokedex.title')}</h1>
          <p className="mt-0.5 text-xs text-muted">{t('pokedex.count', { n: total })}</p>
        </div>
        <Link href="/" className="lab-button shrink-0">{t('pokedex.back')}</Link>
      </header>

      {total > 0 ? (
        <div className="flex flex-wrap gap-2">
          {RARITY_ORDER.map((r) => (
            <span key={r} className={`rounded-full border border-base bg-white/5 px-3 py-1 text-xs font-bold ${RARITY_TEXT[r]}`}>
              {t('rarity.' + r)}: {grouped[r]?.length ?? 0}
            </span>
          ))}
        </div>
      ) : null}

      {total === 0 ? (
        <div className="lab-panel mt-8 flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">\ud83e\uddea</p>
          <p className="text-sm text-muted">{t('pokedex.emptyDesc')}</p>
          <Link href="/" className="lab-button-primary mt-1">{t('pokedex.start')}</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {RARITY_ORDER.map((r) => {
            const items = grouped[r] ?? []
            if (!items.length) return null
            return (
              <section key={r}>
                <h2 className={`mb-3 text-xs font-black uppercase tracking-[0.18em] ${RARITY_TEXT[r]}`}>
                  {t('rarity.' + r)} \u00b7 {items.length}
                </h2>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                  {items.map((d) => (
                    <button
                      key={d.result}
                      onClick={() => setSelected(d)}
                      className="flex flex-col items-center gap-1 rounded-2xl border border-base bg-white/[0.03] p-3 text-center transition-transform duration-150 hover:-translate-y-0.5 active:scale-95"
                    >
                      <span className="text-3xl">{d.emoji}</span>
                      <span className="text-xs font-bold">{d.result}</span>
                      {d.formula ? <span className="font-mono text-[10px] text-muted">{d.formula}</span> : null}
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
