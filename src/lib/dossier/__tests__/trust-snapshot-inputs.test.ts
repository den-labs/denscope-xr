import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DossierData } from '@/lib/dossier/fetch'

const fetchDossierData = vi.fn()
const fetchTrustScore = vi.fn()
const fetchClaimStatus = vi.fn()
const fetchOpenIncidents = vi.fn()
const fetchRecentEventCount = vi.fn()
const fetchValidationEventCount = vi.fn()
const fetchHasRecentReputationDrop = vi.fn()
const readAgentURI = vi.fn()
const readAgentOwner = vi.fn()
const fetchAgentMetadataServer = vi.fn()
const getChain = vi.fn()

vi.mock('@/lib/dossier/fetch', () => ({ fetchDossierData: (...a: unknown[]) => fetchDossierData(...a) }))
vi.mock('@/lib/supabase/trust-scores', () => ({ fetchTrustScore: (...a: unknown[]) => fetchTrustScore(...a) }))
vi.mock('@/lib/supabase/owner-profiles', () => ({ fetchClaimStatus: (...a: unknown[]) => fetchClaimStatus(...a) }))
vi.mock('@/lib/supabase/open-incidents', () => ({ fetchOpenIncidents: (...a: unknown[]) => fetchOpenIncidents(...a) }))
vi.mock('@/lib/supabase/event-aggregates', () => ({
  fetchRecentEventCount: (...a: unknown[]) => fetchRecentEventCount(...a),
  fetchValidationEventCount: (...a: unknown[]) => fetchValidationEventCount(...a),
  fetchHasRecentReputationDrop: (...a: unknown[]) => fetchHasRecentReputationDrop(...a),
}))
vi.mock('@/lib/agent/read', () => ({
  readAgentURI: (...a: unknown[]) => readAgentURI(...a),
  readAgentOwner: (...a: unknown[]) => readAgentOwner(...a),
}))
vi.mock('@/lib/agent/metadata', () => ({ fetchAgentMetadataServer: (...a: unknown[]) => fetchAgentMetadataServer(...a) }))
vi.mock('@/config/chains', () => ({ getChain: (...a: unknown[]) => getChain(...a) }))

const { fetchTrustSnapshotInputs, getTrustSnapshot } = await import('@/lib/dossier/trust-snapshot-inputs')

const DOSSIER: DossierData = {
  firstSeen: '2026-01-01T00:00:00Z',
  lastSeen: '2026-05-30T00:00:00Z',
  feedbackCount: 12,
  positiveCount: 10,
  negativeCount: 2,
  totalEvents: 40,
  uriUpdateCount: 3,
  uniqueInteractors: 8,
  avgFeedbackValue: 1,
  openSybilCount: 0,
  resolvedSybilCount: 0,
}

const TRUST_SCORE = {
  chainId: 42220,
  agentId: 1870,
  score: 72,
  positiveRatio: 0.83,
  activityScore: 0.6,
  ageScore: 0.9,
  incidentPenalty: 0,
  feedbackCount: 12,
  positiveCount: 10,
  negativeCount: 2,
  openIncidents: 0,
  confidence: 'high' as const,
  updatedAt: '2026-05-30T00:00:00Z',
}

const NOW = new Date('2026-06-01T00:00:00Z').getTime()
const SINCE_30D = new Date(NOW - 30 * 24 * 60 * 60 * 1000).toISOString()

function primeHappyPath() {
  getChain.mockReturnValue({ id: 42220, name: 'Celo' })
  fetchDossierData.mockResolvedValue(DOSSIER)
  fetchTrustScore.mockResolvedValue(TRUST_SCORE)
  readAgentURI.mockResolvedValue('ipfs://meta')
  readAgentOwner.mockResolvedValue('0xowner')
  fetchAgentMetadataServer.mockResolvedValue({ name: 'Toppa' })
  fetchClaimStatus.mockResolvedValue({ wallet_address: '0xowner' })
  fetchRecentEventCount.mockResolvedValue(9)
  fetchValidationEventCount.mockResolvedValue(4)
  fetchHasRecentReputationDrop.mockResolvedValue(false)
  fetchOpenIncidents.mockResolvedValue([{ id: 'x', severity: 'warning', kind: 'feedback_spike', openedAt: '2026-05-20T00:00:00Z' }])
}

describe('fetchTrustSnapshotInputs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assembles all inputs from sub-fetchers (happy path)', async () => {
    primeHappyPath()

    const inputs = await fetchTrustSnapshotInputs(42220, 1870, NOW)

    expect(inputs.trustScore).toEqual(TRUST_SCORE)
    expect(inputs.metadata).toEqual({ name: 'Toppa' })
    expect(inputs.uriPresent).toBe(true)
    expect(inputs.ownerResolved).toBe(true)
    expect(inputs.claimed).toBe(true)
    expect(inputs.firstSeen).toBe(DOSSIER.firstSeen)
    expect(inputs.lastSeen).toBe(DOSSIER.lastSeen)
    expect(inputs.totalEvents).toBe(40)
    expect(inputs.uriUpdateCount).toBe(3)
    expect(inputs.feedbackCount).toBe(12)
    expect(inputs.positiveCount).toBe(10)
    expect(inputs.recentEventCount).toBe(9)
    expect(inputs.validationEventCount).toBe(4)
    expect(inputs.hasSybilHistory).toBe(false)
    expect(inputs.hasRecentReputationDrop).toBe(false)
    expect(inputs.openIncidents).toHaveLength(1)
    expect(inputs.now).toBe(NOW)
  })

  it('passes a 30-day window ISO to the recent-window fetchers', async () => {
    primeHappyPath()
    await fetchTrustSnapshotInputs(42220, 1870, NOW)

    expect(fetchRecentEventCount).toHaveBeenCalledWith(42220, 1870, SINCE_30D)
    expect(fetchHasRecentReputationDrop).toHaveBeenCalledWith(42220, 1870, SINCE_30D)
  })

  it('derives hasSybilHistory from dossier sybil counts', async () => {
    primeHappyPath()
    fetchDossierData.mockResolvedValue({ ...DOSSIER, resolvedSybilCount: 1 })

    const inputs = await fetchTrustSnapshotInputs(42220, 1870, NOW)
    expect(inputs.hasSybilHistory).toBe(true)
  })

  it('handles missing uri / owner / claim (null-safe)', async () => {
    primeHappyPath()
    readAgentURI.mockResolvedValue(null)
    readAgentOwner.mockResolvedValue(null)
    fetchClaimStatus.mockResolvedValue(null)

    const inputs = await fetchTrustSnapshotInputs(42220, 1870, NOW)

    expect(inputs.uriPresent).toBe(false)
    expect(inputs.ownerResolved).toBe(false)
    expect(inputs.claimed).toBe(false)
    expect(inputs.metadata).toBeNull()
    expect(fetchAgentMetadataServer).not.toHaveBeenCalled()
  })

  it('skips on-chain reads when the chain is unknown', async () => {
    primeHappyPath()
    getChain.mockReturnValue(undefined)

    const inputs = await fetchTrustSnapshotInputs(999, 1, NOW)

    expect(readAgentURI).not.toHaveBeenCalled()
    expect(readAgentOwner).not.toHaveBeenCalled()
    expect(inputs.uriPresent).toBe(false)
    expect(inputs.ownerResolved).toBe(false)
    expect(inputs.metadata).toBeNull()
    expect(inputs.trustScore).toEqual(TRUST_SCORE)
  })
})

describe('getTrustSnapshot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a derived TrustSnapshotData built from the aggregated inputs', async () => {
    primeHappyPath()

    const snapshot = await getTrustSnapshot(42220, 1870, NOW)

    // Shape comes from buildTrustSnapshot (real orchestrator).
    expect(snapshot).toHaveProperty('verdict')
    expect(snapshot).toHaveProperty('confidence')
    expect(snapshot).toHaveProperty('radar')
    expect(snapshot).toHaveProperty('coordination')
    expect(snapshot.openIncidents).toHaveLength(1)
    expect(Object.keys(snapshot.radar)).toEqual(
      expect.arrayContaining(['identity', 'reliability', 'reputation', 'coordination', 'safety'])
    )
  })
})
