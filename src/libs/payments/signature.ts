import crypto from 'node:crypto';

export function hmacSha256Hex(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

// Razorpay webhook: signature = HMAC_SHA256(rawBody, webhookSecret).
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  return safeEqualHex(signature, hmacSha256Hex(secret, rawBody));
}

// Razorpay Checkout success handler:
//   order:        signature = HMAC_SHA256(order_id|payment_id, keySecret)
//   subscription: signature = HMAC_SHA256(payment_id|subscription_id, keySecret)
export function verifyPaymentSignature(
  entityId: string, // order_id (order) or subscription_id (subscription)
  paymentId: string,
  signature: string,
  keySecret: string,
  kind: 'order' | 'subscription',
): boolean {
  const payload = kind === 'order' ? `${entityId}|${paymentId}` : `${paymentId}|${entityId}`;
  return safeEqualHex(signature, hmacSha256Hex(keySecret, payload));
}
