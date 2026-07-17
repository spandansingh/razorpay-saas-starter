# 02 — Subscription management (billing page)

**Priority:** P0 · **Effort:** ~1 day · **Depends on:** 01

## Problem

The `subscription` table is written by webhooks but never read. A customer has
no way to see their plan, and no way to cancel or manage it.

## Current state

- `src/libs/payments/index.ts` `fulfill()` upserts into `subscriptionSchema`
  (one row per checkout, latest status only).
- No route reads it. Dashboard nav (`src/app/[locale]/(auth)/dashboard/layout.tsx`)
  has Home / Members / Settings — **no Billing link.**
- Cancellation currently only happens inbound (webhook sets status), with no way
  for a user to initiate it.

## Goal

A `/dashboard/billing` page showing the org's current plan and status, with a way
to cancel (or open the gateway's customer portal), plus an upgrade path reusing
spec 01's checkout.

## Scope

**In:**
- `/dashboard/billing` route + nav link.
- Read current `subscription` for the active org; render plan, status, provider.
- Cancel action:
  - Stripe → open Stripe Billing Portal (hosted; least code, handles cancel/upgrade/invoices).
  - Razorpay → call the subscriptions cancel API (no hosted portal), or link to
    the receipt/management email flow.
- "No active subscription" empty state → upgrade CTA (spec 01).

**Out:**
- Full invoice history UI (spec 06).
- Proration / mid-cycle plan changes beyond what the Stripe portal gives for free.

## Approach

1. Add a `getActiveSubscription(orgId)` query in `src/libs/payments/` (or a
   `queries.ts`), returning the latest non-cancelled row.
2. Server component page renders it; empty → `<PlanCheckout>` from spec 01.
3. Extend `PaymentProvider` interface (`src/libs/payments/types.ts`) with an
   optional `manage(subscription)` capability:
   - Stripe: `createBillingPortalSession({ customer, return_url })` → redirect.
   - Razorpay: `subscriptions.cancel(subId)` (guarded; Razorpay one-time orders
     have nothing to manage).
4. New route `POST /api/billing/manage` (authed, org-scoped) that dispatches to
   the provider. Reuse the checkout route's auth+org resolution.

## Data-model changes

- `subscription` likely needs the gateway **customer id** stored to open the
  Stripe portal (Stripe portal keys on `customer`, not the checkout session).
  Add `customerId text` (nullable) and populate it in `parseWebhook`/`fulfill`.

## Files touched

- `src/app/[locale]/(auth)/dashboard/billing/page.tsx` (new)
- `src/app/[locale]/(auth)/dashboard/layout.tsx` (nav link)
- `src/app/api/billing/manage/route.ts` (new)
- `src/libs/payments/{types,index,stripe,razorpay}.ts`
- `src/models/Schema.ts` + a migration (`npm run db:generate`)

## Acceptance criteria

- [ ] `/dashboard/billing` shows current plan + status for the active org.
- [ ] Stripe customer can open the billing portal and cancel; status reflects back via webhook.
- [ ] Razorpay subscription can be cancelled; one-time orders show a sensible read-only state.
- [ ] Empty state offers a working upgrade (spec 01).
- [ ] Only org admins see cancel controls (see spec 03; until then, any member).
- [ ] tests + types + lint clean; a migration is generated and applies.

## Dependencies / open questions

- Requires storing `customerId` — confirm both providers expose it in the webhook
  payloads already parsed.
- Should cancel be immediate or at period end? Recommend Stripe portal default
  (period end); Razorpay `cancel_at_cycle_end: true`.
