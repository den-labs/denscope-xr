// src/lib/signals/detect.ts

type EventInput = {
  kind: string
  chainId: number
  agentId: number
  txHash: string
}

type SignalResult = {
  chainId: number
  agentId: number
  signalKind: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  whyItMatters: string
  sourceTxHash: string
  metadata: Record<string, unknown>
}

// --- Rule 1: First Interaction ---

type FirstInteractionContext = {
  feedbackCount: number
}

export function detectFirstInteraction(
  event: EventInput,
  context: FirstInteractionContext
): SignalResult | null {
  if (event.kind !== 'feedback') return null
  if (context.feedbackCount > 0) return null
  return {
    chainId: event.chainId,
    agentId: event.agentId,
    signalKind: 'first_interaction',
    severity: 'info',
    title: 'First Feedback',
    description: `Agent #${event.agentId} received its first-ever feedback`,
    whyItMatters: 'Your agent is now visible to clients on the network.',
    sourceTxHash: event.txHash,
    metadata: {},
  }
}

// --- Rule 2: Validation Complete ---

export function detectValidationComplete(
  event: EventInput
): SignalResult | null {
  if (event.kind !== 'validation_res') return null
  return {
    chainId: event.chainId,
    agentId: event.agentId,
    signalKind: 'validation_complete',
    severity: 'info',
    title: 'Validation Complete',
    description: `A validator responded about Agent #${event.agentId}`,
    whyItMatters: "Validator feedback affects your agent's trust score.",
    sourceTxHash: event.txHash,
    metadata: {},
  }
}

// --- Rule 3: Feedback Spike ---

const FEEDBACK_SPIKE_THRESHOLD = 5

type FeedbackSpikeContext = {
  recentFeedbackCount: number
  windowHours: number
}

export function detectFeedbackSpike(
  event: EventInput,
  context: FeedbackSpikeContext
): SignalResult | null {
  if (event.kind !== 'feedback') return null
  if (context.recentFeedbackCount < FEEDBACK_SPIKE_THRESHOLD) return null
  return {
    chainId: event.chainId,
    agentId: event.agentId,
    signalKind: 'feedback_spike',
    severity: 'info',
    title: 'Feedback Spike',
    description: `Agent #${event.agentId} received ${context.recentFeedbackCount} feedbacks in ${context.windowHours}h`,
    whyItMatters: 'Unusual activity may indicate growing interest or coordinated behavior.',
    sourceTxHash: event.txHash,
    metadata: {
      count: context.recentFeedbackCount,
      window_hours: context.windowHours,
    },
  }
}

// --- Rule 4: Reputation Drop ---

const REPUTATION_DROP_MIN_FEEDBACKS = 3
const REPUTATION_DROP_WARNING = 0.5
const REPUTATION_DROP_CRITICAL = 0.8

type ReputationDropContext = {
  positiveCount: number
  negativeCount: number
  feedbackCount: number
}

export function detectReputationDrop(
  event: EventInput,
  context: ReputationDropContext
): SignalResult | null {
  if (event.kind !== 'feedback') return null
  if (context.feedbackCount < REPUTATION_DROP_MIN_FEEDBACKS) return null
  const negativeRatio = context.negativeCount / context.feedbackCount
  if (negativeRatio < REPUTATION_DROP_WARNING) return null
  const severity = negativeRatio >= REPUTATION_DROP_CRITICAL ? 'critical' : 'warning'
  const percent = Math.round(negativeRatio * 100)
  return {
    chainId: event.chainId,
    agentId: event.agentId,
    signalKind: 'reputation_drop',
    severity,
    title: 'Reputation Drop',
    description: `Agent #${event.agentId} has ${percent}% negative feedback (${context.negativeCount}/${context.feedbackCount})`,
    whyItMatters: 'A high negative feedback ratio may indicate trust issues. Review recent interactions.',
    sourceTxHash: event.txHash,
    metadata: {
      positive: context.positiveCount,
      negative: context.negativeCount,
      total: context.feedbackCount,
      negative_percent: percent,
    },
  }
}

// --- Rule 5: Sybil Cluster ---

const SYBIL_CLUSTER_THRESHOLD = 4

type SybilClusterContext = {
  uniqueAddressesInWindow: number
  windowHours: number
}

export function detectSybilCluster(
  event: EventInput,
  context: SybilClusterContext
): SignalResult | null {
  if (event.kind !== 'feedback') return null
  if (context.uniqueAddressesInWindow < SYBIL_CLUSTER_THRESHOLD) return null
  return {
    chainId: event.chainId,
    agentId: event.agentId,
    signalKind: 'sybil_cluster',
    severity: 'critical',
    title: 'Sybil Pattern Detected',
    description: `${context.uniqueAddressesInWindow} different addresses submitted feedback for Agent #${event.agentId} in ${context.windowHours}h`,
    whyItMatters: 'Coordinated feedback from multiple new accounts may indicate a sybil attack.',
    sourceTxHash: event.txHash,
    metadata: {
      unique_addresses: context.uniqueAddressesInWindow,
      window_hours: context.windowHours,
    },
  }
}
