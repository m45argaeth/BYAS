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
import { COLLECTION_MILESTONES, labReputation, levelProgress, masteryBreakdown, MASTERY_LABEL, nextMilestone, recordPlay, totalXp, xpForNewDiscovery } from '@/lib/progress'
import { getDailyChallenge, dailyProgress, isDailyClaimed, isDailyComplete } from '@/lib/daily'
import { getWeeklyQuest, weeklyProgress, isWeeklyClaimed, isWeeklyComplete, getMystery, isMysterySolved, isMysteryClaimed, isMysteryHintUsed, STREAK_TIERS, isStreakClaimed, isStreakReached } from '@/lib/retention'
import { useAuth } from '@/lib/useAuth'
import { syncDiscoveries, syncStats } from '@/lib/sync'
import { pushCloudDiscovery, pushStats, pushTotalXp } from '@/lib/cloud'
import { useI18n } from '@/lib/i18n'
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
        <span className="text-xs text-muted">Reward: +{ch.rewardXp} XP · +{ch.rewardCoins} 🪙 · +{ch.rewardHints} 💡</span>
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
        <p className="mt-2 text-xs text-muted">💡 {m.hint}</p>
      ) : (
        <button type="button" onClick={onUseHint} disabled={tokens < 1 || claimed} className="lab-button mt-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">Buka Hint (1 💡 · punya {tokens})</button>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{solved ? 'Terpecahkan!' : 'Temukan jawabannya hari ini.'} +{m.rewardXp} XP · +{m.rewardCoins} 🪙</span>
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
      <p className="mt-3 text-sm text-muted">Temukan {q.target} penemuan baru minggu ini.</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">Reward: +{q.rewardXp} XP · +{q.rewardCoins} 🪙 · +{q.rewardHints} 💡</span>
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
                <span className="text-xs text-muted">+{tier.rewardXp} XP · +{tier.rewardCoins} 🪙{tier.rewardHints ? ` · +${tier.rewardHints} 💡` : ''}</span>
              </div>
              <button type="button" onClick={() => onClaim(tier.days)} disabled={!reached || claimed} className="lab-button text-xs disabled:cursor-not-allowed disabled:opacity-40">{claimed ? '✓' : reached ? 'Claim' : '🔒'}</button>
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
            <div className="min-w-0 flex-1"><strong>{d.result}</strong><small>{d.formula ?? 'No formula'} · {RARITY_LABEL[d.rarity]}</small></div>
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
