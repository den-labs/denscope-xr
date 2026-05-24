import type { AgentMetadata } from '@/types/agents'
import type { BadgeState, CoordinationMatrix } from './types'

export interface CoordinationBadgeInput {
  metadata: AgentMetadata | null
  lastSeen: string | null
  totalEvents: number
  now?: number
}

const DAY_MS = 24 * 60 * 60 * 1000

// §4.6 Rev 3 — 5 derivable badges + 3 PENDING.
// Null-safe metadata access (N3); Health tri-state with explicit 31-90d band (N2).
export function deriveCoordinationBadges(
  input: CoordinationBadgeInput
): CoordinationMatrix {
  const services = input.metadata?.services ?? []
  const description = input.metadata?.description ?? ''

  return {
    a2a: serviceBadge(services, 'A2A'),
    mcp: serviceBadge(services, 'MCP'),
    x402: serviceBadge(services, 'X402'),
    docs: description.length > 0
      ? { state: 'connected', evidence: `description: ${description.length} chars` }
      : { state: 'missing' },
    health: deriveHealthBadge(
      input.lastSeen,
      input.totalEvents,
      input.now ?? Date.now()
    ),
    oasf: pendingBadge('OASF schema convention pending'),
    source: pendingBadge('OSS source-link convention pending'),
    auth: pendingBadge('Auth declaration convention pending'),
  }
}

function serviceBadge(
  services: { type: string }[],
  target: 'A2A' | 'MCP' | 'X402'
): BadgeState {
  const hit = services.find((s) => s.type.toUpperCase() === target)
  return hit
    ? { state: 'connected', evidence: `metadata.services: ${hit.type}` }
    : { state: 'missing' }
}

function deriveHealthBadge(
  lastSeen: string | null,
  totalEvents: number,
  now: number
): BadgeState {
  if (totalEvents < 5) {
    return { state: 'unknown', reason: 'Not enough activity to assess' }
  }
  if (lastSeen === null) {
    return { state: 'missing' }
  }
  const ageDays = (now - new Date(lastSeen).getTime()) / DAY_MS
  if (ageDays <= 7) {
    return { state: 'connected', evidence: 'Active within 7d' }
  }
  if (ageDays <= 90) {
    return { state: 'detected', evidence: 'Recent activity within 90d' }
  }
  return { state: 'missing' }
}

function pendingBadge(reason: string): BadgeState {
  return { state: 'pending', reason }
}

// Helper for summary's {connectedProtocols} interpolation.
export function countConnectedProtocols(matrix: CoordinationMatrix): number {
  let count = 0
  if (matrix.a2a.state === 'connected') count++
  if (matrix.mcp.state === 'connected') count++
  if (matrix.x402.state === 'connected') count++
  return count
}
