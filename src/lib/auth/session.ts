import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'

const SESSION_COOKIE = 'denscope_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function getSecret(): string {
  const key = process.env.SESSION_SECRET
  if (!key) throw new Error('SESSION_SECRET env var is required for session signing')
  return key
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

function verify(payload: string, signature: string): boolean {
  const expected = sign(payload)
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

type SessionPayload = {
  address: string
  iat: number
}

export async function createSession(address: string): Promise<void> {
  const payload: SessionPayload = { address: address.toLowerCase(), iat: Date.now() }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = sign(encoded)
  const token = `${encoded}.${sig}`

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

export async function getSession(): Promise<{ address: string } | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const dotIndex = token.indexOf('.')
  if (dotIndex === -1) return null

  const encoded = token.slice(0, dotIndex)
  const sig = token.slice(dotIndex + 1)

  if (!verify(encoded, sig)) return null

  try {
    const payload: SessionPayload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString()
    )
    if (Date.now() - payload.iat > SESSION_MAX_AGE * 1000) return null
    return { address: payload.address }
  } catch {
    return null
  }
}

export async function requireSession(): Promise<
  { ok: true; address: string } | { ok: false; status: 401 }
> {
  const session = await getSession()
  if (!session) return { ok: false, status: 401 }
  return { ok: true, address: session.address }
}
