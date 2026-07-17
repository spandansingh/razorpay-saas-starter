# 09 — File storage / uploads

**Priority:** P3 (deferred) · **Effort:** ~1 day · **Depends on:** none

## Problem

No object storage or file-upload capability — no avatars, attachments, or
exports. Deferred from the integrations plan under YAGNI: build only when a real
upload feature exists.

## Current state

- No S3/R2/Uploadthing/Vercel Blob dependency or code.
- The integrations plan ([../INTEGRATIONS_PLAN.md](../INTEGRATIONS_PLAN.md))
  marks this "scaffold choice — pick one, document the switch."

## Goal

A plug-and-play `storage.ts` adapter (same contract as email/analytics/ratelimit)
plus one real consumer — org/user avatar upload — so the pattern is demonstrated,
not just scaffolded.

## Scope

**In:**
- `src/libs/storage.ts` — `putObject`, `getSignedUploadUrl`, `getPublicUrl` via
  `@aws-sdk/client-s3` (endpoint-configurable → works for both S3 and Cloudflare R2).
- Unconfigured → throw a clear error at use-time (uploads can't silently no-op the
  way analytics can; a caller must know it failed). Boots fine without keys.
- One consumer: avatar upload on the user or org profile, using presigned URLs
  (client uploads directly; server only signs).

**Out:**
- Image processing/resizing (a later concern or an edge/CDN transform).
- Multiple providers active at once (pick one via env; document R2 vs S3).

## Approach

1. `storage.ts` reads `STORAGE_ENDPOINT / BUCKET / ACCESS_KEY / SECRET_KEY`
   (all `.optional()` in `Env.ts`). Lazy S3 client.
2. `POST /api/uploads/sign` (authed, org-scoped) returns a presigned PUT URL for a
   validated content-type/size; key namespaced by `orgId`.
3. Client uploads to the URL, then saves the resulting object key/URL (Clerk
   profile image API, or a new column if storing org assets locally).
4. README + `.env`/`.env.production` doc block; recommend R2 (no egress fees).

## Data-model changes

- None if using Clerk's avatar API; if storing org-level assets, a nullable
  `logoUrl`/`avatarKey` column on the relevant table + migration.

## Files touched

- `src/libs/storage.ts` (new), `src/libs/Env.ts`
- `src/app/api/uploads/sign/route.ts` (new)
- a profile/settings UI component for the upload
- `.env`, `.env.production`, `README.md`

## Acceptance criteria

- [ ] App boots with no storage env set; upload route returns a clear error when unconfigured.
- [ ] With R2/S3 configured, a user uploads an avatar via presigned URL and it displays.
- [ ] Uploads validate content-type + size server-side before signing.
- [ ] Object keys are namespaced per org (no cross-tenant key collisions).
- [ ] tests + types + lint clean.

## Dependencies / open questions

- Store avatars in Clerk (simplest, no schema) or self-host in R2? Recommend
  Clerk for user avatars; use the adapter for org logos / feature attachments —
  i.e. build this spec only when such a feature is actually requested.
