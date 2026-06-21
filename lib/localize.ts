import type { CombineResult, Lang, LocalizedText } from './types'

// Pick the text for a discovery in the requested language, falling back to the
// canonical top-level fields (stored in English) when a language is missing.
export function discoveryText(d: CombineResult, lang: Lang): LocalizedText {
  const loc = d.i18n?.[lang]
  if (loc && loc.result) {
    return {
      result: loc.result,
      explanation: loc.explanation || d.explanation,
      fun_fact: loc.fun_fact || d.fun_fact,
      hint: loc.hint ?? d.hint,
    }
  }
  return { result: d.result, explanation: d.explanation, fun_fact: d.fun_fact, hint: d.hint }
}

// Stable, language-independent identity for a discovery. Used for de-duplication
// so the same combination found in different languages is never stored twice.
// Prefer the sorted ingredient ids; fall back to the (canonical) result name.
export function discoveryKey(d: { ingredients?: string[]; result: string }): string {
  if (d.ingredients && d.ingredients.length) {
    return d.ingredients.map((s) => s.trim().toLowerCase()).sort().join('+')
  }
  return 'r:' + d.result.trim().toLowerCase()
}
