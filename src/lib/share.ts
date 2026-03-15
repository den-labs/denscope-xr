import { getChain } from '@/config/chains'
import { getAppBaseUrl } from '@/lib/trust/certificate'
import { getCertificateLabels, type CertificateLang } from '@/lib/trust/certificate-i18n'
import type { ShareCardStateKey } from '@/lib/trust/share-card-state'

export type AgentShareInput = {
  chainId: number
  agentId: number
  name?: string
}

export type CertificateShareParams = {
  hash: string
  name: string | null
  state: ShareCardStateKey
  lang: CertificateLang
}

/**
 * Share a trust certificate via Web Share API with fallback chain.
 * Returns 'shared' | 'copied' | 'modal' indicating which method was used.
 */
export async function shareCertificate(
  params: CertificateShareParams,
): Promise<'shared' | 'copied' | 'modal'> {
  const baseUrl = getAppBaseUrl()
  const verifyUrl = `${baseUrl}/verify/${params.hash}`
  const labels = getCertificateLabels(params.lang)
  const displayName = params.name ?? labels.unnamedAgent
  const stateLabel = labels.stateLabels[params.state]

  const title = labels.title
  const text = params.lang === 'es'
    ? `${displayName} · ${stateLabel}\nVerificable en DenScope`
    : `${displayName} · ${stateLabel}\nVerifiable on DenScope`

  // Level 1: Web Share API
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ url: verifyUrl })) {
    try {
      await navigator.share({ title, text, url: verifyUrl })
      return 'shared'
    } catch {
      // User cancelled or share failed — fall through
    }
  }

  // Level 2: Clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(verifyUrl)
      return 'copied'
    } catch {
      // Clipboard denied — fall through
    }
  }

  // Level 3: Modal fallback (caller handles UI)
  return 'modal'
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
  return `${name} @${chainName} — Community Trust Snapshot\nSeñal basada en feedback ERC-8004\n${url}\n\nPowered by @denlabs_app`
}

export function buildOwnerShareText(agent: AgentShareInput): string {
  const name = agent.name ?? `Agent #${agent.agentId}`
  const chainName = getChain(agent.chainId)?.name ?? `Chain ${agent.chainId}`
  const url = buildAgentPageUrl(agent.chainId, agent.agentId)
  return `I shipped my ERC-8004 agent on @${chainName}: ${name}\nCommunity Trust Snapshot + feedback signals\n${url}\n\nPowered by @denlabs_app`
}
