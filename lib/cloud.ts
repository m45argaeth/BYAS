import type { Discovery, MasteryCategory, Rarity, Stats } from './types'
import { getSupabaseBrowser } from './supabaseBrowser'

const COLS = 'result, formula, emoji, explanation, fun_fact, rarity, discovered_at, category, difficulty, xp, hint, ingredients'
const STAT_COLS = 'current_streak, best_streak, last_played, display_name, total_xp, bonus_xp, coins, hint_tokens, lab_reputation, completed_daily_challenges, completed_weekly_quests, claimed_streak_rewards, solved_mysteries, mystery_hints_used, failed_experiments'
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const CATEGORIES: MasteryCategory[] = ['organic', 'inorganic', 'metals', 'gases', 'biology', 'energy', 'industrial']

function safeRarity(value: unknown): Rarity {
  return RARITIES.includes(value as Rarity) ? (value as Rarity) : 'common'
}

function safeCategory(value: unknown): MasteryCategory | undefined {
  return CATEGORIES.includes(value as MasteryCategory) ? (value as MasteryCategory) : undefined
}

function arr<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function toRow(userId: string, d: Discovery) {
  return {
    user_id: userId,
    result: d.result,
    formula: d.formula,
    emoji: d.emoji,
    explanation: d.explanation,
    fun_fact: d.fun_fact,
    rarity: d.rarity,
    category: d.category,
    difficulty: d.difficulty,
    xp: d.xp,
    hint: d.hint,
    ingredients: d.ingredients ?? [],
    discovered_at: new Date(d.discoveredAt).toISOString(),
  }
}

export async function pullCloudDiscoveries(userId: string): Promise<Discovery[]> {
  const sb = getSupabaseBrowser()
  if (!sb) return []
  const { data, error } = await sb.from('user_discoveries').select(COLS).eq('user_id', userId)
  if (error || !data) return []
  return data.map((r: any) => ({
    result: r.result,
    formula: r.formula ?? null,
    emoji: r.emoji ?? '✨',
    explanation: r.explanation ?? '',
    fun_fact: r.fun_fact ?? '',
    rarity: safeRarity(r.rarity),
    category: safeCategory(r.category),
    difficulty: r.difficulty ?? undefined,
    xp: r.xp ?? undefined,
    hint: r.hint ?? undefined,
    ingredients: Array.isArray(r.ingredients) ? r.ingredients : undefined,
    reacted: true,
    discoveredAt: r.discovered_at ? new Date(r.discovered_at).getTime() : Date.now(),
  }))
}

export async function pushCloudDiscovery(userId: string, d: Discovery): Promise<void> {
  const sb = getSupabaseBrowser()
  if (!sb) return
  await sb.from('user_discoveries').upsert(toRow(userId, d), { onConflict: 'user_id,result' })
}

export async function pushManyCloudDiscoveries(userId: string, ds: Discovery[]): Promise<void> {
  const sb = getSupabaseBrowser()
  if (!sb || !ds.length) return
  await sb.from('user_discoveries').upsert(
    ds.map((d) => toRow(userId, d)),
    { onConflict: 'user_id,result' },
  )
}

// ---- Stats ----

export async function pullStats(userId: string): Promise<Stats | null> {
  const sb = getSupabaseBrowser()
  if (!sb) return null
  const { data, error } = await sb
    .from('player_stats')
    .select(STAT_COLS)
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    currentStreak: data.current_streak ?? 0,
    bestStreak: data.best_streak ?? 0,
    lastPlayed: data.last_played ?? null,
    displayName: data.display_name ?? null,
    totalXp: data.total_xp ?? 0,
    bonusXp: data.bonus_xp ?? 0,
    coins: data.coins ?? 0,
    hintTokens: data.hint_tokens ?? 0,
    labReputation: data.lab_reputation ?? 0,
    completedDailyChallenges: arr<string>(data.completed_daily_challenges),
    completedWeeklyQuests: arr<string>(data.completed_weekly_quests),
    claimedStreakRewards: arr<number>(data.claimed_streak_rewards),
    solvedMysteries: arr<string>(data.solved_mysteries),
    mysteryHintsUsed: arr<string>(data.mystery_hints_used),
    failedExperiments: data.failed_experiments ?? 0,
  }
}

// Push streak + total XP + retention state. Sengaja TIDAK menyentuh display_name
// biar tidak menimpa username yang mungkin di-set dari device lain.
export async function pushStats(userId: string, s: Stats, totalXp: number): Promise<void> {
  const sb = getSupabaseBrowser()
  if (!sb) return
  await sb.from('player_stats').upsert(
    {
      user_id: userId,
      current_streak: s.currentStreak,
      best_streak: s.bestStreak,
      last_played: s.lastPlayed,
      total_xp: totalXp,
      bonus_xp: s.bonusXp ?? 0,
      coins: s.coins ?? 0,
      hint_tokens: s.hintTokens ?? 0,
      lab_reputation: s.labReputation ?? totalXp,
      completed_daily_challenges: s.completedDailyChallenges ?? [],
      completed_weekly_quests: s.completedWeeklyQuests ?? [],
      claimed_streak_rewards: s.claimedStreakRewards ?? [],
      solved_mysteries: s.solvedMysteries ?? [],
      mystery_hints_used: s.mysteryHintsUsed ?? [],
      failed_experiments: s.failedExperiments ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
}

// Update total XP saja (dipakai saat dapat penemuan baru tanpa ubah streak).
export async function pushTotalXp(userId: string, totalXp: number): Promise<void> {
  const sb = getSupabaseBrowser()
  if (!sb) return
  await sb.from('player_stats').upsert(
    { user_id: userId, total_xp: totalXp, lab_reputation: totalXp, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
}

export async function updateDisplayName(userId: string, name: string): Promise<void> {
  const sb = getSupabaseBrowser()
  if (!sb) return
  await sb.from('player_stats').upsert(
    { user_id: userId, display_name: name, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
}

// ---- Leaderboard ----

export interface LeaderboardEntry {
  userId: string
  displayName: string | null
  totalXp: number
  currentStreak: number
}

export async function pullLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const sb = getSupabaseBrowser()
  if (!sb) return []
  const { data, error } = await sb
    .from('player_stats')
    .select('user_id, display_name, total_xp, current_streak')
    .order('total_xp', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map((r: any) => ({
    userId: r.user_id,
    displayName: r.display_name ?? null,
    totalXp: r.total_xp ?? 0,
    currentStreak: r.current_streak ?? 0,
  }))
}
