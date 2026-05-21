/** Site URL config — single source of truth backed by NEXT_PUBLIC_APP_URL.
 *  Lazy reads so tests can mutate process.env per case. Throws on missing
 *  env to fail fast at build/render time instead of silently leaking a
 *  fallback domain. */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env: ${name}`)
  return value.replace(/\/$/, '')
}

/** Canonical site URL (https://www.denscope.xyz in production). */
export function siteUrl(): string {
  return requireEnv('NEXT_PUBLIC_APP_URL')
}

/** Host fragment of the canonical URL (www.denscope.xyz). */
export function siteHost(): string {
  return new URL(siteUrl()).host
}
