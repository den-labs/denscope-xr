const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^::ffff:127\./i,
  /^fd/i,
  /^fe80/i,
  /^fc/i,
  /^localhost$/i,
]

type ValidateResult =
  | { safe: true; url: string }
  | { safe: false; reason: string }

export function validateWebhookUrl(url: string): ValidateResult {
  try {
    const parsed = new URL(url)

    const isProduction = process.env.NODE_ENV === 'production'
    if (isProduction && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Only HTTPS URLs allowed in production' }
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { safe: false, reason: 'Only HTTP(S) URLs allowed' }
    }

    const hostname = parsed.hostname
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: 'Private/internal URLs are not allowed' }
      }
    }

    return { safe: true, url: parsed.toString() }
  } catch {
    return { safe: false, reason: 'Invalid URL' }
  }
}
