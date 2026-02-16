export type RateLimitResult = {
  limited: boolean
  remaining: number
  limit: number
  resetAt: string
}

export function isRateLimited(params: {
  requestCount: number
  dailyLimit: number
}): RateLimitResult {
  const { requestCount, dailyLimit } = params
  const remaining = Math.max(0, dailyLimit - requestCount)

  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))

  return {
    limited: requestCount >= dailyLimit,
    remaining,
    limit: dailyLimit,
    resetAt: tomorrow.toISOString(),
  }
}
