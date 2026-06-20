'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import type { CombineResult } from '@/lib/types'
import { RARITY_GRADIENT, RARITY_GLOW, RARITY_LABEL } from '@/lib/rarity'
import { MASTERY_LABEL, guessCategory } from '@/lib/progress'
import { useI18n } from '@/lib/i18n'
import { shareDiscovery } from '@/lib/share'
import { playPop } from '@/lib/sound'

const REVEAL_DELAY: Record<string, number> = {
  common: 350,
  uncommon: 480,
  rare: 650,
  epic: 820,
  legendary: 1000,
  mythic: 1250,
}

export function DiscoveryModal({
  result,
  isNew,
  xpGain,
  onClose,
}: {
  result: CombineResult
  isNew?: boolean
  xpGain?: number
  onClose: () => void
}) {
  const { t } = useI18n()
  const grad = RARITY_GRADIENT[result.rarity] ?? RARITY_GRADIENT.common
  const glow = RARITY_GLOW[result.rarity] ?? RARITY_GLOW.common
  const rarityLabel = RARITY_LABEL[result.rarity] ?? result.rarity
  const category = result.category ?? guessCategory(result)
  const delay = REVEAL_DELAY[result.rarity] ?? 500

  const [stage, setStage] = useState<'charging' | 'revealed'>(isNew ? 'charging' : 'revealed')
  const [xpShown, setXpShown] = useState(isNew ? 0 : xpGain ?? 0)
  const revealed = stage === 'revealed'

  useEffect(() => {
    if (stage === 'revealed') return
    const tm = setTimeout(() => setStage('revealed'), delay)
    return () => clearTimeout(tm)
  }, [stage, delay])

  useEffect(() => {
    if (stage !== 'revealed' || !xpGain) return
    let raf = 0
    const start = performance.now()
    const dur = 700
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      setXpShown(Math.round(p * xpGain))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [stage, xpGain])

  function onShare() {
    playPop()
    void shareDiscovery(result, rarityLabel)
  }

  function stop(e: React.MouseEvent) {
    e.stopPropagation()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/78 backdrop-blur-xl sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="discovery-shell w-full max-w-md overflow-hidden rounded-t-[2rem] border border-white/14 bg-slate-950/92 text-white shadow-2xl sm:rounded-[2rem] animate-reveal-pop"
        style={{ boxShadow: `0 0 72px ${glow}, 0 28px 90px rgba(0,0,0,0.62)` }}
        onClick={stop}
      >
        <div className="relative overflow-hidden p-6 text-center">
          <div className={`absolute inset-0 bg-gradient-to-br ${grad} transition-opacity duration-500 ${revealed ? 'opacity-24' : 'opacity-10'}`} />
          <div className="absolute inset-x-8 top-6 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
          <p className="relative z-10 text-[10px] font-black uppercase tracking-[0.36em] text-white/70">
            {isNew ? (revealed ? 'Discovery Unlocked' : 'Analyzing Reaction…') : 'Research Entry'}
          </p>
          <div className="relative z-10 mx-auto mt-5 h-28 w-28">
            <div
              className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] border border-white/18 bg-white/10 text-7xl shadow-inner backdrop-blur"
              style={{ '--rarity-color': glow } as CSSProperties}
            >
              {revealed ? (
                <span className="animate-orbital-float">{result.emoji}</span>
              ) : (
                <span className="animate-charge opacity-80">🧪</span>
              )}
              {!revealed && <div className="discovery-scan" />}
              {revealed && (
                <>
                  <span className="rarity-ring" />
                  <span className="rarity-ring delay-1" />
                </>
              )}
            </div>
          </div>
          <h2 className="relative z-10 mt-4 text-3xl font-black tracking-tight">
            {revealed ? result.result : '· · · · ·'}
          </h2>
          {revealed && result.formula ? (
            <p className="relative z-10 mt-1 font-mono text-sm text-white/78">{result.formula}</p>
          ) : null}
          {revealed && (
            <div className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-white/16 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]">
                {rarityLabel}
              </span>
              <span className="rounded-full border border-white/16 bg-white/12 px-3 py-1 text-[10px] font-bold text-white/75">
                {MASTERY_LABEL[category]}
              </span>
            </div>
          )}
          {revealed && typeof xpGain === 'number' && xpGain > 0 ? (
            <p className="relative z-10 mt-4 animate-float-xp text-lg font-black tracking-wide text-cyan-100">
              +<span className="xp-count">{xpShown}</span> XP
            </p>
          ) : null}
        </div>
        <div className="space-y-3 border-t border-white/10 p-5 text-sm">
          {revealed ? (
            <>
              <p className="leading-relaxed text-slate-200">{result.explanation}</p>
              {result.fun_fact ? (
                <div className="rounded-2xl border border-cyan-300/14 bg-cyan-300/8 p-3 text-slate-300">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/70">Lab Note</p>
                  <p className="mt-1">{result.fun_fact}</p>
                </div>
              ) : null}
              {result.hint ? (
                <div className="rounded-2xl border border-violet-300/14 bg-violet-300/8 p-3 text-slate-300">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-200/70">Future Hint</p>
                  <p className="mt-1">{result.hint}</p>
                </div>
              ) : null}
              <div className="flex gap-2 pt-1">
                <button onClick={onShare} className="lab-button flex-1" type="button">📤 {t('discovery.share')}</button>
                <button onClick={onClose} className="lab-button-primary flex-1" type="button">{t('discovery.continue')}</button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-slate-400">Scanning molecular signature…</p>
              <button onClick={() => setStage('revealed')} className="lab-button text-xs" type="button">Reveal</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
