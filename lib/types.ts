export type Lang = 'id' | 'en' | 'cn'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

export type MasteryCategory =
  | 'organic'
  | 'inorganic'
  | 'metals'
  | 'gases'
  | 'biology'
  | 'energy'
  | 'industrial'

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
  category?: MasteryCategory
  difficulty?: number
  hint?: string
  ingredients?: string[]
  xp?: number
}

export interface Element {
  id: string
  name: string
  emoji: string
  formula?: string
  atomicNumber?: number
  group?: ElementGroup
  period?: number
  rarity?: Rarity
  category?: MasteryCategory
}

export interface Discovery extends CombineResult {
  discoveredAt: number
}

export interface Stats {
  currentStreak: number
  bestStreak: number
  lastPlayed: string | null
  displayName: string | null
  totalXp?: number
  bonusXp?: number
  coins?: number
  hintTokens?: number
  labReputation?: number
  completedDailyChallenges?: string[]
  completedWeeklyQuests?: string[]
  claimedStreakRewards?: number[]
  solvedMysteries?: string[]
  mysteryHintsUsed?: string[]
  failedExperiments?: number
}
