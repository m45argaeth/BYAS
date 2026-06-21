'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

const ITEMS = [
  { href: '/', icon: '🧪', key: 'nav.lab' },
  { href: '/quest', icon: '🎯', key: 'nav.quest' },
  { href: '/progress', icon: '📊', key: 'nav.progress' },
  { href: '/leaderboard', icon: '🏆', key: 'nav.ranks' },
  { href: '/account', icon: '👤', key: 'nav.account' },
]

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useI18n()
  return (
    <nav className="tabbar" aria-label="Primary">
      {ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href} className={`tab-item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="ico">{item.icon}</span>
            {t(item.key)}
          </Link>
        )
      })}
    </nav>
  )
}
