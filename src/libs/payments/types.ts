export type ProviderName = 'stripe' | 'razorpay';

// 'payment' = one-time charge, 'subscription' = recurring.
export type PaymentMode = 'payment' | 'subscription';

export type CheckoutParams = {
  mode: PaymentMode;
  planId: string;
  orgId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
};

// Stripe returns a hosted-page URL to redirect to. Razorpay is created
// server-side then opened as a modal by the client, so it hands back the
// ids + key the browser SDK needs.
export type CheckoutResult
  = | { kind: 'redirect'; url: string }
    | {
      kind: 'razorpay_modal';
      keyId: string;
      mode: PaymentMode;
      orderId?: string;
      subscriptionId?: string;
      amount: number; // smallest currency unit (paise/cents), 0 for subscriptions
      currency: string;
      planId: string;
      orgId: string;
    };

// Both gateways' webhooks collapse to this shape before we touch the DB.
export type NormalizedEvent = {
  provider: ProviderName;
  externalId: string;
  // The gateway's id for the delivery itself, distinct from externalId (the
  // subscription/order). Unique per event, so it is what makes the billing_event
  // log idempotent across redeliveries.
  eventId: string;
  // The gateway's own event name, kept verbatim for the audit trail.
  type: string;
  planId?: string;
  orgId?: string;
  mode: PaymentMode;
  status: 'active' | 'paid' | 'cancelled' | 'failed';
  // Charged amount in minor units (paise/cents) and its currency, when the
  // payload carries them. Cancellations and activations do not.
  amount?: number;
  currency?: string;
  // Customer email from the gateway payload, when present. Optional because not
  // every event (cancellations, deletions) carries one. Used for receipts only.
  customerEmail?: string;
  // The gateway's customer id, when the payload carries one. Persisted so the
  // billing page can open the Stripe portal later.
  customerId?: string;
};

// What a subscription row needs to expose for manage() to act on it. Not
// exported: callers pass an object literal, implementations infer it.
type ManageTarget = {
  externalId: string;
  customerId: string | null;
  mode: PaymentMode;
};

// Stripe hands back a hosted portal URL; Razorpay has no portal, so we cancel
// server-side and tell the caller it's done.
export type ManageResult
  = | { kind: 'redirect'; url: string }
    | { kind: 'cancelled' };

export type PaymentProvider = {
  name: ProviderName;
  createCheckout: (params: CheckoutParams) => Promise<CheckoutResult>;
  // Returns null when the signature is invalid or the event is one we ignore.
  parseWebhook: (rawBody: string, headers: Headers) => Promise<NormalizedEvent | null>;
  // Optional: one-time payments have nothing to manage, and a gateway may not
  // offer a portal. Callers must handle its absence.
  manage?: (target: ManageTarget, returnUrl: string) => Promise<ManageResult>;
};
