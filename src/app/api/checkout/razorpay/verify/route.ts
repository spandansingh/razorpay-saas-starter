import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Env } from '@/libs/Env';
import { fulfill } from '@/libs/payments';
import { verifyPaymentSignature } from '@/libs/payments/signature';

// Called by the client right after the Razorpay modal succeeds. Confirms the
// signature so the UI can react immediately; the webhook is still the source of
// truth (fulfill() is idempotent, so a double-write is harmless).
const bodySchema = z.object({
  razorpay_payment_id: z.string(),
  razorpay_order_id: z.string().optional(),
  razorpay_subscription_id: z.string().optional(),
  razorpay_signature: z.string(),
  mode: z.enum(['payment', 'subscription']),
  planId: z.string(),
  orgId: z.string(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!Env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: 'razorpay_not_configured' }, { status: 500 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const b = parsed.data;

  const entityId = b.mode === 'subscription' ? b.razorpay_subscription_id : b.razorpay_order_id;
  if (!entityId) {
    return NextResponse.json({ error: 'missing_entity_id' }, { status: 400 });
  }

  const valid = verifyPaymentSignature(
    entityId,
    b.razorpay_payment_id,
    b.razorpay_signature,
    Env.RAZORPAY_KEY_SECRET,
    b.mode === 'subscription' ? 'subscription' : 'order',
  );
  if (!valid) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  // Fulfil only — the audit trail is written from the webhook, which carries the
  // gateway's real event id. Recording here would log the same payment twice
  // under an id Razorpay never issued.
  await fulfill({
    provider: 'razorpay',
    externalId: entityId,
    eventId: `verify:${b.razorpay_payment_id}`,
    type: 'checkout.verified',
    orgId: b.orgId,
    planId: b.planId,
    mode: b.mode,
    status: b.mode === 'subscription' ? 'active' : 'paid',
  });

  return NextResponse.json({ ok: true });
}
