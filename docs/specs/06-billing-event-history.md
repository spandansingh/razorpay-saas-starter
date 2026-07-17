# 06 — Billing-event history

**Priority:** P2 · **Effort:** ~1 day · **Depends on:** 02

## Problem

The `subscription` table keeps only the latest status per checkout — a known
limitation called out in AGENTS.md. There is no audit trail of payments,
renewals, cancellations, or failures.

## Current state

- `fulfill()` upserts a single row per `externalId` (`src/libs/payments/index.ts`).
- Webhook events beyond the ones that change status are discarded after parsing.
- No invoice/receipt persistence; no way to answer "what did this org pay, when?"

## Goal

An append-only `billing_event` log capturing every processed webhook event, plus
a read surface (history section on the billing page) and the data foundation for
receipts/invoices.

## Scope

**In:**
- `billing_event` table: provider, external event id (unique, for idempotency),
  type, orgId, amount, currency, status, raw-safe metadata, createdAt.
- Write one row per processed webhook (idempotent on the event id).
- History list on `/dashboard/billing` (date, type, amount, status).

**Out:**
- PDF invoice generation (separate spec if ever needed).
- Dunning/retry orchestration (gateways handle retries).

## Approach

1. Add `billingEventSchema`; unique on `(provider, eventId)` for idempotency —
   webhooks can redeliver.
2. In each webhook route (or a shared `recordEvent()` in `payments/`), insert the
   event before/after `fulfill()`, `onConflictDoNothing` on the unique key.
3. Store only non-sensitive fields — **never the raw signed payload or PII beyond
   what's needed** (respect the CLAUDE.md rule: don't log raw webhook payloads).
4. Billing page queries the last N events for the org.

## Data-model changes

- New `billing_event` table (see fields above) + migration.

## Files touched

- `src/models/Schema.ts` + migration
- `src/libs/payments/index.ts` (or new `events.ts`)
- `src/app/api/webhooks/{stripe,razorpay}/route.ts`
- `src/app/[locale]/(auth)/dashboard/billing/page.tsx`

## Acceptance criteria

- [ ] Every processed webhook writes exactly one `billing_event` (idempotent on redelivery).
- [ ] Billing page shows a chronological history for the active org.
- [ ] No secrets / raw payloads persisted (spot-check the stored columns).
- [ ] A test proving idempotency (same event id twice → one row).
- [ ] tests + types + lint clean; migration applies.

## Dependencies / open questions

- Extract event id from each provider's payload — confirm both are available at
  the parse step. Stripe: `event.id`; Razorpay: `x-razorpay-event-id` header / payload.
