import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { subscriptionSchema } from '@/models/Schema';

export type Subscription = typeof subscriptionSchema.$inferSelect;

// The org's current subscription: the most recently touched row that hasn't been
// cancelled. `fulfill()` writes one row per checkout, so an org that has bought
// more than once (upgrade, re-subscribe) has several — the latest one wins.
export async function getActiveSubscription(orgId: string): Promise<Subscription | null> {
  const rows = await db
    .select()
    .from(subscriptionSchema)
    .where(and(
      eq(subscriptionSchema.orgId, orgId),
      ne(subscriptionSchema.status, 'cancelled'),
    ))
    .orderBy(desc(subscriptionSchema.updatedAt))
    .limit(1);

  return rows[0] ?? null;
}
