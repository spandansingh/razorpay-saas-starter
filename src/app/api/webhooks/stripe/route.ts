import { fulfill, getProvider } from '@/libs/payments';

// Stripe needs the raw, unparsed body for signature verification.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const event = await getProvider('stripe').parseWebhook(rawBody, req.headers);
  if (!event) {
    return new Response('ignored or invalid signature', { status: 400 });
  }
  await fulfill(event);
  return new Response('ok');
}
