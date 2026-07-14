# AGENTS.md

Guidance for AI coding agents (Codex, Claude Code, Cursor, etc.) working in this repo.
Read this before touching payments, auth, or the database.

## Stack

- Next.js 16 (App Router) + React 19, TypeScript
- Clerk for auth (organizations + users). `auth()` in server code returns `{ userId, orgId }`.
- Drizzle ORM over Postgres (PGLite locally, no Docker). Schema: `src/models/Schema.ts`.
- Tailwind + shadcn/ui.

## Commands

- `npm run dev` — start dev (boots local PGLite + Next).
- `npm run test` — Vitest unit tests.
- `npm run check:types` — tsc, no emit.
- `npm run db:generate` — generate a Drizzle migration after editing `Schema.ts`.
- `npm run lint:fix` — eslint autofix. Match existing style; don't reformat unrelated code.

## Payments (Stripe + Razorpay)

Both gateways are first-class — neither is the "default". They sit behind one
interface so the app doesn't branch on provider except at the very edges.

- `src/libs/payments/types.ts` — the `PaymentProvider` interface + shared types.
- `src/libs/payments/stripe.ts`, `razorpay.ts` — the two implementations.
- `src/libs/payments/index.ts` — `getProvider(name)` + `fulfill(event)` (idempotent DB upsert).
- `src/libs/payments/planRefs.ts` — maps internal plan names → each gateway's price/plan id (from env).
- `src/libs/payments/signature.ts` — Razorpay HMAC verification (unit-tested).

Both **one-time** (`mode: 'payment'`) and **recurring** (`mode: 'subscription'`) are supported.

### Flow

1. Client `<CheckoutButton provider planId mode>` → `POST /api/checkout`.
2. Stripe returns `{ kind: 'redirect', url }` → browser redirects to hosted checkout.
   Razorpay returns `{ kind: 'razorpay_modal', ... }` → client opens the Razorpay modal.
3. Razorpay modal success → `POST /api/checkout/razorpay/verify` (signature check, immediate fulfill).
4. Source of truth: webhooks at `/api/webhooks/stripe` and `/api/webhooks/razorpay`
   both normalize to `NormalizedEvent` and call `fulfill()`. `fulfill()` is idempotent
   (unique `external_id`), so the verify route and the webhook can both fire safely.

### Adding a plan

1. Add it to `src/utils/PricingPlans.ts`.
2. Create the price (Stripe) and plan (Razorpay) in each dashboard.
3. Add their ids to env (`STRIPE_PRICE_*`, `RAZORPAY_PLAN_*`) and wire them in `planRefs.ts`.

### Rules for agents

- **Never** log or echo secret keys or webhook payloads containing signatures.
- Webhook routes must read the **raw** request body (`req.text()`) — parsing first breaks signature checks.
- Keep new gateway logic inside a `PaymentProvider` implementation; don't scatter `if (provider === ...)` through the app.
- Payments is a money path: keep signature verification; don't "simplify" it away.

## Known limitations (starter-grade, upgrade when needed)

- Single `PAYMENTS_CURRENCY` for both gateways. Real multi-region needs per-plan currency.
- Razorpay subscriptions use a fixed `total_count: 120`. Tune per plan interval.
- `subscription` table stores the latest status per checkout; no full billing-event history.
