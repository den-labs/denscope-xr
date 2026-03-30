import type { EvaluateRequest, EvaluateResponse } from '@/types/evaluation'
import { getPreset } from './presets'
import { gatherEvidence } from './gather'
import { interpretEvidence } from './interpret'
import { generateRationale } from './rationale'

export async function composeEvaluation(
  request: EvaluateRequest,
): Promise<EvaluateResponse> {
  const { chainId, agentId, preset: presetId } = request
  const preset = getPreset(presetId)

  const evidence = await gatherEvidence(chainId, agentId)
  if (!evidence.agentExists) {
    throw new Error('Agent not found')
  }

  const interpretation = interpretEvidence(evidence, preset)
  const rationale = generateRationale(evidence, interpretation)

  return {
    evaluation: {
      ...interpretation,
      rationale,
      evidence: {
        score: evidence.score,
        score_confidence: evidence.scoreConfidence,
        feedbackCount: evidence.feedbackCount,
        positiveRatio: evidence.positiveRatio,
        openIncidents: evidence.openIncidents,
        lastActivityDays: evidence.lastActivityDays,
        ageDays: evidence.ageDays,
      },
      preset: presetId,
      evaluatedAt: new Date().toISOString(),
      chainId,
      agentId,
    },
  }
}
