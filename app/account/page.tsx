'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GameHeader } from '@/components/GameHeader'
import { BottomNav } from '@/components/BottomNav'
import { AuthModal } from '@/components/AuthModal'
import { ApiKeyModal } from '@/components/ApiKeyModal'
import { useAuth } from '@/lib/useAuth'
import { useTheme } from '@/lib/theme'
import { useI18n, LANGS } from '@/lib/i18n'
import { isSoundOn, setSoundOn } from '@/lib/sound'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { MIMO_KEY, loadStats, saveStats, loadDiscoveries } from '@/lib/storage'
import { updateDisplayName } from '@/lib/cloud'
import { levelProgress, researchRank, totalXp } from '@/lib/progress'
import type { Discovery, Stats } from '@/lib/types'

const FALLBACK_STATS: Stats = { currentStreak: 0, bestStreak: 0, lastPlayed: null, displayName: null, hintTokens: 0, coins: 0, bonusXp: 0, failedExperiments: 0 }

export default function AccountPage() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { lang, setLang } = useI18n()
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [sound, setSound] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [stats, setStats] = useState<Stats>(FALLBACK_STATS)

  useEffect(() => {
    const s = { ...FALLBACK_STATS, ...loadStats() }
    setStats(s)
    setDiscoveries(loadDiscoveries())
    if (s.displayName) setName(s.displayName)
    setSound(isSoundOn())
    try { const k = localStorage.getItem(MIMO_KEY); if (k) setApiKey(k) } catch {}
  }, [])

  const progress = levelProgress(totalXp(discoveries, stats))
  const rank = researchRank(progress.level, discoveries.length)
  const isDark = theme === 'dark'

  function notify(text: string) { setMsg(text); setTimeout(() => setMsg(null), 2200) }

  async function saveName() {
    if (!user) return
    const trimmed = name.trim().slice(0, 20)
    if (!trimmed) { notify('Nama tidak boleh kosong'); return }
    setSaving(true)
    try {
      await updateDisplayName(user.id, trimmed)
      const s = loadStats()
      saveStats({ ...s, displayName: trimmed })
      notify('Nama tersimpan')
    } finally { setSaving(false) }
  }

  function handleSaveKey(k: string) {
    setApiKey(k)
    try { if (k) localStorage.setItem(MIMO_KEY, k); else localStorage.removeItem(MIMO_KEY) } catch {}
    notify('API key tersimpan')
  }

  function toggleSound() {
    const next = !sound
    setSound(next)
    setSoundOn(next)
    notify(next ? 'Suara dinyalakan' : 'Suara dimatikan')
  }

  async function signOut() {
    const sb = getSupabaseBrowser()
    await sb?.auth.signOut()
    if (typeof window !== 'undefined') window.location.reload()
  }

  return (
    <>
      <GameHeader eyebrow="BYAS • ACCOUNT" discoveries={discoveries} stats={stats} />
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-6 pb-28">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="lab-eyebrow">BYAS • Account</p>
            <h1 className="truncate text-2xl font-black tracking-tight">👤 Akun</h1>
            <p className="mt-0.5 text-xs text-muted">Profil, sinkronisasi, dan preferensi.</p>
          </div>
          <Link href="/" className="lab-button shrink-0">Lab</Link>
        </header>

        <section className="lab-panel">
          <div className="flex items-center gap-3">
            <div className="account-avatar">{(name || 'B').slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0">
              <strong className="block truncate text-base font-black">{name || 'Periset Anonim'}</strong>
              <span className="text-xs text-muted">Lv {progress.level} • {rank}</span>
            </div>
          </div>
          <div className="stat-grid">
            <div className="stat-cell"><span>{discoveries.length}</span><small>Penemuan</small></div>
            <div className="stat-cell"><span>{progress.level}</span><small>Level</small></div>
            <div className="stat-cell"><span>🔥 {stats.currentStreak || 0}</span><small>Streak</small></div>
            <div className="stat-cell"><span>🪙 {stats.coins ?? 0}</span><small>Coin</small></div>
          </div>
        </section>

        <section className="lab-panel">
          <p className="lab-eyebrow">Profil</p>
          {user ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted">Akun tersinkron — penemuan & XP otomatis tersimpan ke cloud.</p>
              <div>
                <label className="text-xs font-bold text-muted">Nama tampilan</label>
                <div className="mt-1 flex gap-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Nama kamu" className="flex-1 rounded-xl border border-base bg-white/[0.04] px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-300/40" />
                  <button onClick={saveName} disabled={saving} className="lab-button-primary disabled:cursor-not-allowed disabled:opacity-50">{saving ? '...' : 'Simpan'}</button>
                </div>
              </div>
              <button onClick={signOut} className="lab-button">Keluar</button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted">Masuk untuk sinkronisasi penemuan dan ikut leaderboard.</p>
              <button onClick={() => setShowAuth(true)} className="lab-button-primary">Masuk / Daftar</button>
            </div>
          )}
        </section>

        <section className="lab-panel">
          <p className="lab-eyebrow">Preferensi</p>
          <div className="mt-3 space-y-3">
            <div className="account-row">
              <span className="text-sm">Tema</span>
              <div className="seg-switch">
                <button onClick={() => setTheme('light')} className={`seg-opt ${!isDark ? 'is-on' : ''}`}>☀️ Terang</button>
                <button onClick={() => setTheme('dark')} className={`seg-opt ${isDark ? 'is-on' : ''}`}>🌙 Gelap</button>
              </div>
            </div>
            <div className="account-row">
              <span className="text-sm">Bahasa</span>
              <div className="seg-switch">
                {LANGS.map((l) => (
                  <button key={l.code} onClick={() => setLang(l.code)} className={`seg-opt ${l.code === lang ? 'is-on' : ''}`}>{l.code.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div className="account-row">
              <span className="text-sm">Suara</span>
              <button onClick={toggleSound} className={`seg-opt single ${sound ? 'is-on' : ''}`}>{sound ? '🔊 Nyala' : '🔇 Mati'}</button>
            </div>
          </div>
        </section>

        <section className="lab-panel">
          <p className="lab-eyebrow">Mimo API</p>
          <div className="mt-3 account-row">
            <span className="text-sm">API key {apiKey ? <span className="text-cyan-300">· aktif</span> : <span className="text-muted">· belum diset</span>}</span>
            <button onClick={() => setShowKey(true)} className="lab-button text-xs">🔑 Atur</button>
          </div>
          <p className="mt-2 text-xs text-muted">Pakai API key Mimo sendiri biar reaksi nggak kena limit bareng.</p>
        </section>
      </main>
      <BottomNav />

      {showKey && <ApiKeyModal current={apiKey} onClose={() => setShowKey(false)} onSave={handleSaveKey} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {msg && <div className="toast-enter fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/92 px-4 py-3 text-sm text-white shadow-2xl" role="status">{msg}</div>}
    </>
  )
}
