import type { PaymentMode, ProviderName } from './types';
import { Env } from '@/libs/Env';
import { AllPlans } from '@/utils/PricingPlans';

// Maps our internal plan names (from PricingPlans.ts) to each gateway's own id.
// Create these in the Stripe/Razorpay dashboards and put the ids in .env.local.
export type PlanRef = {
  planId: string;
  amount: number; // major units, from PricingPlans price
  currency: string;
  stripePriceId?: string;
  razorpayPlanId?: string;
};

const REFS: Record<string, { stripePriceId?: string; razorpayPlanId?: string }> = {
  premium: {
    stripePriceId: Env.STRIPE_PRICE_PREMIUM,
    razorpayPlanId: Env.RAZORPAY_PLAN_PREMIUM,
  },
  enterprise: {
    stripePriceId: Env.STRIPE_PRICE_ENTERPRISE,
    razorpayPlanId: Env.RAZORPAY_PLAN_ENTERPRISE,
  },
};

export function getPlanRef(planId: string): PlanRef | null {
  const plan = AllPlans.find(p => p.name === planId);
  if (!plan || plan.price === 0) {
    return null; // unknown or free plan — nothing to charge
  }
  return {
    planId,
    amount: plan.price,
    currency: Env.PAYMENTS_CURRENCY,
    ...REFS[planId],
  };
}

/** Which gateways are configured well enough to charge for this plan. */
export type GatewayConfig = {
  stripeConfigured: boolean;
  razorpayConfigured: boolean;
};

// Pure so it can be tested without the ambient env. A gateway only qualifies
// when its keys AND this plan's id for that gateway are present — otherwise we
// render no button rather than a path that throws at the API.
export function providersFor(
  ref: PlanRef | null,
  mode: PaymentMode,
  config: GatewayConfig,
): ProviderName[] {
  if (!ref) {
    return []; // free or unknown plan — nothing to charge
  }

  const providers: ProviderName[] = [];
  if (config.stripeConfigured && ref.stripePriceId) {
    providers.push('stripe');
  }
  // One-time Razorpay orders are created from the amount, so they need no plan id.
  if (config.razorpayConfigured && (mode === 'payment' || ref.razorpayPlanId)) {
    providers.push('razorpay');
  }
  return providers;
}

/** Server-side: gateways available for `planId`, per the configured env. */
export function getCheckoutProviders(planId: string, mode: PaymentMode = 'subscription'): ProviderName[] {
  return providersFor(getPlanRef(planId), mode, {
    stripeConfigured: Boolean(Env.STRIPE_SECRET_KEY),
    // The browser gets its key id from the checkout response, so the server-side
    // pair is the accurate signal — NEXT_PUBLIC_RAZORPAY_KEY_ID is not required.
    razorpayConfigured: Boolean(Env.RAZORPAY_KEY_ID && Env.RAZORPAY_KEY_SECRET),
  });
}
