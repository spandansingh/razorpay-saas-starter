import type { NormalizedEvent } from './types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { billingEventSchema } from '@/models/Schema';
import { getBillingEvents, recordEvent } from './events';

// Real Postgres (in-memory PGlite) on the real migrations, so the unique
// constraint doing the deduplication is the one production will have.
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
    amount: 7900,
    currency: 'USD',
    ...overrides,
  };
}

describe('recordEvent', () => {
  beforeEach(async () => {
    await db.delete(billingEventSchema);
  });

  it('appends the normalized fields for a processed event', async () => {
    await recordEvent(event());

    await expect(getBillingEvents('org_a')).resolves.toMatchObject([{
      provider: 'stripe',
      eventId: 'evt_1',
      type: 'checkout.session.completed',
      planId: 'premium',
      amount: 7900,
      currency: 'USD',
      status: 'active',
    }]);
  });

  // Gateways redeliver until they get a 2xx, so the same event id will arrive
  // more than once. It must not append a second row.
  it('is idempotent: the same event id twice writes one row', async () => {
    await recordEvent(event());
    await recordEvent(event());
    await recordEvent(event({ status: 'cancelled' })); // even with changed fields

    const rows = await getBillingEvents('org_a');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'active' }); // append-only: first write wins
  });

  it('treats the same event id from a different provider as a distinct event', async () => {
    await recordEvent(event({ provider: 'stripe' }));
    await recordEvent(event({ provider: 'razorpay' }));

    await expect(getBillingEvents('org_a')).resolves.toHaveLength(2);
  });

  it('keeps distinct events apart and scopes history by org', async () => {
    await recordEvent(event({ eventId: 'evt_1' }));
    await recordEvent(event({ eventId: 'evt_2', type: 'customer.subscription.deleted', status: 'cancelled' }));
    await recordEvent(event({ eventId: 'evt_3', orgId: 'org_b' }));

    await expect(getBillingEvents('org_a')).resolves.toHaveLength(2);
    await expect(getBillingEvents('org_b')).resolves.toHaveLength(1);
  });

  it('records an unattributable event rather than dropping it', async () => {
    await recordEvent(event({ eventId: 'evt_orphan', orgId: undefined, amount: undefined, currency: undefined }));

    const rows = await db.select().from(billingEventSchema);

    expect(rows).toMatchObject([{ orgId: null, amount: null, currency: null }]);
  });
});
