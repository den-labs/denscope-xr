import {
  summarizeActivity,
  formatRelativeTime,
} from '@/lib/dossier/helpers'
import type { ActivitySummary } from '@/lib/dossier/helpers'

type Props = {
  activity: ActivitySummary
  lastSeen: string | null
}

export function WhatChanged({ activity, lastSeen }: Props) {
  const items = summarizeActivity(activity)

  return (
    <section className="bg-surface border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-mono font-bold text-foreground">
          What Changed
        </h3>
        <span className="text-[10px] text-foreground-muted font-mono">
          Last seen: {formatRelativeTime(lastSeen)}
        </span>
      </div>

      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item}
              className="text-sm text-foreground-secondary font-mono flex items-start gap-2"
            >
              <span className="text-foreground-muted select-none">&bull;</span>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground-muted font-mono">
          No activity recorded yet.
        </p>
      )}
    </section>
  )
}
