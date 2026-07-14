import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// The generated migration file will reflect your schema changes.
// It automatically run the command `db-server:file`, which apply the migration before Next.js starts in development mode,
// Alternatively, if your database is running, you can run `npm run db:migrate` and there is no need to restart the server.

// Need a database for production? Check out https://get.neon.com/BMFYNtx
// Tested and compatible with SaaS Boilerplate

export const todoSchema = pgTable('todo', {
  id: serial('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// Single table for both Stripe and Razorpay. `provider` says which gateway,
// `externalId` is that gateway's subscription/order/payment id (unique so
// webhooks can upsert idempotently). One row per checkout, keyed by org.
export const subscriptionSchema = pgTable('subscription', {
  id: serial('id').primaryKey(),
  orgId: text('org_id').notNull(),
  provider: text('provider').notNull(), // 'stripe' | 'razorpay'
  externalId: text('external_id').notNull().unique(),
  planId: text('plan_id').notNull(),
  mode: text('mode').notNull(), // 'payment' (one-time) | 'subscription' (recurring)
  status: text('status').notNull(), // 'active' | 'paid' | 'cancelled' | 'failed'
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});
