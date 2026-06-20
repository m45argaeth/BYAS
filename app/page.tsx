'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { buildStarters, GROUP_COLORS } from '@/lib/elements'
import type { CombineResult, Discovery, Element, Stats, ElementGroup } from '@/lib/types'
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
import { initSound, playPop, playError, playSuccess, playUnlock, playCombineCast, playReactionBurst } from '@/lib/sound'
import { ACHIEVEMENTS, computeUnlocked, loadSeen, saveSeen } from '@/lib/achievements'

const DEFAULT_STATS: Stats = { currentStreak: 0, bestStreak: 0, lastPlayed: null, displayName: null }

type AchToast = { emoji: string; title: string; label: string }

interface Particle {
  id: number
  x: number
  y: number
  color: string
  size: number
  delay: number
}

/* ── ElementCard ── */
function ElementCard({ el, selected, onClick }: { el: Element; selected: boolean; onClick: () => void }) {
  const group: ElementGroup = el.group ?? 'unknown'
  const c = GROUP_COLORS[group]
  const hasAtomic = typeof el.atomicNumber === 'number'
  const symbol = el.id.length <= 3 ? el.id : ''
  return (
    <button
      onClick={onClick}
      className={`pt-card animate-fade-in ${selected ? 'selected' : ''}`}
      style={{
        borderColor: selected ? c.glow : c.border,
        boxShadow: selected
          ? `0 0 14px ${c.ring}, 0 0 36px ${c.ring.replace('0.45', '0.15')}, inset 0 0 14px ${c.ring.replace('0.45', '0.06')}`
          : 'none',
        ['--pt-glow' as string]: c.ring.replace('0.45', '0.08'),
      }}
    >
      {hasAtomic && <span className="pt-atomic" style= color: c.text >{el.atomicNumber}</span>}
      {symbol ? (
        <span className="pt-symbol text-xl sm:text-2xl" style= color: c.text >{symbol}</span>
      ) : (
        <span className="relative z-10 text-2xl sm:text-3xl">{el.emoji}</span>
      )}
      <span className="pt-name mt-0.5">{el.name}</span>
      {!hasAtomic && el.formula && (
        <span className="relative z-10 font-mono text-[9px] text-muted mt-0.5">{el.formula}</span>
      )}
    </button>
  )
}

/* ── CombineSlot ── */
function CombineSlot({ el, pick }: { el?: Element; pick: string }) {
  const key = el?.id ?? 'empty'
  if (!el) {
    return (
      <div className="flex h-28 sm:h-32 items-center justify-center rounded-2xl border-2 border-dashed border-base bg-transparent">
        <span className="text-xs sm:text-sm text-muted font-medium">{pick}</span>
      </div>
    )
  }
  const group: ElementGroup = el.group ?? 'unknown'
  const c = GROUP_COLORS[group]
  const symbol = el.id.length <= 3 ? el.id : ''
  const hasAtomic = typeof el.atomicNumber === 'number'
  return (
    <div
      key={key}
      className="slot-ring filled flex h-28 sm:h-32 flex-col items-center justify-center gap-1 rounded-2xl"
      style={{
        border: `2px solid ${c.glow}`,
        boxShadow: `0 0 18px ${c.ring}, inset 0 0 20px ${c.ring.replace('0.45', '0.08')}`,
        background: `radial-gradient(circle at 50% 30%, ${c.ring.replace('0.45', '0.12')}, transparent 70%)`,
      }}
    >
      {hasAtomic && <span className="absolute top-2 left-3 text-[10px] font-bold" style= color: c.text >{el.atomicNumber}</span>}
      {symbol ? (
        <span className="animate-floaty text-3xl sm:text-4xl font-extrabold" style= color: c.text >{symbol}</span>
      ) : (
        <span className="animate-floaty text-3xl sm:text-4xl">{el.emoji}</span>
      )}
      <span className="text-xs font-medium">{el.name}</span>
      {el.formula && <span className="font-mono text-[10px] text-muted">{el.formula}</span>}
    </div>
  )
}

/* ── ParticleBurst ── */
function ParticleBurst({ particles }: { particles: Particle[] }) {
  if (!particles.length) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            '--px': `${p.x}px`,
            '--py': `${p.y}px`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            left: '50%',
            top: '50%',
            marginLeft: `-${p.size / 2}px`,
            marginTop: `-${p.size / 2}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

/* ── Home ── */
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
  const [reactionState, setReactionState] = useState<'idle' | 'success' | 'fail'>('idle')
  const [particles, setParticles] = useState<Particle[]>([])
  const [flashColor, setFlashColor] = useState<string>('')

  useEffect(() => {
    setDiscoveries(loadDiscoveries())
    setStats(loadStats())
    try { const k = localStorage.getItem(MIMO_KEY); if (k) setApiKey(k) } catch {}
    initSound()
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    syncDiscoveries(user.id).then((merged) => { if (!cancelled) setDiscoveries(merged) })
    syncStats(user.id).then((s) => { if (!cancelled) setStats(s) })
    return () => { cancelled = true }
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

  const spawnParticles = useCallback((success: boolean) => {
    const palette = success
      ? ['#38bdf8','#818cf8','#a78bfa','#f472b6','#fbbf24','#34d399','#fb923c','#e879f9']
      : ['#ef4444','#f87171','#fca5a5','#dc2626']
    const count = success ? 34 : 12
    const spread = success ? 280 : 120
    const arr: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread - 20,
      color: palette[i % palette.length],
      size: success ? 3 + Math.random() * 12 : 3 + Math.random() * 8,
      delay: Math.random() * 0.35,
    }))
    setParticles(arr)
    setTimeout(() => setParticles([]), 1600)
  }, [])

  const triggerSuccess = useCallback(() => {
    setReactionState('success')
    setFlashColor('rgba(56,189,248,0.18)')
    spawnParticles(true)
    playReactionBurst()
    setTimeout(() => { setReactionState('idle'); setFlashColor('') }, 1400)
  }, [spawnParticles])

  const triggerFail = useCallback(() => {
    setReactionState('fail')
    setFlashColor('rgba(239,68,68,0.12)')
    spawnParticles(false)
    setTimeout(() => { setReactionState('idle'); setFlashColor('') }, 700)
  }, [spawnParticles])

  function toggle(id: string) {
    playPop()
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  function showToast(text: string) { setMsg(text); setTimeout(() => setMsg(null), 2600) }

  async function signOut() {
    const sb = getSupabaseBrowser()
    await sb?.auth.signOut()
    setDiscoveries(loadDiscoveries())
  }

  function handleSaveKey(k: string) {
    setApiKey(k)
    try { if (k) localStorage.setItem(MIMO_KEY, k); else localStorage.removeItem(MIMO_KEY) } catch {}
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
      setTimeout(() => setAchToast(null), 3600)
    }
    saveSeen(unlocked)
  }

  async function combine() {
    if (selected.length !== 2 || loading) return
    const a = inventory.find((e) => e.id === selected[0])
    const b = inventory.find((e) => e.id === selected[1])
    if (!a || !b) return
    setLoading(true)
    playCombineCast()
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) headers['x-mimo-key'] = apiKey
      const res = await fetch('/api/combine', { method: 'POST', headers, body: JSON.stringify({ aId: a.id, bId: b.id, aName: a.name, bName: b.name, lang }) })
      const data = await res.json()
      if (!res.ok || data.error) { playError(); triggerFail(); showToast(t('err.' + (data?.error ?? 'combine'))); return }
      const result = data as CombineResult
      if (!result.reacted) { playError(); triggerFail(); showToast(t('combine.noReaction', { a: a.name, b: b.name })); setSelected([]); return }
      triggerSuccess()
      const disc: Discovery = { ...result, discoveredAt: Date.now() }
      const isNew = saveDiscovery(disc)
      let nextList = discoveries
      if (isNew) {
        nextList = [...discoveries, disc]
        setDiscoveries(nextList)
        playSuccess()
        if (user) { pushCloudDiscovery(user.id, disc).catch(() => {}); pushTotalXp(user.id, totalXpFromDiscoveries(loadDiscoveries())).catch(() => {}) }
      } else { playPop() }
      const ns = recordPlay(stats)
      if (ns !== stats) { setStats(ns); saveStats(ns); if (user) pushStats(user.id, ns, totalXpFromDiscoveries(loadDiscoveries())).catch(() => {}) }
      setDiscovery({ result, isNew, xpGain: isNew ? XP_BY_RARITY[result.rarity] ?? 10 : 0 })
      checkAchievements(nextList, ns)
      setSelected([])
    } catch { playError(); triggerFail(); showToast(t('err.network')) }
    finally { setLoading(false) }
  }

  const iconBtn = 'rounded-full card-2 p-2 text-base leading-none transition hover:opacity-80 active:scale-90'
  const canCombine = selected.length === 2 && !loading

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-3 py-4 sm:px-4 sm:py-6">
      {flashColor && <div className="reaction-overlay" style= background: flashColor  />}
      <ParticleBurst particles={particles} />
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl">
            <span className="text-2xl sm:text-3xl">⚗️</span>
            <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">BYAS</span>
          </h1>
          <p className="text-[11px] text-muted">Bring Your Alchemy Skill</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5">
          <Link href="/pokedex" className={iconBtn} title={t('nav.collection')}>📒</Link>
          <Link href="/leaderboard" className={iconBtn} title={t('nav.rank')}>🏆</Link>
          <button onClick={toggleTheme} className={iconBtn} title={t('settings.theme')}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button onClick={() => setShowSettings(true)} className={iconBtn} title={t('settings.title')}>⚙️</button>
          <button onClick={() => setShowKey(true)} className={iconBtn} title={apiKey ? t('key.byok') : t('key.system')}>🔑</button>
          {user ? (
            <button onClick={signOut} title={user.email ?? undefined} className={iconBtn}>👤</button>
          ) : (
            <button onClick={() => setShowAuth(true)} className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 active:scale-95">{t('auth.login')}</button>
          )}
        </div>
      </header>
      <StatsBar totalXp={totalXp} streak={stats.currentStreak} bestStreak={stats.bestStreak} />
      <section className={`mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl card p-4 transition-all duration-300 sm:gap-4 sm:p-5 ${reactionState === 'fail' ? 'shake-it' : ''}`}
        style={reactionState === 'success' ? { boxShadow: '0 0 30px rgba(56,189,248,0.35), 0 0 70px rgba(56,189,248,0.12)' } : undefined}>
        <CombineSlot el={selEls[0]} pick={t('slot.pick')} />
        <div className="text-center"><span className="text-xl font-bold text-muted sm:text-2xl">+</span></div>
        <CombineSlot el={selEls[1]} pick={t('slot.pick')} />
      </section>
      <button onClick={combine} disabled={!canCombine}
        className={`mt-4 w-full rounded-xl py-3.5 text-base font-bold text-white transition-all duration-300 ${canCombine ? 'animate-pulse-glow bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/25 active:scale-[0.97]' : 'cursor-not-allowed bg-slate-700/40 text-slate-400'}`}
        style={canCombine ? { backgroundSize: '200% auto', backgroundImage: 'linear-gradient(to right, #0ea5e9, #6366f1, #a855f7)' } : undefined}>
        {loading ? (
          <span className="flex items-center justify-center gap-2"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />{t('combine.loading')}</span>
        ) : (<span className="flex items-center justify-center gap-2"><span className="text-lg">⚗️</span> {t('combine.button')}</span>)}
      </button>
      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{t('nav.collection')} · {inventory.length}</h2>
          {selected.length > 0 && <button onClick={() => setSelected([])} className="text-xs text-muted underline hover:text-sky-400">{selected.length} selected · clear</button>}
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {inventory.map((el, idx) => (
            <div key={el.id} style={{ animationDelay: `${Math.min(idx * 35, 600)}ms` }}>
              <ElementCard el={el} selected={selected.includes(el.id)} onClick={() => toggle(el.id)} />
            </div>
          ))}
        </div>
      </section>
      {inventory.length <= 6 && discoveries.length === 0 && (
        <div className="mt-3 text-center animate-fade-in"><p className="text-xs text-muted">✨ Pick two elements above and press Combine to discover new compounds!</p></div>
      )}
      {discovery && <DiscoveryModal result={discovery.result} isNew={discovery.isNew} xpGain={discovery.xpGain} onClose={() => setDiscovery(null)} />}
      {showKey && <ApiKeyModal current={apiKey} onClose={() => setShowKey(false)} onSave={handleSaveKey} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {achToast && <AchievementToast emoji={achToast.emoji} title={achToast.title} label={achToast.label} />}
      {msg && <div className="toast-enter fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900/90 px-4 py-2.5 text-sm text-white shadow-xl backdrop-blur">{msg}</div>}
    </main>
  )
}
