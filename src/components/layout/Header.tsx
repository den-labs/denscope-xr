'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Live Feed', disabled: false },
  { href: '/graph', label: 'Trust Graph', disabled: false },
  { href: '/discovery', label: 'Discovery', disabled: false },
  { href: '/topology', label: 'Topology', disabled: true },
]

export function Header() {
  const pathname = usePathname()

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

        {/* Right: Status */}
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-[10px] uppercase tracking-widest text-text-muted">
            Mainnet
          </span>
        </div>
      </div>
    </header>
  )
}
