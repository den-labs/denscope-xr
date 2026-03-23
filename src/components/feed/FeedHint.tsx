'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'denscope-feed-hint-dismissed'

export function FeedHint({ dismissed: externalDismiss }: { dismissed?: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) setVisible(true)
  }, [])

  useEffect(() => {
    if (externalDismiss && visible) {
      setVisible(false)
      localStorage.setItem(STORAGE_KEY, '1')
    }
  }, [externalDismiss, visible])

  if (!visible) return null

  function handleDismiss() {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  return (
    <div className="border-b border-border bg-surface px-6 py-2 flex items-center justify-between">
      <p className="text-xs text-foreground-muted">
        <span className="hidden md:inline">Hover row &rarr; preview certificate &middot; Click row &rarr; inspect agent</span>
        <span className="md:hidden">Tap share icon to share &middot; Tap row to inspect</span>
      </p>
      <button
        onClick={handleDismiss}
        className="text-foreground-muted hover:text-foreground text-xs ml-4 shrink-0"
      >
        &#x2715;
      </button>
    </div>
  )
}
