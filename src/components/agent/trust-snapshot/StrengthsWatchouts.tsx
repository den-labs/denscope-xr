interface StrengthsWatchoutsProps {
  strengths: string[]
  watchouts: string[]
}

/**
 * Strengths · Watchouts — two columns (stacked on mobile). Empty containers are
 * hidden entirely rather than showing a placeholder row (P1-1).
 */
export function StrengthsWatchouts({ strengths, watchouts }: StrengthsWatchoutsProps) {
  if (strengths.length === 0 && watchouts.length === 0) return null

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {strengths.length > 0 && (
        <Column title="Strengths" tone="success" icon="✓" items={strengths} />
      )}
      {watchouts.length > 0 && (
        <Column title="Watchouts" tone="warning" icon="⚠" items={watchouts} />
      )}
    </section>
  )
}

function Column({
  title,
  tone,
  icon,
  items,
}: {
  title: string
  tone: 'success' | 'warning'
  icon: string
  items: string[]
}) {
  return (
    <div className="space-y-2 border border-border p-3">
      <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-text-muted">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
            <span className={`text-${tone}`} aria-hidden>
              {icon}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
