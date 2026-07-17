import { describe, expect, it } from 'vitest';
import { renderReceiptEmail } from './ReceiptEmail';
import { renderWelcomeEmail } from './WelcomeEmail';

describe('email templates', () => {
  it('renders the welcome email as branded HTML with a text fallback', async () => {
    const { subject, html, text } = await renderWelcomeEmail();

    expect(subject).toBe('Welcome aboard! 👋');
    expect(html).toContain('<html');
    expect(html).toContain('Welcome aboard');
    expect(html).toContain('/dashboard');
    // The plain-text fallback carries the copy without the markup.
    expect(text).toContain('Welcome aboard');
    expect(text).not.toContain('<html');
  });

  it('renders the receipt with its plan, status and formatted amount', async () => {
    const { subject, html, text } = await renderReceiptEmail({
      planId: 'premium',
      status: 'active',
      amount: 7900,
      currency: 'USD',
    });

    expect(subject).toBe('Payment receipt');
    expect(html).toContain('premium');
    // Minor units are formatted back to major before display.
    expect(html).toContain('$79.00');
    expect(text).toContain('premium');
    expect(text).toContain('$79.00');
  });

  // Cancellations and activations carry no amount — the receipt must still render.
  it('omits the amount when the event carries none', async () => {
    const { html } = await renderReceiptEmail({ planId: 'premium', status: 'active' });

    expect(html).toContain('premium');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });
});
