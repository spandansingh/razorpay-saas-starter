# 08 — Payments hardening

**Priority:** P2 · **Effort:** ~half day · **Depends on:** none

## Problem

Three starter-grade shortcuts in the payments layer are documented in AGENTS.md
as known limitations. They're fine for a demo, wrong for production.

## Current state (from AGENTS.md "Known limitations")

1. **Single currency** — one `PAYMENTS_CURRENCY` for both gateways; multi-region
   pricing isn't possible.
2. **Hardcoded Razorpay `total_count: 120`** — every subscription is fixed to 120
   cycles regardless of interval/plan (`src/libs/payments/razorpay.ts`).
3. **Latest-status-only `subscription` table** — no history (addressed by spec 06;
   cross-referenced here, not re-specced).

## Goal

Per-plan currency support and a sensible subscription-duration model, so the
payments layer is production-shaped rather than demo-shaped.

## Scope

**In:**
- Per-plan currency: move currency from a single env to plan metadata
  (`planRefs.ts`), defaulting to `PAYMENTS_CURRENCY` when unset.
- Razorpay `total_count`: derive from plan config (or use a large/again-billed
  model appropriate to the interval) instead of the hardcoded 120.

**Out:**
- Full multi-region tax/VAT handling (Stripe Tax / a tax vendor — separate concern).
- FX conversion — each plan is priced in its own currency, not converted.

## Approach

1. Extend the plan reference type in `src/libs/payments/planRefs.ts` to carry
   `{ stripePriceId, razorpayPlanId, currency? }`. Checkout reads currency from
   the plan, falling back to `Env.PAYMENTS_CURRENCY`.
2. Add `totalCount?` (or `interval`-derived count) to plan config; pass it into
   the Razorpay subscription create call in `razorpay.ts`. Document the meaning.
3. Update AGENTS.md to reflect the removed limitations.

## Data-model changes

None (plan config is code/env, not a table).

## Files touched

- `src/libs/payments/planRefs.ts`, `razorpay.ts`, `stripe.ts`, `index.ts`
- `src/libs/Env.ts` (keep `PAYMENTS_CURRENCY` as the default)
- `AGENTS.md`

## Acceptance criteria

- [ ] A plan can declare its own currency; checkout uses it; unset falls back to the env default.
- [ ] Razorpay subscription `total_count` comes from plan config, not a literal 120.
- [ ] Existing single-currency setups keep working with no config change.
- [ ] AGENTS.md known-limitations updated.
- [ ] Payment unit tests (spec 07) cover the currency fallback + total_count derivation.
- [ ] tests + types + lint clean.

## Dependencies / open questions

- Best paired with spec 07 so the new branching is tested.
- Confirm Stripe price ids already encode currency (they do) — so Stripe mostly
  needs the app to *stop* assuming one global currency, while Razorpay needs the
  currency passed explicitly.
