import { renderReceiptEmail } from '@/emails/ReceiptEmail';
import { capture } from '@/libs/analytics';
import { sendEmail } from '@/libs/email';
import { logger } from '@/libs/Logger';
import { fulfill, getProvider } from '@/libs/payments';
import { recordEvent } from '@/libs/payments/events';

// Stripe needs the raw, unparsed body for signature verification, which is the
// security boundary here: without the secret an attacker cannot forge an event.
// Deliberately not rate limited — Stripe delivers every event from its own small
// IP pool, so an IP-keyed limit throttles our own revenue path rather than an
// attacker. Volumetric protection belongs at the edge (Vercel/Cloudflare).
export async function POST(req: Request) {
  const rawBody = await req.text();
  const event = await getProvider('stripe').parseWebhook(rawBody, req.headers);
  if (!event) {
    return new Response('ignored or invalid signature', { status: 400 });
  }

  await fulfill(event);
  // Append to the audit trail after fulfillment, so the log only ever claims
  // events we actually applied. Idempotent on redelivery.
  await recordEvent(event);

  // Side effects fire only on a successful checkout — never on cancellations.
  if (event.status === 'active' || event.status === 'paid') {
    await capture({
      event: 'subscription_active',
      distinctId: event.orgId ?? event.externalId,
      properties: { provider: 'stripe', plan: event.planId, mode: event.mode },
    });

    if (event.customerEmail) {
      const result = await sendEmail({
        to: event.customerEmail,
        ...(await renderReceiptEmail({
          planId: event.planId ?? 'subscription',
          status: event.status,
          amount: event.amount,
          currency: event.currency,
        })),
      });
      if (!result.skipped && result.error) {
        logger.error(`receipt email failed (${event.externalId}): ${result.error}`);
      }
    }
  }

  return new Response('ok');
}
