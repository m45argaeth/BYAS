'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { buildStarters } from '@/lib/elements'
import type { CombineResult, Discovery, Element, Stats } from '@/lib/types'
import { DiscoveryModal } from '@/components/DiscoveryModal'
import { ApiKeyModal } from '@/components/ApiKeyModal'
import { AuthModal } from '@/components/AuthModal'
import { SettingsModal } from '@/components/SettingsModal'
import { StatsBar } from '@/components/StatsBar'
import { AchievementToast } from '@/components/AchievementToast'
import { MIMO_KEY, saveDiscovery, loadDiscoveries, loadStats, saveStats } from '@/lib/storage'
import { totalXpFromDiscoveries, recordPlay, levelFromXp, XP_BY_RARITY } from '@/lib/progress'
import { useAuth } from '@/lib/useAuth'
import { syncDiscoveries, syncStats } from '@/lib/sync'
import { pushCloudDiscovery, pushStats, pushTotalXp } from '@/lib/cloud'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { initSound, playPop, playError, playSuccess, playUnlock } from '@/lib/sound'
import { ACHIEVEMENTS, computeUnlocked, loadSeen, saveSeen } from '@/lib/achievements'

const DEFAULT_STATS: Stats = { currentStreak: 0, bestStreak: 0, lastPlayed: null, displayName: null }

type AchToast = { emoji: string; title: string; label: string }

export default function Home() {
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const { theme, toggle: toggleTheme } = useTheme()

  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [discovery, setDiscovery] = useState<{ result: CombineResult; isNew: boolean; xpGain: number } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [achToast, setAchToast] = useState<AchToast | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    setDiscoveries(loadDiscoveries())
    setStats(loadStats())
    try {
      const k = localStorage.getItem(MIMO_KEY)
      if (k) setApiKey(k)
    } catch {}
    initSound()
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    syncDiscoveries(user.id).then((merged) => {
      if (!cancelled) setDiscoveries(merged)
    })
    syncStats(user.id).then((s) => {
      if (!cancelled) setStats(s)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const totalXp = useMemo(() => totalXpFromDiscoveries(discoveries), [discoveries])

  const inventory: Element[] = useMemo(() => {
    const map = new Map<string, Element>()
    for (const s of buildStarters(lang)) map.set(s.id, s)
    for (const d of discoveries) {
      if (!map.has(d.result)) {
        map.set(d.result, { id: d.result, name: d.result, emoji: d.emoji, formula: d.formula ?? undefined })
      }
    }
    return Array.from(map.values())
  }, [lang, discoveries])

  const selEls = useMemo(
    () => selected.map((id) => inventory.find((e) => e.id === id)).filter(Boolean) as Element[],
    [selected, inventory],
  )

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  function showToast(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(null), 2600)
  }

  async function signOut() {
    const sb = getSupabaseBrowser()
    await sb?.auth.signOut()
    setDiscoveries(loadDiscoveries())
  }

  function handleSaveKey(k: string) {
    setApiKey(k)
    try {
      if (k) localStorage.setItem(MIMO_KEY, k)
      else localStorage.removeItem(MIMO_KEY)
    } catch {}
  }

  function checkAchievements(ds: Discovery[], st: Stats) {
    const level = levelFromXp(totalXpFromDiscoveries(ds))
    const unlocked = computeUnlocked(ds, st, level)
    const seen = loadSeen()
    const fresh = Array.from(unlocked).filter((id) => !seen.has(id))
    if (!fresh.length) return
    const ach = ACHIEVEMENTS.find((a) => a.id === fresh[0])
    if (ach) {
      setAchToast({ emoji: ach.emoji, title: t('ach.' + ach.id + '.title'), label: t('ach.unlocked') })
      playUnlock()
      setTimeout(() => setAchToast(null), 3400)
    }
    saveSeen(unlocked)
  }

  async function combine() {
    if (selected.length !== 2 || loading) return
    const a = inventory.find((e) => e.id === selected[0])
    const b = inventory.find((e) => e.id === selected[1])
    if (!a || !b) return
    setLoading(true)
    playPop()
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) headers['x-mimo-key'] = apiKey
      const res = await fetch('/api/combine', {
        method: 'POST',
        headers,
        body: JSON.stringify({ aId: a.id, bId: b.id, aName: a.name, bName: b.name, lang }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        playError()
        showToast(t('err.' + (data?.error ?? 'combine')))
        return
      }
      const result = data as CombineResult
      if (!result.reacted) {
        playError()
        showToast(t('combine.noReaction', { a: a.name, b: b.name }))
        setSelected([])
        return
      }
      const disc: Discovery = { ...result, discoveredAt: Date.now() }
      const isNew = saveDiscovery(disc)
      let nextList = discoveries
      if (isNew) {
        nextList = [...discoveries, disc]
        setDiscoveries(nextList)
        playSuccess()
        if (user) {
          pushCloudDiscovery(user.id, disc).catch(() => {})
          pushTotalXp(user.id, totalXpFromDiscoveries(loadDiscoveries())).catch(() => {})
        }
      } else {
        playPop()
      }
      const ns = recordPlay(stats)
      if (ns !== stats) {
        setStats(ns)
        saveStats(ns)
        if (user) pushStats(user.id, ns, totalXpFromDiscoveries(loadDiscoveries())).catch(() => {})
      }
      setDiscovery({ result, isNew, xpGain: isNew ? XP_BY_RARITY[result.rarity] ?? 10 : 0 })
      checkAchievements(nextList, ns)
      setSelected([])
    } catch {
      playError()
      showToast(t('err.network'))
    } finally {
      setLoading(false)
    }
  }

  const iconBtn = 'rounded-full card-2 p-2 text-base leading-none transition hover:opacity-80'

  return (
    <main className='mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-5 sm:py-7'>
      <header className='flex items-center justify-between gap-2'>
        <div className='min-w-0'>
          <h1 className='truncate text-xl font-extrabold tracking-tight sm:text-2xl'>⚗️ BYAS</h1>
          <p className='text-[11px] text-muted'>Bring Your Alchemy Skill</p>
        </div>
        <div className='flex flex-wrap items-center justify-end gap-1.5'>
          <Link href='/pokedex' className={iconBtn} title={t('nav.collection')}>📒</Link>
          <Link href='/leaderboard' className={iconBtn} title={t('nav.rank')}>🏆</Link>
          <button onClick={toggleTheme} className={iconBtn} title={t('settings.theme')}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={() => setShowSettings(true)} className={iconBtn} title={t('settings.title')}>⚙️</button>
          <button onClick={() => setShowKey(true)} className={iconBtn} title={apiKey ? t('key.byok') : t('key.system')}>🔑</button>
          {user ? (
            <button onClick={signOut} title={user.email ?? undefined} className={iconBtn}>👤</button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className='rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500'
            >
              {t('auth.login')}
            </button>
          )}
        </div>
      </header>

      <StatsBar totalXp={totalXp} streak={stats.currentStreak} bestStreak={stats.bestStreak} />

      <section className='mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl card p-4 sm:p-6'>
        <Slot el={selEls[0]} pick={t('slot.pick')} />
        <div className='text-center text-2xl text-muted'>+</div>
        <Slot el={selEls[1]} pick={t('slot.pick')} />
      </section>

      <button
        onClick={combine}
        disabled={selected.length !== 2 || loading}
        className='mt-4 w-full rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3.5 font-bold text-white transition enabled:hover:opacity-90 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40'
      >
        {loading ? '🧪 ' + t('combine.loading') : '⚗️ ' + t('combine.button')}
      </button>

      <section className='mt-6 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6'>
        {inventory.map((el) => {
          const active = selected.includes(el.id)
          const cls =
            'flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition active:scale-95 ' +
            (active ? 'border-sky-400 bg-sky-500/15' : 'border-base card hover:opacity-80')
          return (
            <button key={el.id} onClick={() => toggle(el.id)} className={cls}>
              <span className='text-3xl'>{el.emoji}</span>
              <span className='text-xs font-medium'>{el.name}</span>
            </button>
          )
        })}
      </section>

      {discovery ? (
        <DiscoveryModal
          result={discovery.result}
          isNew={discovery.isNew}
          xpGain={discovery.xpGain}
          onClose={() => setDiscovery(null)}
        />
      ) : null}
      {showKey ? <ApiKeyModal current={apiKey} onClose={() => setShowKey(false)} onSave={handleSaveKey} /> : null}
      {showAuth ? <AuthModal onClose={() => setShowAuth(false)} /> : null}
      {showSettings ? <SettingsModal onClose={() => setShowSettings(false)} /> : null}
      {achToast ? <AchievementToast emoji={achToast.emoji} title={achToast.title} label={achToast.label} /> : null}
      {msg ? (
        <div className='fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg'>
          {msg}
        </div>
      ) : null}
    </main>
  )
}

function Slot({ el, pick }: { el?: Element; pick: string }) {
  if (!el) {
    return (
      <div className='flex h-24 items-center justify-center rounded-xl border border-dashed border-base text-xs text-muted'>
        {pick}
      </div>
    )
  }
  return (
    <div className='flex h-24 flex-col items-center justify-center gap-1 rounded-xl border border-sky-500/40 bg-sky-500/10'>
      <span className='animate-floaty text-3xl'>{el.emoji}</span>
      <span className='text-xs'>{el.name}</span>
    </div>
  )
}
