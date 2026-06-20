'use client'

import { levelProgress } from '@/lib/progress'

export function StatsBar({
  totalXp,
  streak,
  bestStreak,
}: {
  totalXp: number
  streak: number
  bestStreak: number
}) {
  const p = levelProgress(totalXp)
  return (
    <div className='mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-3'>
      <div className='flex items-center justify-between text-xs'>
        <span className='font-bold'>Level {p.level}</span>
        <span className='text-slate-400'>{p.totalXp} XP</span>
        <span className='font-medium text-orange-400'>
          🔥 {streak} hari{bestStreak > streak ? ` · best ${bestStreak}` : ''}
        </span>
      </div>
      <div className='mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800'>
        <div
          className='h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all'
          style={{ width: `${p.pct}%` }}
        />
      </div>
      <p className='mt-1 text-right text-[10px] text-slate-500'>
        {p.into}/{p.span} XP ke Level {p.level + 1}
      </p>
    </div>
  )
}
