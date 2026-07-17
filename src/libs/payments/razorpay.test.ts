import { describe, expect, it, vi } from 'vitest';
import {
  razorpaySubscriptionCharged,
  signRazorpayWebhook,
  TEST_RAZORPAY_WEBHOOK_SECRET,
} from '../../../tests/helpers/webhooks';
import { razorpayProvider } from './razorpay';

// Env is read at module load, so it has to be mocked rather than stubbed.
// Signature verification is local HMAC — nothing here calls Razorpay.
vi.mock('@/libs/Env', () => ({
  Env: {
    RAZORPAY_KEY_ID: 'rzp_test_fixture',
    RAZORPAY_KEY_SECRET: 'rzp_secret_fixture',
    RAZORPAY_WEBHOOK_SECRET: TEST_RAZORPAY_WEBHOOK_SECRET,
    PAYMENTS_CURRENCY: 'INR',
  },
}));

describe('razorpay parseWebhook', () => {
  it('normalizes a subscription charge', async () => {
    const { rawBody, headers } = signRazorpayWebhook(razorpaySubscriptionCharged());

    await expect(razorpayProvider.parseWebhook(rawBody, headers)).resolves.toEqual({
      provider: 'razorpay',
      externalId: 'sub_razorpay_1',
      eventId: 'evt_razorpay_1',
      type: 'subscription.charged',
      orgId: 'org_a',
      planId: 'premium',
      mode: 'subscription',
      status: 'active',
      amount: 7900,
      currency: 'INR',
      // The subscription entity has no email; it comes off the payment entity.
      customerEmail: 'buyer@example.com',
      customerId: 'cust_razorpay_1',
    });
  });

  it('normalizes a cancellation', async () => {
    const { rawBody, headers } = signRazorpayWebhook({
      event: 'subscription.cancelled',
      payload: {
        subscription: {
          entity: {
            id: 'sub_razorpay_1',
            customer_id: 'cust_razorpay_1',
            notes: { orgId: 'org_a', planId: 'premium' },
          },
        },
      },
    });

    await expect(razorpayProvider.parseWebhook(rawBody, headers)).resolves.toMatchObject({
      externalId: 'sub_razorpay_1',
      status: 'cancelled',
      mode: 'subscription',
    });
  });

  it('normalizes a one-time order payment, keyed on the order', async () => {
    const { rawBody, headers } = signRazorpayWebhook({
      event: 'order.paid',
      payload: {
        payment: {
          entity: {
            id: 'pay_1',
            order_id: 'order_1',
            amount: 19900,
            currency: 'INR',
            email: 'buyer@example.com',
            customer_id: 'cust_razorpay_1',
            notes: { orgId: 'org_a', planId: 'enterprise' },
          },
        },
      },
    });

    await expect(razorpayProvider.parseWebhook(rawBody, headers)).resolves.toMatchObject({
      externalId: 'order_1',
      mode: 'payment',
      status: 'paid',
      amount: 19900,
    });
  });

  // Falls back to a payment-id composite, which must stay unique per charge —
  // otherwise repeated subscription.charged events would collapse to one row.
  it('derives an event id from the payment when the header is absent', async () => {
    const { rawBody } = signRazorpayWebhook(razorpaySubscriptionCharged());
    const headers = new Headers({
      'x-razorpay-signature': (await import('./signature'))
        .hmacSha256Hex(TEST_RAZORPAY_WEBHOOK_SECRET, rawBody),
    });

    await expect(razorpayProvider.parseWebhook(rawBody, headers)).resolves.toMatchObject({
      eventId: 'subscription.charged:pay_razorpay_1',
    });
  });

  // The signature is the security boundary: a forged body must never fulfil.
  it('rejects a tampered body', async () => {
    const { rawBody, headers } = signRazorpayWebhook(razorpaySubscriptionCharged());
    const tampered = rawBody.replace('"premium"', '"enterprise"');

    await expect(razorpayProvider.parseWebhook(tampered, headers)).resolves.toBeNull();
  });

  it('rejects a signature made with the wrong secret', async () => {
    const { rawBody, headers } = signRazorpayWebhook(razorpaySubscriptionCharged(), {
      secret: 'attacker_secret',
    });

    await expect(razorpayProvider.parseWebhook(rawBody, headers)).resolves.toBeNull();
  });

  it('rejects a request with no signature header', async () => {
    const { rawBody } = signRazorpayWebhook(razorpaySubscriptionCharged());

    await expect(razorpayProvider.parseWebhook(rawBody, new Headers())).resolves.toBeNull();
  });

  // Correctly signed but not an event we act on.
  it('ignores an unhandled event type', async () => {
    const { rawBody, headers } = signRazorpayWebhook({
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_2' } } },
    });

    await expect(razorpayProvider.parseWebhook(rawBody, headers)).resolves.toBeNull();
  });
});
