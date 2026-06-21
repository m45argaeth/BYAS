'use client'

import type { Discovery, Stats } from '@/lib/types'
import { getDailyChallenge, dailyProgress, isDailyClaimed } from '@/lib/daily'
import { getWeeklyQuest, weeklyProgress, isWeeklyClaimed, getMystery, isMysterySolved, isMysteryClaimed, isMysteryHintUsed, STREAK_TIERS, isStreakClaimed, isStreakReached } from '@/lib/retention'
import { COLLECTION_MILESTONES, labReputation, masteryBreakdown, MASTERY_LABEL, nextMilestone } from '@/lib/progress'
import { RARITY_LABEL } from '@/lib/rarity'
import { useI18n } from '@/lib/i18n'
import { discoveryText } from '@/lib/localize'

export function DailyResearchPanel({ discoveries, stats, onClaim }: { discoveries: Discovery[]; stats: Stats; onClaim: () => void }) {
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

export function MysteryResearchPanel({ discoveries, stats, onClaim, onUseHint }: { discoveries: Discovery[]; stats: Stats; onClaim: () => void; onUseHint: () => void }) {
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

export function WeeklyQuestPanel({ discoveries, stats, onClaim }: { discoveries: Discovery[]; stats: Stats; onClaim: () => void }) {
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

export function StreakLadderPanel({ stats, onClaim }: { stats: Stats; onClaim: (days: number) => void }) {
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

export function StatsPanel({ discoveries, stats }: { discoveries: Discovery[]; stats: Stats }) {
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

export function CollectionPanel({ discoveries }: { discoveries: Discovery[] }) {
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

export function ResearchLog({ discoveries }: { discoveries: Discovery[] }) {
  const { t, lang } = useI18n()
  const recent = discoveries.slice(-6).reverse()
  return (
    <aside className="lab-panel">
      <p className="lab-eyebrow">{t('log.title')}</p>
      <div className="mt-3 space-y-2">
        {recent.length ? recent.map((d) => (
          <div key={`${d.result}-${d.discoveredAt}`} className="research-log-row">
            <span>{d.emoji}</span>
            <div className="min-w-0 flex-1"><strong>{discoveryText(d, lang).result}</strong><small>{d.formula ?? t('log.noFormula')} · {RARITY_LABEL[d.rarity]}</small></div>
          </div>
        )) : <p className="text-sm text-muted">{t('log.empty')}</p>}
      </div>
    </aside>
  )
}

export function MasteryPanel({ discoveries }: { discoveries: Discovery[] }) {
  const top = masteryBreakdown(discoveries).sort((a, b) => b.count - a.count).slice(0, 5)
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
