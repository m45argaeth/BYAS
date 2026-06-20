'use client'

import type { CombineResult } from '@/lib/types'
import { RARITY_GRADIENT, RARITY_GLOW } from '@/lib/rarity'
import { useI18n } from '@/lib/i18n'
import { shareDiscovery } from '@/lib/share'
import { playPop } from '@/lib/sound'

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
  const headerCls = 'bg-gradient-to-br ' + grad + ' p-6 text-center text-white'
  const rarityLabel = t('rarity.' + result.rarity)

  function onShare() {
    playPop()
    void shareDiscovery(result, rarityLabel)
  }

  function stop(e: React.MouseEvent) {
    e.stopPropagation()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-t-2xl card sm:rounded-2xl animate-reveal-pop"
        style={{
          boxShadow: `0 0 40px ${glow}, 0 20px 60px rgba(0,0,0,0.4)`,
        }}
        onClick={stop}
      >
        <div className={headerCls}>
          {isNew ? (
            <p className="mb-1 text-xs font-bold uppercase tracking-widest">
              {t('discovery.new')}
            </p>
          ) : null}
          <div className="animate-pop text-7xl" aria-hidden>
            {result.emoji}
          </div>
          <h2 className="mt-2 text-2xl font-extrabold">{result.result}</h2>
          {result.formula ? (
            <p className="mt-1 font-mono text-sm opacity-90">{result.formula}</p>
          ) : null}
          <p className="mt-2 inline-block rounded-full bg-black/20 px-4 py-0.5 text-xs font-bold uppercase tracking-wide">
            {rarityLabel}
          </p>
          {typeof xpGain === 'number' && xpGain > 0 ? (
            <p className="mt-2 animate-float-xp text-base font-extrabold tracking-wide">
              +{xpGain} XP
            </p>
          ) : null}
        </div>
        <div className="space-y-3 p-5 text-sm">
          <p>{result.explanation}</p>
          {result.fun_fact ? (
            <p className="rounded-lg card-2 p-3 text-muted">
              💡 {result.fun_fact}
            </p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onShare}
              className="flex-1 rounded-xl card-2 py-2.5 font-semibold transition hover:bg-sky-500/10 hover:text-sky-400"
            >
              📤 {t('discovery.share')}
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-xl bg-sky-600 py-2.5 font-semibold text-white transition hover:bg-sky-500 active:scale-[0.98]"
            >
              {t('discovery.continue')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
