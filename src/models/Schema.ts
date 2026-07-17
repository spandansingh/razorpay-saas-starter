import type { NormalizedEvent, PaymentMode, ProviderName } from '@/libs/payments/types';
import { index, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// The generated migration file will reflect your schema changes.
// It automatically run the command `db-server:file`, which apply the migration before Next.js starts in development mode,
// Alternatively, if your database is running, you can run `npm run db:migrate` and there is no need to restart the server.

// Need a database for production? Check out https://get.neon.com/BMFYNtx
// Tested and compatible with SaaS Boilerplate

// Org-scoped: every read and write filters on `orgId`, which always comes from
// the session and never from the client. `ownerId` records who created the row.
export const todoSchema = pgTable('todo', {
  id: serial('id').primaryKey(),
  orgId: text('org_id').notNull(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [
  // Every query filters by org, so the index carries the whole access pattern.
  index('todo_org_id_idx').on(table.orgId),
]);

// Single table for both Stripe and Razorpay. `provider` says which gateway,
// `externalId` is that gateway's subscription/order/payment id (unique so
// webhooks can upsert idempotently). One row per checkout, keyed by org.
export const subscriptionSchema = pgTable('subscription', {
  id: serial('id').primaryKey(),
  orgId: text('org_id').notNull(),
  // Stored as text; typed here so readers get the union instead of a bare string.
  provider: text('provider').$type<ProviderName>().notNull(),
  externalId: text('external_id').notNull().unique(),
  planId: text('plan_id').notNull(),
  mode: text('mode').$type<PaymentMode>().notNull(), // one-time | recurring
  status: text('status').$type<NormalizedEvent['status']>().notNull(),
  // The gateway's own customer id. Nullable: not every event carries one, and
  // Razorpay one-time orders have no customer. Needed to open the Stripe portal,
  // which keys on the customer rather than the checkout session.
  customerId: text('customer_id'),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});
