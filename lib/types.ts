export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

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
  name: string
  emoji: string
  formula?: string
}
