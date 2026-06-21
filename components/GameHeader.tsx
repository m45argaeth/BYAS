'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import type { Discovery, Stats } from '@/lib/types'
import { loadDiscoveries, loadStats } from '@/lib/storage'
import { levelProgress, researchRank, totalXp } from '@/lib/progress'
import { useTheme } from '@/lib/theme'
import { useI18n, LANGS } from '@/lib/i18n'

const FALLBACK_STATS: Stats = { currentStreak: 0, bestStreak: 0, lastPlayed: null, displayName: null, hintTokens: 0, coins: 0, bonusXp: 0, failedExperiments: 0 }

export function GameHeader({ discoveries: dProp, stats: sProp, eyebrow = 'BYAS • REACTION LAB' }: { discoveries?: Discovery[]; stats?: Stats; eyebrow?: string }) {
  const { theme, toggle: toggleTheme } = useTheme()
  const { lang, setLang } = useI18n()
  const [discoveries, setDiscoveries] = useState<Discovery[]>(dProp ?? [])
  const [stats, setStats] = useState<Stats>(sProp ?? FALLBACK_STATS)

  useEffect(() => {
    if (dProp === undefined) setDiscoveries(loadDiscoveries())
  }, [dProp])
  useEffect(() => {
    if (sProp === undefined) setStats({ ...FALLBACK_STATS, ...loadStats() })
  }, [sProp])

  const liveD = dProp ?? discoveries
  const liveS = sProp ?? stats
  const progress = levelProgress(totalXp(liveD, liveS))
  const rank = researchRank(progress.level, liveD.length)
  const isDark = theme === 'dark'
  const xpStyle: CSSProperties = { width: `${progress.pct}%` }

  return (
    <header className="stage-head">
      <div className="stage-head-row">
        <span className="stage-eyebrow">{eyebrow}</span>
        <div className="stage-head-controls">
          <button type="button" role="switch" aria-checked={isDark} onClick={toggleTheme} className={`switch-toggle ${isDark ? 'is-on' : ''}`} aria-label="Toggle terang / gelap">
            <span className="switch-ico">☀️</span>
            <span className="switch-ico">🌙</span>
            <span className="switch-knob" />
          </button>
          <div className="lang-switch" role="group" aria-label="Bahasa">
            {LANGS.map((l) => (
              <button key={l.code} type="button" onClick={() => setLang(l.code)} className={`lang-opt ${l.code === lang ? 'is-on' : ''}`} aria-pressed={l.code === lang}>{l.code.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="stage-head-row">
        <strong className="stage-head-lvl">Lv {progress.level} • {rank}</strong>
        <div className="stage-head-stats">
          <span className="hud-chip">🔥 {liveS.currentStreak || 0}</span>
          <span className="hud-chip">🪙 {liveS.coins ?? 0}</span>
        </div>
      </div>

      <div className="stage-head-xp" aria-label={`Research XP ${progress.into} of ${progress.span}`}>
        <div className="xp-mini"><div style={xpStyle} /></div>
        <span className="xp-label">{progress.into}/{progress.span} EXP</span>
      </div>
    </header>
  )
}
