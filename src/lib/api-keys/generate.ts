import { randomBytes, createHash } from 'crypto'

const KEY_PREFIX = 'ds_'
const KEY_BYTES = 24

export function generateApiKey(): string {
  const bytes = randomBytes(KEY_BYTES)
  return KEY_PREFIX + bytes.toString('hex')
}

export async function hashApiKey(key: string): Promise<string> {
  return createHash('sha256').update(key).digest('hex')
}

export function validateKeyFormat(key: string): boolean {
  return /^ds_[a-f0-9]{48}$/.test(key)
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, 11)
}
