export type Lang = 'id' | 'en' | 'cn'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export type ElementGroup =
  | 'alkali-metal'
  | 'alkaline-earth'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'unknown'

export interface CombineResult {
  result: string
  formula: string | null
  emoji: string
  explanation: string
  fun_fact: string
  rarity: Rarity
  reacted: boolean
}

export interface Element {
  id: string
  name: string
  emoji: string
  formula?: string
  atomicNumber?: number
  group?: ElementGroup
  period?: number
}

export interface Discovery extends CombineResult {
  discoveredAt: number
}

export interface Stats {
  currentStreak: number
  bestStreak: number
  lastPlayed: string | null
  displayName: string | null
}
