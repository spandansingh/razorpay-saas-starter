# 01 — Wire checkout to the pricing UI

**Priority:** P0 · **Effort:** ~half day · **Depends on:** none

## Problem

The dual Stripe + Razorpay checkout engine works end to end at the API layer,
but no UI reaches it. The repo's headline feature is unreachable in the running
app.

## Current state

- `src/features/billing/CheckoutButton.tsx` exists and correctly POSTs to
  `/api/checkout`, handles the Razorpay modal, and calls
  `/api/checkout/razorpay/verify` — **but it is imported nowhere.**
- `src/templates/Pricing.tsx` renders `PricingCard`s whose CTA is a plain
  `<Link href="/sign-up">`, not `CheckoutButton`.
- `POST /api/checkout` (`src/app/api/checkout/route.ts`) requires an authed user
  with an active org, takes `{ provider, mode, planId }`, and is rate limited
  per user.

## Goal

A signed-in user on the pricing page (or an in-dashboard upgrade page) can click
a plan and complete payment through either gateway, landing back in the app with
their subscription recorded.

## Scope

**In:**
- Mount `CheckoutButton` in the pricing cards for authed users.
- Provider selection (Stripe vs Razorpay) — a toggle or two buttons per plan.
- Signed-out users: CTA routes to `/sign-up?redirect=/dashboard/billing` so they
  return to a purchase surface after auth.
- Success/cancel URLs point at a real dashboard route (billing page from spec 02;
  until then, `/dashboard`).

**Out:**
- The billing/status page itself (spec 02).
- Plan/price configuration UI — plan ids stay env-driven (`planRefs.ts`).

## Approach

1. In `Pricing.tsx` / `PricingCard`, branch on auth state (`useAuth` /
   server-side `auth()`): signed-out → `/sign-up?redirect=…`; signed-in →
   `<CheckoutButton provider planId mode>`.
2. Decide provider selection UX. Lazy default: show both gateways only if both
   are configured (`NEXT_PUBLIC_RAZORPAY_KEY_ID` present, Stripe key present);
   if only one is configured, render a single button. This reuses the
   plug-and-play env pattern — no dead buttons for unconfigured gateways.
3. Map each pricing tier to its `planId` via existing `src/libs/payments/planRefs.ts`.
4. Confirm `successUrl`/`cancelUrl` are absolute (use `NEXT_PUBLIC_APP_URL`).

## Data-model changes

None.

## Files touched

- `src/templates/Pricing.tsx`, `src/features/billing/PricingCard.tsx` (or wherever the card lives)
- `src/features/billing/CheckoutButton.tsx` (props/exports if needed)
- possibly a small `src/features/billing/PlanCheckout.tsx` wrapper resolving provider availability

## Acceptance criteria

- [ ] Signed-in user clicks a paid plan → reaches Stripe Checkout or the Razorpay modal.
- [ ] Completing payment records a row in `subscription` (verify via webhook path).
- [ ] Signed-out user clicking a plan lands on sign-up, then returns to the purchase surface.
- [ ] A gateway with no env keys shows no button for that gateway (no broken path).
- [ ] `npm run test` + `check:types` + lint clean.

## Dependencies / open questions

- Where should the buy flow live — the public `/` pricing section, an in-dashboard
  `/dashboard/billing` upgrade panel, or both? Recommendation: both share one
  `PlanCheckout` component; public pricing gates on auth, dashboard assumes it.
- Provider selection UX: per-plan toggle vs. a global "pay with" switch. Recommend
  per-plan buttons for the ≤2 gateway case.
