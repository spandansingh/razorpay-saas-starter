import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { Env } from '@/libs/Env';

export type LimitResult = {
  success: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
};

// One limiter, lazily built from the Upstash REST credentials. Unconfigured → null,
// and limit() allows every request through.
let limiter: Ratelimit | null = null;
function getLimiter(): Ratelimit | null {
  if (!Env.UPSTASH_REDIS_REST_URL || !Env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!limiter) {
    const redis = new Redis({
      url: Env.UPSTASH_REDIS_REST_URL,
      token: Env.UPSTASH_REDIS_REST_TOKEN,
    });
    limiter = new Ratelimit({
      redis,
      // 10 requests / 10 s per identifier. Tune per route as needed.
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
    });
  }
  return limiter;
}

// Plug-and-play: unconfigured, every call is allowed ({ success: true }).
// This is defense-in-depth — it never replaces webhook signature verification,
// which stays mandatory in the provider's parseWebhook() step.
export async function limit(identifier: string): Promise<LimitResult> {
  const ratelimit = getLimiter();
  if (!ratelimit) {
    return { success: true };
  }
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier);
  return { success, limit, remaining, reset };
}
