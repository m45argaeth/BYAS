'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/', icon: '🧪', label: 'Lab' },
  { href: '/pokedex', icon: '📒', label: 'Archive' },
  { href: '/leaderboard', icon: '🏆', label: 'Ranks' },
]

export function BottomNav() {
  const pathname = usePathname() || '/'
  return (
    <nav className="tabbar" aria-label="Primary">
      {ITEMS.map((it) => {
        const active = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href)
        return (
          <Link key={it.href} href={it.href} className={`tab-item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="ico">{it.icon}</span>
            {it.label}
          </Link>
        )
      })}
    </nav>
  )
}
