'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type DragEvent } from 'react'
import Link from 'next/link'
import { buildStarters, STARTER_IDS } from '@/lib/elements'
import type { CombineResult, Discovery, Element, ElementGroup, Lang, Rarity, Stats } from '@/lib/types'
import { GameHeader } from '@/components/GameHeader'
import { BottomNav } from '@/components/BottomNav'
import { DiscoveryModal } from '@/components/DiscoveryModal'
import { AchievementToast } from '@/components/AchievementToast'
import { MIMO_KEY, saveDiscovery, loadDiscoveries, loadStats, saveStats } from '@/lib/storage'
import { guessCategory, levelProgress, recordPlay, totalXp, xpForNewDiscovery } from '@/lib/progress'
import { useAuth } from '@/lib/useAuth'
import { syncDiscoveries, syncStats } from '@/lib/sync'
import { pushCloudDiscovery, pushStats, pushTotalXp } from '@/lib/cloud'
import { useI18n } from '@/lib/i18n'
import { discoveryText } from '@/lib/localize'
import { initSound, playPop, playError, playSuccess, playUnlock, playCombineCast, playReactionBurst } from '@/lib/sound'
import { ACHIEVEMENTS, computeUnlocked, loadSeen, saveSeen } from '@/lib/achievements'
import { RARITY_GLOW } from '@/lib/rarity'

const DEFAULT_STATS: Stats = { currentStreak: 0, bestStreak: 0, lastPlayed: null, displayName: null, hintTokens: 0, coins: 0, bonusXp: 0, failedExperiments: 0 }

type SpecimenKind = 'element' | 'compound' | 'fresh'

// Top-slot label for compound cards (replaces the atomic number). "Senyawa" when
// both ingredients are base elements; "Senyawa Baru" when a compound was involved.
const COMPOUND_LABEL: Record<Lang, { base: string; fresh: string }> = {
  id: { base: 'Senyawa', fresh: 'Senyawa Baru' },
  en: { base: 'Compound', fresh: 'New Compound' },
  cn: { base: '\u5316\u5408\u7269', fresh: '\u65b0\u5316\u5408\u7269' },
}

// Labels for the two dock grouping filters.
const FILTER_LABEL: Record<Lang, { tier: string; type: string }> = {
  id: { tier: 'Per Tier', type: 'Per Jenis' },
  en: { tier: 'By Tier', type: 'By Type' },
  cn: { tier: '\u6309\u7a00\u6709\u5ea6', type: '\u6309\u7c7b\u578b' },
}

// Section headings when grouping by specimen kind.
const TYPE_LABEL: Record<Lang, Record<SpecimenKind, string>> = {
  id: { element: 'Unsur', compound: 'Senyawa', fresh: 'Senyawa Baru' },
  en: { element: 'Elements', compound: 'Compounds', fresh: 'New Compounds' },
  cn: { element: '\u5143\u7d20', compound: '\u5316\u5408\u7269', fresh: '\u65b0\u5316\u5408\u7269' },
}

// Section headings when grouping by rarity tier.
const TIER_LABEL: Record<Lang, Record<Rarity, string>> = {
  id: { common: 'Umum', uncommon: 'Tak Umum', rare: 'Langka', epic: 'Epik', legendary: 'Legendaris', mythic: 'Mitos' },
  en: { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' },
  cn: { common: '\u666e\u901a', uncommon: '\u7f55\u89c1', rare: '\u7a00\u6709', epic: '\u53f2\u8bd7', legendary: '\u4f20\u5947', mythic: '\u795e\u8bdd' },
}

const TYPE_ORDER: SpecimenKind[] = ['element', 'compound', 'fresh']
const TIER_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

const SUBSCRIPTS = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089'

// Turn ASCII digits that directly follow an element symbol or a closing paren
// into proper subscripts (H2O -> H\u2082O, Ca(OH)2 -> Ca(OH)\u2082). Coefficient
// numbers after a middle dot (e.g. CH4\u00b75.75H2O) are left as-is.
function formatFormula(f: string): string {
  return f.replace(/([A-Za-z)])(\d+)/g, (_m, lead: string, digits: string) =>
    lead + digits.replace(/\d/g, (d) => SUBSCRIPTS[Number(d)]),
  )
}

function isElementSpecimen(element: Element): boolean {
  return element.atomicNumber != null
}

function isFreshCompound(element: Element): boolean {
  return !!element.ingredients && element.ingredients.some((id) => !STARTER_IDS.has(id))
}

function specimenKind(element: Element): SpecimenKind {
  if (isElementSpecimen(element)) return 'element'
  return isFreshCompound(element) ? 'fresh' : 'compound'
}

function specimenTier(element: Element): Rarity {
  return element.rarity ?? 'common'
}

function specimenTopLabel(element: Element, lang: Lang): string {
  if (isElementSpecimen(element)) return String(element.atomicNumber)
  return isFreshCompound(element) ? COMPOUND_LABEL[lang].fresh : COMPOUND_LABEL[lang].base
}

function specimenSymbol(element: Element): string {
  if (isElementSpecimen(element)) return element.id.length <= 3 ? element.id : element.emoji
  return element.formula ? formatFormula(element.formula) : element.emoji
}

type DockSection = { id: string; label: string; tier?: Rarity; items: Element[] }

// Build the dock layout. No filters => one flat grid. "By type" groups into
// Unsur / Senyawa / Senyawa Baru. "By tier" groups by rarity. Both on => nested
// (type first, then tier within each type).
function buildDockSections(items: Element[], byTier: boolean, byType: boolean, lang: Lang): DockSection[] {
  if (!byTier && !byType) return [{ id: 'all', label: '', items }]
  const sections: DockSection[] = []
  if (byType && byTier) {
    for (const ty of TYPE_ORDER) {
      for (const ti of TIER_ORDER) {
        const sub = items.filter((e) => specimenKind(e) === ty && specimenTier(e) === ti)
        if (sub.length) sections.push({ id: `${ty}-${ti}`, label: `${TYPE_LABEL[lang][ty]} \u00b7 ${TIER_LABEL[lang][ti]}`, tier: ti, items: sub })
      }
    }
  } else if (byType) {
    for (const ty of TYPE_ORDER) {
      const sub = items.filter((e) => specimenKind(e) === ty)
      if (sub.length) sections.push({ id: ty, label: TYPE_LABEL[lang][ty], items: sub })
    }
  } else {
    for (const ti of TIER_ORDER) {
      const sub = items.filter((e) => specimenTier(e) === ti)
      if (sub.length) sections.push({ id: ti, label: TIER_LABEL[lang][ti], tier: ti, items: sub })
    }
  }
  return sections
}

function haptic(ms: number) {
  try { navigator.vibrate?.(ms) } catch {}
}

type ReactorState = 'idle' | 'ready' | 'reacting' | 'success' | 'failed'
type AchToast = { emoji: string; title: string; label: string }
type Particle = { id: number; x: number; y: number; color: string; size: number; delay: number }

function ParticleBurst({ particles }: { particles: Particle[] }) {
  if (!particles.length) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[80]">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            '--px': `${p.x}px`,
            '--py': `${p.y}px`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            left: '50%',
            top: '42%',
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

function SpecimenTile({ element, selected, onSelect, onDragStart }: { element: Element; selected: boolean; onSelect: () => void; onDragStart: (e: DragEvent<HTMLButtonElement>) => void }) {
  const { lang } = useI18n()
  const group: ElementGroup = element.group ?? 'unknown'
  const isEl = isElementSpecimen(element)
  const rarity: Rarity = element.rarity ?? 'common'
  const topLabel = specimenTopLabel(element, lang)
  const symbol = specimenSymbol(element)
  const label = group !== 'unknown'
    ? group.replaceAll('-', ' ')
    : guessCategory({ result: element.name, formula: element.formula, category: element.category })
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={element.name}
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      className={`specimen-tile tier-${rarity} ${selected ? 'is-selected' : ''}`}
    >
      <span className={`specimen-number ${isEl ? '' : 'is-compound'}`}>{topLabel}</span>
      <span className={`specimen-symbol ${isEl ? '' : 'is-formula'}`}>{symbol}</span>
      <span className="specimen-name">{element.name}</span>
      <span className="specimen-group">{label}</span>
    </button>
  )
}

function ChamberSlot({ element, label, onRemove }: { element?: Element; label: string; onRemove: () => void }) {
  const { lang } = useI18n()
  if (!element) {
    return <div className="chamber-slot empty"><span>{label}</span></div>
  }
  const isEl = isElementSpecimen(element)
  const rarity: Rarity = element.rarity ?? 'common'
  const topLabel = specimenTopLabel(element, lang)
  const symbol = specimenSymbol(element)
  return (
    <button type="button" onClick={onRemove} aria-label={element.name} className={`chamber-slot filled tier-${rarity}`}>
      <small className={isEl ? '' : 'is-compound'}>{topLabel}</small>
      <strong className={isEl ? '' : 'is-formula'}>{symbol}</strong>
      <span>{element.name}</span>
    </button>
  )
}

function ReactionChamber({ selected, state, dragOver, onRun, onClear, onDropSpecimen, onRemoveSpecimen, onDragStateChange }: { selected: Element[]; state: ReactorState; dragOver: boolean; onRun: () => void; onClear: () => void; onDropSpecimen: (id: string) => void; onRemoveSpecimen: (index: number) => void; onDragStateChange: (v: boolean) => void }) {
  const { t } = useI18n()
  const ready = selected.length === 2 && state !== 'reacting'
  const step = state === 'reacting' ? 4 : selected.length === 0 ? 1 : selected.length === 1 ? 2 : 3
  const status = state === 'reacting' ? t('lab.statusReacting') : ready ? t('lab.statusReady') : selected.length === 1 ? t('lab.statusOne') : t('lab.statusEmpty')
  return (
    <section
      className={`reaction-chamber state-${state} ${dragOver ? 'chamber-drop-active' : ''}`}
      aria-label="Reaction chamber"
      aria-live="polite"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!dragOver) onDragStateChange(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) onDragStateChange(false) }}
      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) onDropSpecimen(id); onDragStateChange(false) }}
    >
      <div className="chamber-core">
        <p className="chamber-step"><b>{step}/4</b> {t('lab.flow')}</p>
        <div className="chamber-slots">
          <ChamberSlot element={selected[0]} label={t('lab.specimenA')} onRemove={() => onRemoveSpecimen(0)} />
          <div className="chamber-plus">+</div>
          <ChamberSlot element={selected[1]} label={t('lab.specimenB')} onRemove={() => onRemoveSpecimen(1)} />
        </div>
        <h2>{status}</h2>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={onRun} disabled={!ready} className="lab-button-primary min-w-44 disabled:cursor-not-allowed disabled:opacity-40">
            {state === 'reacting' ? t('lab.synth') : t('lab.run')}
          </button>
          {selected.length ? <button type="button" onClick={onClear} className="lab-button">{t('lab.clear')}</button> : null}
        </div>
        <p className="chamber-hint">{t('lab.hintLead')} <span className="kbd-hint"><kbd>Enter</kbd></span> {t('lab.hintReact')} · <span className="kbd-hint"><kbd>Esc</kbd></span> {t('lab.hintReset')}</p>
      </div>
    </section>
  )
}

export default function Home() {
  const { user } = useAuth()
  const { lang, t } = useI18n()

  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS)
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [discovery, setDiscovery] = useState<{ result: CombineResult; isNew: boolean; xpGain: number } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [achToast, setAchToast] = useState<AchToast | null>(null)
  const [reactorState, setReactorState] = useState<ReactorState>('idle')
  const [particles, setParticles] = useState<Particle[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [byTier, setByTier] = useState(false)
  const [byType, setByType] = useState(false)

  useEffect(() => {
    setDiscoveries(loadDiscoveries())
    setStats({ ...DEFAULT_STATS, ...loadStats() })
    initSound()
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    syncDiscoveries(user.id).then((merged) => { if (!cancelled) setDiscoveries(merged) })
    syncStats(user.id).then((s) => { if (!cancelled) setStats({ ...DEFAULT_STATS, ...s }) })
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (loading) setReactorState('reacting')
    else setReactorState(selected.length === 2 ? 'ready' : 'idle')
  }, [loading, selected.length])

  const inventory: Element[] = useMemo(() => {
    const map = new Map<string, Element>()
    for (const s of buildStarters(lang)) map.set(s.id, s)
    for (const d of discoveries) {
      if (!map.has(d.result)) map.set(d.result, { id: d.result, name: discoveryText(d, lang).result, emoji: d.emoji, formula: d.formula ?? undefined, rarity: d.rarity, category: d.category, ingredients: d.ingredients })
    }
    return Array.from(map.values())
  }, [lang, discoveries])

  const dockSections = useMemo(() => buildDockSections(inventory, byTier, byType, lang), [inventory, byTier, byType, lang])

  const selEls = useMemo(() => selected.map((id) => inventory.find((e) => e.id === id)).filter(Boolean) as Element[], [selected, inventory])

  const spawnParticles = useCallback((success: boolean, rarity: keyof typeof RARITY_GLOW = 'rare') => {
    const palette = success ? ['#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#fbbf24', '#34d399'] : ['#fb7185', '#f97316', '#fca5a5']
    const count = success ? 28 : 12
    const spread = success ? 280 : 120
    const arr = Array.from({ length: count }, (_, i) => ({ id: i, x: (Math.random() - 0.5) * spread, y: (Math.random() - 0.5) * spread - 40, color: palette[i % palette.length], size: 4 + Math.random() * (success ? 10 : 6), delay: Math.random() * 0.22 }))
    setParticles(arr)
    setTimeout(() => setParticles([]), 1400)
  }, [])

  function toggle(id: string) {
    playPop()
    haptic(6)
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id])
  }

  function addToChamber(id: string) {
    playPop()
    haptic(10)
    setSelected((prev) => prev.includes(id) ? prev : prev.length >= 2 ? [prev[1], id] : [...prev, id])
  }

  function showToast(text: string) { setMsg(text); setTimeout(() => setMsg(null), 2600) }

  function checkAchievements(ds: Discovery[], st: Stats) {
    const level = levelProgress(totalXp(ds, st)).level
    const unlocked = computeUnlocked(ds, st, level)
    const seen = loadSeen()
    const fresh = Array.from(unlocked).filter((id) => !seen.has(id))
    if (!fresh.length) return
    const ach = ACHIEVEMENTS.find((a) => a.id === fresh[0])
    if (ach) {
      setAchToast({ emoji: ach.emoji, title: ach.title, label: t('ach.unlocked') })
      playUnlock()
      setTimeout(() => setAchToast(null), 3600)
    }
    saveSeen(unlocked)
  }

  const combine = useCallback(async () => {
    if (selected.length !== 2 || loading) return
    const a = inventory.find((e) => e.id === selected[0])
    const b = inventory.find((e) => e.id === selected[1])
    if (!a || !b) return
    setLoading(true)
    playCombineCast()
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      let key = ''
      try { key = (typeof localStorage !== 'undefined' && localStorage.getItem(MIMO_KEY)) || '' } catch {}
      if (key) headers['x-mimo-key'] = key
      const res = await fetch('/api/combine', { method: 'POST', headers, body: JSON.stringify({ aId: a.id, bId: b.id, aName: a.name, bName: b.name, lang }) })
      const data = await res.json()
      if (!res.ok || data.error) { playError(); setReactorState('failed'); spawnParticles(false); showToast(t('lab.failPrefix') + (data?.error ?? 'combine')); return }
      const result = data as CombineResult
      if (!result.reacted) { playError(); haptic(40); setReactorState('failed'); spawnParticles(false); showToast(t('lab.noReaction')); setSelected([]); return }
      setReactorState('success')
      spawnParticles(true, result.rarity)
      playReactionBurst()
      haptic(22)
      const ns = recordPlay(stats)
      const xpGain = xpForNewDiscovery(result, ns.currentStreak || 0)
      const disc: Discovery = { ...result, discoveredAt: Date.now(), xp: xpGain }
      const isNew = saveDiscovery(disc)
      let nextList = discoveries
      if (isNew) {
        nextList = [...discoveries, disc]
        setDiscoveries(nextList)
        playSuccess()
        if (user) { pushCloudDiscovery(user.id, disc).catch(() => {}); pushTotalXp(user.id, totalXp(nextList, ns)).catch(() => {}) }
      } else playPop()
      setStats(ns)
      saveStats(ns)
      if (user) pushStats(user.id, ns, totalXp(nextList, ns)).catch(() => {})
      setDiscovery({ result, isNew, xpGain: isNew ? xpGain : 0 })
      checkAchievements(nextList, ns)
      setSelected([])
    } catch {
      playError(); setReactorState('failed'); spawnParticles(false); showToast(t('lab.networkErr'))
    } finally {
      setLoading(false)
      setTimeout(() => setReactorState('idle'), 900)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, loading, inventory, lang, stats, discoveries, user, spawnParticles, t])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (discovery) return
      if (e.key === 'Enter' && selected.length === 2 && !loading) { e.preventDefault(); combine() }
      else if ((e.key === 'Escape' || e.key === 'Backspace') && selected.length) { e.preventDefault(); setSelected([]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, loading, combine, discovery])

  return (
    <div className="app">
      <ParticleBurst particles={particles} />

      <aside className="rail">
        <Link href="/" className="rail-brand" aria-label="BYAS Lab">🧪</Link>
        <nav className="rail-nav">
          <Link href="/" className="rail-btn is-active" aria-label={t('nav.lab')} aria-current="page">🧪</Link>
          <Link href="/quest" className="rail-btn" aria-label={t('nav.quest')}>🎯</Link>
          <Link href="/progress" className="rail-btn" aria-label={t('nav.progress')}>📊</Link>
          <Link href="/leaderboard" className="rail-btn" aria-label={t('nav.ranks')}>🏆</Link>
          <Link href="/account" className="rail-btn" aria-label={t('nav.account')}>👤</Link>
        </nav>
      </aside>

      <div className="stage">
        <GameHeader discoveries={discoveries} stats={stats} />
        <div className="stage-scroll">
          <ReactionChamber selected={selEls} state={reactorState} dragOver={dragOver} onRun={combine} onClear={() => setSelected([])} onDropSpecimen={addToChamber} onRemoveSpecimen={(i) => setSelected((prev) => prev.filter((_, idx) => idx !== i))} onDragStateChange={setDragOver} />
          <section className="specimen-dock" aria-label="Specimen dock">
            <div className="dock-head">
              <div className="dock-head-row">
                <div><p className="lab-eyebrow">{t('lab.dockEyebrow')}</p><h3>{t('lab.dockTitle')}</h3></div>
                {selected.length ? <button onClick={() => setSelected([])} className="dock-clear" type="button">{t('lab.clearSel')}</button> : null}
              </div>
              <div className="dock-filters">
                <button type="button" aria-pressed={byTier} onClick={() => setByTier((v) => !v)} className={`dock-filter ${byTier ? 'is-on' : ''}`}>
                  <span className="dot" />{FILTER_LABEL[lang].tier}
                </button>
                <button type="button" aria-pressed={byType} onClick={() => setByType((v) => !v)} className={`dock-filter ${byType ? 'is-on' : ''}`}>
                  <span className="dot" />{FILTER_LABEL[lang].type}
                </button>
              </div>
            </div>
            {dockSections.map((sec) => (
              <div key={sec.id} className="specimen-section">
                {sec.label ? (
                  <p className={`specimen-section-title ${sec.tier ? `tier-${sec.tier}` : ''}`}>{sec.label}<span className="specimen-section-count">{sec.items.length}</span></p>
                ) : null}
                <div className="specimen-grid">
                  {sec.items.map((el) => (
                    <SpecimenTile
                      key={el.id}
                      element={el}
                      selected={selected.includes(el.id)}
                      onSelect={() => toggle(el.id)}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', el.id); e.dataTransfer.effectAllowed = 'move' }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>

      <BottomNav />

      {discovery && <DiscoveryModal result={discovery.result} isNew={discovery.isNew} xpGain={discovery.xpGain} onClose={() => setDiscovery(null)} />}
      {achToast && <AchievementToast emoji={achToast.emoji} title={achToast.title} label={achToast.label} />}
      {msg && <div className="toast-enter fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/92 px-4 py-3 text-sm text-white shadow-2xl" role="status">{msg}</div>}
    </div>
  )
}
