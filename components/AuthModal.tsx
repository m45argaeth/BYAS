'use client'

import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

export function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    const sb = getSupabaseBrowser()
    if (!sb) {
      setError('Supabase belum dikonfigurasi (cek env).')
      return
    }
    if (!email || password.length < 6) {
      setError('Isi email + password minimal 6 karakter.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({ email, password })
        if (error) {
          setError(error.message)
          return
        }
        // Tanpa verifikasi: kalau session belum kebentuk, langsung login.
        if (!data.session) {
          const { error: e2 } = await sb.auth.signInWithPassword({ email, password })
          if (e2) {
            setError('Gagal auto-login. Pastikan "Confirm email" dimatikan di Supabase.')
            return
          }
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) {
          setError(error.message)
          return
        }
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'
      onClick={onClose}
    >
      <div
        className='w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6'
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className='text-lg font-bold'>{mode === 'signup' ? 'Daftar akun' : 'Masuk'}</h2>
        <p className='mt-1 text-sm text-slate-400'>
          Simpan koleksi kamu biar bisa diakses lintas device.
        </p>
        <input
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder='email@kamu.com'
          className='mt-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500'
        />
        <input
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder='password (min 6 karakter)'
          className='mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500'
        />
        {error && <p className='mt-2 text-xs text-red-400'>{error}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className='mt-4 w-full rounded-lg bg-sky-600 py-2 font-semibold hover:bg-sky-500 disabled:opacity-50'
        >
          {busy ? 'Memproses...' : mode === 'signup' ? 'Daftar' : 'Masuk'}
        </button>
        <button
          onClick={() => {
            setMode(mode === 'signup' ? 'signin' : 'signup')
            setError(null)
          }}
          className='mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-200'
        >
          {mode === 'signup' ? 'Udah punya akun? Masuk' : 'Belum punya akun? Daftar'}
        </button>
      </div>
    </div>
  )
}
