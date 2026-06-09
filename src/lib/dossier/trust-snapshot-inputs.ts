import { getChain } from '@/config/chains'
import { fetchAgentMetadataServer } from '@/lib/agent/metadata'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import {
  buildTrustSnapshot,
  type TrustSnapshotInputs,
} from '@/lib/trust-snapshot/build'
import type { TrustSnapshotData } from '@/lib/trust-snapshot/types'
import {
  fetchHasRecentReputationDrop,
  fetchRecentEventCount,
  fetchValidationEventCount,
} from '@/lib/supabase/event-aggregates'
import { fetchOpenIncidents } from '@/lib/supabase/open-incidents'
import { fetchClaimStatus } from '@/lib/supabase/owner-profiles'
import { fetchTrustScore } from '@/lib/supabase/trust-scores'
import { fetchDossierData } from './fetch'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// Resolve on-chain URI + owner + metadata. Returns null-safe defaults when the
// chain is unknown (e.g. unsupported chainId in a deep link).
async function fetchOnchainIdentity(chainId: number, agentId: number) {
  const chain = getChain(chainId)
  if (!chain) {
    return { uri: null as string | null, owner: null as string | null, metadata: null }
  }
  const [uri, owner] = await Promise.all([
    readAgentURI(chain, agentId),
    readAgentOwner(chain, agentId),
  ])
  const metadata = uri ? await fetchAgentMetadataServer(uri) : null
  return { uri, owner, metadata }
}

/**
 * Aggregate every input the trust-snapshot orchestrator needs, in parallel.
 * Spec §8 B1. The 30-day window is derived from `now` so callers can pin time
 * for deterministic snapshots (defaults to wall-clock).
 */
export async function fetchTrustSnapshotInputs(
  chainId: number,
  agentId: number,
  now: number = Date.now()
): Promise<TrustSnapshotInputs> {
  const sinceIso = new Date(now - THIRTY_DAYS_MS).toISOString()

  const [
    trustScore,
    dossier,
    identity,
    claim,
    recentEventCount,
    validationEventCount,
    hasRecentReputationDrop,
    openIncidents,
  ] = await Promise.all([
    fetchTrustScore(chainId, agentId),
    fetchDossierData(chainId, agentId),
    fetchOnchainIdentity(chainId, agentId),
    fetchClaimStatus(chainId, agentId),
    fetchRecentEventCount(chainId, agentId, sinceIso),
    fetchValidationEventCount(chainId, agentId),
    fetchHasRecentReputationDrop(chainId, agentId, sinceIso),
    fetchOpenIncidents(chainId, agentId),
  ])

  return {
    trustScore,
    metadata: identity.metadata,
    uriPresent: identity.uri != null,
    ownerResolved: identity.owner != null,
    claimed: claim != null,
    firstSeen: dossier.firstSeen,
    lastSeen: dossier.lastSeen,
    totalEvents: dossier.totalEvents,
    uriUpdateCount: dossier.uriUpdateCount,
    feedbackCount: dossier.feedbackCount,
    positiveCount: dossier.positiveCount,
    recentEventCount,
    validationEventCount,
    openIncidents,
    hasSybilHistory: dossier.openSybilCount + dossier.resolvedSybilCount > 0,
    hasRecentReputationDrop,
    now,
  }
}

/** Fetch inputs and build the derived trust snapshot for an agent. Spec §8 B2. */
export async function getTrustSnapshot(
  chainId: number,
  agentId: number,
  now: number = Date.now()
): Promise<TrustSnapshotData> {
  const inputs = await fetchTrustSnapshotInputs(chainId, agentId, now)
  return buildTrustSnapshot(inputs)
}
