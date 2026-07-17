import type { NormalizedEvent } from './types';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { subscriptionSchema } from '@/models/Schema';
import { fulfill, getProvider } from './index';

// Real Postgres (in-memory PGlite) on the real migrations, so the unique
// constraint that makes fulfill() idempotent is the one production has.
vi.mock('@/libs/DB', () => import('../../../tests/helpers/testDb'));

function event(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    provider: 'stripe',
    externalId: 'sub_1',
    eventId: 'evt_1',
    type: 'checkout.session.completed',
    orgId: 'org_a',
    planId: 'premium',
    mode: 'subscription',
    status: 'active',
    customerId: 'cus_1',
    ...overrides,
  };
}

const rows = () => db.select().from(subscriptionSchema);

describe('getProvider', () => {
  it('resolves both gateways and rejects an unknown one', () => {
    expect(getProvider('stripe').name).toBe('stripe');
    expect(getProvider('razorpay').name).toBe('razorpay');
    // @ts-expect-error — guarding the runtime path against a bad provider string
    expect(() => getProvider('paypal')).toThrow(/Unknown payment provider/);
  });
});

describe('fulfill', () => {
  beforeEach(async () => {
    await db.delete(subscriptionSchema);
  });

  it('records a subscription for the org', async () => {
    await fulfill(event());

    await expect(rows()).resolves.toMatchObject([{
      orgId: 'org_a',
      provider: 'stripe',
      externalId: 'sub_1',
      planId: 'premium',
      status: 'active',
      customerId: 'cus_1',
    }]);
  });

  // The webhook and the Razorpay verify route both call fulfill() for the same
  // checkout, and gateways redeliver — none of that may duplicate the row.
  it('is idempotent: the same externalId twice keeps one row', async () => {
    await fulfill(event());
    await fulfill(event());

    await expect(rows()).resolves.toHaveLength(1);
  });

  it('upserts the status of an existing subscription rather than appending', async () => {
    await fulfill(event());
    await fulfill(event({ status: 'cancelled' }));

    const result = await rows();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ status: 'cancelled' });
  });

  // A cancellation carries no customer id, and must not blank out the stored one
  // — losing it would make the Stripe portal unopenable.
  it('keeps the stored customerId when a later event carries none', async () => {
    await fulfill(event());
    await fulfill(event({ status: 'cancelled', customerId: undefined }));

    await expect(rows()).resolves.toMatchObject([{ status: 'cancelled', customerId: 'cus_1' }]);
  });

  it('treats a different externalId as a separate subscription', async () => {
    await fulfill(event({ externalId: 'sub_1' }));
    await fulfill(event({ externalId: 'sub_2' }));

    await expect(rows()).resolves.toHaveLength(2);
  });

  // Better to drop the event than to write a row we cannot attribute to anyone.
  it('ignores an event with no org or plan rather than orphaning a row', async () => {
    await fulfill(event({ orgId: undefined }));
    await fulfill(event({ planId: undefined }));

    await expect(rows()).resolves.toHaveLength(0);
  });

  it('scopes rows by org', async () => {
    await fulfill(event({ orgId: 'org_a', externalId: 'sub_a' }));
    await fulfill(event({ orgId: 'org_b', externalId: 'sub_b' }));

    await expect(
      db.select().from(subscriptionSchema).where(eq(subscriptionSchema.orgId, 'org_a')),
    ).resolves.toHaveLength(1);
  });
});
