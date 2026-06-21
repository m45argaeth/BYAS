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
  const { lang, setLang, t } = useI18n()
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
    if (!trimmed) { notify(t('account.nameEmpty')); return }
    setSaving(true)
    try {
      await updateDisplayName(user.id, trimmed)
      const s = loadStats()
      saveStats({ ...s, displayName: trimmed })
      notify(t('account.nameSaved'))
    } finally { setSaving(false) }
  }

  function handleSaveKey(k: string) {
    setApiKey(k)
    try { if (k) localStorage.setItem(MIMO_KEY, k); else localStorage.removeItem(MIMO_KEY) } catch {}
    notify(t('account.keySaved'))
  }

  function toggleSound() {
    const next = !sound
    setSound(next)
    setSoundOn(next)
    notify(next ? t('account.soundEnabled') : t('account.soundDisabled'))
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
            <h1 className="truncate text-2xl font-black tracking-tight">👤 {t('account.title')}</h1>
            <p className="mt-0.5 text-xs text-muted">{t('account.subtitle')}</p>
          </div>
          <Link href="/" className="lab-button shrink-0">{t('account.lab')}</Link>
        </header>

        <section className="lab-panel">
          <div className="flex items-center gap-3">
            <div className="account-avatar">{(name || 'B').slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0">
              <strong className="block truncate text-base font-black">{name || t('account.anon')}</strong>
              <span className="text-xs text-muted">Lv {progress.level} • {rank}</span>
            </div>
          </div>
          <div className="stat-grid">
            <div className="stat-cell"><span>{discoveries.length}</span><small>{t('account.discoveries')}</small></div>
            <div className="stat-cell"><span>{progress.level}</span><small>{t('account.level')}</small></div>
            <div className="stat-cell"><span>🔥 {stats.currentStreak || 0}</span><small>{t('account.streak')}</small></div>
            <div className="stat-cell"><span>🪙 {stats.coins ?? 0}</span><small>{t('account.coins')}</small></div>
          </div>
        </section>

        <section className="lab-panel">
          <p className="lab-eyebrow">{t('account.profile')}</p>
          {user ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted">{t('account.syncedDesc')}</p>
              <div>
                <label className="text-xs font-bold text-muted">{t('account.displayName')}</label>
                <div className="mt-1 flex gap-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder={t('account.namePlaceholder')} className="flex-1 rounded-xl border border-base bg-white/[0.04] px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-300/40" />
                  <button onClick={saveName} disabled={saving} className="lab-button-primary disabled:cursor-not-allowed disabled:opacity-50">{saving ? '...' : t('account.save')}</button>
                </div>
              </div>
              <button onClick={signOut} className="lab-button">{t('account.signOut')}</button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted">{t('account.loginDesc')}</p>
              <button onClick={() => setShowAuth(true)} className="lab-button-primary">{t('account.loginBtn')}</button>
            </div>
          )}
        </section>

        <section className="lab-panel">
          <p className="lab-eyebrow">{t('account.prefs')}</p>
          <div className="mt-3 space-y-3">
            <div className="account-row">
              <span className="text-sm">{t('account.theme')}</span>
              <div className="seg-switch">
                <button onClick={() => setTheme('light')} className={`seg-opt ${!isDark ? 'is-on' : ''}`}>☀️ {t('account.light')}</button>
                <button onClick={() => setTheme('dark')} className={`seg-opt ${isDark ? 'is-on' : ''}`}>🌙 {t('account.dark')}</button>
              </div>
            </div>
            <div className="account-row">
              <span className="text-sm">{t('account.language')}</span>
              <div className="seg-switch">
                {LANGS.map((l) => (
                  <button key={l.code} onClick={() => setLang(l.code)} className={`seg-opt ${l.code === lang ? 'is-on' : ''}`}>{l.code.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div className="account-row">
              <span className="text-sm">{t('account.sound')}</span>
              <button onClick={toggleSound} className={`seg-opt single ${sound ? 'is-on' : ''}`}>{sound ? `🔊 ${t('account.soundOn')}` : `🔇 ${t('account.soundOff')}`}</button>
            </div>
          </div>
        </section>

        <section className="lab-panel">
          <p className="lab-eyebrow">{t('account.apiTitle')}</p>
          <div className="mt-3 account-row">
            <span className="text-sm">{t('account.apiKey')} {apiKey ? <span className="text-cyan-300">· {t('account.apiActive')}</span> : <span className="text-muted">· {t('account.apiUnset')}</span>}</span>
            <button onClick={() => setShowKey(true)} className="lab-button text-xs">🔑 {t('account.manage')}</button>
          </div>
          <p className="mt-2 text-xs text-muted">{t('account.apiDesc')}</p>
        </section>
      </main>
      <BottomNav />

      {showKey && <ApiKeyModal current={apiKey} onClose={() => setShowKey(false)} onSave={handleSaveKey} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {msg && <div className="toast-enter fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/92 px-4 py-3 text-sm text-white shadow-2xl" role="status">{msg}</div>}
    </>
  )
}
