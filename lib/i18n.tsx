'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Lang } from './types'
import { DICT, EN } from './i18n-dict'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'id', label: 'ID' },
  { code: 'en', label: 'EN' },
  { code: 'cn', label: '中文' },
]

type Ctx = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<Ctx | null>(null)

function format(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('id')
  useEffect(() => {
    const saved = localStorage.getItem('byas_lang') as Lang | null
    if (saved && ['id', 'en', 'cn'].includes(saved)) setLangState(saved)
  }, [])
  function setLang(l: Lang) {
    setLangState(l)
    try {
      localStorage.setItem('byas_lang', l)
    } catch {}
  }
  function t(key: string, vars?: Record<string, string | number>) {
    const d = DICT[lang] ?? DICT.id
    return format(d[key] ?? EN[key] ?? key, vars)
  }
  const ctxValue: Ctx = { lang, setLang, t }
  return <I18nContext.Provider value={ctxValue}>{children}</I18nContext.Provider>
}

export function useI18n(): Ctx {
  const c = useContext(I18nContext)
  if (!c) return { lang: 'id', setLang: () => {}, t: (k: string) => k }
  return c
}
