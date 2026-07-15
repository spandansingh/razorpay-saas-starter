import { describe, expect, it } from 'vitest';
import { sendEmail } from './email';

describe('sendEmail', () => {
  // The test environment has no RESEND_API_KEY set — the adapter must no-op and
  // never throw. This is the plug-and-play contract: a missing vendor is silent.
  it('returns { skipped: true } when RESEND_API_KEY is not configured', async () => {
    const result = await sendEmail({ to: 'user@example.com', subject: 'Welcome', text: 'hi' });

    expect(result).toEqual({ skipped: true });
  });
});
