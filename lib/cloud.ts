import type { Discovery, Stats } from './types'
import { getSupabaseBrowser } from './supabaseBrowser'

const COLS = 'result, formula, emoji, explanation, fun_fact, rarity, discovered_at'

function toRow(userId: string, d: Discovery) {
  return {
    user_id: userId,
    result: d.result,
    formula: d.formula,
    emoji: d.emoji,
    explanation: d.explanation,
    fun_fact: d.fun_fact,
    rarity: d.rarity,
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
    rarity: r.rarity ?? 'common',
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
    .select('current_streak, best_streak, last_played, display_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    currentStreak: data.current_streak ?? 0,
    bestStreak: data.best_streak ?? 0,
    lastPlayed: data.last_played ?? null,
    displayName: data.display_name ?? null,
  }
}

// Push streak + total XP. Sengaja TIDAK menyentuh display_name biar tidak
// menimpa username yang mungkin di-set dari device lain.
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
    { user_id: userId, total_xp: totalXp, updated_at: new Date().toISOString() },
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
