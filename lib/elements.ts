import type { Element, Lang } from './types'

interface StarterDef {
  id: string
  emoji: string
  formula: string
  names: Record<Lang, string>
}

export const STARTER_DEFS: StarterDef[] = [
  { id: 'H', emoji: '🫧', formula: 'H', names: { id: 'Hidrogen', en: 'Hydrogen', cn: '氢' } },
  { id: 'O', emoji: '🔵', formula: 'O', names: { id: 'Oksigen', en: 'Oxygen', cn: '氧' } },
  { id: 'C', emoji: '⚫', formula: 'C', names: { id: 'Karbon', en: 'Carbon', cn: '碳' } },
  { id: 'N', emoji: '🟪', formula: 'N', names: { id: 'Nitrogen', en: 'Nitrogen', cn: '氮' } },
  { id: 'S', emoji: '🟡', formula: 'S', names: { id: 'Sulfur', en: 'Sulfur', cn: '硫' } },
  { id: 'Na', emoji: '🧂', formula: 'Na', names: { id: 'Natrium', en: 'Sodium', cn: '钠' } },
]

export const STARTER_IDS = new Set(STARTER_DEFS.map((d) => d.id))

export function starterName(id: string, lang: Lang): string {
  const def = STARTER_DEFS.find((d) => d.id === id)
  return def ? def.names[lang] ?? def.names.en : id
}

export function buildStarters(lang: Lang): Element[] {
  return STARTER_DEFS.map((d) => ({
    id: d.id,
    name: d.names[lang] ?? d.names.en,
    emoji: d.emoji,
    formula: d.formula,
  }))
}
