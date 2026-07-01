import { SiweMessage } from 'siwe'

type CreateMessageParams = {
  /** Must equal the requesting origin's host (window.location.host) so wallets
   *  pass their phishing/domain-binding check. */
  domain: string
  /** Must equal window.location.origin. */
  uri: string
  address: string
  chainId: number
  nonce: string
  statement?: string
}

export function createSiweMessage({
  domain,
  uri,
  address,
  chainId,
  nonce,
  statement = 'Sign in to DenScope',
}: CreateMessageParams): string {
  const message = new SiweMessage({
    domain,
    address,
    statement,
    uri,
    version: '1',
    chainId,
    nonce,
  })
  return message.prepareMessage()
}

/** Domain + URI bound to the live browser origin. Client-only (reads window). */
export function browserSiweOrigin(): { domain: string; uri: string } {
  return { domain: window.location.host, uri: window.location.origin }
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
