# 03 — Role / permission gating

**Priority:** P1 · **Effort:** ~half day · **Depends on:** none

## Problem

No role or permission checks exist anywhere. Any organization member reaches
every dashboard page, and (once checkout is wired, spec 01) any member could
start or cancel billing.

## Current state

- Clerk organizations are wired (`OrganizationSwitcher`, onboarding, org-scoped
  data by `orgId`), but there is **no** use of `has()`, `<Protect>`, `orgRole`,
  or `auth().has(...)` anywhere in `src`.
- Roles are managed only inside Clerk's `<OrganizationProfile>` widget; the app
  never reads them.

## Goal

Sensitive actions (billing, org settings, member management, destructive data
ops) are gated to organization admins. Regular members get a clear "not
authorized" surface, not a broken page.

## Scope

**In:**
- Server-side gate helper wrapping Clerk `auth().has({ role })` / `has({ permission })`.
- Gate the billing page + `/api/billing/*` and `/api/checkout` mutations to `org:admin`.
- Hide admin-only nav items / buttons for non-admins (UI), backed by the server
  check (never UI-only).

**Out:**
- Custom roles beyond Clerk's `org:admin` / `org:member` (use Clerk's defaults;
  custom permissions are a Clerk dashboard config, not code).
- Per-resource ACLs.

## Approach

1. Add `src/libs/authz.ts`: `requireOrgAdmin()` (server) → throws / returns 403
   when `!auth().has({ role: 'org:admin' })`; `isOrgAdmin()` boolean for UI.
2. Apply `requireOrgAdmin()` at the top of `/api/checkout`, `/api/billing/manage`.
3. In the billing page and dashboard layout, use `isOrgAdmin()` to conditionally
   render controls; wrap admin-only pages with Clerk `<Protect role="org:admin">`
   for defense in depth.
4. Add a shared `403` / "ask your admin" component for denied states.

## Data-model changes

None — roles live in Clerk.

## Files touched

- `src/libs/authz.ts` (new)
- `src/app/api/checkout/route.ts`, `src/app/api/billing/manage/route.ts`
- `src/app/[locale]/(auth)/dashboard/billing/page.tsx`, `.../dashboard/layout.tsx`
- a small `src/features/dashboard/NotAuthorized.tsx`

## Acceptance criteria

- [ ] A non-admin member cannot reach `/dashboard/billing` mutations (server returns 403).
- [ ] Admin-only nav/buttons are hidden for members and enforced server-side.
- [ ] Denied state renders a friendly component, not a stack trace or blank page.
- [ ] One unit/e2e check proving the server gate rejects a member.
- [ ] tests + types + lint clean.

## Dependencies / open questions

- Confirm the project uses Clerk's default org roles (`org:admin`/`org:member`)
  vs. custom permissions. Recommend defaults to stay lazy; document how to switch
  to custom permissions in AGENTS.md.
