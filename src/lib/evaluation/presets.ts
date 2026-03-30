import type { PresetConfig, PresetId } from '@/types/evaluation'

export const PRESETS: Record<PresetId, PresetConfig> = {
  default_safety: {
    id: 'default_safety',
    label: 'Default Safety',
    description: 'General safety evaluation for basic interaction gating',
    trustBand: { high: 60, medium: 35, low: 15 },
    minFeedbacks: 3,
    minConfidence: 'low',
    sybilWeight: 'normal',
    incidentTolerance: 2,
    allowThreshold: 60,
    reviewThreshold: 35,
    staleDays: 30,
    dormantDays: 90,
  },
  agent_to_agent: {
    id: 'agent_to_agent',
    label: 'Agent-to-Agent',
    description: 'Evaluation for inter-agent interactions with elevated sybil sensitivity',
    trustBand: { high: 65, medium: 40, low: 20 },
    minFeedbacks: 5,
    minConfidence: 'medium',
    sybilWeight: 'elevated',
    incidentTolerance: 1,
    allowThreshold: 65,
    reviewThreshold: 40,
    staleDays: 14,
    dormantDays: 45,
  },
  defi_counterparty: {
    id: 'defi_counterparty',
    label: 'DeFi Counterparty',
    description: 'Strict evaluation for financial contexts demanding strong proof',
    trustBand: { high: 75, medium: 55, low: 30 },
    minFeedbacks: 10,
    minConfidence: 'high',
    sybilWeight: 'critical',
    incidentTolerance: 0,
    allowThreshold: 75,
    reviewThreshold: 55,
    staleDays: 7,
    dormantDays: 21,
  },
}

export function getPreset(id: PresetId): PresetConfig {
  return PRESETS[id]
}

export function isValidPreset(id: string): id is PresetId {
  return id in PRESETS
}
