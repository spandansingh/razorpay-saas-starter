import type { PlanRef } from './planRefs';
import { describe, expect, it } from 'vitest';
import { providersFor } from './planRefs';

describe('providersFor', () => {
  const bothConfigured = { stripeConfigured: true, razorpayConfigured: true };
  const ref: PlanRef = {
    planId: 'premium',
    amount: 79,
    currency: 'USD',
    stripePriceId: 'price_123',
    razorpayPlanId: 'plan_123',
  };

  it('offers both gateways when both are configured and the plan maps to each', () => {
    expect(providersFor(ref, 'subscription', bothConfigured)).toEqual(['stripe', 'razorpay']);
  });

  it('offers nothing for a free or unknown plan', () => {
    expect(providersFor(null, 'subscription', bothConfigured)).toEqual([]);
  });

  it('hides a gateway whose keys are absent', () => {
    expect(providersFor(ref, 'subscription', { stripeConfigured: false, razorpayConfigured: true }))
      .toEqual(['razorpay']);
    expect(providersFor(ref, 'subscription', { stripeConfigured: true, razorpayConfigured: false }))
      .toEqual(['stripe']);
    expect(providersFor(ref, 'subscription', { stripeConfigured: false, razorpayConfigured: false }))
      .toEqual([]);
  });

  // Configured keys aren't enough: without the plan's id for that gateway the
  // button would only reach an error at the API.
  it('hides a configured gateway that has no id for this plan', () => {
    expect(providersFor({ ...ref, stripePriceId: undefined }, 'subscription', bothConfigured))
      .toEqual(['razorpay']);
    expect(providersFor({ ...ref, razorpayPlanId: undefined }, 'subscription', bothConfigured))
      .toEqual(['stripe']);
  });

  // One-time Razorpay orders are built from the amount, so they need no plan id.
  it('still offers Razorpay for one-time payments without a plan id', () => {
    expect(providersFor({ ...ref, razorpayPlanId: undefined }, 'payment', bothConfigured))
      .toEqual(['stripe', 'razorpay']);
  });
});
