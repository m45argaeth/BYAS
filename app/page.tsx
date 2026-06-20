'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { STARTER_ELEMENTS } from '@/lib/elements'
import type { CombineResult, Discovery, Element, Stats } from '@/lib/types'
import { DiscoveryModal } from '@/components/DiscoveryModal'
import { ApiKeyModal } from '@/components/ApiKeyModal'
import { AuthModal } from '@/components/AuthModal'
import { StatsBar } from '@/components/StatsBar'
import { INV_KEY, MIMO_KEY, saveDiscovery, loadDiscoveries, loadStats, saveStats } from '@/lib/storage'
import { totalXpFromDiscoveries, recordPlay, XP_BY_RARITY } from '@/lib/progress'
import { useAuth } from '@/lib/useAuth'
import { syncDiscoveries, syncStats } from '@/lib/sync'
import { pushCloudDiscovery, pushStats } from '@/lib/cloud'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

export default function Home() {
  const { user } = useAuth()
  const [inventory, setInventory] = useState<Element[]>(STARTER_ELEMENTS)
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [stats, setStats] = useState<Stats>({ currentStreak: 0, bestStreak: 0, lastPlayed: null })
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [discovery, setDiscovery] = useState<{
    result: CombineResult
    isNew: boolean
    xpGain: number
  } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    try {
      const inv = localStorage.getItem(INV_KEY)
      if (inv) setInventory(JSON.parse(inv))
      const k = localStorage.getItem(MIMO_KEY)
      if (k) setApiKey(k)
    } catch {}
    setDiscoveries(loadDiscoveries())
    setStats(loadStats())
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(INV_KEY, JSON.stringify(inventory))
    } catch {}
  }, [inventory])

  // Saat login: sync koleksi + stats cloud <-> lokal.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    syncDiscoveries(user.id).then((merged) => {
      if (cancelled) return
      setDiscoveries(merged)
      setInventory((prev) => {
        const names = new Set(prev.map((e) => e.name))
        const additions = merged
          .filter((d) => !names.has(d.result))
          .map((d) => ({ name: d.result, emoji: d.emoji, formula: d.formula ?? undefined }))
        return additions.length ? [...prev, ...additions] : prev
      })
    })
    syncStats(user.id).then((s) => {
      if (!cancelled) setStats(s)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const totalXp = useMemo(() => totalXpFromDiscoveries(discoveries), [discoveries])

  const selectedElements = useMemo(
    () =>
      selected
        .map((n) => inventory.find((e) => e.name === n))
        .filter(Boolean) as Element[],
    [selected, inventory],
  )

  function toggle(name: string) {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name)
      if (prev.length >= 2) return [prev[1], name]
      return [...prev, name]
    })
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function signOut() {
    const sb = getSupabaseBrowser()
    await sb?.auth.signOut()
  }

  // Catat main hari ini -> update streak (lokal + cloud).
  function registerPlay() {
    setStats((prev) => {
      const ns = recordPlay(prev)
      if (ns !== prev) {
        saveStats(ns)
        if (user) pushStats(user.id, ns).catch(() => {})
      }
      return ns
    })
  }

  async function combine() {
    if (selected.length !== 2 || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/combine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-mimo-key': apiKey } : {}),
        },
        body: JSON.stringify({ a: selected[0], b: selected[1] }),
      })
      const data = await res.json()
      if (!res.ok) {
        const map: Record<string, string> = {
          invalid_player_key: 'API key kamu invalid 😬',
          no_key: 'Belum ada API key sistem yang aktif.',
          all_keys_failed: 'Semua key lagi sibuk, coba lagi sebentar.',
        }
        showToast(map[data?.error] ?? 'Gagal combine, coba lagi.')
        return
      }
      const result = data as CombineResult
      if (!result.reacted) {
        showToast(`${selected[0]} + ${selected[1]} → nggak bereaksi 🚫`)
        setSelected([])
        return
      }
      const disc: Discovery = { ...result, discoveredAt: Date.now() }
      const isNew = saveDiscovery(disc)
      if (isNew) {
        setDiscoveries((prev) => [...prev, disc])
        if (user) pushCloudDiscovery(user.id, disc).catch(() => {})
        if (!inventory.some((e) => e.name === result.result)) {
          setInventory((prev) => [
            ...prev,
            { name: result.result, emoji: result.emoji, formula: result.formula ?? undefined },
          ])
        }
      }
      registerPlay()
      setDiscovery({
        result,
        isNew,
        xpGain: isNew ? XP_BY_RARITY[result.rarity] ?? 10 : 0,
      })
      setSelected([])
    } catch {
      showToast('Koneksi bermasalah, coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  function resetGame() {
    if (!confirm('Reset inventory ke starter pack? (Koleksi & XP tetap aman)')) return
    setInventory(STARTER_ELEMENTS)
    setSelected([])
  }

  return (
    <main className='mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6'>
      <header className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-extrabold tracking-tight'>⚗️ BYAS</h1>
          <p className='text-xs text-slate-400'>Bring Your Alchemy Skill</p>
        </div>
        <div className='flex items-center gap-2'>
          <Link
            href='/pokedex'
            className='rounded-full bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700'
          >
            📒 Koleksi
          </Link>
          <button
            onClick={() => setShowKeyModal(true)}
            className='rounded-full bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700'
          >
            🔑 {apiKey ? 'BYOK aktif' : 'Key sistem'}
          </button>
          {user ? (
            <button
              onClick={signOut}
              title={user.email ?? undefined}
              className='rounded-full bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700'
            >
              👤 Keluar
            </button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className='rounded-full bg-emerald-700 px-3 py-1 text-xs font-medium hover:bg-emerald-600'
            >
              Masuk
            </button>
          )}
        </div>
      </header>

      <StatsBar totalXp={totalXp} streak={stats.currentStreak} bestStreak={stats.bestStreak} />

      <section className='mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4'>
        <Slot el={selectedElements[0]} />
        <div className='text-center text-2xl text-slate-500'>+</div>
        <Slot el={selectedElements[1]} />
      </section>

      <button
        onClick={combine}
        disabled={selected.length !== 2 || loading}
        className='mt-4 w-full rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3 font-bold transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40'
      >
        {loading ? '🧪 Mereaksikan...' : 'Combine'}
      </button>

      <section className='mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4'>
        {inventory.map((el) => {
          const active = selected.includes(el.name)
          return (
            <button
              key={el.name}
              onClick={() => toggle(el.name)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition ${
                active
                  ? 'border-sky-400 bg-sky-500/20'
                  : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'
              }`}
            >
              <span className='text-3xl'>{el.emoji}</span>
              <span className='text-xs font-medium'>{el.name}</span>
            </button>
          )
        })}
      </section>

      <footer className='mt-auto pt-6 text-center'>
        <button onClick={resetGame} className='text-xs text-slate-500 hover:text-slate-300'>
          Reset inventory
        </button>
      </footer>

      {discovery && (
        <DiscoveryModal
          result={discovery.result}
          isNew={discovery.isNew}
          xpGain={discovery.xpGain}
          onClose={() => setDiscovery(null)}
        />
      )}
      {showKeyModal && (
        <ApiKeyModal
          current={apiKey}
          onClose={() => setShowKeyModal(false)}
          onSave={(k) => {
            setApiKey(k)
            try {
              if (k) localStorage.setItem(MIMO_KEY, k)
              else localStorage.removeItem(MIMO_KEY)
            } catch {}
            setShowKeyModal(false)
          }}
        />
      )}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {toast && (
        <div className='fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-800 px-4 py-2 text-sm shadow-lg'>
          {toast}
        </div>
      )}
    </main>
  )
}

function Slot({ el }: { el?: Element }) {
  if (!el) {
    return (
      <div className='flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-700 text-xs text-slate-600'>
        Pilih elemen
      </div>
    )
  }
  return (
    <div className='flex h-24 flex-col items-center justify-center gap-1 rounded-xl border border-sky-500/40 bg-sky-500/10'>
      <span className='text-3xl'>{el.emoji}</span>
      <span className='text-xs'>{el.name}</span>
    </div>
  )
}
