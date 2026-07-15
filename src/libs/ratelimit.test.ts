import { describe, expect, it } from 'vitest';
import { limit } from './ratelimit';

describe('limit', () => {
  // The test environment has no UPSTASH_REDIS_REST_URL set — the adapter must
  // allow every request through and never throw. This is the plug-and-play
  // contract: a missing limiter degrades to open, not to failure.
  it('allows through ({ success: true }) when Upstash is not configured', async () => {
    const result = await limit('test-identifier');

    expect(result.success).toBe(true);
  });
});
