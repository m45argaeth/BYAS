import type { Element, ElementGroup, Lang, MasteryCategory } from './types'

interface StarterDef {
  id: string
  atomicNumber: number
  emoji: string
  formula: string
  group: ElementGroup
  category: MasteryCategory
  tier: number
  period: number
  names: Record<Lang, string>
}

// 8-element starter pack: H O C N Si Fe S P (BYAS Discovery Engine v3).
// Every discovery in the game must ultimately trace back to these elements.
// All starters are Tier 1 "Elements" and sit in the Chemistry discovery domain;
// they chain toward materials, life, civilization and eventually the space age.
export const STARTER_DEFS: StarterDef[] = [
  { id: 'H', atomicNumber: 1, emoji: '🎈', formula: 'H', group: 'nonmetal', category: 'chemistry', tier: 1, period: 1, names: { id: 'Hidrogen', en: 'Hydrogen', cn: '氢' } },
  { id: 'O', atomicNumber: 8, emoji: '💨', formula: 'O', group: 'nonmetal', category: 'chemistry', tier: 1, period: 2, names: { id: 'Oksigen', en: 'Oxygen', cn: '氧' } },
  { id: 'C', atomicNumber: 6, emoji: '💎', formula: 'C', group: 'nonmetal', category: 'chemistry', tier: 1, period: 2, names: { id: 'Karbon', en: 'Carbon', cn: '碳' } },
  { id: 'N', atomicNumber: 7, emoji: '🌬️', formula: 'N', group: 'nonmetal', category: 'chemistry', tier: 1, period: 2, names: { id: 'Nitrogen', en: 'Nitrogen', cn: '氮' } },
  { id: 'Si', atomicNumber: 14, emoji: '🪨', formula: 'Si', group: 'metalloid', category: 'chemistry', tier: 1, period: 3, names: { id: 'Silikon', en: 'Silicon', cn: '硅' } },
  { id: 'Fe', atomicNumber: 26, emoji: '🧲', formula: 'Fe', group: 'transition-metal', category: 'chemistry', tier: 1, period: 4, names: { id: 'Besi', en: 'Iron', cn: '铁' } },
  { id: 'S', atomicNumber: 16, emoji: '🟡', formula: 'S', group: 'nonmetal', category: 'chemistry', tier: 1, period: 3, names: { id: 'Sulfur', en: 'Sulfur', cn: '硫' } },
  { id: 'P', atomicNumber: 15, emoji: '🔥', formula: 'P', group: 'nonmetal', category: 'chemistry', tier: 1, period: 3, names: { id: 'Fosfor', en: 'Phosphorus', cn: '磷' } },
]

export const STARTER_IDS = new Set(STARTER_DEFS.map((d) => d.id))

export function starterName(id: string, lang: Lang): string {
  const def = STARTER_DEFS.find((d) => d.id === id)
  return def ? def.names[lang] ?? def.names.en : id
}

export function buildStarters(lang: Lang): Element[] {
  return STARTER_DEFS.map((d) => ({
    id: d.id,
    name: d.names[lang] ?? d.names.en,
    emoji: d.emoji,
    formula: d.formula,
    atomicNumber: d.atomicNumber,
    group: d.group,
    category: d.category,
    tier: d.tier,
    period: d.period,
    rarity: 'common' as const,
  }))
}

export const GROUP_COLORS: Record<ElementGroup, { border: string; glow: string; text: string; ring: string }> = {
  'alkali-metal': { border: '#f87171', glow: '#ef4444', text: '#dc2626', ring: 'rgba(239,68,68,0.45)' },
  'alkaline-earth': { border: '#fb923c', glow: '#f97316', text: '#ea580c', ring: 'rgba(249,115,22,0.45)' },
  'transition-metal': { border: '#facc15', glow: '#eab308', text: '#ca8a04', ring: 'rgba(234,179,8,0.45)' },
  'post-transition-metal': { border: '#2dd4bf', glow: '#14b8a6', text: '#0f766e', ring: 'rgba(20,184,166,0.45)' },
  'metalloid': { border: '#4ade80', glow: '#22c55e', text: '#15803d', ring: 'rgba(34,197,94,0.45)' },
  'nonmetal': { border: '#38bdf8', glow: '#0ea5e9', text: '#0369a1', ring: 'rgba(14,165,233,0.45)' },
  'halogen': { border: '#a78bfa', glow: '#8b5cf6', text: '#6d28d9', ring: 'rgba(139,92,246,0.45)' },
  'noble-gas': { border: '#818cf8', glow: '#6366f1', text: '#4f46e5', ring: 'rgba(99,102,241,0.45)' },
  'unknown': { border: '#94a3b8', glow: '#64748b', text: '#475569', ring: 'rgba(100,116,139,0.3)' },
}

export const GROUP_LABEL: Record<ElementGroup, string> = {
  'alkali-metal': 'Alkali Metal',
  'alkaline-earth': 'Alkaline Earth',
  'transition-metal': 'Transition Metal',
  'post-transition-metal': 'Post-Transition',
  'metalloid': 'Metalloid',
  'nonmetal': 'Nonmetal',
  'halogen': 'Halogen',
  'noble-gas': 'Noble Gas',
  'unknown': 'Unknown',
}
