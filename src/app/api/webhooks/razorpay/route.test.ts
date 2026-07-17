import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { billingEventSchema, subscriptionSchema } from '@/models/Schema';
import {
  razorpaySubscriptionCharged,
  signRazorpayWebhook,
  TEST_RAZORPAY_WEBHOOK_SECRET,
} from '../../../../../tests/helpers/webhooks';
import { POST } from './route';

// Drives the whole webhook chain — signature check, parse, fulfil, audit log —
// against real SQL, with a synthetic signed payload instead of a live gateway.
vi.mock('@/libs/DB', () => import('../../../../../tests/helpers/testDb'));
vi.mock('@/libs/Env', () => ({
  Env: {
    RAZORPAY_KEY_ID: 'rzp_test_fixture',
    RAZORPAY_KEY_SECRET: 'rzp_secret_fixture',
    RAZORPAY_WEBHOOK_SECRET: TEST_RAZORPAY_WEBHOOK_SECRET,
    PAYMENTS_CURRENCY: 'INR',
    // No RESEND_API_KEY / POSTHOG key: the receipt email and analytics capture
    // no-op, which is the plug-and-play contract this path relies on.
  },
}));

function request(rawBody: string, headers: Headers) {
  return new Request('http://localhost/api/webhooks/razorpay', {
    method: 'POST',
    body: rawBody,
    headers,
  });
}

describe('POST /api/webhooks/razorpay', () => {
  beforeEach(async () => {
    await db.delete(subscriptionSchema);
    await db.delete(billingEventSchema);
  });

  it('fulfils the subscription and logs one billing event', async () => {
    const { rawBody, headers } = signRazorpayWebhook(razorpaySubscriptionCharged());

    const response = await POST(request(rawBody, headers));

    expect(response.status).toBe(200);
    await expect(db.select().from(subscriptionSchema)).resolves.toMatchObject([{
      orgId: 'org_a',
      provider: 'razorpay',
      externalId: 'sub_razorpay_1',
      status: 'active',
      customerId: 'cust_razorpay_1',
    }]);
    await expect(db.select().from(billingEventSchema)).resolves.toMatchObject([{
      eventId: 'evt_razorpay_1',
      type: 'subscription.charged',
      amount: 7900,
      currency: 'INR',
    }]);
  });

  // Razorpay redelivers until it gets a 2xx. A repeat must stay at one row each.
  it('is idempotent across a redelivery of the same event', async () => {
    const { rawBody, headers } = signRazorpayWebhook(razorpaySubscriptionCharged());

    await POST(request(rawBody, headers));
    const second = await POST(request(rawBody, headers));

    expect(second.status).toBe(200);
    await expect(db.select().from(subscriptionSchema)).resolves.toHaveLength(1);
    await expect(db.select().from(billingEventSchema)).resolves.toHaveLength(1);
  });

  it('rejects a forged payload and writes nothing', async () => {
    const { rawBody, headers } = signRazorpayWebhook(razorpaySubscriptionCharged());
    const tampered = rawBody.replace('"premium"', '"enterprise"');

    const response = await POST(request(tampered, headers));

    expect(response.status).toBe(400);
    await expect(db.select().from(subscriptionSchema)).resolves.toHaveLength(0);
    await expect(db.select().from(billingEventSchema)).resolves.toHaveLength(0);
  });

  it('rejects an unsigned request', async () => {
    const { rawBody } = signRazorpayWebhook(razorpaySubscriptionCharged());

    const response = await POST(request(rawBody, new Headers()));

    expect(response.status).toBe(400);
    await expect(db.select().from(subscriptionSchema)).resolves.toHaveLength(0);
  });
});
