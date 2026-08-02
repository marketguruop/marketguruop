interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * In-process fixed-window limiter. Adequate for a single-user deployment;
 * swap for Redis when the app runs on more than one instance.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const bucket: Bucket = { count: 1, resetAt: now + windowMs }
    buckets.set(key, bucket)
    return { allowed: true, remaining: limit - 1, resetAt: bucket.resetAt }
  }
  existing.count += 1
  const allowed = existing.count <= limit
  return { allowed, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt }
}

export function resetRateLimits(): void {
  buckets.clear()
}
