export type AgentService = {
  type: 'a2a' | 'mcp' | 'x402' | 'web' | 'ens' | 'did' | 'email'
  url?: string; version?: string
}
export type AgentMetadata = {
  name: string; description: string; image?: string;
  services: AgentService[]; x402?: boolean
}
export type AgentSummary = {
  agentId: number; chainId: number; owner: string; agentURI: string;
  metadata?: AgentMetadata; feedbackCount: number;
  positiveFeedback: number; negativeFeedback: number;
  lastEventBlock: number; registeredAt?: number
}
