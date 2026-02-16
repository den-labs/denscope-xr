export type AgentStatus = {
  label: 'NEW' | 'HEALTHY' | 'WARNING' | 'CRITICAL'
  variant: 'neutral' | 'success' | 'warning' | 'critical'
}

export type SybilRisk = {
  level: 'LOW' | 'MEDIUM' | 'HIGH'
  variant: 'success' | 'warning' | 'critical'
}

export type ActivitySummary = {
  firstSeen: string | null
  uriUpdateCount: number
  feedbackCount: number
  avgFeedback: number
  totalEvents: number
}

export function getAgentStatus(score: number | null): AgentStatus {
  if (score === null) return { label: 'NEW', variant: 'neutral' }
  if (score >= 60) return { label: 'HEALTHY', variant: 'success' }
  if (score >= 30) return { label: 'WARNING', variant: 'warning' }
  return { label: 'CRITICAL', variant: 'critical' }
}

export function formatRelativeTime(dateStr: string | null): string {
  if (dateStr === null) return '\u2014'

  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  const minutes = Math.floor(diffMs / 60_000)
  const hours = Math.floor(diffMs / 3_600_000)
  const days = Math.floor(diffMs / 86_400_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function getSybilRisk(incidents: {
  openSybil: number
  resolvedSybil: number
}): SybilRisk {
  if (incidents.openSybil > 0) return { level: 'HIGH', variant: 'critical' }
  if (incidents.resolvedSybil > 0) return { level: 'MEDIUM', variant: 'warning' }
  return { level: 'LOW', variant: 'success' }
}

export function summarizeActivity(data: ActivitySummary): string[] {
  const items: string[] = []

  if (data.firstSeen) {
    const diffMs = Date.now() - new Date(data.firstSeen).getTime()
    const days = Math.floor(diffMs / 86_400_000)
    items.push(days === 0 ? 'Registered today' : `Registered ${days}d ago`)
  }

  if (data.uriUpdateCount > 0) {
    const noun = data.uriUpdateCount === 1 ? 'time' : 'times'
    items.push(`URI updated ${data.uriUpdateCount} ${noun}`)
  }

  if (data.feedbackCount > 0) {
    const sign = data.avgFeedback >= 0 ? '+' : ''
    items.push(
      `Received ${data.feedbackCount} feedback (avg ${sign}${data.avgFeedback})`
    )
  }

  if (
    data.feedbackCount === 0 &&
    data.uriUpdateCount === 0 &&
    data.totalEvents <= 1
  ) {
    items.push('Awaiting activity \u2014 this agent was recently registered')
  }

  return items
}
