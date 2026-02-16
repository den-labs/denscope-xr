export type DossierData = {
  firstSeen: string | null
  lastSeen: string | null
  feedbackCount: number
  positiveCount: number
  negativeCount: number
  totalEvents: number
  uriUpdateCount: number
  uniqueInteractors: number
  avgFeedbackValue: number
  openSybilCount: number
  resolvedSybilCount: number
}

const DEFAULTS: DossierData = {
  firstSeen: null,
  lastSeen: null,
  feedbackCount: 0,
  positiveCount: 0,
  negativeCount: 0,
  totalEvents: 0,
  uriUpdateCount: 0,
  uniqueInteractors: 0,
  avgFeedbackValue: 0,
  openSybilCount: 0,
  resolvedSybilCount: 0,
}

async function supabaseFetch(path: string): Promise<unknown> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    next: { revalidate: 60 },
  })

  return res.json()
}

export async function fetchDossierData(
  chainId: number,
  agentId: number
): Promise<DossierData> {
  const compositeId = encodeURIComponent(`${chainId}:${agentId}`)

  const [agentRows, allEvents, feedbackEvents, openSybil, resolvedSybil] =
    await Promise.all([
      supabaseFetch(
        `agents?id=eq.${compositeId}&select=first_seen,last_seen,feedback_count,positive_count,negative_count`
      ),
      supabaseFetch(
        `scope_events?chain_id=eq.${chainId}&agent_id=eq.${agentId}&select=kind`
      ),
      supabaseFetch(
        `scope_events?chain_id=eq.${chainId}&agent_id=eq.${agentId}&kind=eq.feedback&select=data`
      ),
      supabaseFetch(
        `incidents?chain_id=eq.${chainId}&agent_id=eq.${agentId}&signal_kind=eq.sybil_cluster&resolved_at=is.null&select=id`
      ),
      supabaseFetch(
        `incidents?chain_id=eq.${chainId}&agent_id=eq.${agentId}&signal_kind=eq.sybil_cluster&resolved_at=not.is.null&select=id`
      ),
    ])

  // Guard: if agent not found, return defaults
  if (!Array.isArray(agentRows) || agentRows.length === 0) {
    return { ...DEFAULTS }
  }

  const agent = agentRows[0] as {
    first_seen: string | null
    last_seen: string | null
    feedback_count: number
    positive_count: number
    negative_count: number
  }

  // Count total events
  const totalEvents = Array.isArray(allEvents) ? allEvents.length : 0

  // Count URI updates
  const uriUpdateCount = Array.isArray(allEvents)
    ? allEvents.filter(
        (e: { kind: string }) => e.kind === 'uri_update'
      ).length
    : 0

  // Compute unique interactors and average feedback value
  let uniqueInteractors = 0
  let avgFeedbackValue = 0

  if (Array.isArray(feedbackEvents) && feedbackEvents.length > 0) {
    const addresses = new Set<string>()
    let feedbackSum = 0

    for (const event of feedbackEvents) {
      const data = (event as { data: { clientAddress?: string; value?: string } })
        .data
      if (data?.clientAddress) {
        addresses.add(data.clientAddress)
      }
      feedbackSum += Number(data?.value ?? 0)
    }

    uniqueInteractors = addresses.size
    avgFeedbackValue = Math.round(feedbackSum / feedbackEvents.length)
  }

  return {
    firstSeen: agent.first_seen,
    lastSeen: agent.last_seen,
    feedbackCount: agent.feedback_count,
    positiveCount: agent.positive_count,
    negativeCount: agent.negative_count,
    totalEvents,
    uriUpdateCount,
    uniqueInteractors,
    avgFeedbackValue,
    openSybilCount: Array.isArray(openSybil) ? openSybil.length : 0,
    resolvedSybilCount: Array.isArray(resolvedSybil)
      ? resolvedSybil.length
      : 0,
  }
}
