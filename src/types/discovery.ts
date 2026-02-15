export type SignalKind = 'first_blood' | 'trust_cluster' | 'reputation_crash' | 'rising_star' | 'x402_ready' | 'multi_chain_agent' | 'sybil_alert'
export type DiscoverySignal = {
  kind: SignalKind; title: string; description: string;
  agentIds: number[]; chainId: number; timestamp: number;
  severity: 'info' | 'warning' | 'critical'
}
