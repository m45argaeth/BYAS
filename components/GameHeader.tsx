'use client'

import { useEffect, useState } from 'react'
import type { Discovery, Stats } from '@/lib/types'
import { MIMO_KEY, loadDiscoveries, loadStats } from '@/lib/storage'
import { levelProgress, researchRank, totalXp } from '@/lib/progress'
import { useAuth } from '@/lib/useAuth'
import { useTheme } from '@/lib/theme'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { ApiKeyModal } from '@/components/ApiKeyModal'
import { AuthModal } from '@/components/AuthModal'
import { SettingsModal } from '@/components/SettingsModal'

const FALLBACK_STATS: Stats = { currentStreak: 0, bestStreak: 0, lastPlayed: null, displayName: null, hintTokens: 0, coins: 0, bonusXp: 0, failedExperiments: 0 }

export function GameHeader({ discoveries: dProp, stats: sProp, eyebrow = 'BYAS · Reaction Lab' }: { discoveries?: Discovery[]; stats?: Stats; eyebrow?: string }) {
  const { user } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const [discoveries, setDiscoveries] = useState<Discovery[]>(dProp ?? [])
  const [stats, setStats] = useState<Stats>(sProp ?? FALLBACK_STATS)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (dProp === undefined) setDiscoveries(loadDiscoveries())
  }, [dProp])
  useEffect(() => {
    if (sProp === undefined) setStats({ ...FALLBACK_STATS, ...loadStats() })
  }, [sProp])
  useEffect(() => {
    try { const k = localStorage.getItem(MIMO_KEY); if (k) setApiKey(k) } catch {}
  }, [])

  const liveD = dProp ?? discoveries
  const liveS = sProp ?? stats
  const progress = levelProgress(totalXp(liveD, liveS))
  const rank = researchRank(progress.level, liveD.length)

  function handleSaveKey(k: string) {
    setApiKey(k)
    try { if (k) localStorage.setItem(MIMO_KEY, k); else localStorage.removeItem(MIMO_KEY) } catch {}
  }
  async function signOut() {
    const sb = getSupabaseBrowser()
    await sb?.auth.signOut()
    if (typeof window !== 'undefined') window.location.reload()
  }

  return (
    <header className="stage-head">
      <div className="stage-head-id">
        <span className="stage-eyebrow">{eyebrow}</span>
        <strong>Lv {progress.level} · {rank}</strong>
      </div>
      <div className="stage-head-xp" aria-label={`Research XP ${progress.into} of ${progress.span}`}>
        <div className="xp-mini"><div style={{ width: `${progress.pct}%` }} /></div>
      </div>
      <div className="stage-head-chips">
        <span className="hud-chip">🔥 {liveS.currentStreak || 0}</span>
        <span className="hud-chip">🪙 {liveS.coins ?? 0}</span>
        <button type="button" onClick={toggleTheme} className="hud-chip" aria-label="Toggle theme">{theme === 'dark' ? '☀️' : '🌙'}</button>
        <button type="button" onClick={() => setShowKey(true)} className="hud-chip" aria-label="API key">🔑</button>
        {user
          ? <button type="button" onClick={signOut} className="hud-chip" aria-label="Sign out">👤</button>
          : <button type="button" onClick={() => setShowAuth(true)} className="hud-chip" style= borderColor: 'var(--accent)'  aria-label="Login">➡️</button>}
        <button type="button" onClick={() => setShowSettings(true)} className="hud-chip" aria-label="Settings">⚙️</button>
      </div>

      {showKey && <ApiKeyModal current={apiKey} onClose={() => setShowKey(false)} onSave={handleSaveKey} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </header>
  )
}
