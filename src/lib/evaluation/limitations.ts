import type { GatheredEvidence } from '@/types/evaluation'

/**
 * The disclosures that travel with every paid decision.
 *
 * These are not marketing hedges. Each one names a specific way this evaluation
 * can be confidently wrong, and each is true of the current engine — not of an
 * engine we intend to build. If a statement here stops being true, delete it;
 * a stale limitation is as misleading as a missing one.
 *
 * They ship in the response body rather than in the docs because the buyer is a
 * machine that will never read the docs.
 */

/** True of every evaluation, regardless of the agent. */
const ALWAYS: readonly string[] = [
  'Signal detectors run only for agents whose ownership has been claimed on DenScope; the absence of signals is not evidence of the absence of risk.',
  'This evaluation is derived solely from ERC-8004 registry events on the chains DenScope indexes. Conduct on any other chain, protocol or off-chain venue is invisible to it.',
  'Indexer lag is typically under 60 seconds, so this evaluation may not reflect the most recent on-chain activity. See dataAsOf.',
  'context, objective and sensitivity are accepted for forward compatibility and do NOT affect this result.',
  'DenScope does not attest to its own trustworthiness. See https://www.denscope.xyz/.well-known/x402.',
] as const

/**
 * Build the limitation list for one evaluation.
 *
 * @param evidence - Evidence the decision was drawn from.
 * @returns The always-true disclosures, plus any warranted by this evidence.
 */
export function buildLimitations(evidence: GatheredEvidence): string[] {
  const limitations = [...ALWAYS]

  // Conditional disclosures. Each fires only when the evidence makes the
  // decision materially weaker than the headline verdict suggests.
  if (evidence.feedbackCount === 0) {
    limitations.push(
      'This agent has no recorded feedback. The verdict rests on age and activity alone and should not be read as a judgement of conduct.',
    )
  }

  if (evidence.dataAsOf === null) {
    limitations.push(
      'No dated evidence was available for this agent, so data freshness cannot be established.',
    )
  }

  return limitations
}
