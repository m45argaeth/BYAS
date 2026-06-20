'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n'

export function ApiKeyModal({
  current,
  onClose,
  onSave,
}: {
  current: string
  onClose: () => void
  onSave: (key: string) => void
}) {
  const { t } = useI18n()
  const [key, setKey] = useState(current)

  function stop(e: React.MouseEvent) {
    e.stopPropagation()
  }
  function removeKey() {
    onSave('')
    onClose()
  }
  function saveKey() {
    onSave(key.trim())
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-sm rounded-t-2xl card p-5 sm:rounded-2xl" onClick={stop}>
        <h2 className="text-lg font-bold">{t('apikey.title')}</h2>
        <p className="mt-1 text-xs text-muted">{t('apikey.desc')}</p>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t('apikey.placeholder')}
          className="mt-3 w-full rounded-lg card-2 px-3 py-2 text-sm outline-none"
        />
        <a
          href="https://platform.xiaomimimo.com/#/console/api-keys"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-sky-400 hover:underline"
        >
          platform.xiaomimimo.com →
        </a>
        <div className="mt-4 flex gap-2">
          <button
            onClick={removeKey}
            className="flex-1 rounded-xl card-2 py-2.5 text-sm font-semibold hover:opacity-80"
          >
            {t('apikey.remove')}
          </button>
          <button
            onClick={saveKey}
            className="flex-1 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            {t('apikey.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
