'use client'

import Link from 'next/link'
import { GameHeader } from '@/components/GameHeader'
import { BottomNav } from '@/components/BottomNav'
import { DailyResearchPanel, MysteryResearchPanel, WeeklyQuestPanel } from '@/components/panels'
import { useGameData } from '@/lib/useGameData'
import { useI18n } from '@/lib/i18n'

export default function QuestPage() {
  const { discoveries, stats, msg, claimDaily, claimWeekly, claimMystery, useMysteryHint } = useGameData()
  const { t } = useI18n()
  return (
    <>
      <GameHeader discoveries={discoveries} stats={stats} eyebrow="BYAS · Quests" />
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-6 pb-28">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="lab-eyebrow">BYAS · Quests</p>
            <h1 className="truncate text-2xl font-black tracking-tight">🎯 {t('quest.title')}</h1>
            <p className="mt-0.5 text-xs text-muted">{t('quest.sub')}</p>
          </div>
          <Link href="/" className="lab-button shrink-0">{t('nav.lab')}</Link>
        </header>
        <DailyResearchPanel discoveries={discoveries} stats={stats} onClaim={claimDaily} />
        <MysteryResearchPanel discoveries={discoveries} stats={stats} onClaim={claimMystery} onUseHint={useMysteryHint} />
        <WeeklyQuestPanel discoveries={discoveries} stats={stats} onClaim={claimWeekly} />
      </main>
      <BottomNav />
      {msg && <div className="toast-enter fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/92 px-4 py-3 text-sm text-white shadow-2xl" role="status">{msg}</div>}
    </>
  )
}
