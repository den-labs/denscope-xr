/** Site URL config — single source of truth backed by NEXT_PUBLIC_APP_URL.
 *  Lazy reads so tests can mutate process.env per case. Throws on missing
 *  env to fail fast at build/render time instead of silently leaking a
 *  fallback domain. */

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env: ${name}`)
  return value.replace(/\/$/, '')
}

/** Canonical site URL (https://www.denscope.xyz in production).
 *  NEXT_PUBLIC_APP_URL is read as a static literal so Next.js inlines it into
 *  the client bundle — a dynamic process.env[name] access is NOT replaced at
 *  build time and resolves to undefined in the browser. */
export function siteUrl(): string {
  return requireEnv('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL)
}

/** Host fragment of the canonical URL (www.denscope.xyz). */
export function siteHost(): string {
  return new URL(siteUrl()).host
}
