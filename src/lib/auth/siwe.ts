import { SiweMessage } from 'siwe'

const DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'localhost:3000'
const URI = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

type CreateMessageParams = {
  address: string
  chainId: number
  nonce: string
  statement?: string
}

export function createSiweMessage({
  address,
  chainId,
  nonce,
  statement = 'Sign in to DenScope',
}: CreateMessageParams): string {
  const message = new SiweMessage({
    domain: DOMAIN,
    address,
    statement,
    uri: URI,
    version: '1',
    chainId,
    nonce,
  })
  return message.prepareMessage()
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
