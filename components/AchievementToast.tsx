'use client'

export function AchievementToast({ emoji, title, label }: { emoji: string; title: string; label: string }) {
  return (
    <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 animate-pop rounded-xl border border-amber-400/60 bg-amber-500 px-4 py-2 text-center text-slate-900 shadow-xl">
      <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold">
        {emoji} {title}
      </p>
    </div>
  )
}
