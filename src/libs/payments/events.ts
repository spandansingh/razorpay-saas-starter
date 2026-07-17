import type { NormalizedEvent } from './types';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { billingEventSchema } from '@/models/Schema';

export type BillingEvent = typeof billingEventSchema.$inferSelect;

/**
 * Append one row per processed webhook.
 *
 * Idempotent: gateways redeliver until they get a 2xx, and the Razorpay verify
 * route can race the webhook for the same event. The unique (provider, eventId)
 * key turns a repeat into a no-op rather than a duplicate row.
 *
 * Only the normalized, non-sensitive fields are stored — never the raw payload.
 */
export async function recordEvent(event: NormalizedEvent): Promise<void> {
  await db
    .insert(billingEventSchema)
    .values({
      provider: event.provider,
      eventId: event.eventId,
      type: event.type,
      orgId: event.orgId ?? null,
      planId: event.planId ?? null,
      amount: event.amount ?? null,
      currency: event.currency ?? null,
      status: event.status,
    })
    .onConflictDoNothing({
      target: [billingEventSchema.provider, billingEventSchema.eventId],
    });
}

/** The org's billing history, newest first. */
export async function getBillingEvents(orgId: string, limit = 20): Promise<BillingEvent[]> {
  return db
    .select()
    .from(billingEventSchema)
    .where(eq(billingEventSchema.orgId, orgId))
    .orderBy(desc(billingEventSchema.createdAt))
    .limit(limit);
}
