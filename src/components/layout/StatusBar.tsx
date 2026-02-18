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
  const [feedActive, setFeedActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Track whether new events arrived recently (within 90s)
  useEffect(() => {
    if (eventCount > lastCountRef.current) {
      setFeedActive(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setFeedActive(false), 90_000)
    }
    lastCountRef.current = eventCount
    return () => clearTimeout(timerRef.current)
  }, [eventCount])

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
