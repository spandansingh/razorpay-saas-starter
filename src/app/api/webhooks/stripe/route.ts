import { capture } from '@/libs/analytics';
import { sendEmail } from '@/libs/email';
import { logger } from '@/libs/Logger';
import { fulfill, getProvider } from '@/libs/payments';

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
        subject: 'Payment receipt',
        text: `Thanks for your purchase. Your ${event.planId ?? 'subscription'} is now ${event.status}.`,
      });
      if (!result.skipped && result.error) {
        logger.error(`receipt email failed (${event.externalId}): ${result.error}`);
      }
    }
  }

  return new Response('ok');
}
