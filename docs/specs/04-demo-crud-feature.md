# 04 — Demo org-scoped CRUD feature

**Priority:** P1 · **Effort:** ~1 day · **Depends on:** none (pairs with 03)

## Problem

There is no working example of the multi-tenant, org-scoped data pattern. A
`todo` table is defined but has zero references — the dashboard is a static
placeholder. Adopters have nothing to copy when building their first real
feature.

## Current state

- `src/models/Schema.ts` defines `todo` (`id, ownerId, title, message,
  timestamps`) — **unused everywhere.**
- `src/app/[locale]/(auth)/dashboard/page.tsx` renders a static marketing
  placeholder, no data.

## Goal

A small, real CRUD feature (todos/notes) scoped to the active organization,
demonstrating: server actions or route handlers, Drizzle queries, org scoping,
optimistic UI, validation, and role gating (create/delete = member+, per spec 03).

## Scope

**In:**
- List / create / edit / delete todos for the active org.
- Scope every query by `orgId` (switch `todo.ownerId` semantics to org, or add
  `orgId`); enforce the signed-in user belongs to that org.
- Zod validation on inputs; empty/loading/error states.
- Wire it into `/dashboard` (replace the placeholder) or a `/dashboard/todos` route.

**Out:**
- Real-time sync, pagination beyond a simple limit, rich text.

## Approach

1. Extend `todoSchema`: add `orgId text not null` (keep `ownerId` for "created
   by"); index on `orgId`. Migration via `npm run db:generate`.
2. Server actions in `src/features/todos/actions.ts` (`createTodo`, `updateTodo`,
   `deleteTodo`) — each resolves `orgId` from `auth()`, validates with Zod,
   scopes the query. Never trust a client-supplied `orgId`.
3. `src/features/todos/TodoList.tsx` (client) with `useOptimistic` for add/remove.
4. Page renders the list server-side, actions mutate + `revalidatePath`.

## Data-model changes

- `todo`: add `orgId text not null` + index. Backfill not needed (table empty).

## Files touched

- `src/models/Schema.ts` + migration
- `src/features/todos/{actions.ts,TodoList.tsx,TodoItem.tsx}` (new)
- `src/app/[locale]/(auth)/dashboard/page.tsx` (or new `dashboard/todos/page.tsx`)
- i18n messages in `src/locales/en.json`

## Acceptance criteria

- [ ] A user creates/edits/deletes todos; they persist and are scoped to the active org.
- [ ] Switching orgs shows a different todo set; no cross-org leakage (queries filter by `orgId`).
- [ ] Server actions reject a client-supplied foreign `orgId`.
- [ ] Validation errors surface in the UI, not as crashes.
- [ ] At least one test covering the org-scoping guard.
- [ ] tests + types + lint clean; migration applies.

## Dependencies / open questions

- Keep it as `todo` or rename to something more neutral (`note`)? Recommend
  `todo` — matches the existing schema, smallest diff.
- Server actions vs. route handlers? Recommend server actions (less boilerplate,
  idiomatic Next 16).
