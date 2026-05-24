import type { AgentMetadata } from '@/types/agents'
import type {
  CoordinationMatrix,
  DimensionKey,
  DimensionResult,
  ImprovementSuggestion,
  OpenIncident,
} from './types'

export interface ImprovementInput {
  radar: Record<DimensionKey, DimensionResult>
  coordinationBadges: CoordinationMatrix
  metadata: AgentMetadata | null
  claimed: boolean
  openIncidents: OpenIncident[]
  feedbackCount: number
}

const PRIORITY_ORDER: Record<ImprovementSuggestion['priority'], number> = {
  P1: 0,
  P2: 1,
  P3: 2,
}

// §4.7 deterministic templates. Max 5 visible — rest available behind "Show all".
export function suggestImprovements(
  input: ImprovementInput
): ImprovementSuggestion[] {
  const out: ImprovementSuggestion[] = []

  // P1: open critical incident
  const critical = input.openIncidents.find((i) => i.severity === 'critical')
  if (critical) {
    out.push({
      priority: 'P1',
      title: `Resolve open critical incident (${critical.kind})`,
      body: `Open critical incident #${critical.id} blocks coordination. Review and resolve via Owner Console.`,
      affectsDimension: 'safety',
      action: { label: 'Open Console', href: '/console' },
    })
  }

  // P1: identity weak and not claimed
  if (input.radar.identity.value < 70 && !input.claimed) {
    out.push({
      priority: 'P1',
      title: 'Claim this agent to unlock owner features',
      body: 'Claim ownership via /console to expose authoring metadata and improvement actions.',
      affectsDimension: 'identity',
      action: { label: 'Claim agent', href: '/console' },
    })
  }

  // P1: identity weak and missing name
  if (
    input.radar.identity.value < 70 &&
    !input.metadata?.name
  ) {
    out.push({
      priority: 'P1',
      title: 'Add a human-readable name to your Agent URI metadata',
      body: 'A name lets partners identify the agent at a glance. Update metadata.name in your Agent URI document.',
      affectsDimension: 'identity',
    })
  }

  // P2: A2A missing
  if (input.coordinationBadges.a2a.state === 'missing') {
    out.push({
      priority: 'P2',
      title: 'Declare A2A service for agent-to-agent coordination',
      body: 'Add a service entry of type "A2A" in metadata.services to enable agent-to-agent flows.',
      affectsDimension: 'coordination',
    })
  }

  // P2: MCP missing
  if (input.coordinationBadges.mcp.state === 'missing') {
    out.push({
      priority: 'P2',
      title: 'Declare MCP service to integrate with AI agents',
      body: 'Add a service entry of type "MCP" in metadata.services to expose tools to AI agents.',
      affectsDimension: 'coordination',
    })
  }

  // P3: low feedback
  if (input.feedbackCount < 5) {
    out.push({
      priority: 'P3',
      title: 'Encourage early adopters to leave validation feedback',
      body: 'Reputation Quality strengthens with feedback volume. Aim for 10+ feedbacks to reach high confidence.',
      affectsDimension: 'reputation',
    })
  }

  out.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  return out
}
