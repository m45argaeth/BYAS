import type { Rarity } from './types'

export const RARITY_ORDER: Rarity[] = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common']

export const RARITY_GRADIENT: Record<Rarity, string> = {
  common: 'from-slate-400 to-slate-600',
  uncommon: 'from-emerald-400 to-teal-600',
  rare: 'from-sky-400 to-blue-700',
  epic: 'from-violet-400 to-fuchsia-700',
  legendary: 'from-amber-300 via-orange-500 to-rose-600',
  mythic: 'from-cyan-300 via-violet-500 to-rose-500',
}

export const RARITY_BG_GRADIENT: Record<Rarity, string> = {
  common: 'from-slate-500/16 to-slate-900/20',
  uncommon: 'from-emerald-500/18 to-teal-900/24',
  rare: 'from-sky-500/20 to-blue-950/28',
  epic: 'from-violet-500/22 to-fuchsia-950/30',
  legendary: 'from-amber-400/24 via-orange-600/20 to-rose-900/30',
  mythic: 'from-cyan-300/22 via-violet-700/24 to-rose-900/32',
}

export const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-slate-300',
  uncommon: 'text-emerald-300',
  rare: 'text-sky-300',
  epic: 'text-violet-300',
  legendary: 'text-amber-300',
  mythic: 'text-fuchsia-200',
}

export const RARITY_GLOW: Record<Rarity, string> = {
  common: 'rgba(148,163,184,0.32)',
  uncommon: 'rgba(52,211,153,0.38)',
  rare: 'rgba(56,189,248,0.46)',
  epic: 'rgba(167,139,250,0.52)',
  legendary: 'rgba(251,191,36,0.62)',
  mythic: 'rgba(217,70,239,0.68)',
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
}
