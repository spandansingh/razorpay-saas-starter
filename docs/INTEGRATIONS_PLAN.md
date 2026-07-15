# Integrations Plan — Plug-and-Play Vendors

Goal: close the vendor gaps (email, analytics, rate limiting, storage, DB
provider, deploy) while keeping the boilerplate **plug-and-play** — every
integration boots dormant and activates by setting env vars, no code edits.

## The contract (every vendor obeys all four)

This is the pattern the repo already uses for payments and Better Stack logging
([Logger.ts](../src/libs/Logger.ts) `canForwardToBetterStack`):

1. **Optional env** — keys are `.optional()` in [Env.ts](../src/libs/Env.ts); the app boots with none set.
2. **Single adapter** — one `src/libs/<vendor>.ts` (or folder) behind a tiny interface.
3. **Graceful no-op** — unconfigured → `send()` logs and returns, `capture()` does nothing, rate-limiter allows through. A missing vendor never breaks a request.
4. **Documented** — commented placeholder in `.env` + one README line.

### Plug-and-play tiers (honesty about what env-only can't do)

| Tier | Meaning | Vendors in this plan |
|---|---|---|
| **Full** — env flip, zero code | set key → live | Resend, PostHog, Upstash |
| **Config swap** — env + connection string + migrate | swap `DATABASE_URL` | Supabase / Neon Postgres |
| **Scaffold choice** — can't run two live at once | documented switch, one active | Vercel deploy, S3-vs-R2 storage |

---

## Phase 1 — Full plug-and-play (highest ROI, pure adapters)

### 1a. Transactional email — Resend
- **New**: `src/libs/email.ts` — `sendEmail({to, subject, react/html})`. If `RESEND_API_KEY` unset → `logger.info('email skipped (no RESEND_API_KEY)')` and return `{skipped:true}`.
- **Env**: `RESEND_API_KEY?`, `EMAIL_FROM?` (default `onboarding@resend.dev` for dev).
- **Dep**: `resend`. Optional: `@react-email/components` for templates.
- **Wire points**: Clerk webhook (welcome email on user.created), payment `fulfill()` (receipt) — both call `sendEmail`, both no-op cleanly if unconfigured.
- **Test**: one assert — `sendEmail` returns `{skipped:true}` when key absent.
- **Tier**: Full. **Effort**: ~1–2h.

### 1b. Product analytics — PostHog
- **New**: `src/libs/analytics.ts` — server `capture(event, props)` via `posthog-node`; no-op when `NEXT_PUBLIC_POSTHOG_KEY` unset. Client provider in `src/app/[locale]/layout.tsx` rendered only when the key exists.
- **Env**: `NEXT_PUBLIC_POSTHOG_KEY?`, `NEXT_PUBLIC_POSTHOG_HOST?` (default `https://us.i.posthog.com`).
- **Dep**: `posthog-js`, `posthog-node`.
- **Wire points**: capture `checkout_started`, `subscription_active` in payment flow.
- **Tier**: Full. **Effort**: ~2h.

### 1c. Rate limiting — Upstash (webhooks + API)
- **New**: `src/libs/ratelimit.ts` — `@upstash/ratelimit` + `@upstash/redis`. If `UPSTASH_REDIS_REST_URL` unset → `limit()` returns `{success:true}` (allow-through). Apply to the **checkout API only**, keyed per user.
- **Env**: `UPSTASH_REDIS_REST_URL?`, `UPSTASH_REDIS_REST_TOKEN?`.
- **Dep**: `@upstash/ratelimit`, `@upstash/redis`.
- **Do not rate limit the payment webhooks.** Signature verification is their security boundary — an attacker without the secret cannot forge an event, and the HMAC check is cheaper than a Redis round-trip. Stripe/Razorpay deliver from a small IP pool, so an IP-keyed limit shares one bucket across every customer's events and 429s your own revenue path under load. Volumetric protection belongs at the edge (Vercel/Cloudflare).
- **Test**: assert `limit()` allows through when unconfigured.
- **Tier**: Full. **Effort**: ~1–2h.

---

## Phase 2 — Config-swap (DB provider commitment)

### 2. Managed Postgres — Supabase or Neon
- **No code change** — repo already uses `pg` + Drizzle ([DB.ts](../src/libs/DB.ts)). Production = swap `DATABASE_URL` to a Neon/Supabase connection string; local stays PGLite.
- **Deliverable**: doc block in `.env.production` + README section "Production database" with the two options and the `npm run db:migrate` step. Optionally add `?sslmode=require` handling note.
- **Decision needed**: recommend **Neon** (closest to existing Postgres assumptions, serverless, no extra SDK). Supabase only if you also want its auth/storage — but auth is already Clerk, so Neon is the lazy correct pick.
- **Tier**: Config swap. **Effort**: ~30min (docs only).

---

## Phase 3 — Scaffold-choice (pick one, document the switch)

### 3a. File storage — Cloudflare R2 or S3 (choose one)
- **New**: `src/libs/storage.ts` — `putObject`/`getSignedUrl` via `@aws-sdk/client-s3` (works for both S3 and R2 via endpoint). No-op/throw-at-use when unconfigured.
- **Env**: `STORAGE_ENDPOINT?`, `STORAGE_BUCKET?`, `STORAGE_ACCESS_KEY?`, `STORAGE_SECRET_KEY?`.
- **Recommend**: R2 (no egress fees) — but only build when there's an actual upload feature. **YAGNI until then.**
- **Tier**: Scaffold choice. **Effort**: ~2–3h. **Defer** unless a file-upload feature is planned.

### 3b. Deploy target — Vercel
- **New**: minimal `vercel.json` (or rely on zero-config) + README "Deploy" section. Add `NEXT_PUBLIC_APP_URL` guidance and note the Checkly production checks already assume a deployed URL.
- **Tier**: Scaffold choice. **Effort**: ~30min.

---

## Explicitly skipped (YAGNI — add when a real need appears)

- **Search** (Algolia/Meilisearch) — no searchable content model yet.
- **Feature flags** — PostHog already ships flags; use those if needed, no separate vendor.
- **Web analytics** (GA/Plausible) — PostHog covers product + basic web analytics.
- **Support chat** (Intercom/Crisp) — trivial `<script>` drop-in later, not boilerplate-critical.
- **Twilio/SMS** — product-specific, not a generic SaaS need.

---

## Suggested order & sizing

| Order | Item | Tier | Effort | Blocks anything? |
|---|---|---|---|---|
| 1 | Resend email | Full | 1–2h | No |
| 2 | PostHog analytics | Full | ~2h | No |
| 3 | Upstash rate limit | Full | 1–2h | No |
| 4 | DB provider docs (Neon) | Config swap | ~30m | No |
| 5 | Vercel deploy docs | Scaffold | ~30m | No |
| 6 | R2/S3 storage | Scaffold | 2–3h | Defer to a feature |

Phase 1 (items 1–3) is the meaningful "batteries-included" upgrade and is
~4–6h total. Each item is independent — can ship as separate PRs.

## Definition of done (per item)

- Adapter file added, keys `.optional()` in `Env.ts` + `runtimeEnv`.
- App still boots and `npm run test` / `npm run check:types` pass with **no** new env set.
- Setting the env vars activates the vendor with no code change.
- `.env` placeholder + README line added.
- One runnable assert proving the no-op path (for non-trivial adapters).
