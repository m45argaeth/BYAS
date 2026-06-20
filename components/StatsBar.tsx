'use client'

import { levelProgress } from '@/lib/progress'
import { useI18n } from '@/lib/i18n'

export function StatsBar({
  totalXp,
  streak,
  bestStreak,
}: {
  totalXp: number
  streak: number
  bestStreak: number
}) {
  const { t } = useI18n()
  const p = levelProgress(totalXp)

  return (
    <div className="mt-3 rounded-2xl card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-sm font-extrabold text-white shadow-lg shadow-sky-500/25">
            {p.level}
          </div>
          <div>
            <p className="text-xs font-bold">Level {p.level}</p>
            <p className="text-[10px] text-muted">{p.totalXp} {t('stats.xp')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base">🔥</span>
          <div>
            <p className="text-xs font-bold text-orange-400">{streak}</p>
            {bestStreak > streak && (
              <p className="text-[10px] text-muted">{t('stats.best', { n: bestStreak })}</p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 transition-all duration-700 ease-out"
          style={{ width: `${p.pct}%` }}
        />
      </div>
      <p className="mt-1 text-right text-[10px] text-muted">
        {t('stats.toNext', { into: p.into, span: p.span, next: p.level + 1 })}
      </p>
    </div>
  )
}
