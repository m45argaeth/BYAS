'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GameHeader } from '@/components/GameHeader'
import { BottomNav } from '@/components/BottomNav'
import { AuthModal } from '@/components/AuthModal'
import { ApiKeyModal } from '@/components/ApiKeyModal'
import { SettingsModal } from '@/components/SettingsModal'
import { useAuth } from '@/lib/useAuth'
import { useTheme } from '@/lib/theme'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { MIMO_KEY, loadStats, saveStats } from '@/lib/storage'
import { updateDisplayName } from '@/lib/cloud'

export default function AccountPage() {
  const { user } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const s = loadStats()
    if (s.displayName) setName(s.displayName)
    try { const k = localStorage.getItem(MIMO_KEY); if (k) setApiKey(k) } catch {}
  }, [])

  function notify(text: string) { setMsg(text); setTimeout(() => setMsg(null), 2200) }

  async function saveName() {
    if (!user) return
    const trimmed = name.trim().slice(0, 20)
    if (!trimmed) { notify('Nama tidak boleh kosong') ; return }
    setSaving(true)
    try {
      await updateDisplayName(user.id, trimmed)
      const s = loadStats()
      saveStats({ ...s, displayName: trimmed })
      notify('Nama tersimpan')
    } finally { setSaving(false) }
  }

  function handleSaveKey(k: string) {
    setApiKey(k)
    try { if (k) localStorage.setItem(MIMO_KEY, k); else localStorage.removeItem(MIMO_KEY) } catch {}
    notify('API key tersimpan')
  }

  async function signOut() {
    const sb = getSupabaseBrowser()
    await sb?.auth.signOut()
    if (typeof window !== 'undefined') window.location.reload()
  }

  return (
    <>
      <GameHeader eyebrow="BYAS · Account" />
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-6 pb-28">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="lab-eyebrow">BYAS · Account</p>
            <h1 className="truncate text-2xl font-black tracking-tight">👤 Account</h1>
            <p className="mt-0.5 text-xs text-muted">Profil, sinkronisasi, dan preferensi.</p>
          </div>
          <Link href="/" className="lab-button shrink-0">Lab</Link>
        </header>

        <section className="lab-panel">
          <p className="lab-eyebrow">Profil</p>
          {user ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted">Akun tersinkron — penemuan & XP otomatis tersimpan ke cloud.</p>
              <div>
                <label className="text-xs font-bold text-muted">Nama tampilan</label>
                <div className="mt-1 flex gap-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Nama kamu" className="flex-1 rounded-xl border border-base bg-white/[0.04] px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-300/40" />
                  <button onClick={saveName} disabled={saving} className="lab-button-primary disabled:cursor-not-allowed disabled:opacity-50">{saving ? '...' : 'Simpan'}</button>
                </div>
              </div>
              <button onClick={signOut} className="lab-button">Keluar</button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted">Masuk untuk sinkronisasi penemuan dan ikut leaderboard.</p>
              <button onClick={() => setShowAuth(true)} className="lab-button-primary">Masuk / Daftar</button>
            </div>
          )}
        </section>

        <section className="lab-panel">
          <p className="lab-eyebrow">Preferensi</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Tema</span>
              <button onClick={toggleTheme} className="lab-button text-xs">{theme === 'dark' ? '🌙 Gelap' : '☀️ Terang'}</button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Mimo API key {apiKey ? <span className="text-cyan-300">· aktif</span> : <span className="text-muted">· belum diset</span>}</span>
              <button onClick={() => setShowKey(true)} className="lab-button text-xs">🔑 Atur</button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Pengaturan lanjutan</span>
              <button onClick={() => setShowSettings(true)} className="lab-button text-xs">⚙️ Buka</button>
            </div>
          </div>
        </section>
      </main>
      <BottomNav />

      {showKey && <ApiKeyModal current={apiKey} onClose={() => setShowKey(false)} onSave={handleSaveKey} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {msg && <div className="toast-enter fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/92 px-4 py-3 text-sm text-white shadow-2xl" role="status">{msg}</div>}
    </>
  )
}
