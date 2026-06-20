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
type SideTab = 'quests' | 'rewards' | 'progress'
type MobileView = 'lab' | 'panel'
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

function StageHead({ discoveries, stats }: { discoveries: Discovery[]; stats: Stats }) {
  const xp = totalXp(discoveries, stats)
  const progress = levelProgress(xp)
  const rank = researchRank(progress.level, discoveries.length)
  return (
    <header className="stage-head">
      <div className="stage-head-id">
        <span className="stage-eyebrow">BYAS \u00b7 Reaction Lab</span>
        <strong>Lv {progress.level} \u00b7 {rank}</strong>
      </div>
      <div className="stage-head-xp" aria-label={`Research XP ${progress.into} of ${progress.span}`}>
        <div className="xp-mini"><div style={{ width: `${progress.pct}%` }} /></div>
      </div>
      <div className="stage-head-chips">
        <span className="hud-chip">\ud83d\udd25 {stats.currentStreak || 0}</span>
        <span className="hud-chip">\ud83e\ude99 {stats.coins ?? 0}</span>
      </div>
    </header>
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
      <span className="specimen-number">{element.atomicNumber ?? '\u221e'}</span>
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
      <small>{element.atomicNumber ?? '\u221e'}</small>
      <strong>{symbol}</strong>
      <span>{element.name}</span>
    </button>
  )
}

function ReactionChamber({ selected, state, dragOver, onRun, onClear, onDropSpecimen, onRemoveSpecimen, onDragStateChange }: { selected: Element[]; state: ReactorState; dragOver: boolean; onRun: () => void; onClear: () => void; onDropSpecimen: (id: string) => void; onRemoveSpecimen: (index: number) => void; onDragStateChange: (v: boolean) => void }) {
  const ready = selected.length === 2 && state !== 'reacting'
  const step = state === 'reacting' ? 4 : selected.length === 0 ? 1 : selected.length === 1 ? 2 : 3
  const status = state === 'reacting' ? 'Reaction in progress\u2026' : ready ? 'Ready \u2014 run the experiment' : selected.length === 1 ? 'Pick a second specimen' : 'Insert two specimens'
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
        <p className="chamber-step"><b>{step}/4</b> Pick A \u00b7 Pick B \u00b7 React \u00b7 Discover</p>
        <div className="chamber-slots">
          <ChamberSlot element={selected[0]} label="Specimen A" onRemove={() => onRemoveSpecimen(0)} />
          <div className="chamber-plus">+</div>
          <ChamberSlot element={selected[1]} label="Specimen B" onRemove={() => onRemoveSpecimen(1)} />
        </div>
        <h2>{status}</h2>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={onRun} disabled={!ready} className="lab-button-primary min-w-44 disabled:cursor-not-allowed disabled:opacity-40">
            {state === 'reacting' ? 'Synthesizing\u2026' : 'Run Experiment'}
          </button>
          {selected.length ? <button type="button" onClick={onClear} className="lab-button">Clear</button> : null}
        </div>
        <p className="chamber-hint">Tarik specimen ke chamber, atau tekan <span className="kbd-hint"><kbd>Enter</kbd></span> untuk reaksi \u00b7 <span className="kbd-hint"><kbd>Esc</kbd></span> reset</p>
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
      <p className="mt-3 text-sm text-muted">{ch.description}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">Reward: +{ch.rewardXp} XP \u00b7 +{ch.rewardCoins} \ud83e\ude99 \u00b7 +{ch.rewardHints} \ud83d\udca1</span>
        <button type="button" onClick={onClaim} disabled={!done || claimed} className="lab-button text-xs disabled:cursor-not-allowed disabled:opacity-40">{claimed ? 'Claimed \u2713' : done ? 'Claim' : 'Locked'}</button>
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
        <span className="text-2xl">{claimed ? '\ud83d\udd13' : '\ud83d\udd12'}</span>
      </div>
      <p className="mt-3 rounded-2xl border border-amber-300/14 bg-amber-300/8 p-3 text-sm italic text-amber-100/90">\u201c{m.riddle}\u201d</p>
      {hintUsed ? (
        <p className="mt-2 text-xs text-muted">\ud83d\udca1 {m.hint}</p>
      ) : (
        <button type="button" onClick={onUseHint} disabled={tokens < 1 || claimed} className="lab-button mt-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">Buka Hint (1 \ud83d\udca1 \u00b7 punya {tokens})</button>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{solved ? 'Terpecahkan!' : 'Temukan jawabannya hari ini.'} +{m.rewardXp} XP \u00b7 +{m.rewardCoins} \ud83e\ude99</span>
        <button type="button" onClick={onClaim} disabled={!solved || claimed} className="lab-button text-xs disabled:cursor-not-allowed disabled:opacity-40">{claimed ? 'Claimed \u2713' : solved ? 'Claim' : 'Locked'}</button>
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
      <p className="mt-3 text-sm text-muted">Temukan {q.target} penemuan baru minggu ini.</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">Reward: +{q.rewardXp} XP \u00b7 +{q.rewardCoins} \ud83e\ude99 \u00b7 +{q.rewardHints} \ud83d\udca1</span>
        <button type="button" onClick={onClaim} disabled={!done || claimed} className="lab-button text-xs disabled:cursor-not-allowed disabled:opacity-40">{claimed ? 'Claimed \u2713' : done ? 'Claim' : 'Locked'}</button>
      </div>
    </aside>
  )
}

function StreakLadderPanel({ stats, onClaim }: { stats: Stats; onClaim: (days: number) => void }) {
  const streak = stats.currentStreak ?? 0
  return (
    <aside className="lab-panel">
      <div className="flex items-center justify-between gap-3">
        <div><p className="lab-eyebrow">Streak Ladder</p><h3>{streak} hari beruntun \ud83d\udd25</h3></div>
      </div>
      <div className="mt-3 space-y-2">
        {STREAK_TIERS.map((tier) => {
          const reached = isStreakReached(tier.days, stats)
          const claimed = isStreakClaimed(tier.days, stats)
          return (
            <div key={tier.days} className="flex items-center justify-between gap-2 rounded-2xl border border-white/8 bg-white/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-7 w-9 items-center justify-center rounded-full text-xs font-black ${reached ? 'bg-cyan-400/20 text-cyan-100' : 'bg-white/5 text-slate-500'}`}>{tier.days}d</span>
                <span className="text-xs text-muted">+{tier.rewardXp} XP \u00b7 +{tier.rewardCoins} \ud83e\ude99{tier.rewardHints ? ` \u00b7 +${tier.rewardHints} \ud83d\udca1` : ''}</span>
              </div>
              <button type="button" onClick={() => onClaim(tier.days)} disabled={!reached || claimed} className="lab-button text-xs disabled:cursor-not-allowed disabled:opacity-40">{claimed ? '\u2713' : reached ? 'Claim' : '\ud83d\udd12'}</button>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function StatsPanel({ discoveries, stats }: { discoveries: Discovery[]; stats: Stats }) {
  const goal = nextMilestone(discoveries.length)
  const rep = labReputation(discoveries, stats)
  return (
    <aside className="lab-panel">
      <p className="lab-eyebrow">Lab Statistics</p>
      <div className="stat-grid">
        <div className="stat-cell"><span>{discoveries.length}/{goal}</span><small>Discovery Index</small></div>
        <div className="stat-cell"><span>{stats.currentStreak || 0}d</span><small>Active Streak</small></div>
        <div className="stat-cell"><span>{stats.coins ?? 0}</span><small>Lab Coins</small></div>
        <div className="stat-cell"><span>{rep}</span><small>Reputation</small></div>
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
      <p className="mt-3 text-xs text-muted">Menuju milestone berikutnya: {goal}</p>
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
            <div className="min-w-0 flex-1"><strong>{d.result}</strong><small>{d.formula ?? 'No formula'} \u00b7 {RARITY_LABEL[d.rarity]}</small></div>
          </div>
        )) : <p className="text-sm text-muted">Belum ada discovery. Jalankan eksperimen pertama.</p>}
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
            <div className="mb-1 flex items-center justify-between text-xs"><span>{MASTERY_LABEL[m.category]}</span><span className="text-muted">{m.count}</span></div>
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
  const [sideTab, setSideTab] = useState<SideTab>('quests')
  const [mobileView, setMobileView] = useState<MobileView>('lab')

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
  const canRun = selEls.length === 2 && !loading

  const spawnParticles = useCallback((success: boolean, rarity: keyof typeof RARITY_GLOW = 'rare') => {
    const palette = success ? ['#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#fbbf24', '#34d399'] : ['#fb7185', '#f97316', '#fca5a5']
    const count = success ? 16 : 8
    const spread = success ? 260 : 110
    const arr = Array.from({ length: count }, (_, i) => ({ id: i, x: (Math.random() - 0.5) * spread, y: (Math.random() - 0.5) * spread - 40, color: palette[i % palette.length], size: 4 + Math.random() * (success ? 9 : 5), delay: Math.random() * 0.2 }))
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
    }, `Daily claimed! +${ch.rewardXp} XP \u00b7 +${ch.rewardCoins} coins \u00b7 +${ch.rewardHints} hint`)
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
    }, `Weekly quest! +${q.rewardXp} XP \u00b7 +${q.rewardCoins} coins \u00b7 +${q.rewardHints} hint`)
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
    }, `Streak ${days}d! +${tier.rewardXp} XP \u00b7 +${tier.rewardCoins} coins`)
  }

  function claimMystery() {
    const m = getMystery()
    if (isMysteryClaimed(m, stats) || !isMysterySolved(m, discoveries)) return
    commitStats({
      ...stats,
      solvedMysteries: [...(stats.solvedMysteries ?? []), m.id],
      bonusXp: (stats.bonusXp ?? 0) + m.rewardXp,
      coins: (stats.coins ?? 0) + m.rewardCoins,
    }, `Mystery solved! +${m.rewardXp} XP \u00b7 +${m.rewardCoins} coins`)
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

  const combine = useCallback(async () => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, loading, inventory, apiKey, lang, stats, discoveries, user, spawnParticles])

  // Keyboard combine + reset (a11y)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (discovery || showKey || showAuth || showSettings) return
      if (e.key === 'Enter' && selected.length === 2 && !loading) { e.preventDefault(); combine() }
      else if ((e.key === 'Escape' || e.key === 'Backspace') && selected.length) { e.preventDefault(); setSelected([]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, loading, combine, discovery, showKey, showAuth, showSettings])

  // Indikator reward yang siap di-claim (untuk badge tab)
  const dailyCh = getDailyChallenge()
  const weeklyQ = getWeeklyQuest()
  const mystery = getMystery()
  const questsClaimable =
    (isDailyComplete(dailyCh, discoveries) && !isDailyClaimed(dailyCh, stats)) ||
    (isWeeklyComplete(weeklyQ, discoveries) && !isWeeklyClaimed(weeklyQ, stats)) ||
    (isMysterySolved(mystery, discoveries) && !isMysteryClaimed(mystery, stats))
  const rewardsClaimable = STREAK_TIERS.some((t) => isStreakReached(t.days, stats) && !isStreakClaimed(t.days, stats))
  const anyClaimable = questsClaimable || rewardsClaimable

  function openPanel(tab: SideTab) { setSideTab(tab); setMobileView('panel') }
  function openProfile() { if (user) setShowSettings(true); else setShowAuth(true) }

  return (
    <main className="app" data-mview={mobileView} data-side={sideTab}>
      <ParticleBurst particles={particles} />

      {/* Desktop rail */}
      <aside className="rail">
        <div className="rail-brand" aria-hidden>\u2697\ufe0f</div>
        <nav className="rail-nav" aria-label="Primary">
          <button type="button" className="rail-btn is-active" aria-current="page" title="Lab">\ud83e\uddea</button>
          <Link href="/pokedex" className="rail-btn" title="Archive">\ud83d\udcd2</Link>
          <Link href="/leaderboard" className="rail-btn" title="Reputation">\ud83c\udfc6</Link>
        </nav>
        <div className="rail-foot">
          <button onClick={toggleTheme} className="rail-btn" type="button" aria-label="Toggle theme">{theme === 'dark' ? '\u2600\ufe0f' : '\ud83c\udf19'}</button>
          <button onClick={() => setShowSettings(true)} className="rail-btn" type="button" aria-label="Settings">\u2699\ufe0f</button>
          <button onClick={() => setShowKey(true)} className="rail-btn" type="button" aria-label="API key">\ud83d\udd11</button>
          {user ? <button onClick={signOut} className="rail-btn" type="button" aria-label="Sign out">\ud83d\udc64</button> : <button onClick={() => setShowAuth(true)} className="rail-btn is-active" type="button" aria-label="Login">\u27a1\ufe0f</button>}
        </div>
      </aside>

      {/* Center gameplay */}
      <section className="stage" aria-label="Gameplay">
        <StageHead discoveries={discoveries} stats={stats} />
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
      </section>

      {/* Right progression panel */}
      <aside className="panel" aria-label="Progression">
        <div className="panel-tabs" role="tablist" aria-label="Lab panels">
          <button type="button" role="tab" aria-selected={sideTab === 'quests'} onClick={() => setSideTab('quests')} className={`ptab ${sideTab === 'quests' ? 'is-active' : ''}`}>\ud83c\udfaf Quests{questsClaimable ? <span className="dot" aria-label="reward ready" /> : null}</button>
          <button type="button" role="tab" aria-selected={sideTab === 'rewards'} onClick={() => setSideTab('rewards')} className={`ptab ${sideTab === 'rewards' ? 'is-active' : ''}`}>\ud83c\udfc6 Rewards{rewardsClaimable ? <span className="dot" aria-label="reward ready" /> : null}</button>
          <button type="button" role="tab" aria-selected={sideTab === 'progress'} onClick={() => setSideTab('progress')} className={`ptab ${sideTab === 'progress' ? 'is-active' : ''}`}>\ud83d\udcca Progress</button>
        </div>
        <div className="panel-scroll">
          {sideTab === 'quests' && (
            <>
              <DailyResearchPanel discoveries={discoveries} stats={stats} onClaim={claimDaily} />
              <MysteryResearchPanel discoveries={discoveries} stats={stats} onClaim={claimMystery} onUseHint={useMysteryHint} />
              <WeeklyQuestPanel discoveries={discoveries} stats={stats} onClaim={claimWeekly} />
            </>
          )}
          {sideTab === 'rewards' && <StreakLadderPanel stats={stats} onClaim={claimStreak} />}
          {sideTab === 'progress' && (
            <>
              <CollectionPanel discoveries={discoveries} />
              <MasteryPanel discoveries={discoveries} />
              <ResearchLog discoveries={discoveries} />
              <StatsPanel discoveries={discoveries} stats={stats} />
            </>
          )}
        </div>
      </aside>

      {/* Mobile sticky Experiment CTA */}
      <div className="cta-dock">
        <button type="button" className="cta-run" onClick={combine} disabled={!canRun}>
          {reactorState === 'reacting' ? 'Synthesizing\u2026' : canRun ? 'Run Experiment' : `Pick ${2 - selEls.length} more specimen`}
        </button>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="tabbar" aria-label="Sections">
        <button type="button" className={`tab-item ${mobileView === 'lab' ? 'is-active' : ''}`} onClick={() => setMobileView('lab')}><span className="ico">\ud83e\uddea</span>Lab</button>
        <button type="button" className={`tab-item ${mobileView === 'panel' && sideTab === 'quests' ? 'is-active' : ''}`} onClick={() => openPanel('quests')}><span className="ico">\ud83c\udfaf</span>Quests{anyClaimable ? <span className="dot" aria-label="reward ready" /> : null}</button>
        <button type="button" className={`tab-item ${mobileView === 'panel' && sideTab === 'progress' ? 'is-active' : ''}`} onClick={() => openPanel('progress')}><span className="ico">\ud83d\udcca</span>Progress</button>
        <Link href="/pokedex" className="tab-item"><span className="ico">\ud83d\udcd2</span>Archive</Link>
        <button type="button" className="tab-item" onClick={openProfile}><span className="ico">\ud83d\udc64</span>You</button>
      </nav>

      {discovery && <DiscoveryModal result={discovery.result} isNew={discovery.isNew} xpGain={discovery.xpGain} onClose={() => setDiscovery(null)} />}
      {showKey && <ApiKeyModal current={apiKey} onClose={() => setShowKey(false)} onSave={handleSaveKey} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {achToast && <AchievementToast emoji={achToast.emoji} title={achToast.title} label={achToast.label} />}
      {msg && <div className="toast-enter fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/92 px-4 py-3 text-sm text-white shadow-2xl" role="status">{msg}</div>}
    </main>
  )
}
