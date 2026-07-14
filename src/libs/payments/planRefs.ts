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
