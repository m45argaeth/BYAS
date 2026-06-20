'use client'

import { useState } from 'react'
import { useI18n, LANGS } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { isSoundOn, setSoundOn } from '@/lib/sound'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { lang, setLang, t } = useI18n()
  const { theme, setTheme } = useTheme()
  const [sound, setSound] = useState(isSoundOn())

  function toggleSound() {
    const next = !sound
    setSound(next)
    setSoundOn(next)
  }

  const isDark = theme === 'dark'
  const darkCls =
    'flex-1 rounded-lg px-3 py-2 font-medium transition ' +
    (isDark ? 'bg-indigo-600 text-white' : 'card-2 text-muted hover:opacity-80')
  const lightCls =
    'flex-1 rounded-lg px-3 py-2 font-medium transition ' +
    (!isDark ? 'bg-amber-500 text-white' : 'card-2 text-muted hover:opacity-80')
  const soundCls =
    'rounded-lg px-3 py-2 text-sm font-medium transition ' +
    (sound ? 'bg-emerald-600 text-white' : 'card-2 text-muted hover:opacity-80')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl card p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('settings.title')}</h2>
          <button onClick={onClose} className="text-muted text-lg leading-none" aria-label={t('settings.close')}>
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-5 text-sm">
          <div>
            <p className="mb-2 font-medium">{t('settings.language')}</p>
            <div className="flex gap-2">
              {LANGS.map((l) => {
                const active = l.code === lang
                const cls =
                  'flex-1 rounded-lg px-3 py-2 font-medium transition ' +
                  (active ? 'bg-sky-600 text-white' : 'card-2 text-muted hover:opacity-80')
                return (
                  <button key={l.code} onClick={() => setLang(l.code)} className={cls}>
                    {l.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 font-medium">{t('settings.theme')}</p>
            <div className="flex gap-2">
              <button onClick={() => setTheme('dark')} className={darkCls}>
                🌙 {t('settings.dark')}
              </button>
              <button onClick={() => setTheme('light')} className={lightCls}>
                ☀️ {t('settings.light')}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium">{t('settings.sound')}</span>
            <button onClick={toggleSound} className={soundCls}>
              {sound ? '🔊 ' + t('settings.on') : '🔇 ' + t('settings.off')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
