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

Each `planRefs.ts` entry may also declare:

- `currency` — this plan's own currency. Unset falls back to `PAYMENTS_CURRENCY`,
  so single-currency setups need no config. Stripe price ids already encode their
  currency; Razorpay needs it passed explicitly.
- `totalCount` — how many cycles a Razorpay subscription runs for. Razorpay has no
  "until cancelled", so it needs a finite count up front. Unset defaults to 120
  (ten years monthly). A yearly plan wants ~10, not 120.

A gateway is only offered for a plan when its keys **and** that plan's id for it are
present (`providersFor`), so an unconfigured gateway renders no button rather than
one that fails at the API.

### Rules for agents

- **Never** log or echo secret keys or webhook payloads containing signatures.
- Webhook routes must read the **raw** request body (`req.text()`) — parsing first breaks signature checks.
- Keep new gateway logic inside a `PaymentProvider` implementation; don't scatter `if (provider === ...)` through the app.
- Payments is a money path: keep signature verification; don't "simplify" it away.

## Data model

- `subscription` — latest status per checkout, one row per `externalId`, keyed by org.
- `billing_event` — append-only audit trail, one row per processed webhook, unique
  on `(provider, eventId)` so redeliveries don't duplicate. Stores only normalized,
  non-sensitive columns: **never the raw payload or signature**.
- `todo` — the org-scoped CRUD reference (`src/features/todos/`). The pattern to
  copy: `orgId` comes from `auth()`, never the client, and every mutation matches
  on `(id AND orgId)`.

## Auth & roles

`src/libs/authz.ts` wraps Clerk's default org roles:

- `requireOrgAdmin()` — server gate; returns a 401/403 response or the resolved
  `{ userId, orgId }`. Used by `/api/checkout` and `/api/billing/manage`.
- `isOrgAdmin()` — boolean for UI. Never the only guard; always pair it with the
  server check.

To switch to Clerk **custom permissions**, define the permission in the Clerk
dashboard and swap `{ role: 'org:admin' }` for `{ permission: 'org:billing:manage' }`
inside `authz.ts` — no other file reads roles.

## Testing

`tests/helpers/testDb.ts` is an in-memory PGlite migrated from the real
`migrations/` folder. Swap it in with
`vi.mock('@/libs/DB', () => import('<rel>/tests/helpers/testDb'))` to test DB code
against real SQL with no server. `npm run test` needs no live database.

`tests/helpers/webhooks.ts` builds **synthetic signed webhooks** for both gateways.
Both signatures are plain HMAC over the raw body, so they are computable offline —
the money path is tested deterministically with no live gateway and no real keys.
Test `Env` is mocked per file; those secrets are fixtures, not credentials. Never
point the suite at a live sandbox: it is slower, flakier, and proves nothing extra
about our own parsing.

Not covered: authed end-to-end flows (sign-in → checkout → billing) need a real
Clerk test instance (`@clerk/testing` + `CLERK_SECRET_KEY`). The webhook route test
covers the same server path — signature → parse → fulfil → audit log — without one.

## Emails

`src/emails/` holds React Email templates. Adding one = a component plus a small
`render*()` function returning `{ subject, html, text }`; the route then calls
`sendEmail({ to, ...rendered })`. Keeping the JSX inside `src/emails/` is what lets
the API routes stay `.ts`. `sendEmail` still no-ops without `RESEND_API_KEY`.

Email clients support neither CSS variables nor `oklch()`, so `EmailLayout.tsx`
mirrors the design tokens as hex — keep them in step with `src/styles/global.css`.

## Object storage

`src/libs/storage.ts` is an S3-compatible adapter (AWS S3, Cloudflare R2 — the
endpoint is configurable; R2 is the lazy default: same API, no egress fees) with
`POST /api/uploads/sign` handing the browser a short-lived presigned PUT so files
never pass through this server.

It breaks the plug-and-play no-op convention on purpose: email and analytics
silently skip when unconfigured, but an upload that quietly did nothing would look
like success and lose the user's file. The app still boots with no storage env —
nothing runs at import — and callers check `isStorageConfigured()` to return a
clear error; the unconfigured path throws.

Because the presigned URL bypasses the server, the sign route is the only gate:
it validates content-type and size before signing, and builds the key from the
session's `orgId` with a sanitised filename (`orgObjectKey`).

**Scaffold only** — there is no UI consumer yet. Per spec 09, build one when a
real upload feature is requested; Clerk already handles user avatars, so the
adapter is for org logos and attachments.

## Known limitations (starter-grade, upgrade when needed)

- No proration or mid-cycle plan changes beyond what the Stripe portal gives free.
- Razorpay one-time orders can't be cancelled or refunded from the app.
- `billing_event` stores no line items or tax breakdown — enough for an audit
  trail, not enough to render an invoice.
- The public pricing page can't mount checkout: marketing routes sit outside
  `ClerkProvider`/`clerkMiddleware`, so auth state is unknowable there. Its CTA
  routes to sign-up, and `/dashboard/billing` is the purchase surface.
