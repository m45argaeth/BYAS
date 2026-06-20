import type { Element, Lang } from './types'

export interface StarterDef {
  id: string
  emoji: string
  names: Record<Lang, string>
}

export const STARTER_DEFS: StarterDef[] = [
  { id: 'H', emoji: '🫧', names: { id: 'Hidrogen', en: 'Hydrogen', cn: '氢' } },
  { id: 'O', emoji: '🔵', names: { id: 'Oksigen', en: 'Oxygen', cn: '氧' } },
  { id: 'C', emoji: '⚫', names: { id: 'Karbon', en: 'Carbon', cn: '碳' } },
  { id: 'N', emoji: '🟪', names: { id: 'Nitrogen', en: 'Nitrogen', cn: '氮' } },
  { id: 'S', emoji: '🟡', names: { id: 'Sulfur', en: 'Sulfur', cn: '硫' } },
  { id: 'Na', emoji: '🧂', names: { id: 'Natrium', en: 'Sodium', cn: '钠' } },
]

export const STARTER_IDS = new Set(STARTER_DEFS.map((d) => d.id))

export function starterName(id: string, lang: Lang): string {
  const d = STARTER_DEFS.find((x) => x.id === id)
  return d ? d.names[lang] : id
}

export function buildStarters(lang: Lang): Element[] {
  return STARTER_DEFS.map((d) => ({ id: d.id, name: d.names[lang], emoji: d.emoji }))
}
