import type { CheckoutResult, ManageResult, NormalizedEvent, PaymentProvider } from './types';
import Stripe from 'stripe';
import { Env } from '@/libs/Env';
import { getPlanRef } from './planRefs';

function client(): Stripe {
  if (!Env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(Env.STRIPE_SECRET_KEY);
}

// `customer` is either an id or an expanded object depending on the event.
function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | undefined {
  if (!customer) {
    return undefined;
  }
  return typeof customer === 'string' ? customer : customer.id;
}

export const stripeProvider: PaymentProvider = {
  name: 'stripe',

  async createCheckout(params): Promise<CheckoutResult> {
    const ref = getPlanRef(params.planId);
    if (!ref?.stripePriceId) {
      throw new Error(`No Stripe price configured for plan "${params.planId}"`);
    }

    const metadata = { orgId: params.orgId, planId: params.planId };
    const session = await client().checkout.sessions.create({
      mode: params.mode,
      line_items: [{ price: ref.stripePriceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      client_reference_id: params.orgId,
      metadata,
      // Copy metadata onto the subscription so we get orgId back on cancel events.
      ...(params.mode === 'subscription' ? { subscription_data: { metadata } } : {}),
    });

    return { kind: 'redirect', url: session.url! };
  },

  async parseWebhook(rawBody, headers): Promise<NormalizedEvent | null> {
    const sig = headers.get('stripe-signature');
    if (!sig || !Env.STRIPE_WEBHOOK_SECRET) {
      return null;
    }

    let event: Stripe.Event;
    try {
      event = client().webhooks.constructEvent(rawBody, sig, Env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return null; // bad signature
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        return {
          provider: 'stripe',
          externalId: (s.subscription as string | null) ?? s.id,
          orgId: s.metadata?.orgId,
          planId: s.metadata?.planId,
          mode: s.mode === 'subscription' ? 'subscription' : 'payment',
          status: s.mode === 'subscription' ? 'active' : 'paid',
          customerEmail: s.customer_email ?? s.customer_details?.email ?? undefined,
          customerId: customerId(s.customer),
        };
      }
      case 'customer.subscription.deleted': {
        const s = event.data.object;
        return {
          provider: 'stripe',
          externalId: s.id,
          orgId: s.metadata?.orgId,
          planId: s.metadata?.planId,
          mode: 'subscription',
          status: 'cancelled',
          customerId: customerId(s.customer),
        };
      }
      default:
        return null;
    }
  },

  // The hosted portal handles cancel/upgrade/invoices, so we hand the customer
  // over rather than reimplementing any of it.
  async manage(target, returnUrl): Promise<ManageResult> {
    if (!target.customerId) {
      throw new Error('No Stripe customer recorded for this subscription');
    }
    const session = await client().billingPortal.sessions.create({
      customer: target.customerId,
      return_url: returnUrl,
    });
    return { kind: 'redirect', url: session.url };
  },
};
