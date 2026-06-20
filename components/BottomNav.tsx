'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/', icon: '🧪', label: 'Lab' },
  { href: '/pokedex', icon: '📒', label: 'Archive' },
  { href: '/leaderboard', icon: '🏆', label: 'Ranks' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="tabbar" aria-label="Primary navigation">
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
