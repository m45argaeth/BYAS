'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { loadStats, saveStats } from '@/lib/storage'
import { levelFromXp } from '@/lib/progress'
import { pullLeaderboard, updateDisplayName, type LeaderboardEntry } from '@/lib/cloud'
import { useI18n } from '@/lib/i18n'

function rankBadge(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
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
    <main className='mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6'>
      <header className='flex items-center justify-between gap-2'>
        <div className='min-w-0'>
          <h1 className='truncate text-2xl font-extrabold tracking-tight'>🏆 {t('leaderboard.title')}</h1>
          <p className='text-xs text-muted'>{t('leaderboard.subtitle')}</p>
        </div>
        <Link href='/' className='rounded-full card-2 px-3 py-1.5 text-xs hover:opacity-80'>
          {t('pokedex.back')}
        </Link>
      </header>

      {user ? (
        <div className='mt-4 rounded-2xl card p-3'>
          <label className='text-xs text-muted'>{t('leaderboard.usernameLabel')}</label>
          <div className='mt-2 flex gap-2'>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder={t('leaderboard.usernamePlaceholder')}
              className='flex-1 rounded-lg border border-base card-2 px-3 py-2 text-sm outline-none'
            />
            <button
              onClick={saveName}
              disabled={saving}
              className='rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50'
            >
              {saving ? '...' : t('leaderboard.save')}
            </button>
          </div>
          {msg ? <p className='mt-2 text-xs text-emerald-400'>{msg}</p> : null}
        </div>
      ) : (
        <p className='mt-4 rounded-2xl card p-3 text-sm text-muted'>{t('leaderboard.loginToJoin')}</p>
      )}

      <section className='mt-6'>
        {loading ? (
          <p className='text-center text-sm text-muted'>{t('leaderboard.loading')}</p>
        ) : entries.length === 0 ? (
          <p className='text-center text-sm text-muted'>{t('leaderboard.empty')}</p>
        ) : (
          <ol className='space-y-2'>
            {entries.map((e, i) => {
              const isMe = Boolean(user && e.userId === user.id)
              const cls =
                'flex items-center gap-3 rounded-xl border p-3 ' +
                (isMe ? 'border-sky-500 bg-sky-500/10' : 'border-base card')
              return (
                <li key={e.userId} className={cls}>
                  <span className='w-8 text-center text-sm font-bold'>{rankBadge(i + 1)}</span>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-semibold'>
                      {e.displayName || t('leaderboard.mystery')}
                      {isMe ? <span className='ml-2 text-xs text-sky-400'>{t('leaderboard.you')}</span> : null}
                    </p>
                    <p className='text-xs text-muted'>
                      {t('leaderboard.levelStreak', { lvl: levelFromXp(e.totalXp), n: e.currentStreak })}
                    </p>
                  </div>
                  <span className='text-sm font-bold text-amber-400'>{e.totalXp} XP</span>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </main>
  )
}
