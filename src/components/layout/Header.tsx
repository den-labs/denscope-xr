'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { SearchModal } from '@/components/search/SearchModal'
import { ConnectButton } from '@/components/auth/ConnectButton'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { IncidentBadge } from '@/components/console/IncidentBadge'

const navItems = [
  { href: '/explore', label: 'Explore' },
  { href: '/discovery', label: 'Discovery' },
  { href: '/console', label: 'Console' },
]

export function Header() {
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setMenuOpen(false))
    return () => window.cancelAnimationFrame(raf)
  }, [pathname])

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
    <header className="border-b border-border bg-bg">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/denscope-logo.png"
              alt="DenScope"
              width={28}
              height={28}
              className="dark:invert"
            />
            <span className="font-display text-sm font-bold uppercase tracking-widest text-text-primary">
              Denscope
            </span>
          </Link>

          {/* Navigation — desktop only */}
          <nav className="hidden md:flex gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href

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
                  {item.href === '/console' && (
                    <span className="ml-1"><IncidentBadge /></span>
                  )}
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

        {/* Right: Search + Wallet + Status (desktop) / Wallet + Hamburger (mobile) */}
        <div className="flex items-center gap-4">
          {/* Search — desktop only */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 border border-border bg-surface px-3 py-1 text-xs font-mono text-text-muted transition-colors hover:text-text-secondary"
          >
            Search
            <kbd className="border border-border px-1 py-0.5 text-[10px]">
              {'\u2318'}K
            </kbd>
          </button>

          <span className="hidden md:flex">
            <ThemeToggle />
          </span>
          <ConnectButton />

          {/* Status — desktop only */}
          <div className="hidden md:flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-[10px] uppercase tracking-widest text-text-muted">
              Mainnet
            </span>
          </div>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="md:hidden flex items-center justify-center w-8 h-8 text-text-muted hover:text-text-primary transition-colors"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              {menuOpen ? (
                <>
                  <line x1="4" y1="4" x2="14" y2="14" />
                  <line x1="14" y1="4" x2="4" y2="14" />
                </>
              ) : (
                <>
                  <line x1="3" y1="5" x2="15" y2="5" />
                  <line x1="3" y1="9" x2="15" y2="9" />
                  <line x1="3" y1="13" x2="15" y2="13" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-border bg-bg"
          >
            <div className="px-6 py-3">
              {/* Search */}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  setSearchOpen(true)
                }}
                className="flex w-full items-center gap-2 border border-border bg-surface px-3 py-2.5 text-xs font-mono text-text-muted transition-colors hover:text-text-secondary"
              >
                Search
                <kbd className="ml-auto border border-border px-1 py-0.5 text-[10px]">
                  {'\u2318'}K
                </kbd>
              </button>
            </div>

            <div className="border-t border-border" />

            {/* Nav items */}
            <nav className="flex flex-col">
              {navItems.map((item) => {
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center px-6 py-3 text-xs uppercase tracking-widest transition-colors ${
                      isActive
                        ? 'text-text-primary bg-surface'
                        : 'text-text-muted hover:text-text-secondary hover:bg-surface/50'
                    }`}
                  >
                    {item.label}
                    {item.href === '/console' && (
                      <span className="ml-1"><IncidentBadge /></span>
                    )}
                  </Link>
                )
              })}
            </nav>

            <div className="border-t border-border" />

            {/* Theme + Status */}
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="text-[10px] uppercase tracking-widest text-text-muted">
                  Mainnet
                </span>
              </div>
              <ThemeToggle />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
