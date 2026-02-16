/** x402 v2 wire protocol types — adapted from docs/x402-implementation-guide.md */

/** Payment requirement sent in the 402 response */
export interface PaymentRequirement {
  scheme: string
  network: string
  amount: string
  asset: string
  payTo: string
  maxTimeoutSeconds: number
  extra: Record<string, unknown>
}

/** Resource metadata in the 402 response */
export interface ResourceInfo {
  url: string
  description: string
  mimeType: string
}

/** Full 402 response body */
export interface PaymentRequiredResponse {
  x402Version: number
  accepts: PaymentRequirement[]
  resource: ResourceInfo
  error: string
}

/** Result from facilitator /verify */
export interface X402VerifyResult {
  valid: boolean
  payer?: string
  network?: string
  error?: string
}

/** Result from facilitator /settle */
export interface X402SettleResult {
  success: boolean
  transaction?: string
  network?: string
  payer?: string
  error?: string
}

/** Context attached to request after successful x402 payment */
export interface X402Context {
  payer: string
  transaction?: string
  authMethod: 'x402'
}
