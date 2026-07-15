import { Resend } from 'resend';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

// Default Resend sandbox sender for local/dev. Override with EMAIL_FROM in prod
// (a verified domain) — see https://resend.com/domains.
export const DEFAULT_EMAIL_FROM = 'onboarding@resend.dev';

export type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export type SendEmailResult
  = | { skipped: true }
    | { skipped: false; id?: string; error?: string };

// One client, lazily built. Unconfigured → null, and sendEmail no-ops.
let client: Resend | null = null;
function getResend(): Resend | null {
  if (!Env.RESEND_API_KEY) {
    return null;
  }
  if (!client) {
    client = new Resend(Env.RESEND_API_KEY);
  }
  return client;
}

// Plug-and-play: with no RESEND_API_KEY, log and return { skipped: true } rather
// than throwing. A missing email vendor must never break a request (welcome
// email, receipt, etc.). Wire points: Clerk user.created, payment webhooks.
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getResend();
  if (!resend) {
    logger.info(`email skipped (no RESEND_API_KEY): "${input.subject}" → ${input.to}`);
    return { skipped: true };
  }

  // Resend's CreateEmailOptions is RequireAtLeastOne<{react,html,text}>, so
  // undefined-valued html/text would fail the union — only spread what's set.
  const payload = {
    from: Env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    ...(input.html ? { html: input.html } : {}),
    ...(input.text ? { text: input.text } : {}),
  };

  // Never throws: Resend reports most failures via `error`, but a network fault
  // rejects. Callers sit on the payment webhook path, where a failed receipt must
  // not 500 the route and trigger a provider retry — the payment already landed.
  try {
    const { data, error } = await resend.emails.send(
      payload as Parameters<Resend['emails']['send']>[0],
    );

    if (error) {
      logger.error(`email send failed ("${input.subject}" → ${input.to}): ${error.message}`);
      return { skipped: false, error: error.message };
    }

    return { skipped: false, id: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`email send threw ("${input.subject}" → ${input.to}): ${message}`);
    return { skipped: false, error: message };
  }
}
