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
      className="border-b bg-black px-6 py-3"
      style={{ borderColor: '#222' }}
    >
      <div className="flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="flex h-7 w-8 items-center justify-center border text-[10px] font-bold tracking-tight text-white"
              style={{ borderColor: '#444', borderRadius: '0px' }}
            >
              DS
            </span>
            <span className="font-display text-sm font-bold uppercase tracking-widest text-white">
              Denscope XR
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
                    className="cursor-not-allowed px-0 py-1.5 text-xs uppercase tracking-widest text-zinc-600"
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
                      ? 'text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 h-px w-full bg-white"
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
              className="h-7 w-52 cursor-default border bg-transparent px-2.5 text-xs text-zinc-500 placeholder-zinc-600 outline-none"
              style={{ borderColor: '#333', borderRadius: '0px' }}
            />
            <kbd
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 border px-1 py-0.5 text-[10px] leading-none text-zinc-600"
              style={{ borderColor: '#333', borderRadius: '0px' }}
            >
              Cmd+K
            </kbd>
          </div>

          {/* MAINNET Status */}
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">
              Mainnet
            </span>
          </div>

          {/* RTT Indicator */}
          <span className="text-[10px] font-mono tabular-nums text-zinc-600">
            RTT 42ms
          </span>
        </div>
      </div>
    </header>
  )
}
