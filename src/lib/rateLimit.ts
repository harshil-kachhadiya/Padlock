// Best-effort in-memory rate limit for anonymous API routes. Each serverless
// instance keeps its own counters, so this doesn't hold up under horizontal
// scaling the way a shared store (e.g. Redis) would — but it stops trivial,
// single-instance abuse for a low-traffic endpoint without adding infra.

const buckets = new Map<string, { count: number; windowStart: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}

export function clientIpFrom(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
