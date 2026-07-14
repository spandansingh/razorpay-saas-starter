import { describe, expect, it } from 'vitest';
import { hmacSha256Hex, verifyPaymentSignature, verifyWebhookSignature } from './signature';

describe('razorpay signatures', () => {
  const secret = 'test_secret';

  it('verifies a valid webhook signature and rejects tampering', () => {
    const body = '{"event":"order.paid"}';
    const sig = hmacSha256Hex(secret, body);

    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyWebhookSignature(body, sig, 'wrong_secret')).toBe(false);
    expect(verifyWebhookSignature(`${body} `, sig, secret)).toBe(false);
  });

  it('verifies an order payment signature', () => {
    const sig = hmacSha256Hex(secret, 'order_1|pay_1');

    expect(verifyPaymentSignature('order_1', 'pay_1', sig, secret, 'order')).toBe(true);
    expect(verifyPaymentSignature('order_1', 'pay_2', sig, secret, 'order')).toBe(false);
  });

  it('verifies a subscription payment signature (payment|subscription order)', () => {
    const sig = hmacSha256Hex(secret, 'pay_1|sub_1');

    expect(verifyPaymentSignature('sub_1', 'pay_1', sig, secret, 'subscription')).toBe(true);
    expect(verifyPaymentSignature('sub_1', 'pay_1', sig, secret, 'order')).toBe(false);
  });
});
