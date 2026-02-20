export type GraphNode = {
  id: string; agentId: number; chainId: number; label: string;
  feedbackCount: number; x?: number; y?: number; vx?: number; vy?: number
}
export type TrustEdge = {
  source: string; target: string; kind: 'feedback' | 'validation';
  value: number; timestamp?: number; txHash?: string; logIndex?: number; eventId?: string; id?: string; ts?: number
}
