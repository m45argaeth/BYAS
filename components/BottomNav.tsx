'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/', icon: '🧪', label: 'Lab' },
  { href: '/quest', icon: '🎯', label: 'Quest' },
  { href: '/progress', icon: '📊', label: 'Progress' },
  { href: '/leaderboard', icon: '🏆', label: 'Ranks' },
  { href: '/account', icon: '👤', label: 'Account' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="tabbar" aria-label="Primary">
      {ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href} className={`tab-item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="ico">{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
