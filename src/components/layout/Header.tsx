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

        {/* Right: Search + Status + RTT */}
        <div className="flex items-center gap-5">
          {/* Cosmetic Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search agent ID..."
              readOnly
              tabIndex={-1}
              className="h-7 w-52 cursor-default border border-border-bright bg-transparent px-2.5 text-xs text-text-muted placeholder-text-muted outline-none"
            />
            <kbd
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 border border-border-bright px-1 py-0.5 text-[10px] leading-none text-text-muted"
            >
              Cmd+K
            </kbd>
          </div>

          {/* MAINNET Status */}
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-[10px] uppercase tracking-widest text-text-muted">
              Mainnet
            </span>
          </div>

          {/* RTT Indicator */}
          <span className="text-[10px] font-mono tabular-nums text-text-muted">
            RTT 42ms
          </span>
        </div>
      </div>
    </header>
  )
}
