interface PrismWatermarkProps {
  className?: string
}

export function PrismWatermark({ className = '' }: PrismWatermarkProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {/* Prism wireframe — geometric polyhedron */}
      <g stroke="currentColor" strokeWidth="0.5" className="opacity-[0.08] dark:opacity-[0.06]">
        <polygon points="200,40 360,320 40,320" />
        <line x1="200" y1="40" x2="120" y2="200" />
        <line x1="200" y1="40" x2="280" y2="200" />
        <line x1="120" y1="200" x2="280" y2="200" />
        <line x1="120" y1="200" x2="40" y2="320" />
        <line x1="280" y1="200" x2="360" y2="320" />
        <line x1="200" y1="40" x2="200" y2="280" />
        <line x1="120" y1="200" x2="200" y2="280" />
        <line x1="280" y1="200" x2="200" y2="280" />
        <line x1="200" y1="280" x2="40" y2="320" />
        <line x1="200" y1="280" x2="360" y2="320" />
      </g>
      {/* Node highlights in gold */}
      <g fill="var(--color-accent, #b89b3e)" className="opacity-20 dark:opacity-[0.15]">
        <circle cx="200" cy="40" r="3" />
        <circle cx="120" cy="200" r="2.5" />
        <circle cx="280" cy="200" r="2.5" />
        <circle cx="200" cy="280" r="2.5" />
        <circle cx="40" cy="320" r="2" />
        <circle cx="360" cy="320" r="2" />
      </g>
    </svg>
  )
}
