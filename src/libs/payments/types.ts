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
export type CheckoutResult =
  | { kind: 'redirect'; url: string }
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
  planId?: string;
  orgId?: string;
  mode: PaymentMode;
  status: 'active' | 'paid' | 'cancelled' | 'failed';
};

export type PaymentProvider = {
  name: ProviderName;
  createCheckout: (params: CheckoutParams) => Promise<CheckoutResult>;
  // Returns null when the signature is invalid or the event is one we ignore.
  parseWebhook: (rawBody: string, headers: Headers) => Promise<NormalizedEvent | null>;
};
