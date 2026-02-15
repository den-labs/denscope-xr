'use client'

import { useEventStore } from '@/stores/events'

export function StatusBar() {
  const eventCount = useEventStore((s) => s.events.length)

  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 px-6 py-2">
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          connected
        </span>
        <span>{eventCount} events</span>
      </div>
    </footer>
  )
}
