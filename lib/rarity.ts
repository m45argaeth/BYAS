import type { Rarity } from './types'

export const RARITY_ORDER: Rarity[] = ['legendary', 'rare', 'uncommon', 'common']

export const RARITY_GRADIENT: Record<Rarity, string> = {
  common: 'from-slate-500 to-slate-700',
  uncommon: 'from-emerald-500 to-emerald-700',
  rare: 'from-sky-500 to-indigo-700',
  legendary: 'from-amber-400 to-orange-600',
}

export const RARITY_BG_GRADIENT: Record<Rarity, string> = {
  common: 'from-slate-600/20 to-slate-800/20',
  uncommon: 'from-emerald-600/20 to-emerald-800/20',
  rare: 'from-sky-600/20 to-indigo-800/20',
  legendary: 'from-amber-500/20 to-orange-700/20',
}

export const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-slate-400',
  uncommon: 'text-emerald-400',
  rare: 'text-sky-400',
  legendary: 'text-amber-400',
}

export const RARITY_GLOW: Record<Rarity, string> = {
  common: 'rgba(100,116,139,0.3)',
  uncommon: 'rgba(52,211,153,0.35)',
  rare: 'rgba(56,189,248,0.4)',
  legendary: 'rgba(251,191,36,0.5)',
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
}
