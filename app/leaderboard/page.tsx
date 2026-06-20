'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { loadStats, saveStats } from '@/lib/storage'
import { levelFromXp } from '@/lib/progress'
import { pullLeaderboard, updateDisplayName, type LeaderboardEntry } from '@/lib/cloud'
import { useI18n } from '@/lib/i18n'

function rankBadge(rank: number): string {
  if (rank === 1) return '\ud83e\udd47'
  if (rank === 2) return '\ud83e\udd48'
  if (rank === 3) return '\ud83e\udd49'
  return '#' + rank
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setEntries(await pullLeaderboard(50))
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    const s = loadStats()
    if (s.displayName) setName(s.displayName)
  }, [])

  async function saveName() {
    if (!user) return
    const trimmed = name.trim().slice(0, 20)
    if (!trimmed) {
      setMsg(t('leaderboard.emptyName'))
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await updateDisplayName(user.id, trimmed)
      const s = loadStats()
      saveStats({ ...s, displayName: trimmed })
      setMsg(t('leaderboard.saved'))
      setTimeout(() => setMsg(null), 2000)
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-6 pb-28">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="lab-eyebrow">BYAS \u00b7 Reputation</p>
          <h1 className="truncate text-2xl font-black tracking-tight">\ud83c\udfc6 {t('leaderboard.title')}</h1>
          <p className="mt-0.5 text-xs text-muted">{t('leaderboard.subtitle')}</p>
        </div>
        <Link href="/" className="lab-button shrink-0">{t('pokedex.back')}</Link>
      </header>

      {user ? (
        <div className="lab-panel">
          <p className="lab-eyebrow">{t('leaderboard.usernameLabel')}</p>
          <div className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder={t('leaderboard.usernamePlaceholder')}
              className="flex-1 rounded-xl border border-base bg-white/[0.04] px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-300/40"
            />
            <button
              onClick={saveName}
              disabled={saving}
              className="lab-button-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? '...' : t('leaderboard.save')}
            </button>
          </div>
          {msg ? <p className="mt-2 text-xs text-cyan-300">{msg}</p> : null}
        </div>
      ) : (
        <p className="lab-panel text-sm text-muted">{t('leaderboard.loginToJoin')}</p>
      )}

      <section>
        {loading ? (
          <p className="text-center text-sm text-muted">{t('leaderboard.loading')}</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-sm text-muted">{t('leaderboard.empty')}</p>
        ) : (
          <ol className="space-y-2">
            {entries.map((e, i) => {
              const isMe = Boolean(user && e.userId === user.id)
              const cls =
                'flex items-center gap-3 rounded-2xl border p-3 ' +
                (isMe ? 'border-cyan-300/40 bg-cyan-300/10' : 'border-base bg-white/[0.03]')
              return (
                <li key={e.userId} className={cls}>
                  <span className="w-8 text-center text-sm font-black">{rankBadge(i + 1)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {e.displayName || t('leaderboard.mystery')}
                      {isMe ? <span className="ml-2 text-xs text-cyan-300">{t('leaderboard.you')}</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {t('leaderboard.levelStreak', { lvl: levelFromXp(e.totalXp), n: e.currentStreak })}
                    </p>
                  </div>
                  <span className="text-sm font-black text-cyan-200">{e.totalXp} XP</span>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </main>
  )
}
