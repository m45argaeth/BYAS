'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type DragEvent } from 'react'
import Link from 'next/link'
import { buildStarters, GROUP_COLORS } from '@/lib/elements'
import type { CombineResult, Discovery, Element, ElementGroup, Stats } from '@/lib/types'
import { DiscoveryModal } from '@/components/DiscoveryModal'
import { ApiKeyModal } from '@/components/ApiKeyModal'
import { AuthModal } from '@/components/AuthModal'
import { SettingsModal } from '@/components/SettingsModal'
import { AchievementToast } from '@/components/AchievementToast'
import { MIMO_KEY, saveDiscovery, loadDiscoveries, loadStats, saveStats } from '@/lib/storage'
import { COLLECTION_MILESTONES, labReputation, levelProgress, masteryBreakdown, MASTERY_LABEL, nextMilestone, recordPlay, researchRank, totalXp, xpForNewDiscovery } from '@/lib/progress'
import { getDailyChallenge, dailyProgress, isDailyClaimed, isDailyComplete } from '@/lib/daily'
import { getWeeklyQuest, weeklyProgress, isWeeklyClaimed, isWeeklyComplete, getMystery, isMysterySolved, isMysteryClaimed, isMysteryHintUsed, STREAK_TIERS, isStreakClaimed, isStreakReached } from '@/lib/retention'
import { useAuth } from '@/lib/useAuth'
import { syncDiscoveries, syncStats } from '@/lib/sync'
import { pushCloudDiscovery, pushStats, pushTotalXp } from '@/lib/cloud'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { initSound, playPop, playError, playSuccess, playUnlock, playCombineCast, playReactionBurst } from '@/lib/sound'
import { ACHIEVEMENTS, computeUnlocked, loadSeen, saveSeen } from '@/lib/achievements'
import { RARITY_GLOW, RARITY_LABEL } from '@/lib/rarity'

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

function LabStatus({ discoveries, stats }: { discoveries: Discovery[]; stats: Stats }) {
  const xp = totalXp(discoveries, stats)
  const progress = levelProgress(xp)
  const rank = researchRank(progress.level, discoveries.length)
  const rep = labReputation(discoveries, stats)
  const goal = nextMilestone(discoveries.length)
  return (
    <section className="lab-status" aria-label="Lab status">
      <div>
        <p className="lab-eyebrow">BYAS Lab OS</p>
        <h1>Bring Your Alchemy Skill</h1>
        <p className="text-sm text-slate-400">{rank} · Level {progress.level}</p>
      </div>
      <div className="lab-status-grid">
        <div className="lab-metric"><span>{discoveries.length}/{goal}</span><small>Discovery Index</small></div>
        <div className="lab-metric"><span>{stats.currentStreak || 0}d</span><small>Active Streak</small></div>
        <div className="lab-metric"><span>{stats.coins ?? 0}</span><small>Lab Coins</small></div>
        <div className="lab-metric"><span>{rep}</span><small>Lab Reputation</small></div>
      </div>
      <div className="lab-level">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          <span>Research XP</span><span>{progress.into}/{progress.span}</span>
        </div>
        <div className="lab-progress"><div style={{ width: `${progress.pct}%` }} /></div>
      </div>
    </section>
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
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      className={`specimen-tile ${selected ? 'is-selected' : ''}`}
      style={{
        '--specimen-glow': colors.ring,
        '--specimen-border': selected ? colors.glow : 'rgba(255,255,255,0.12)',
      } as CSSProperties}
    >
      <span className="specimen-number">{element.atomicNumber ?? '∞'}</span>
      <span className="specimen-symbol">{symbol}</span>
      <span className="specimen-name">{element.name}</span>
      <span className="specimen-group">{group.replaceAll('-', ' ')}</span>
    </button>
  )
}

function ChamberSlot({ element, label }: { element?: Element; label: string }) {
  if (!element) {
    return <div className="chamber-slot empty"><span>{label}</span></div>
  }
  const group: ElementGroup = element.group ?? 'unknown'
  const colors = GROUP_COLORS[group]
  const symbol = element.id.length <= 3 ? element.id : element.emoji
  return (
    <div className="chamber-slot filled" style={{ '--slot-glow': colors.ring } as CSSProperties}>
      <small>{element.atomicNumber ?? '∞'}</small>
      <strong>{symbol}</strong>
      <span>{element.name}</span>
    </div>
  )
}

function ReactionChamber({ selected, state, dragOver, onRun, onClear, onDropSpecimen, onDragStateChange }: { selected: Element[]; state: ReactorState; dragOver: boolean; onRun: () => void; onClear: () => void; onDropSpecimen: (id: string) => void; onDragStateChange: (v: boolean) => void }) {
  const ready = selected.length === 2 && state !== 'reacting'
  const status = state === 'reacting' ? 'Reaction in progress' : ready ? 'Ready to run experiment' : 'Insert two specimens'
  return (
    <section
      className={`reaction-chamber state-${state} ${dragOver ? 'chamber-drop-active' : ''}`}
      aria-live="polite"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!dragOver) onDragStateChange(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) onDragStateChange(false) }}
      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) onDropSpecimen(id); onDragStateChange(false) }}
    >
      <div className="chamber-bg" />
      <div className="chamber-orbit orbit-one" />
      <div className="chamber-orbit orbit-two" />
      <div className="chamber-core">
        <div className="chamber-slots">
          <ChamberSlot element={selected[0]} label="Specimen A" />
          <div className="chamber-plus">+</div>
          <ChamberSlot element={selected[1]} label="Specimen B" />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-cyan-100/60">Reaction Chamber</p>
        <h2>{status}</h2>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={onRun} disabled={!ready} className="lab-button-primary min-w-44 disabled:cursor-not-allowed disabled:opacity-40">
            {state === 'reacting' ? 'Synthesizing…' : 'Run Experiment'}
          </button>
          {selected.length ? <button type="button" onClick={onClear} className="lab-button">Clear</button> : null}
        </div>
        <p className="chamber-hint">Tarik specimen ke chamber, atau tap untuk memilih</p>
      </div>
    </section>
  )
}

function DailyResearchPanel({ discoveries, stats, onClaim }: { discoveries: Discovery[]; stats: Stats; onClaim: () => void }) {
  const ch = getDailyChallenge()
  const prog = dailyProgress(ch, discoveries)
  const done = prog >= ch.target
  const claimed = isDailyClaimed(ch, stats)
  return (
    <aside className="lab-panel">
      <div className="flex items-center justify-between gap-3">
        <div><p className="lab-eyebrow">Daily Research</p><h3>{ch.title}</h3></div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-100">{prog}/{ch.target}</span>
      </div>
      <div className="lab-progress mt-4"><div style={{ width: `${(prog / ch.target) * 100}%` }} /></div>
      <p className="mt-3 text-sm text-slate-400">{ch.description}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">Reward: +{ch.rewardXp} XP · +{ch.rewardCoins} 🪙 · +{ch.rewardHints} 💡</span>
        <button type="button" onClick={onClaim} disabled={!done || claimed} className="lab-button text-xs disabled:cursor-not-allowed disabled:opacity-40">{claimed ? 'Claimed ✓' : done ? 'Claim' : 'Locked'}</button>
      </div>
    </aside>
  )
}

function MysteryResearchPanel({ discoveries, stats, onClaim, onUseHint }: { discoveries: Discovery[]; stats: Stats; onClaim: () => void; onUseHint: () => void }) {
  const m = getMystery()
  const solved = isMysterySolved(m, discoveries)
  const claimed = isMysteryClaimed(m, stats)
  const hintUsed = isMysteryHintUsed(m, stats)
  const tokens = stats.hintTokens ?? 0
  return (
    <aside className="lab-panel">
      <div className="flex items-center justify-between gap-3">
        <div><p className="lab-eyebrow">Mystery Research</p><h3>Teka-teki Hari Ini</h3></div>
        <span className="text-2xl">{claimed ? '🔓' : '🔒'}</span>
      </div>
      <p className="mt-3 rounded-2xl border border-amber-300/14 bg-amber-300/8 p-3 text-sm italic text-amber-100/90">“{m.riddle}”</p>
      {hintUsed ? (
        <p className="mt-2 text-xs text-slate-300">💡 {m.hint}</p>
      ) : (
        <button type="button" onClick={onUseHint} disabled={tokens < 1 || claimed} className="lab-button mt-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">Buka Hint (1 💡 · punya {tokens})</button>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">{solved ? 'Terpecahkan!' : 'Temukan jawabannya hari ini.'} +{m.rewardXp} XP · +{m.rewardCoins} 🪙</span>
        <button type="button" onClick={onClaim} disabled={!solved || claimed} className="lab-button text-xs disabled:cursor-not-allowed disabled:opacity-40">{claimed ? 'Claimed ✓' : solved ? 'Claim' : 'Locked'}</button>
      </div>
    </aside>
  )
}

function WeeklyQuestPanel({ discoveries, stats, onClaim }: { discoveries: Discovery[]; stats: Stats; onClaim: () => void }) {
  const q = getWeeklyQuest()
  const prog = weeklyProgress(q, discoveries)
  const done = prog >= q.target
  const claimed = isWeeklyClaimed(q, stats)
  return (
    <aside className="lab-panel">
      <div className="flex items-center justify-between gap-3">
        <div><p className="lab-eyebrow">Weekly Quest</p><h3>Discover {q.target} reactions</h3></div>
        <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-black text-violet-100">{prog}/{q.target}</span>
      </div>
      <div className="lab-progress mt-4"><div style={{ width: `${(prog / q.target) * 100}%` }} /></div>
      <p className="mt-3 text-sm text-slate-400">Temukan {q.target} penemuan baru minggu ini.</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">Reward: +{q.rewardXp} XP · +{q.rewardCoins} 🪙 · +{q.rewardHints} 💡</span>
        <button type="button" onClick={onClaim} disabled={!done || claimed} className="lab-button text-xs disabled:cursor-not-allowed disabled:opacity-40">{claimed ? 'Claimed ✓' : done ? 'Claim' : 'Locked'}</button>
      </div>
    </aside>
  )
}

function StreakLadderPanel({ stats, onClaim }: { stats: Stats; onClaim: (days: number) => void }) {
  const streak = stats.currentStreak ?? 0
  return (
    <aside className="lab-panel">
      <div className="flex items-center justify-between gap-3">
        <div><p className="lab-eyebrow">Streak Ladder</p><h3>{streak} hari beruntun 🔥</h3></div>
      </div>
      <div className="mt-3 space-y-2">
        {STREAK_TIERS.map((tier) => {
          const reached = isStreakReached(tier.days, stats)
          const claimed = isStreakClaimed(tier.days, stats)
          return (
            <div key={tier.days} className="flex items-center justify-between gap-2 rounded-2xl border border-white/8 bg-white/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-7 w-9 items-center justify-center rounded-full text-xs font-black ${reached ? 'bg-cyan-400/20 text-cyan-100' : 'bg-white/5 text-slate-500'}`}>{tier.days}d</span>
                <span className="text-xs text-slate-400">+{tier.rewardXp} XP · +{tier.rewardCoins} 🪙{tier.rewardHints ? ` · +${tier.rewardHints} 💡` : ''}</span>
              </div>
              <button type="button" onClick={() => onClaim(tier.days)} disabled={!reached || claimed} className="lab-button text-xs disabled:cursor-not-allowed disabled:opacity-40">{claimed ? '✓' : reached ? 'Claim' : '🔒'}</button>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function CollectionPanel({ discoveries }: { discoveries: Discovery[] }) {
  const count = discoveries.length
  const goal = nextMilestone(count)
  const pct = Math.min(100, Math.round((count / goal) * 100))
  return (
    <aside className="lab-panel">
      <div className="flex items-center justify-between gap-3">
        <div><p className="lab-eyebrow">Collection</p><h3>{count} discoveries</h3></div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-100">{pct}%</span>
      </div>
      <div className="lab-progress mt-4"><div style={{ width: `${pct}%` }} /></div>
      <p className="mt-3 text-xs text-slate-400">Menuju milestone berikutnya: {goal}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {COLLECTION_MILESTONES.map((m) => (
          <span key={m} className={`rounded-full px-2 py-0.5 text-[10px] font-black ${count >= m ? 'bg-cyan-400/20 text-cyan-100' : 'bg-white/5 text-slate-500'}`}>{m}</span>
        ))}
      </div>
    </aside>
  )
}

function ResearchLog({ discoveries }: { discoveries: Discovery[] }) {
  const recent = discoveries.slice(-4).reverse()
  return (
    <aside className="lab-panel">
      <p className="lab-eyebrow">Latest Research Log</p>
      <div className="mt-3 space-y-2">
        {recent.length ? recent.map((d) => (
          <div key={`${d.result}-${d.discoveredAt}`} className="research-log-row">
            <span>{d.emoji}</span>
            <div className="min-w-0 flex-1"><strong>{d.result}</strong><small>{d.formula ?? 'No formula'} · {RARITY_LABEL[d.rarity]}</small></div>
          </div>
        )) : <p className="text-sm text-slate-400">Belum ada discovery. Jalankan eksperimen pertama.</p>}
      </div>
    </aside>
  )
}

function MasteryPanel({ discoveries }: { discoveries: Discovery[] }) {
  const top = masteryBreakdown(discoveries).sort((a, b) => b.count - a.count).slice(0, 4)
  return (
    <aside className="lab-panel">
      <p className="lab-eyebrow">Chemistry Mastery</p>
      <div className="mt-3 space-y-3">
        {top.map((m) => (
          <div key={m.category}>
            <div className="mb-1 flex items-center justify-between text-xs"><span>{MASTERY_LABEL[m.category]}</span><span className="text-slate-400">{m.count}</span></div>
            <div className="lab-progress"><div style={{ width: `${m.pct}%` }} /></div>
          </div>
        ))}
      </div>
    </aside>
  )
}

export default function Home() {
  const { user } = useAuth()
  const { lang } = useI18n()
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
  const [reactorState, setReactorState] = useState<ReactorState>('idle')
  const [particles, setParticles] = useState<Particle[]>([])
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    setDiscoveries(loadDiscoveries())
    setStats({ ...DEFAULT_STATS, ...loadStats() })
    try { const k = localStorage.getItem(MIMO_KEY); if (k) setApiKey(k) } catch {}
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
    const count = success ? 42 : 14
    const spread = success ? 320 : 120
    const arr = Array.from({ length: count }, (_, i) => ({ id: i, x: (Math.random() - 0.5) * spread, y: (Math.random() - 0.5) * spread - 40, color: palette[i % palette.length], size: 4 + Math.random() * (success ? 12 : 7), delay: Math.random() * 0.22 }))
    setParticles(arr)
    setTimeout(() => setParticles([]), 1500)
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

  function commitStats(ns: Stats, toast: string) {
    setStats(ns)
    saveStats(ns)
    playUnlock()
    haptic(18)
    showToast(toast)
    if (user) pushStats(user.id, ns, totalXp(discoveries, ns)).catch(() => {})
  }

  async function signOut() {
    const sb = getSupabaseBrowser()
    await sb?.auth.signOut()
    setDiscoveries(loadDiscoveries())
  }

  function handleSaveKey(k: string) {
    setApiKey(k)
    try { if (k) localStorage.setItem(MIMO_KEY, k); else localStorage.removeItem(MIMO_KEY) } catch {}
  }

  function claimDaily() {
    const ch = getDailyChallenge()
    if (isDailyClaimed(ch, stats) || !isDailyComplete(ch, discoveries)) return
    commitStats({
      ...stats,
      completedDailyChallenges: [...(stats.completedDailyChallenges ?? []), ch.id],
      bonusXp: (stats.bonusXp ?? 0) + ch.rewardXp,
      coins: (stats.coins ?? 0) + ch.rewardCoins,
      hintTokens: (stats.hintTokens ?? 0) + ch.rewardHints,
    }, `Daily claimed! +${ch.rewardXp} XP · +${ch.rewardCoins} coins · +${ch.rewardHints} hint`)
  }

  function claimWeekly() {
    const q = getWeeklyQuest()
    if (isWeeklyClaimed(q, stats) || !isWeeklyComplete(q, discoveries)) return
    commitStats({
      ...stats,
      completedWeeklyQuests: [...(stats.completedWeeklyQuests ?? []), q.id],
      bonusXp: (stats.bonusXp ?? 0) + q.rewardXp,
      coins: (stats.coins ?? 0) + q.rewardCoins,
      hintTokens: (stats.hintTokens ?? 0) + q.rewardHints,
    }, `Weekly quest! +${q.rewardXp} XP · +${q.rewardCoins} coins · +${q.rewardHints} hint`)
  }

  function claimStreak(days: number) {
    const tier = STREAK_TIERS.find((t) => t.days === days)
    if (!tier || !isStreakReached(days, stats) || isStreakClaimed(days, stats)) return
    commitStats({
      ...stats,
      claimedStreakRewards: [...(stats.claimedStreakRewards ?? []), days],
      bonusXp: (stats.bonusXp ?? 0) + tier.rewardXp,
      coins: (stats.coins ?? 0) + tier.rewardCoins,
      hintTokens: (stats.hintTokens ?? 0) + tier.rewardHints,
    }, `Streak ${days}d! +${tier.rewardXp} XP · +${tier.rewardCoins} coins`)
  }

  function claimMystery() {
    const m = getMystery()
    if (isMysteryClaimed(m, stats) || !isMysterySolved(m, discoveries)) return
    commitStats({
      ...stats,
      solvedMysteries: [...(stats.solvedMysteries ?? []), m.id],
      bonusXp: (stats.bonusXp ?? 0) + m.rewardXp,
      coins: (stats.coins ?? 0) + m.rewardCoins,
    }, `Mystery solved! +${m.rewardXp} XP · +${m.rewardCoins} coins`)
  }

  function useMysteryHint() {
    const m = getMystery()
    if ((stats.hintTokens ?? 0) < 1 || isMysteryHintUsed(m, stats)) return
    const ns: Stats = {
      ...stats,
      hintTokens: (stats.hintTokens ?? 0) - 1,
      mysteryHintsUsed: [...(stats.mysteryHintsUsed ?? []), m.id],
    }
    setStats(ns)
    saveStats(ns)
    playPop()
    haptic(8)
    if (user) pushStats(user.id, ns, totalXp(discoveries, ns)).catch(() => {})
  }

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
  }

  return (
    <main className="lab-shell">
      <div className="lab-ambient" aria-hidden />
      <ParticleBurst particles={particles} />
      <header className="lab-topbar">
        <Link href="/pokedex" className="lab-nav-chip">📒 Archive</Link>
        <Link href="/leaderboard" className="lab-nav-chip">🏆 Reputation</Link>
        <button onClick={toggleTheme} className="lab-nav-chip" type="button">{theme === 'dark' ? '☀️' : '🌙'} Theme</button>
        <button onClick={() => setShowSettings(true)} className="lab-nav-chip" type="button">⚙️</button>
        <button onClick={() => setShowKey(true)} className="lab-nav-chip" type="button">🔑</button>
        {user ? <button onClick={signOut} className="lab-nav-chip" type="button">👤</button> : <button onClick={() => setShowAuth(true)} className="lab-nav-chip lab-nav-primary" type="button">Login</button>}
      </header>

      <LabStatus discoveries={discoveries} stats={stats} />

      <div className="lab-grid">
        <div className="lab-main-stage">
          <ReactionChamber selected={selEls} state={reactorState} dragOver={dragOver} onRun={combine} onClear={() => setSelected([])} onDropSpecimen={addToChamber} onDragStateChange={setDragOver} />
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

        <div className="lab-side-stage">
          <DailyResearchPanel discoveries={discoveries} stats={stats} onClaim={claimDaily} />
          <MysteryResearchPanel discoveries={discoveries} stats={stats} onClaim={claimMystery} onUseHint={useMysteryHint} />
          <WeeklyQuestPanel discoveries={discoveries} stats={stats} onClaim={claimWeekly} />
          <StreakLadderPanel stats={stats} onClaim={claimStreak} />
          <CollectionPanel discoveries={discoveries} />
          <MasteryPanel discoveries={discoveries} />
          <ResearchLog discoveries={discoveries} />
        </div>
      </div>

      {discovery && <DiscoveryModal result={discovery.result} isNew={discovery.isNew} xpGain={discovery.xpGain} onClose={() => setDiscovery(null)} />}
      {showKey && <ApiKeyModal current={apiKey} onClose={() => setShowKey(false)} onSave={handleSaveKey} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {achToast && <AchievementToast emoji={achToast.emoji} title={achToast.title} label={achToast.label} />}
      {msg && <div className="toast-enter fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/92 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur">{msg}</div>}
    </main>
  )
}
