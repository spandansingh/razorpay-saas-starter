'use client';

import type { ManageResult } from '@/libs/payments/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/buttonVariants';

type Props = {
  children: React.ReactNode;
  /** Shown before a Razorpay cancel, which is immediate and has no portal step. */
  confirmText?: string;
};

// Stripe returns a portal URL to redirect to; Razorpay cancels server-side and
// returns nothing to visit, so we just refresh to pick up the new status.
export function ManageButton({ children, confirmText }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function manage() {
    // eslint-disable-next-line no-alert
    if (confirmText && !window.confirm(confirmText)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/billing/manage', { method: 'POST' });
      const data: ManageResult & { error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not open billing management');
      }

      if (data.kind === 'redirect') {
        window.location.href = data.url;
      } else {
        router.refresh();
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
      onClick={manage}
      disabled={loading}
      className={buttonVariants({ size: 'sm' })}
    >
      {loading ? '…' : children}
    </button>
  );
}
