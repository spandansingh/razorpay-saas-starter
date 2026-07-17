# Implementation Plan — Remaining Build

Sequences the nine specs in [docs/specs/](specs/) into ordered, shippable phases.
Specs say *what*; this says *in what order, gated by what*. Each phase is an
independently mergeable increment that leaves the app working and tested.

## Critical path

```
01 checkout UI ─▶ 02 billing page ─▶ 06 billing history
                      │                    07 e2e ◀── (needs 01+02)
                      ▼
                 03 role gating          08 hardening ── pairs with 07
04 demo CRUD (parallel, pairs with 03)
05 emails (parallel, any time)
09 storage (deferred — build on demand)
```

**Do 01 → 02 → 03 first.** Until then the payments engine — the repo's reason to
exist — is unreachable, and the receipt/analytics wiring already in the webhooks
never fires because nobody can pay.

## Rules for every phase (carry the existing conventions)

- Follow AGENTS.md before touching payments/auth/DB. Never log secrets or raw
  webhook payloads; webhook routes use the raw body.
- Every schema change: edit `src/models/Schema.ts` → `npm run db:generate` →
  commit the generated migration. Confirm it applies (`npm run dev` runs migrate).
- Gate each merge on `npm run test` + `npm run check:types` + scoped `eslint`.
- New non-trivial logic leaves one runnable check (unit or e2e). No frameworks
  beyond Vitest/Playwright already here.
- Keep the plug-and-play contract: a feature depending on an unconfigured vendor
  degrades gracefully, it doesn't crash a request.

---

## Phase 1 — Make payments work (P0)  ·  ~2–2.5 days

Specs: **01**, **02**, **03**. Ships the whole money loop: pay → see status →
cancel, admin-gated.

### 1.1 — Wire checkout (spec 01)
1. Map pricing tiers → plan ids via `src/libs/payments/planRefs.ts`.
2. New `src/features/billing/PlanCheckout.tsx`: resolves which gateways are
   configured (env presence), renders `CheckoutButton` per available provider.
3. `Pricing.tsx` / `PricingCard`: signed-in → `<PlanCheckout>`; signed-out →
   `/sign-up?redirect=/dashboard/billing`.
4. Absolute success/cancel URLs from `NEXT_PUBLIC_APP_URL`.
5. **Check:** manual — signed-in click reaches Stripe Checkout / Razorpay modal;
   completing it writes a `subscription` row via the webhook.

### 1.2 — Schema prep for management
6. Add `customerId text` (nullable) to `subscription`; populate in
   `parseWebhook`/`fulfill` for both providers. `db:generate` + migration.

### 1.3 — Billing page + manage (spec 02)
7. `getActiveSubscription(orgId)` query in `src/libs/payments/queries.ts`.
8. `/dashboard/billing/page.tsx` (server): render plan/status, or empty-state →
   `<PlanCheckout>`. Add the **Billing** nav link in `dashboard/layout.tsx`.
9. Extend `PaymentProvider` with `manage()`: Stripe → billing-portal session;
   Razorpay → `subscriptions.cancel(..., cancel_at_cycle_end)`.
10. `POST /api/billing/manage` (authed, org-scoped) dispatching to the provider.
11. **Check:** unit — `getActiveSubscription` returns latest non-cancelled row;
    manual — open Stripe portal, cancel, status reflects back.

### 1.4 — Role gating (spec 03)
12. `src/libs/authz.ts`: `requireOrgAdmin()` (server 403), `isOrgAdmin()` (UI).
13. Apply `requireOrgAdmin()` to `/api/checkout` + `/api/billing/manage`.
14. Hide admin-only controls for members (backed by the server check); add
    `NotAuthorized.tsx` denied state; wrap billing page in `<Protect>`.
15. **Check:** unit/e2e — a member hitting `/api/billing/manage` gets 403.

**Phase 1 DoD:** an admin can buy, view, and cancel a subscription through the UI;
a non-admin cannot mutate billing; suite + types + lint green; migration applies.

---

## Phase 2 — Product substance (P1)  ·  ~1 day

Spec: **04**. A real org-scoped feature so adopters have a pattern to copy.

1. Extend `todo` with `orgId text not null` + index; `db:generate` + migration.
2. `src/features/todos/actions.ts` — `create/update/delete`, each resolving
   `orgId` from `auth()`, Zod-validated, org-scoped. Never trust client `orgId`.
3. `TodoList.tsx` with `useOptimistic`; mount on `/dashboard` (replace the
   placeholder) or `/dashboard/todos`. i18n strings in `src/locales/en.json`.
4. **Check:** test the org-scoping guard (foreign `orgId` rejected; org A data
   invisible to org B).

**Phase 2 DoD:** working CRUD scoped to the active org, no cross-org leakage,
guard test green.

---

## Phase 3 — Polish & trust (P2)  ·  ~2 days

Specs **05**, **06**, **08** — independent, can go in any order or parallel.

### 3a — React Email (spec 05)
- `@react-email/components` + `@react-email/render`; `src/emails/_layout` +
  `WelcomeEmail` + `ReceiptEmail`; `renderEmail()` → `{html,text}`; update the 3
  webhook call sites. Keep `sendEmail` no-op intact.

### 3b — Billing-event history (spec 06, needs Phase 1)
- `billing_event` table, unique `(provider, eventId)`; `recordEvent()` inserts
  idempotently per webhook (`onConflictDoNothing`); history list on billing page.
  Store no secrets/raw payloads.
- **Check:** same event id twice → one row.

### 3c — Payments hardening (spec 08)
- Per-plan `currency?` in `planRefs` (fallback `PAYMENTS_CURRENCY`); Razorpay
  `total_count` from plan config, not the literal 120. Update AGENTS.md
  known-limitations.

**Phase 3 DoD:** branded emails; auditable billing history (idempotent); per-plan
currency + configurable subscription length; AGENTS.md updated.

---

## Phase 4 — Lock it down (P2)  ·  ~1–2 days

Spec **07** — do once the flows from Phases 1–2 exist so tests hit real surfaces.

1. Payment-layer unit tests: `parseWebhook` (valid / invalid-sig / ignored) both
   providers; `fulfill()` idempotency on PGLite.
2. E2E (`@clerk/testing`): auth → pricing → checkout → synthetic signed webhook →
   billing shows active. Org-scoping e2e (pairs with Phase 2).
3. Wire into `.github/workflows/CI.yml`; secrets for Clerk test mode.

**Phase 4 DoD:** money-path unit tests + core-flow e2e green in CI; synthetic
webhook drives fulfillment deterministically (no flaky live gateway in CI).

---

## Phase 5 — Deferred (P3)

Spec **09** (file storage). Build **only** when a concrete upload feature is
requested — adapter + presigned-URL route + one real consumer. Until then, YAGNI.

---

## Effort roll-up

| Phase | Specs | Effort | Outcome |
|---|---|---|---|
| 1 | 01, 02, 03 | ~2–2.5d | payments actually work, admin-gated |
| 2 | 04 | ~1d | org-scoped CRUD example |
| 3 | 05, 06, 08 | ~2d | emails, history, hardening |
| 4 | 07 | ~1–2d | tested money path + flows |
| 5 | 09 | ~1d | deferred until needed |

~6–8.5 days for Phases 1–4. Phase 1 is the one that changes the repo from
"demo with dead payment code" to "working SaaS starter" — everything else builds
on a working money loop.

## Migrations introduced (in order)

1. `subscription.customerId` (Phase 1.2)
2. `todo.orgId` + index (Phase 2)
3. `billing_event` table (Phase 3b)
4. *(only if org-level assets)* `logoUrl`/`avatarKey` (Phase 5)

Generate each with `npm run db:generate`; never hand-edit applied migrations.
