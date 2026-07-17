# 07 — E2E test coverage for core flows

**Priority:** P2 · **Effort:** ~1–2 days · **Depends on:** 01, 02

## Problem

No end-to-end coverage of any user product flow. The payment layer also has no
unit tests beyond signature verification.

## Current state

- Playwright e2e (`tests/e2e/`): `Sanity.check`, `I18n`, `Visual` — smoke/i18n/
  visual only.
- Unit: `email.test.ts` (no-op), `analytics.test.ts` (no-op), `ratelimit.test.ts`
  (no-op), `signature.test.ts`, plus a couple component tests.
- **No coverage** of auth, checkout, subscription, org scoping, or webhooks.

## Goal

Confidence that the money paths and core flows work, via a pragmatic mix of unit
tests (webhook parsing/fulfillment) and e2e (auth → checkout → billing).

## Scope

**In:**
- Unit: `parseWebhook` for both providers (valid/invalid signature, ignored
  events), `fulfill()` idempotency (upsert same `externalId` twice → one row).
- E2E: sign-in (Clerk test mode), reach pricing, start checkout (Stripe test
  card via Checkout, or stub), land on billing showing active status.
- Org scoping e2e: data created in org A is invisible in org B (pairs with spec 04).

**Out:**
- Full gateway sandbox automation if it's flaky in CI — prefer stubbing the
  gateway call and testing our routes/DB, plus one manual/gated live smoke.

## Approach

1. Payment-layer unit tests with crafted payloads + a known webhook secret
   (extend the pattern in `signature.test.ts`). Use an in-memory/PGLite DB for
   `fulfill()` idempotency.
2. Clerk testing token for authed e2e (Clerk supports test users / `@clerk/testing`).
3. For checkout e2e, decide sandbox-vs-stub (see open questions); at minimum
   assert the redirect/modal is reached and the DB row appears when the webhook
   fires (fire a synthetic signed webhook at the local route).
4. Wire new e2e into the existing Playwright config + CI (`.github/workflows/CI.yml`,
   `checkly.yml`).

## Data-model changes

None.

## Files touched

- `src/libs/payments/*.test.ts` (new unit tests)
- `tests/e2e/{Auth,Checkout,OrgScoping}.e2e.ts` (new)
- `.github/workflows/CI.yml` if extra setup/secrets needed
- `@clerk/testing` dev dependency

## Acceptance criteria

- [ ] `parseWebhook` unit tests cover valid, invalid-signature, and ignored-event cases for both gateways.
- [ ] `fulfill()` idempotency test passes (double event → one row).
- [ ] E2E: authed user reaches checkout and, after a synthetic webhook, sees active status on the billing page.
- [ ] Org-scoping e2e proves no cross-org leakage.
- [ ] CI runs the new tests green.

## Dependencies / open questions

- Live gateway sandbox in CI vs. synthetic signed webhooks. Recommend synthetic
  webhooks for determinism + one manually-run live smoke doc'd in AGENTS.md.
- Clerk test-mode credentials in CI secrets.
