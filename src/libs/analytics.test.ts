import { describe, expect, it } from 'vitest';
import { capture } from './analytics';

describe('capture', () => {
  // The test environment has no NEXT_PUBLIC_POSTHOG_KEY set — capture() must
  // resolve silently and never throw. This is the plug-and-play contract: a
  // missing analytics vendor is a silent no-op, not a broken request.
  it('no-ops (resolves without throwing) when PostHog is not configured', async () => {
    await expect(capture({ event: 'test_event', distinctId: 'test-user' })).resolves.toBeUndefined();
  });
});
