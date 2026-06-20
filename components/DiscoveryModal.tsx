'use client'

import type { CombineResult } from '@/lib/types'

const RARITY_STYLES: Record<string, string> = {
  common: 'from-slate-600 to-slate-700 border-slate-400',
  uncommon: 'from-emerald-600 to-emerald-800 border-emerald-400',
  rare: 'from-sky-600 to-indigo-800 border-sky-400',
  legendary: 'from-amber-500 to-pink-700 border-amber-300',
}

export function DiscoveryModal({
  result,
  isNew,
  onClose,
}: {
  result: CombineResult
  isNew: boolean
  onClose: () => void
}) {
  const style = RARITY_STYLES[result.rarity] ?? RARITY_STYLES.common
  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'
      onClick={onClose}
    >
      <div
        className={`animate-pop w-full max-w-md rounded-2xl border bg-gradient-to-br ${style} p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {isNew && (
          <p className='mb-2 text-center text-sm font-bold uppercase tracking-widest text-amber-200'>
            ✨ Penemuan Baru!
          </p>
        )}
        <div className='text-center text-6xl'>{result.emoji}</div>
        <h2 className='mt-3 text-center text-2xl font-bold'>{result.result}</h2>
        {result.formula && (
          <p className='text-center font-mono text-slate-200'>{result.formula}</p>
        )}
        <span className='mx-auto mt-2 block w-fit rounded-full bg-black/30 px-3 py-1 text-xs uppercase tracking-wide'>
          {result.rarity}
        </span>
        <p className='mt-4 text-sm text-slate-100'>{result.explanation}</p>
        {result.fun_fact && (
          <p className='mt-3 rounded-lg bg-black/25 p-3 text-sm italic text-slate-200'>
            💡 {result.fun_fact}
          </p>
        )}
        <button
          onClick={onClose}
          className='mt-5 w-full rounded-lg bg-white/90 py-2 font-semibold text-slate-900 transition hover:bg-white'
        >
          Lanjut bereksperimen
        </button>
      </div>
    </div>
  )
}
