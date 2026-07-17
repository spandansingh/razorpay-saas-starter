import type { CheckoutResult, ManageResult, NormalizedEvent, PaymentProvider } from './types';
import Razorpay from 'razorpay';
import { Env } from '@/libs/Env';
import { getPlanRef } from './planRefs';
import { verifyWebhookSignature } from './signature';

// The razorpay SDK ships loose types; cast to what we actually call.
type RazorpayNotes = { orgId?: string; planId?: string };
type RazorpayClient = {
  orders: {
    create: (opts: Record<string, unknown>) => Promise<{ id: string }>;
    fetch: (id: string) => Promise<{ id: string; notes?: RazorpayNotes }>;
  };
  subscriptions: {
    create: (opts: Record<string, unknown>) => Promise<{ id: string }>;
    fetch: (id: string) => Promise<{ id: string; notes?: RazorpayNotes }>;
    cancel: (id: string, cancelAtCycleEnd?: boolean) => Promise<{ id: string; status: string }>;
  };
};

function client(): RazorpayClient {
  if (!Env.RAZORPAY_KEY_ID || !Env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set');
  }
  return new Razorpay({
    key_id: Env.RAZORPAY_KEY_ID,
    key_secret: Env.RAZORPAY_KEY_SECRET,
  }) as unknown as RazorpayClient;
}

// The orgId/planId a checkout was created for, read back from the notes we set
// on the order/subscription at creation. The client success handler must not be
// trusted for these — its signature only proves the payment happened, not which
// plan or org it was for.
export async function fetchCheckoutNotes(
  mode: 'payment' | 'subscription',
  entityId: string,
): Promise<RazorpayNotes> {
  const entity = mode === 'subscription'
    ? await client().subscriptions.fetch(entityId)
    : await client().orders.fetch(entityId);
  return entity.notes ?? {};
}

export const razorpayProvider: PaymentProvider = {
  name: 'razorpay',

  async createCheckout(params): Promise<CheckoutResult> {
    const ref = getPlanRef(params.planId);
    if (!ref) {
      throw new Error(`Unknown or free plan "${params.planId}"`);
    }
    const notes = { orgId: params.orgId, planId: params.planId };
    // `||`, not `??`: the shipped .env defines NEXT_PUBLIC_RAZORPAY_KEY_ID as an
    // empty string, which is not nullish and would hand the modal a blank key.
    const keyId = Env.NEXT_PUBLIC_RAZORPAY_KEY_ID || Env.RAZORPAY_KEY_ID!;

    if (params.mode === 'subscription') {
      if (!ref.razorpayPlanId) {
        throw new Error(`No Razorpay plan configured for "${params.planId}"`);
      }
      const sub = await client().subscriptions.create({
        plan_id: ref.razorpayPlanId,
        total_count: ref.totalCount, // per-plan; see DEFAULT_TOTAL_COUNT in planRefs
        customer_notify: 1,
        notes,
      });
      return {
        kind: 'razorpay_modal',
        keyId,
        mode: 'subscription',
        subscriptionId: sub.id,
        amount: 0,
        currency: ref.currency,
        planId: params.planId,
        orgId: params.orgId,
      };
    }

    const amount = Math.round(ref.amount * 100); // major -> paise/cents
    const order = await client().orders.create({
      amount,
      currency: ref.currency,
      notes,
    });
    return {
      kind: 'razorpay_modal',
      keyId,
      mode: 'payment',
      orderId: order.id,
      amount,
      currency: ref.currency,
      planId: params.planId,
      orgId: params.orgId,
    };
  },

  async parseWebhook(rawBody, headers): Promise<NormalizedEvent | null> {
    const sig = headers.get('x-razorpay-signature');
    if (!sig || !Env.RAZORPAY_WEBHOOK_SECRET) {
      return null;
    }
    if (!verifyWebhookSignature(rawBody, sig, Env.RAZORPAY_WEBHOOK_SECRET)) {
      return null;
    }

    const event = JSON.parse(rawBody);
    const payment = event.payload.payment?.entity;

    // Razorpay identifies each delivery with this header. Falling back to the
    // payment id keeps the billing_event log idempotent if it is ever absent —
    // it must stay unique per charge, so subscription.charged (which repeats for
    // one subscription id) cannot collapse into a single row.
    const eventId = headers.get('x-razorpay-event-id')
      ?? `${event.event}:${payment?.id ?? event.payload.subscription?.entity?.id}`;

    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged': {
        const sub = event.payload.subscription.entity;
        return {
          provider: 'razorpay',
          externalId: sub.id,
          eventId,
          type: event.event,
          orgId: sub.notes?.orgId,
          planId: sub.notes?.planId,
          mode: 'subscription',
          status: 'active',
          amount: payment?.amount,
          currency: payment?.currency,
          // The subscription entity itself has no email; pull it from the
          // payment entity when this event includes one (e.g. subscription.charged).
          customerEmail: payment?.email,
          customerId: sub.customer_id,
        };
      }
      case 'subscription.cancelled': {
        const sub = event.payload.subscription.entity;
        return {
          provider: 'razorpay',
          externalId: sub.id,
          eventId,
          type: event.event,
          orgId: sub.notes?.orgId,
          planId: sub.notes?.planId,
          mode: 'subscription',
          status: 'cancelled',
          customerId: sub.customer_id,
        };
      }
      case 'order.paid':
      case 'payment.captured': {
        const pay = event.payload.payment.entity;
        return {
          provider: 'razorpay',
          externalId: pay.order_id ?? pay.id,
          eventId,
          type: event.event,
          orgId: pay.notes?.orgId,
          planId: pay.notes?.planId,
          mode: 'payment',
          status: 'paid',
          amount: pay.amount,
          currency: pay.currency,
          customerEmail: pay.email,
          customerId: pay.customer_id,
        };
      }
      default:
        return null;
    }
  },

  // No hosted portal exists, so manage() means cancel. At cycle end, so the
  // customer keeps what they paid for; the webhook writes the final status.
  async manage(target): Promise<ManageResult> {
    if (target.mode !== 'subscription') {
      throw new Error('Razorpay one-time payments cannot be cancelled');
    }
    await client().subscriptions.cancel(target.externalId, true);
    return { kind: 'cancelled' };
  },
};
