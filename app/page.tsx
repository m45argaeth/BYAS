'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type DragEvent } from 'react'
import Link from 'next/link'
import { buildStarters, GROUP_COLORS } from '@/lib/elements'
import type { CombineResult, Discovery, Element, ElementGroup, Stats } from '@/lib/types'
import { GameHeader } from '@/components/GameHeader'
import { BottomNav } from '@/components/BottomNav'
import { DiscoveryModal } from '@/components/DiscoveryModal'
import { AchievementToast } from '@/components/AchievementToast'
import { MIMO_KEY, saveDiscovery, loadDiscoveries, loadStats, saveStats } from '@/lib/storage'
import { levelProgress, recordPlay, totalXp, xpForNewDiscovery } from '@/lib/progress'
import { useAuth } from '@/lib/useAuth'
import { syncDiscoveries, syncStats } from '@/lib/sync'
import { pushCloudDiscovery, pushStats, pushTotalXp } from '@/lib/cloud'
import { useI18n } from '@/lib/i18n'
import { initSound, playPop, playError, playSuccess, playUnlock, playCombineCast, playReactionBurst } from '@/lib/sound'
import { ACHIEVEMENTS, computeUnlocked, loadSeen, saveSeen } from '@/lib/achievements'
import { RARITY_GLOW } from '@/lib/rarity'

const DEFAULT_STATS: Stats = { currentStreak: 0, bestStreak: 0, lastPlayed: null, displayName: null, hintTokens: 0, coins: 0, bonusXp: 0, failedExperiments: 0 }

function haptic(ms: number) {
  try { navigator.vibrate?.(ms) } catch {}
}

type ReactorState = 'idle' | 'ready' | 'reacting' | 'success' | 'failed'
type AchToast = { emoji: string; title: string; label: string }
type Particle = { id: number; x: number; y: number; color: string; size: number; delay: number }

function ParticleBurst({ particles }: { particles: Particle[] }) {
  if (!particles.length) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[80]">
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
            top: '42%',
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

function SpecimenTile({ element, selected, onSelect, onDragStart }: { element: Element; selected: boolean; onSelect: () => void; onDragStart: (e: DragEvent<HTMLButtonElement>) => void }) {
  const group: ElementGroup = element.group ?? 'unknown'
  const colors = GROUP_COLORS[group]
  const symbol = element.id.length <= 3 ? element.id : element.emoji
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${element.name}${element.rarity ? `, ${element.rarity}` : ''}. ${selected ? 'Selected' : 'Tap to select, drag to chamber'}`}
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      className={`specimen-tile ${selected ? 'is-selected' : ''}`}
      style={{
        '--specimen-glow': colors.ring,
        '--specimen-border': selected ? colors.glow : 'var(--border)',
      } as CSSProperties}
    >
      <span className="specimen-number">{element.atomicNumber ?? '∞'}</span>
      <span className="specimen-symbol">{symbol}</span>
      <span className="specimen-name">{element.name}</span>
      <span className="specimen-group">{group.replaceAll('-', ' ')}</span>
    </button>
  )
}

function ChamberSlot({ element, label, onRemove }: { element?: Element; label: string; onRemove: () => void }) {
  if (!element) {
    return <div className="chamber-slot empty"><span>{label}</span></div>
  }
  const group: ElementGroup = element.group ?? 'unknown'
  const colors = GROUP_COLORS[group]
  const symbol = element.id.length <= 3 ? element.id : element.emoji
  return (
    <button type="button" onClick={onRemove} aria-label={`Remove ${element.name} from chamber`} className="chamber-slot filled" style={{ '--slot-glow': colors.ring } as CSSProperties}>
      <small>{element.atomicNumber ?? '∞'}</small>
      <strong>{symbol}</strong>
      <span>{element.name}</span>
    </button>
  )
}

function ReactionChamber({ selected, state, dragOver, onRun, onClear, onDropSpecimen, onRemoveSpecimen, onDragStateChange }: { selected: Element[]; state: ReactorState; dragOver: boolean; onRun: () => void; onClear: () => void; onDropSpecimen: (id: string) => void; onRemoveSpecimen: (index: number) => void; onDragStateChange: (v: boolean) => void }) {
  const ready = selected.length === 2 && state !== 'reacting'
  const step = state === 'reacting' ? 4 : selected.length === 0 ? 1 : selected.length === 1 ? 2 : 3
  const status = state === 'reacting' ? 'Reaction in progress…' : ready ? 'Ready — run the experiment' : selected.length === 1 ? 'Pick a second specimen' : 'Insert two specimens'
  return (
    <section
      className={`reaction-chamber state-${state} ${dragOver ? 'chamber-drop-active' : ''}`}
      aria-label="Reaction chamber"
      aria-live="polite"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!dragOver) onDragStateChange(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) onDragStateChange(false) }}
      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) onDropSpecimen(id); onDragStateChange(false) }}
    >
      <div className="chamber-core">
        <p className="chamber-step"><b>{step}/4</b> Pick A · Pick B · React · Discover</p>
        <div className="chamber-slots">
          <ChamberSlot element={selected[0]} label="Specimen A" onRemove={() => onRemoveSpecimen(0)} />
          <div className="chamber-plus">+</div>
          <ChamberSlot element={selected[1]} label="Specimen B" onRemove={() => onRemoveSpecimen(1)} />
        </div>
        <h2>{status}</h2>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={onRun} disabled={!ready} className="lab-button-primary min-w-44 disabled:cursor-not-allowed disabled:opacity-40">
            {state === 'reacting' ? 'Synthesizing…' : 'Run Experiment'}
          </button>
          {selected.length ? <button type="button" onClick={onClear} className="lab-button">Clear</button> : null}
        </div>
        <p className="chamber-hint">Tarik specimen ke chamber, atau tekan <span className="kbd-hint"><kbd>Enter</kbd></span> untuk reaksi · <span className="kbd-hint"><kbd>Esc</kbd></span> reset</p>
      </div>
    </section>
  )
}

export default function Home() {
  const { user } = useAuth()
  const { lang } = useI18n()

  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [discovery, setDiscovery] = useState<{ result: CombineResult; isNew: boolean; xpGain: number } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [achToast, setAchToast] = useState<AchToast | null>(null)
  const [reactorState, setReactorState] = useState<ReactorState>('idle')
  const [particles, setParticles] = useState<Particle[]>([])
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    setDiscoveries(loadDiscoveries())
    setStats({ ...DEFAULT_STATS, ...loadStats() })
    initSound()
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    syncDiscoveries(user.id).then((merged) => { if (!cancelled) setDiscoveries(merged) })
    syncStats(user.id).then((s) => { if (!cancelled) setStats({ ...DEFAULT_STATS, ...s }) })
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (loading) setReactorState('reacting')
    else setReactorState(selected.length === 2 ? 'ready' : 'idle')
  }, [loading, selected.length])

  const inventory: Element[] = useMemo(() => {
    const map = new Map<string, Element>()
    for (const s of buildStarters(lang)) map.set(s.id, s)
    for (const d of discoveries) {
      if (!map.has(d.result)) map.set(d.result, { id: d.result, name: d.result, emoji: d.emoji, formula: d.formula ?? undefined, rarity: d.rarity, category: d.category })
    }
    return Array.from(map.values())
  }, [lang, discoveries])

  const selEls = useMemo(() => selected.map((id) => inventory.find((e) => e.id === id)).filter(Boolean) as Element[], [selected, inventory])

  const spawnParticles = useCallback((success: boolean, rarity: keyof typeof RARITY_GLOW = 'rare') => {
    const palette = success ? ['#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#fbbf24', '#34d399'] : ['#fb7185', '#f97316', '#fca5a5']
    const count = success ? 28 : 12
    const spread = success ? 280 : 120
    const arr = Array.from({ length: count }, (_, i) => ({ id: i, x: (Math.random() - 0.5) * spread, y: (Math.random() - 0.5) * spread - 40, color: palette[i % palette.length], size: 4 + Math.random() * (success ? 10 : 6), delay: Math.random() * 0.22 }))
    setParticles(arr)
    setTimeout(() => setParticles([]), 1400)
  }, [])

  function toggle(id: string) {
    playPop()
    haptic(6)
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id])
  }

  function addToChamber(id: string) {
    playPop()
    haptic(10)
    setSelected((prev) => prev.includes(id) ? prev : prev.length >= 2 ? [prev[1], id] : [...prev, id])
  }

  function showToast(text: string) { setMsg(text); setTimeout(() => setMsg(null), 2600) }

  function checkAchievements(ds: Discovery[], st: Stats) {
    const level = levelProgress(totalXp(ds, st)).level
    const unlocked = computeUnlocked(ds, st, level)
    const seen = loadSeen()
    const fresh = Array.from(unlocked).filter((id) => !seen.has(id))
    if (!fresh.length) return
    const ach = ACHIEVEMENTS.find((a) => a.id === fresh[0])
    if (ach) {
      setAchToast({ emoji: ach.emoji, title: ach.title, label: 'Achievement Unlocked' })
      playUnlock()
      setTimeout(() => setAchToast(null), 3600)
    }
    saveSeen(unlocked)
  }

  const combine = useCallback(async () => {
    if (selected.length !== 2 || loading) return
    const a = inventory.find((e) => e.id === selected[0])
    const b = inventory.find((e) => e.id === selected[1])
    if (!a || !b) return
    setLoading(true)
    playCombineCast()
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      let key = ''
      try { key = (typeof localStorage !== 'undefined' && localStorage.getItem(MIMO_KEY)) || '' } catch {}
      if (key) headers['x-mimo-key'] = key
      const res = await fetch('/api/combine', { method: 'POST', headers, body: JSON.stringify({ aId: a.id, bId: b.id, aName: a.name, bName: b.name, lang }) })
      const data = await res.json()
      if (!res.ok || data.error) { playError(); setReactorState('failed'); spawnParticles(false); showToast('Experiment failed: ' + (data?.error ?? 'combine')); return }
      const result = data as CombineResult
      if (!result.reacted) { playError(); haptic(40); setReactorState('failed'); spawnParticles(false); showToast('No stable reaction detected.'); setSelected([]); return }
      setReactorState('success')
      spawnParticles(true, result.rarity)
      playReactionBurst()
      haptic(22)
      const ns = recordPlay(stats)
      const xpGain = xpForNewDiscovery(result, ns.currentStreak || 0)
      const disc: Discovery = { ...result, discoveredAt: Date.now(), xp: xpGain }
      const isNew = saveDiscovery(disc)
      let nextList = discoveries
      if (isNew) {
        nextList = [...discoveries, disc]
        setDiscoveries(nextList)
        playSuccess()
        if (user) { pushCloudDiscovery(user.id, disc).catch(() => {}); pushTotalXp(user.id, totalXp(nextList, ns)).catch(() => {}) }
      } else playPop()
      setStats(ns)
      saveStats(ns)
      if (user) pushStats(user.id, ns, totalXp(nextList, ns)).catch(() => {})
      setDiscovery({ result, isNew, xpGain: isNew ? xpGain : 0 })
      checkAchievements(nextList, ns)
      setSelected([])
    } catch {
      playError(); setReactorState('failed'); spawnParticles(false); showToast('Network error. Lab connection unstable.')
    } finally {
      setLoading(false)
      setTimeout(() => setReactorState('idle'), 900)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, loading, inventory, lang, stats, discoveries, user, spawnParticles])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (discovery) return
      if (e.key === 'Enter' && selected.length === 2 && !loading) { e.preventDefault(); combine() }
      else if ((e.key === 'Escape' || e.key === 'Backspace') && selected.length) { e.preventDefault(); setSelected([]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, loading, combine, discovery])

  const ctaReady = selEls.length === 2 && reactorState !== 'reacting'

  return (
    <div className="app">
      <ParticleBurst particles={particles} />

      <aside className="rail">
        <Link href="/" className="rail-brand" aria-label="BYAS Lab">🧪</Link>
        <nav className="rail-nav">
          <Link href="/" className="rail-btn is-active" aria-label="Lab" aria-current="page">🧪</Link>
          <Link href="/quest" className="rail-btn" aria-label="Quest">🎯</Link>
          <Link href="/progress" className="rail-btn" aria-label="Progress">📊</Link>
          <Link href="/leaderboard" className="rail-btn" aria-label="Ranks">🏆</Link>
          <Link href="/account" className="rail-btn" aria-label="Account">👤</Link>
        </nav>
      </aside>

      <div className="stage">
        <GameHeader discoveries={discoveries} stats={stats} />
        <div className="stage-scroll">
          <ReactionChamber selected={selEls} state={reactorState} dragOver={dragOver} onRun={combine} onClear={() => setSelected([])} onDropSpecimen={addToChamber} onRemoveSpecimen={(i) => setSelected((prev) => prev.filter((_, idx) => idx !== i))} onDragStateChange={setDragOver} />
          <section className="specimen-dock" aria-label="Specimen dock">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><p className="lab-eyebrow">Specimen Dock</p><h3>Choose two materials</h3></div>
              {selected.length ? <button onClick={() => setSelected([])} className="text-xs font-bold text-cyan-200/70 underline" type="button">clear selection</button> : null}
            </div>
            <div className="specimen-grid">
              {inventory.map((el) => (
                <SpecimenTile
                  key={el.id}
                  element={el}
                  selected={selected.includes(el.id)}
                  onSelect={() => toggle(el.id)}
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', el.id); e.dataTransfer.effectAllowed = 'move' }}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="cta-dock">
        <button type="button" className="cta-run" onClick={combine} disabled={!ctaReady}>
          {reactorState === 'reacting' ? 'Synthesizing…' : ctaReady ? 'Run Experiment' : 'Pick 2 specimens'}
        </button>
      </div>

      <BottomNav />

      {discovery && <DiscoveryModal result={discovery.result} isNew={discovery.isNew} xpGain={discovery.xpGain} onClose={() => setDiscovery(null)} />}
      {achToast && <AchievementToast emoji={achToast.emoji} title={achToast.title} label={achToast.label} />}
      {msg && <div className="toast-enter fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/92 px-4 py-3 text-sm text-white shadow-2xl" role="status">{msg}</div>}
    </div>
  )
}
