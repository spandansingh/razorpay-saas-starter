import type { NextRequest } from 'next/server';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { renderWelcomeEmail } from '@/emails/WelcomeEmail';
import { sendEmail } from '@/libs/email';
import { logger } from '@/libs/Logger';

// Clerk webhook (Svix-signed). Inert until CLERK_WEBHOOK_SECRET is set and the
// endpoint is registered in the Clerk dashboard (Webhooks → add endpoint
// /api/webhooks/clerk, subscribing to the `user.created` event). The handler
// verifies the signature itself; sendEmail no-ops if Resend isn't configured.
export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req);

    if (evt.type === 'user.created') {
      // verifyWebhook returns loosely-typed data; narrow to the fields we use.
      const user = evt.data as { id?: string; email_addresses?: { email_address: string }[] };
      const email = user.email_addresses?.[0]?.email_address;
      if (email) {
        const result = await sendEmail({ to: email, ...(await renderWelcomeEmail()) });
        if (!result.skipped && result.error) {
          logger.error(`welcome email failed for user ${user.id ?? 'unknown'}: ${result.error}`);
        }
      }
    }

    return new Response('ok');
  } catch (error) {
    // verifyWebhook throws on a missing/invalid signature — reject the request.
    return new Response((error as Error).message, { status: 400 });
  }
}
