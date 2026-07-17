import { describe, expect, it, vi } from 'vitest';
import {
  signStripeWebhook,
  stripeCheckoutCompleted,
  TEST_STRIPE_WEBHOOK_SECRET,
} from '../../../tests/helpers/webhooks';
import { stripeProvider } from './stripe';

// Env is read at module load, so it has to be mocked rather than stubbed. The
// keys are fixtures: constructEvent is pure crypto and never calls Stripe.
vi.mock('@/libs/Env', () => ({
  Env: {
    STRIPE_SECRET_KEY: 'sk_test_fixture',
    STRIPE_WEBHOOK_SECRET: TEST_STRIPE_WEBHOOK_SECRET,
    PAYMENTS_CURRENCY: 'USD',
  },
}));

describe('stripe parseWebhook', () => {
  it('normalizes a completed subscription checkout', async () => {
    const { rawBody, headers } = signStripeWebhook(stripeCheckoutCompleted());

    await expect(stripeProvider.parseWebhook(rawBody, headers)).resolves.toEqual({
      provider: 'stripe',
      // The subscription id, not the session id — that is what later events key on.
      externalId: 'sub_stripe_1',
      eventId: 'evt_stripe_1',
      type: 'checkout.session.completed',
      orgId: 'org_a',
      planId: 'premium',
      mode: 'subscription',
      status: 'active',
      amount: 7900,
      currency: 'USD',
      customerEmail: 'buyer@example.com',
      customerId: 'cus_stripe_1',
    });
  });

  it('normalizes a one-time payment as paid, keyed on the session', async () => {
    const { rawBody, headers } = signStripeWebhook(
      stripeCheckoutCompleted({ mode: 'payment', subscription: null }),
    );

    await expect(stripeProvider.parseWebhook(rawBody, headers)).resolves.toMatchObject({
      externalId: 'cs_test_1',
      mode: 'payment',
      status: 'paid',
    });
  });

  it('normalizes a subscription deletion as cancelled', async () => {
    const { rawBody, headers } = signStripeWebhook({
      id: 'evt_stripe_2',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_stripe_1',
          customer: 'cus_stripe_1',
          metadata: { orgId: 'org_a', planId: 'premium' },
        },
      },
    });

    await expect(stripeProvider.parseWebhook(rawBody, headers)).resolves.toMatchObject({
      externalId: 'sub_stripe_1',
      status: 'cancelled',
      customerId: 'cus_stripe_1',
    });
  });

  // The signature is the security boundary: a forged body must never fulfil.
  it('rejects a tampered body', async () => {
    const { rawBody, headers } = signStripeWebhook(stripeCheckoutCompleted());
    const tampered = rawBody.replace('"premium"', '"enterprise"');

    await expect(stripeProvider.parseWebhook(tampered, headers)).resolves.toBeNull();
  });

  it('rejects a signature made with the wrong secret', async () => {
    const { rawBody, headers } = signStripeWebhook(stripeCheckoutCompleted(), 'whsec_attacker');

    await expect(stripeProvider.parseWebhook(rawBody, headers)).resolves.toBeNull();
  });

  it('rejects a request with no signature header', async () => {
    const { rawBody } = signStripeWebhook(stripeCheckoutCompleted());

    await expect(stripeProvider.parseWebhook(rawBody, new Headers())).resolves.toBeNull();
  });

  // Correctly signed but not an event we act on.
  it('ignores an unhandled event type', async () => {
    const { rawBody, headers } = signStripeWebhook({
      id: 'evt_stripe_3',
      type: 'invoice.created',
      data: { object: { id: 'in_1' } },
    });

    await expect(stripeProvider.parseWebhook(rawBody, headers)).resolves.toBeNull();
  });
});
