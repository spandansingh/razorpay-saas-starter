import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Env } from '@/libs/Env';
import { getProvider } from '@/libs/payments';

const bodySchema = z.object({
  provider: z.enum(['stripe', 'razorpay']),
  planId: z.string().min(1),
  mode: z.enum(['payment', 'subscription']),
});

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const user = await currentUser();
  const base = Env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const result = await getProvider(parsed.data.provider).createCheckout({
      mode: parsed.data.mode,
      planId: parsed.data.planId,
      orgId: orgId ?? userId, // fall back to personal account when no org is active
      customerEmail: user?.primaryEmailAddress?.emailAddress,
      successUrl: `${base}/dashboard?checkout=success`,
      cancelUrl: `${base}/dashboard?checkout=cancel`,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
