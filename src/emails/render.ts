import type { ReactElement } from 'react';
import { render } from '@react-email/render';

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

/**
 * Render a template to both HTML and a plain-text fallback.
 *
 * Every email ships both: text-only clients and spam filters both want it, and
 * @react-email/render derives it from the same component, so the two can't drift.
 */
export async function renderEmail(subject: string, email: ReactElement): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([
    render(email),
    render(email, { plainText: true }),
  ]);

  return { subject, html, text };
}
