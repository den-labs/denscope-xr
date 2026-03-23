'use client'

import { useState, useEffect, useRef } from 'react'
import { useEventStore } from '@/stores/events'

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, '0')
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function StatusBar() {
  const [uptime, setUptime] = useState(0)
  const eventCount = useEventStore((s) => s.events.length)
  const lastCountRef = useRef(eventCount)
  const [feedActive, setFeedActive] = useState(() => eventCount > 0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document === 'undefined') return true
    return document.visibilityState !== 'hidden'
  })

  useEffect(() => {
    function onVisibilityChange() {
      setIsVisible(document.visibilityState !== 'hidden')
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    if (!isVisible) return
    const interval = setInterval(() => {
      setUptime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isVisible])

  // Track whether new events arrived recently (within 90s)
  useEffect(() => {
    if (!isVisible) {
      lastCountRef.current = eventCount
      clearTimeout(timerRef.current)
      return
    }

    let rafId: number | null = null
    if (eventCount > lastCountRef.current) {
      rafId = window.requestAnimationFrame(() => setFeedActive(true))
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setFeedActive(false), 90_000)
    }
    lastCountRef.current = eventCount
    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId)
      clearTimeout(timerRef.current)
    }
  }, [eventCount, isVisible])

  return (
    <footer className="border-t border-border bg-bg px-6 py-2 font-mono text-xs uppercase tracking-wider text-text-secondary">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span>Session: {formatUptime(uptime)}</span>
          <span className="border border-border px-2 py-0.5">v0.1.0</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${feedActive ? 'bg-success' : 'bg-warning'}`} />
          <span>{feedActive ? 'Feed Active' : 'Feed Idle'}</span>
        </div>
      </div>
    </footer>
  )
}
