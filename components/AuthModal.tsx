'use client'

import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { useI18n } from '@/lib/i18n'

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!email || password.length < 6) {
      setError(t('auth.minErr'))
      return
    }
    const sb = getSupabaseBrowser()
    if (!sb) {
      setError(t('auth.notConfigured'))
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const up = await sb.auth.signUp({ email, password })
        if (up.error && !/registered|already/i.test(up.error.message)) throw up.error
        const inRes = await sb.auth.signInWithPassword({ email, password })
        if (inRes.error) {
          setError(t('auth.autoLoginFail'))
          setBusy(false)
          return
        }
      } else {
        const inRes = await sb.auth.signInWithPassword({ email, password })
        if (inRes.error) throw inRes.error
      }
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function toggleMode() {
    setMode(mode === 'signup' ? 'signin' : 'signup')
    setError(null)
  }

  function stop(e: React.MouseEvent) {
    e.stopPropagation()
  }

  const title = mode === 'signup' ? t('auth.signUpTitle') : t('auth.signInTitle')
  const cta = busy ? t('auth.processing') : mode === 'signup' ? t('auth.signUp') : t('auth.signIn')
  const switchLabel = mode === 'signup' ? t('auth.haveAccount') : t('auth.noAccount')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-sm rounded-t-2xl card p-5 sm:rounded-2xl" onClick={stop}>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-xs text-muted">{t('auth.subtitle')}</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.email')}
          className="mt-3 w-full rounded-lg card-2 px-3 py-2 text-sm outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.password')}
          className="mt-2 w-full rounded-lg card-2 px-3 py-2 text-sm outline-none"
        />
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        <button
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {cta}
        </button>
        <button onClick={toggleMode} className="mt-3 w-full text-center text-xs text-muted hover:underline">
          {switchLabel}
        </button>
      </div>
    </div>
  )
}
