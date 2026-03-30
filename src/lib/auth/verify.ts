import { SiweMessage } from 'siwe'

const DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'localhost:3000'

type VerifyResult =
  | { valid: true; address: string }
  | { valid: false; error: string }

export async function verifySiweMessage(
  message: string,
  signature: string
): Promise<VerifyResult> {
  try {
    const siweMessage = new SiweMessage(message)

    if (siweMessage.domain !== DOMAIN) {
      return { valid: false, error: 'Domain mismatch' }
    }

    const result = await siweMessage.verify({ signature, domain: DOMAIN })
    if (!result.success) {
      return { valid: false, error: 'Signature verification failed' }
    }
    return { valid: true, address: siweMessage.address }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
