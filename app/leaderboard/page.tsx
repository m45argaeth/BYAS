'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { loadStats, saveStats } from '@/lib/storage'
import { levelFromXp } from '@/lib/progress'
import { pullLeaderboard, updateDisplayName, type LeaderboardEntry } from '@/lib/cloud'

function rankBadge(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

export default function LeaderboardPage() {
  const { user } = useAuth()
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
      setMsg('Username nggak boleh kosong.')
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await updateDisplayName(user.id, trimmed)
      const s = loadStats()
      saveStats({ ...s, displayName: trimmed })
      setMsg('Username tersimpan! ✅')
      setTimeout(() => setMsg(null), 2000)
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className='mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6'>
      <header className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-extrabold tracking-tight'>🏆 Leaderboard</h1>
          <p className='text-xs text-slate-400'>Top alkemis berdasarkan XP</p>
        </div>
        <Link href='/' className='rounded-full bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700'>
          ← Kembali combine
        </Link>
      </header>

      {user ? (
        <div className='mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-3'>
          <label className='text-xs text-slate-400'>Username kamu (tampil di leaderboard)</label>
          <div className='mt-2 flex gap-2'>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder='cth: AlkemisSakti'
              className='flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500'
            />
            <button
              onClick={saveName}
              disabled={saving}
              className='rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold hover:bg-sky-500 disabled:opacity-50'
            >
              {saving ? '...' : 'Simpan'}
            </button>
          </div>
          {msg && <p className='mt-2 text-xs text-emerald-400'>{msg}</p>}
        </div>
      ) : (
        <p className='mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-400'>
          Masuk dulu di halaman utama buat ikut leaderboard dan set username.
        </p>
      )}

      <section className='mt-6'>
        {loading ? (
          <p className='text-center text-sm text-slate-500'>Memuat ranking...</p>
        ) : entries.length === 0 ? (
          <p className='text-center text-sm text-slate-500'>
            Belum ada yang masuk ranking. Jadilah yang pertama! 🧪
          </p>
        ) : (
          <ol className='space-y-2'>
            {entries.map((e, i) => {
              const isMe = user && e.userId === user.id
              return (
                <li
                  key={e.userId}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${
                    isMe
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <span className='w-8 text-center text-sm font-bold'>{rankBadge(i + 1)}</span>
                  <div className='flex-1'>
                    <p className='text-sm font-semibold'>
                      {e.displayName || 'Alkemis misterius'}
                      {isMe && <span className='ml-2 text-xs text-sky-400'>(kamu)</span>}
                    </p>
                    <p className='text-xs text-slate-500'>
                      Level {levelFromXp(e.totalXp)} · 🔥 {e.currentStreak} hari
                    </p>
                  </div>
                  <span className='text-sm font-bold text-amber-300'>{e.totalXp} XP</span>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </main>
  )
}
