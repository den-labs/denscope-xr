import { SiweMessage } from 'siwe'

type VerifyResult =
  | { valid: true; address: string }
  | { valid: false; error: string }

export async function verifySiweMessage(
  message: string,
  signature: string
): Promise<VerifyResult> {
  try {
    const siweMessage = new SiweMessage(message)
    const result = await siweMessage.verify({ signature })
    if (!result.success) {
      return { valid: false, error: 'Signature verification failed' }
    }
    return { valid: true, address: siweMessage.address }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
