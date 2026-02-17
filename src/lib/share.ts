import { getChain } from '@/config/chains'

export type AgentShareInput = {
  chainId: number
  agentId: number
  name?: string
}

export function buildAgentPageUrl(chainId: number, agentId: number): string {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://denscope.vercel.app'
  return `${origin}/agent/${chainId}/${agentId}`
}

export function buildXIntentUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`
}

export function buildCertificateShareText(agent: AgentShareInput): string {
  const name = agent.name ?? `Agent #${agent.agentId}`
  const chainName = getChain(agent.chainId)?.name ?? `Chain ${agent.chainId}`
  const url = buildAgentPageUrl(agent.chainId, agent.agentId)
  return `${name} @${chainName} — Trust Certificate\n${url}\n\nPowered by @denlabs_app`
}

export function buildOwnerShareText(agent: AgentShareInput): string {
  const name = agent.name ?? `Agent #${agent.agentId}`
  const chainName = getChain(agent.chainId)?.name ?? `Chain ${agent.chainId}`
  const url = buildAgentPageUrl(agent.chainId, agent.agentId)
  return `I shipped my ERC-8004 agent on @${chainName}: ${name}\nTrust Certificate + trust signals\n${url}\n\nPowered by @denlabs_app`
}
