'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { chains } from '@/config/chains'

const navItems = [
  { href: '/', label: 'Live Feed' },
  { href: '/graph', label: 'Trust Graph' },
  { href: '/discovery', label: 'Discovery' },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="border-b border-zinc-800 bg-zinc-950 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold tracking-tight text-white">DenScope</h1>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  pathname === item.href ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex gap-2">
          {chains.map((c) => (
            <span key={c.id} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: `${c.badge.color}15`, color: c.badge.color }}>
              {c.badge.label}
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}
