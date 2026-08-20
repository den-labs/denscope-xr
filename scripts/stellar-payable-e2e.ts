/**
 * The single approved payable Stellar TESTNET E2E.
 *
 *   pnpm stellar:e2e sign     # fetch the live 402, verify it, sign ONE payment
 *   pnpm stellar:e2e pay      # send that payment once
 *   pnpm stellar:e2e replay   # re-send the SAME bytes; must not pay again
 *
 * Signing is a SEPARATE step from sending, and the signed header is persisted,
 * so `replay` physically cannot mint a second payment: it reads the same bytes
 * from disk. There is no code path here that signs twice.
 *
 * The LIVE 402 is the payment authority. Local config is not consulted when
 * deciding what to pay, and every field is asserted against the approved values
 * before a signature is produced. Any mismatch aborts before signing.
 *
 * TESTNET ONLY. A pubnet or non-USDC requirement aborts.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createEd25519Signer } from '@x402/stellar'
import { ExactStellarScheme } from '@x402/stellar/exact/client'
import { encodePaymentSignatureHeader } from '@x402/core/http'
import type { Network, PaymentRequirements } from '@x402/core/types'

const RESOURCE = 'https://www.denscope.xyz/api/v1/trust/evaluate'
const RPC_URL = 'https://soroban-testnet.stellar.org'

/** Exactly what the founder approved. Anything else aborts before signing. */
const APPROVED = {
  scheme: 'exact',
  network: 'stellar:testnet',
  asset: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  payTo: 'GC4I5CKZ2MLRSMTHOEHVYMFDYVTKEQ3LCUKXCJ7ZWL43PKRSOCFHO4XP',
  amount: '10000',
} as const

const BUYER_SECRET_FILE = resolve(process.cwd(), '.stellar-buyer-secret')
const SIGNED_HEADER_FILE = resolve(process.cwd(), '.stellar-e2e-payment')

const BODY = { chainId: 42220, agentId: 1, preset: 'default_safety' }

async function fetchLive402(): Promise<PaymentRequirements> {
  const res = await fetch(RESOURCE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ probe: true }),
  })
  if (res.status !== 402) throw new Error(`expected 402 from the live resource, got ${res.status}`)
  const body = (await res.json()) as { accepts: PaymentRequirements[] }
  const accepts = body.accepts?.[0]
  if (!accepts) throw new Error('live 402 carried no accepts[]')
  return accepts
}

/** Abort unless every approved field matches the LIVE 402 exactly. */
function assertApproved(req: PaymentRequirements): void {
  const mismatches: string[] = []
  for (const [field, expected] of Object.entries(APPROVED)) {
    const actual = (req as unknown as Record<string, unknown>)[field]
    if (actual !== expected) mismatches.push(`${field}: live=${String(actual)} approved=${expected}`)
  }
  if (mismatches.length > 0) {
    throw new Error(`LIVE 402 DIFFERS FROM APPROVAL — NOT PAYING:\n  ${mismatches.join('\n  ')}`)
  }
  console.log('live 402 matches the approval on all five fields')
}

async function sign() {
  if (existsSync(SIGNED_HEADER_FILE)) {
    throw new Error(
      `${SIGNED_HEADER_FILE} already exists. A payment was already signed; refusing to sign a second one.`,
    )
  }
  const requirements = await fetchLive402()
  console.log(JSON.stringify(requirements, null, 2))
  assertApproved(requirements)

  const secret = readFileSync(BUYER_SECRET_FILE, 'utf8').trim()
  const signer = createEd25519Signer(secret, APPROVED.network as Network)
  const scheme = new ExactStellarScheme(signer, { url: RPC_URL })

  console.log('signing exactly one payment…')
  const partial = await scheme.createPaymentPayload(2, requirements)
  const header = encodePaymentSignatureHeader({
    ...partial,
    accepted: requirements,
  } as Parameters<typeof encodePaymentSignatureHeader>[0])

  writeFileSync(SIGNED_HEADER_FILE, header, { mode: 0o600 })
  console.log(`signed payment persisted (${header.length} chars). Signing will not happen again.`)
}

async function send(label: string) {
  if (!existsSync(SIGNED_HEADER_FILE)) throw new Error('no signed payment; run `sign` first')
  const header = readFileSync(SIGNED_HEADER_FILE, 'utf8').trim()

  console.log(`[${label}] sending the persisted payment…`)
  const started = Date.now()
  const res = await fetch(RESOURCE, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-PAYMENT': header },
    body: JSON.stringify(BODY),
  })
  const elapsed = Date.now() - started
  const text = await res.text()

  console.log(`[${label}] HTTP ${res.status} in ${elapsed}ms`)
  for (const h of ['x-payment-method', 'x-payment-tx', 'x-payment-replay', 'x-payment-replayable']) {
    const v = res.headers.get(h)
    if (v) console.log(`[${label}] ${h}: ${v}`)
  }
  console.log(`[${label}] body: ${text.slice(0, 1400)}`)
}

const mode = process.argv[2]
const run =
  mode === 'sign' ? sign : mode === 'pay' ? () => send('PAY') : mode === 'replay' ? () => send('REPLAY') : null

if (!run) {
  console.error('usage: stellar-payable-e2e.ts <sign|pay|replay>')
  process.exit(1)
}

run().catch((error) => {
  console.error('FAILED:', error instanceof Error ? error.message : 'unknown')
  process.exit(1)
})
