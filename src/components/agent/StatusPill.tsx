import type { AgentStatus } from '@/lib/dossier/helpers'

export function StatusPill({ status }: { status: AgentStatus }) {
  return (
    <span className={`status-pill status-pill-${status.variant}`}>
      {status.label}
    </span>
  )
}
