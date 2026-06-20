export type Lang = 'id' | 'en' | 'cn'

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

// Item di inventory. id = identitas kanonik (simbol untuk starter, nama hasil untuk turunan).
export interface Element {
  id: string
  name: string
  emoji: string
  formula?: string
}

// Satu penemuan unik yang disimpan di koleksi/Pokedex.
export interface Discovery extends CombineResult {
  discoveredAt: number
}

// Progres pemain (XP diturunkan dari koleksi; streak & username disimpan eksplisit).
export interface Stats {
  currentStreak: number
  bestStreak: number
  lastPlayed: string | null // 'YYYY-MM-DD'
  displayName: string | null
}
