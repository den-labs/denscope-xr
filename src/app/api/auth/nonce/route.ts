import { NextResponse } from 'next/server'
import { generateNonce } from '@/lib/auth/siwe'

// In-memory nonce store (valid for 5 minutes)
const nonces = new Map<string, number>()

export function GET() {
  // Clean expired nonces
  const now = Date.now()
  for (const [nonce, expiry] of nonces) {
    if (expiry < now) nonces.delete(nonce)
  }

  const nonce = generateNonce()
  nonces.set(nonce, now + 5 * 60 * 1000)

  return NextResponse.json({ nonce })
}

export { nonces }
