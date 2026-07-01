import { SiweMessage } from 'siwe'

type VerifyResult =
  | { valid: true; address: string }
  | { valid: false; error: string }

/** Verify a SIWE signature, binding it to expectedDomain — which callers must
 *  derive from the incoming request host (not a hardcoded env value) so it
 *  always matches the origin the wallet signed for. */
export async function verifySiweMessage(
  message: string,
  signature: string,
  expectedDomain: string
): Promise<VerifyResult> {
  try {
    const siweMessage = new SiweMessage(message)

    if (!expectedDomain || siweMessage.domain !== expectedDomain) {
      return { valid: false, error: 'Domain mismatch' }
    }

    const result = await siweMessage.verify({ signature, domain: expectedDomain })
    if (!result.success) {
      return { valid: false, error: 'Signature verification failed' }
    }
    return { valid: true, address: siweMessage.address }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
