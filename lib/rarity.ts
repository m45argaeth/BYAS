import type { Rarity } from './types'

export const RARITY_ORDER: Rarity[] = ['legendary', 'rare', 'uncommon', 'common']

export const RARITY_GRADIENT: Record<Rarity, string> = {
  common: 'from-slate-500 to-slate-700',
  uncommon: 'from-emerald-500 to-emerald-700',
  rare: 'from-sky-500 to-indigo-700',
  legendary: 'from-amber-400 to-orange-600',
}

export const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-slate-400',
  uncommon: 'text-emerald-400',
  rare: 'text-sky-400',
  legendary: 'text-amber-400',
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
}
