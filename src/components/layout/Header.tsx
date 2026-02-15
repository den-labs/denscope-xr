'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SearchModal } from '@/components/search/SearchModal'

const navItems = [
  { href: '/', label: 'Live Feed', disabled: false },
  { href: '/graph', label: 'Trust Graph', disabled: false },
  { href: '/discovery', label: 'Discovery', disabled: false },
  { href: '/topology', label: 'Topology', disabled: true },
]

export function Header() {
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <header
      className="border-b border-border bg-bg px-6 py-3"
    >
      <div className="flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="flex h-7 w-8 items-center justify-center border border-border-bright text-[10px] font-bold tracking-tight text-text-primary"
            >
              DS
            </span>
            <span className="font-display text-sm font-bold uppercase tracking-widest text-text-primary">
              Denscope
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href

              if (item.disabled) {
                return (
                  <span
                    key={item.href}
                    className="cursor-not-allowed px-0 py-1.5 text-xs uppercase tracking-widest text-text-muted"
                  >
                    {item.label}
                  </span>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-0 py-1.5 text-xs uppercase tracking-widest transition-colors ${
                    isActive
                      ? 'text-text-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 h-px w-full bg-text-primary"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: Search + Status */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 border border-border bg-surface px-3 py-1 text-xs font-mono text-text-muted transition-colors hover:text-text-secondary"
          >
            Search
            <kbd className="border border-border px-1 py-0.5 text-[10px]">
              {'\u2318'}K
            </kbd>
          </button>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-[10px] uppercase tracking-widest text-text-muted">
              Mainnet
            </span>
          </div>
        </div>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
