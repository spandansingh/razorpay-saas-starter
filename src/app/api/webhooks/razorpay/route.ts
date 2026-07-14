import { fulfill, getProvider } from '@/libs/payments';

// Razorpay signs the raw body; read it as text before parsing.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const event = await getProvider('razorpay').parseWebhook(rawBody, req.headers);
  if (!event) {
    return new Response('ignored or invalid signature', { status: 400 });
  }
  await fulfill(event);
  return new Response('ok');
}
