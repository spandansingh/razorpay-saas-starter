import type { NormalizedEvent, PaymentProvider, ProviderName } from './types';
import { db } from '@/libs/DB';
import { subscriptionSchema } from '@/models/Schema';
import { razorpayProvider } from './razorpay';
import { stripeProvider } from './stripe';

const providers: Record<ProviderName, PaymentProvider> = {
  stripe: stripeProvider,
  razorpay: razorpayProvider,
};

export function getProvider(name: ProviderName): PaymentProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown payment provider: ${name}`);
  }
  return provider;
}

// Idempotent: webhooks and the Razorpay success handler can both call this for
// the same externalId; the unique constraint + upsert keeps one row per checkout.
export async function fulfill(event: NormalizedEvent): Promise<void> {
  if (!event.orgId || !event.planId) {
    return; // can't attribute to an org — ignore rather than orphan a row
  }
  await db
    .insert(subscriptionSchema)
    .values({
      orgId: event.orgId,
      provider: event.provider,
      externalId: event.externalId,
      planId: event.planId,
      mode: event.mode,
      status: event.status,
      customerId: event.customerId ?? null,
    })
    .onConflictDoUpdate({
      target: subscriptionSchema.externalId,
      set: {
        status: event.status,
        planId: event.planId,
        updatedAt: new Date(),
        // Only overwrite when this event carries one — a cancellation has no
        // customer id, and must not blank out the one we already stored.
        ...(event.customerId ? { customerId: event.customerId } : {}),
      },
    });
}

export type { CheckoutParams, CheckoutResult, NormalizedEvent, PaymentMode, ProviderName } from './types';
