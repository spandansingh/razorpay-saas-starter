import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fulfill } from '@/libs/payments';
import { fetchCheckoutNotes } from '@/libs/payments/razorpay';
import { verifyPaymentSignature } from '@/libs/payments/signature';
import { POST } from './route';

// The verify route confirms a Razorpay Checkout success. Its security-critical
// property: orgId/planId come from the gateway's stored notes, never the body —
// a valid signature only proves the payment happened, not what it was for.
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(async () => ({ userId: 'user_1' })) }));
vi.mock('@/libs/Env', () => ({ Env: { RAZORPAY_KEY_SECRET: 'secret_fixture' } }));
vi.mock('@/libs/payments', () => ({ fulfill: vi.fn(async () => {}) }));
vi.mock('@/libs/payments/razorpay', () => ({ fetchCheckoutNotes: vi.fn() }));
vi.mock('@/libs/payments/signature', () => ({ verifyPaymentSignature: vi.fn(() => true) }));

function request(body: unknown) {
  return new Request('http://localhost/api/checkout/razorpay/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const validBody = {
  razorpay_payment_id: 'pay_1',
  razorpay_order_id: 'order_1',
  razorpay_signature: 'sig',
  mode: 'payment',
};

describe('POST /api/checkout/razorpay/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyPaymentSignature).mockReturnValue(true);
    vi.mocked(fetchCheckoutNotes).mockResolvedValue({ orgId: 'org_real', planId: 'premium' });
  });

  it('fulfils with the gateway notes, ignoring a forged planId/orgId in the body', async () => {
    const response = await POST(request({
      ...validBody,
      planId: 'enterprise', // forged
      orgId: 'org_attacker', // forged
    }));

    expect(response.status).toBe(200);
    expect(fulfill).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org_real',
      planId: 'premium',
    }));
  });

  it('rejects a payment the gateway cannot attribute to an org/plan', async () => {
    vi.mocked(fetchCheckoutNotes).mockResolvedValue({});

    const response = await POST(request(validBody));

    expect(response.status).toBe(400);
    expect(fulfill).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature without touching the gateway or DB', async () => {
    vi.mocked(verifyPaymentSignature).mockReturnValue(false);

    const response = await POST(request(validBody));

    expect(response.status).toBe(400);
    expect(fetchCheckoutNotes).not.toHaveBeenCalled();
    expect(fulfill).not.toHaveBeenCalled();
  });
});
