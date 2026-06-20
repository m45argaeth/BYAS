'use client'

import { levelProgress } from '@/lib/progress'
import { useI18n } from '@/lib/i18n'

export function StatsBar({ totalXp, streak, bestStreak }: { totalXp: number; streak: number; bestStreak: number }) {
  const { t } = useI18n()
  const p = levelProgress(totalXp)
  const barStyle = { width: p.pct + '%' }
  const trackStyle = { background: 'var(--surface-2)' }
  return (
    <div className="mt-4 rounded-2xl card p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold">Level {p.level}</span>
        <span className="text-muted">
          {p.totalXp} {t('stats.xp')}
        </span>
        <span className="font-medium text-orange-400">
          {t('stats.streak', { n: streak })}
          {bestStreak > streak ? t('stats.best', { n: bestStreak }) : ''}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full border-base" style={trackStyle}>
        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500" style={barStyle} />
      </div>
      <p className="mt-1 text-right text-[10px] text-muted">
        {t('stats.toNext', { into: p.into, span: p.span, next: p.level + 1 })}
      </p>
    </div>
  )
}
