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
  trust_scores: { score: number } | null
}

function mapRow(
  row: CertificateJoinRow,
  group: 'top-score' | 'recent'
): FeaturedCertificate {
  return {
    chainId: row.chain_id,
    agentId: row.agent_id,
    hash: row.hash,
    score: row.trust_scores?.score ?? 0,
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

  const excludeIds = topScore.map((c) => c.agentId)

  const { data: recentRows } = await supabase
    .from('certificate_snapshots')
    .select('chain_id, agent_id, hash, issued_at, trust_scores(score)')
    .not('hash', 'is', null)
    .not('agent_id', 'in', `(${excludeIds.join(',')})`)
    .order('issued_at', { ascending: false })
    .limit(3)

  const recent = (recentRows ?? []).map((r) =>
    mapRow(r as CertificateJoinRow, 'recent')
  )

  return { topScore, recent }
}
