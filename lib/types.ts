export type Lang = 'id' | 'en' | 'cn'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

// BYAS Discovery Engine v3 — the 8 discovery domains a result can belong to.
// (Replaces the old chemistry-only mastery categories.)
export type DiscoveryCategory =
  | 'chemistry'
  | 'materials'
  | 'geology'
  | 'biology'
  | 'knowledge'
  | 'technology'
  | 'civilization'
  | 'space'

// Back-compat alias: much of the codebase still imports `MasteryCategory`.
export type MasteryCategory = DiscoveryCategory

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

// Language-dependent text for a discovery. Stored for every supported language
// so the UI can switch languages live without re-generating.
export interface LocalizedText {
  result: string
  explanation: string
  fun_fact: string
  hint?: string
  // v3: short "why this advances progression" note (the Progression Reason).
  progression?: string
}

export interface CombineResult {
  result: string
  formula: string | null
  emoji: string
  explanation: string
  fun_fact: string
  rarity: Rarity
  reacted: boolean
  category?: MasteryCategory
  // v3: progression tier 1..15 (1 = raw Elements, 15 = Space Age).
  tier?: number
  difficulty?: number
  hint?: string
  // v3: progression reason (canonical/English copy; localized copies live in i18n).
  progression?: string
  ingredients?: string[]
  xp?: number
  // Per-language text. Language-independent fields (emoji, formula, rarity,
  // category, tier, difficulty) live at the top level and are shared across languages.
  i18n?: Partial<Record<Lang, LocalizedText>>
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
  // v3: progression tier of this specimen (starters = 1).
  tier?: number
  // For discovered compounds: the specimen ids that were combined to make it.
  ingredients?: string[]
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
