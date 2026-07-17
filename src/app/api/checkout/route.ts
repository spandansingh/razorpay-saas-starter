import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { capture } from '@/libs/analytics';
import { requireOrgAdmin } from '@/libs/authz';
import { Env } from '@/libs/Env';
import { getProvider } from '@/libs/payments';
import { limit } from '@/libs/ratelimit';

const bodySchema = z.object({
  provider: z.enum(['stripe', 'razorpay']),
  planId: z.string().min(1),
  mode: z.enum(['payment', 'subscription']),
});

export async function POST(req: Request) {
  // Billing is admin-only: a member must not be able to start a charge.
  const gate = await requireOrgAdmin();
  if (!gate.ok) {
    return gate.response;
  }
  const { userId, orgId } = gate;

  // Defense-in-depth per user before the gateway call.
  const { success } = await limit(`checkout:${userId}`);
  if (!success) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const user = await currentUser();
  const base = Env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    await capture({
      event: 'checkout_started',
      distinctId: userId,
      properties: { provider: parsed.data.provider, plan: parsed.data.planId, mode: parsed.data.mode },
    });

    const result = await getProvider(parsed.data.provider).createCheckout({
      mode: parsed.data.mode,
      planId: parsed.data.planId,
      orgId, // requireOrgAdmin guarantees an active org
      customerEmail: user?.primaryEmailAddress?.emailAddress,
      successUrl: `${base}/dashboard/billing?checkout=success`,
      cancelUrl: `${base}/dashboard/billing?checkout=cancel`,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
