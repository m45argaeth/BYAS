'use client'

import { useEffect, useState } from 'react'
import type { Discovery, Stats } from '@/lib/types'
import { loadDiscoveries, loadStats, saveStats } from '@/lib/storage'
import { totalXp } from '@/lib/progress'
import { getDailyChallenge, isDailyClaimed, isDailyComplete } from '@/lib/daily'
import { getWeeklyQuest, isWeeklyClaimed, isWeeklyComplete, getMystery, isMysterySolved, isMysteryClaimed, isMysteryHintUsed, STREAK_TIERS, isStreakClaimed, isStreakReached } from '@/lib/retention'
import { useAuth } from '@/lib/useAuth'
import { syncDiscoveries, syncStats } from '@/lib/sync'
import { pushStats } from '@/lib/cloud'

export const DEFAULT_STATS: Stats = { currentStreak: 0, bestStreak: 0, lastPlayed: null, displayName: null, hintTokens: 0, coins: 0, bonusXp: 0, failedExperiments: 0 }

export function useGameData() {
  const { user } = useAuth()
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setDiscoveries(loadDiscoveries())
    setStats({ ...DEFAULT_STATS, ...loadStats() })
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    syncDiscoveries(user.id).then((merged) => { if (!cancelled) setDiscoveries(merged) })
    syncStats(user.id).then((s) => { if (!cancelled) setStats({ ...DEFAULT_STATS, ...s }) })
    return () => { cancelled = true }
  }, [user])

  function showToast(text: string) { setMsg(text); setTimeout(() => setMsg(null), 2600) }

  function commitStats(ns: Stats, toast: string) {
    setStats(ns)
    saveStats(ns)
    showToast(toast)
    if (user) pushStats(user.id, ns, totalXp(discoveries, ns)).catch(() => {})
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
    }, `Daily claimed! +${ch.rewardXp} XP · +${ch.rewardCoins} coins`)
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
    }, `Weekly quest! +${q.rewardXp} XP · +${q.rewardCoins} coins`)
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
    if (user) pushStats(user.id, ns, totalXp(discoveries, ns)).catch(() => {})
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

  return { user, discoveries, stats, msg, claimDaily, claimWeekly, claimMystery, useMysteryHint, claimStreak }
}
