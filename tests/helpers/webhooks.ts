import Stripe from 'stripe';
import { hmacSha256Hex } from '@/libs/payments/signature';

// Synthetic signed webhooks, so the money path is tested deterministically with
// no live gateway: both signatures are plain HMAC over the raw body, computable
// offline. A sandbox in CI would be slower and flakier and would prove nothing
// extra about our own parsing.
//
// These secrets are fixtures, not credentials — the tests mock Env to match.
export const TEST_STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
export const TEST_RAZORPAY_WEBHOOK_SECRET = 'razorpay_test_secret';

/** A raw body plus the `stripe-signature` header Stripe would send for it. */
export function signStripeWebhook(payload: object, secret = TEST_STRIPE_WEBHOOK_SECRET) {
  const rawBody = JSON.stringify(payload);
  // Stripe's own test helper builds the timestamped v1 signature scheme.
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: rawBody, secret });

  return { rawBody, headers: new Headers({ 'stripe-signature': signature }) };
}

/** A raw body plus the headers Razorpay would send for it. */
export function signRazorpayWebhook(
  payload: object,
  { secret = TEST_RAZORPAY_WEBHOOK_SECRET, eventId = 'evt_razorpay_1' } = {},
) {
  const rawBody = JSON.stringify(payload);

  return {
    rawBody,
    headers: new Headers({
      'x-razorpay-signature': hmacSha256Hex(secret, rawBody),
      'x-razorpay-event-id': eventId,
    }),
  };
}

/** A minimal `checkout.session.completed` shaped like Stripe's real payload. */
export function stripeCheckoutCompleted(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_stripe_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_stripe_1',
        customer: 'cus_stripe_1',
        customer_email: 'buyer@example.com',
        amount_total: 7900,
        currency: 'usd',
        metadata: { orgId: 'org_a', planId: 'premium' },
        ...overrides,
      },
    },
  };
}

/** A minimal `subscription.charged` shaped like Razorpay's real payload. */
export function razorpaySubscriptionCharged(overrides: Record<string, unknown> = {}) {
  return {
    event: 'subscription.charged',
    payload: {
      subscription: {
        entity: {
          id: 'sub_razorpay_1',
          customer_id: 'cust_razorpay_1',
          notes: { orgId: 'org_a', planId: 'premium' },
          ...overrides,
        },
      },
      payment: {
        entity: {
          id: 'pay_razorpay_1',
          amount: 7900,
          currency: 'INR',
          email: 'buyer@example.com',
        },
      },
    },
  };
}
