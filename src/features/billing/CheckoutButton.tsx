'use client';

import type { CheckoutResult, PaymentMode, ProviderName } from '@/libs/payments/types';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/buttonVariants';

declare global {
  // eslint-disable-next-line vars-on-top
  var Razorpay: new (options: Record<string, unknown>) => { open: () => void };
}

const RAZORPAY_SDK = 'https://checkout.razorpay.com/v1/checkout.js';

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function openRazorpayModal(data: Extract<CheckoutResult, { kind: 'razorpay_modal' }>) {
  const ok = await loadScript(RAZORPAY_SDK);
  if (!ok) {
    throw new Error('Razorpay SDK failed to load');
  }

  const rzp = new globalThis.Razorpay({
    key: data.keyId,
    amount: data.amount,
    currency: data.currency,
    order_id: data.orderId,
    subscription_id: data.subscriptionId,
    name: 'Your SaaS',
    description: `Plan: ${data.planId}`,
    handler: async (response: Record<string, string>) => {
      await fetch('/api/checkout/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...response,
          mode: data.mode,
          planId: data.planId,
          orgId: data.orgId,
        }),
      });
      window.location.href = '/dashboard?checkout=success';
    },
  });
  rzp.open();
}

type Props = {
  planId: string;
  provider: ProviderName;
  mode?: PaymentMode;
  children: React.ReactNode;
};

export function CheckoutButton({ planId, provider, mode = 'subscription', children }: Props) {
  const [loading, setLoading] = useState(false);

  async function checkout() {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, planId, mode }),
      });
      const data: CheckoutResult & { error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Checkout failed');
      }

      if (data.kind === 'redirect') {
        window.location.href = data.url;
      } else if (data.kind === 'razorpay_modal') {
        await openRazorpayModal(data);
      }
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={checkout}
      disabled={loading}
      className={buttonVariants({ size: 'sm', className: 'w-full' })}
    >
      {loading ? '…' : children}
    </button>
  );
}
