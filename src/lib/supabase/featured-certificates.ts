import { supabase } from './client'

export type FeaturedCertificate = {
  chainId: number
  agentId: number
  hash: string
  score: number
  issuedAt: string
  group: 'top-score' | 'recent'
}

type CertificateJoinRow = {
  chain_id: number
  agent_id: number
  hash: string
  issued_at: string
  trust_scores: { score: number } | { score: number }[] | null
}

function mapRow(
  row: CertificateJoinRow,
  group: 'top-score' | 'recent'
): FeaturedCertificate {
  return {
    chainId: row.chain_id,
    agentId: row.agent_id,
    hash: row.hash,
    score: Array.isArray(row.trust_scores)
      ? (row.trust_scores[0]?.score ?? 0)
      : (row.trust_scores?.score ?? 0),
    issuedAt: row.issued_at,
    group,
  }
}

export async function fetchFeaturedCertificates(): Promise<{
  topScore: FeaturedCertificate[]
  recent: FeaturedCertificate[]
}> {
  if (!supabase) {
    return { topScore: [], recent: [] }
  }

  const { data: topRows } = await supabase
    .from('certificate_snapshots')
    .select('chain_id, agent_id, hash, issued_at, trust_scores(score)')
    .not('hash', 'is', null)
    .order('trust_scores(score)', { ascending: false })
    .limit(3)

  const topScore = (topRows ?? []).map((r) =>
    mapRow(r as CertificateJoinRow, 'top-score')
  )

  // Build a Set of "chainId:agentId" keys to exclude duplicates across chains.
  // PostgREST doesn't support compound NOT IN, so we fetch extra rows and filter
  // in application code to handle same agent_id on different chains correctly.
  const topKeys = new Set(topScore.map((c) => `${c.chainId}:${c.agentId}`))

  const { data: recentRows } = await supabase
    .from('certificate_snapshots')
    .select('chain_id, agent_id, hash, issued_at, trust_scores(score)')
    .not('hash', 'is', null)
    .order('issued_at', { ascending: false })
    .limit(9)

  const recent = (recentRows ?? [])
    .map((r) => mapRow(r as CertificateJoinRow, 'recent'))
    .filter((c) => !topKeys.has(`${c.chainId}:${c.agentId}`))
    .slice(0, 3)

  return { topScore, recent }
}
