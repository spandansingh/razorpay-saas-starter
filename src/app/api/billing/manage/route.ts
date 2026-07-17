import { NextResponse } from 'next/server';
import { requireOrgAdmin } from '@/libs/authz';
import { Env } from '@/libs/Env';
import { getProvider } from '@/libs/payments';
import { getActiveSubscription } from '@/libs/payments/queries';

// Opens the gateway's management surface for the org's current subscription:
// Stripe hands back a portal URL, Razorpay cancels at cycle end. The resulting
// status change comes back through the webhook — we never write it here.
export async function POST() {
  const gate = await requireOrgAdmin();
  if (!gate.ok) {
    return gate.response;
  }

  // Scoped to the caller's active org — the client never names the subscription.
  const subscription = await getActiveSubscription(gate.orgId);
  if (!subscription) {
    return NextResponse.json({ error: 'no_active_subscription' }, { status: 404 });
  }

  const provider = getProvider(subscription.provider);
  if (!provider.manage) {
    return NextResponse.json({ error: 'not_manageable' }, { status: 400 });
  }

  const base = Env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const result = await provider.manage(
      {
        externalId: subscription.externalId,
        customerId: subscription.customerId,
        mode: subscription.mode,
      },
      `${base}/dashboard/billing`,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
