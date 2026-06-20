import type { Rarity } from './types'

// Urutan tampil: paling langka dulu.
export const RARITY_ORDER: Rarity[] = ['legendary', 'rare', 'uncommon', 'common']

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
}

// Gradient + border buat kartu / modal.
export const RARITY_GRADIENT: Record<Rarity, string> = {
  common: 'from-slate-600 to-slate-700 border-slate-400',
  uncommon: 'from-emerald-600 to-emerald-800 border-emerald-400',
  rare: 'from-sky-600 to-indigo-800 border-sky-400',
  legendary: 'from-amber-500 to-pink-700 border-amber-300',
}

// Warna teks aksen per rarity.
export const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-slate-300',
  uncommon: 'text-emerald-300',
  rare: 'text-sky-300',
  legendary: 'text-amber-300',
}
