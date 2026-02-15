import type { AgentMetadata } from '@/types/agents'
import { IPFS_GATEWAYS, METADATA_FETCH_TIMEOUT_MS } from '@/config/constants'

export function parseAgentMetadata(json: Record<string, unknown>): AgentMetadata {
  return {
    name: (json.name as string) ?? 'Unknown Agent',
    description: (json.description as string) ?? '',
    image: json.image as string | undefined,
    services: Array.isArray(json.services)
      ? json.services.map((s: Record<string, string>) => ({
          type: s.type as AgentMetadata['services'][number]['type'],
          url: s.url,
          version: s.version,
        }))
      : [],
    x402: json.x402 === true,
  }
}

function resolveIPFS(uri: string): string {
  if (uri.startsWith('ipfs://')) return `${IPFS_GATEWAYS[0]}${uri.replace('ipfs://', '')}`
  return uri
}

export async function fetchAgentMetadata(agentURI: string): Promise<AgentMetadata | null> {
  const url = resolveIPFS(agentURI)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const json = await res.json()
    return parseAgentMetadata(json)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
