# 05 — React Email templates

**Priority:** P2 · **Effort:** ~half day · **Depends on:** none

## Problem

Transactional emails are inline plain-text strings duplicated across three call
sites. No branding, no reuse, no HTML.

## Current state

- `src/libs/email.ts` (Resend) accepts `html` or `text` but is only ever called
  with `text`.
- Inline bodies at: `src/app/api/webhooks/clerk/route.ts` (welcome),
  `src/app/api/webhooks/stripe/route.ts` and `.../razorpay/route.ts` (receipt).
- No `@react-email/*` dependency.

## Goal

Reusable, branded email templates rendered to HTML, with the plain-text fallback
kept. Adding a new email is authoring one component, not hand-writing a string.

## Scope

**In:**
- Add `@react-email/components` + `@react-email/render`.
- Templates: `WelcomeEmail`, `ReceiptEmail` (props: plan, status, amount, org).
- A shared layout (logo, colors from the design tokens, footer).
- `sendEmail` callers pass a rendered template (`html` + `text`).

**Out:**
- A visual email preview server (nice-to-have; `react-email dev` can be a script later).
- Marketing/broadcast emails (this is transactional only).

## Approach

1. `src/emails/` with `_layout.tsx`, `WelcomeEmail.tsx`, `ReceiptEmail.tsx`.
2. Small helper `renderEmail(component)` → `{ html, text }` using
   `@react-email/render` (it produces both).
3. Update the 3 call sites to build the template and pass `html`+`text` to
   `sendEmail`. Keep the no-op contract intact.
4. Optional `npm run email:dev` script for local preview.

## Data-model changes

None.

## Files touched

- `src/emails/*` (new), `package.json` (deps + optional script)
- `src/app/api/webhooks/{clerk,stripe,razorpay}/route.ts`
- possibly `src/libs/email.ts` (a `sendTemplate` convenience wrapper)

## Acceptance criteria

- [ ] Welcome + receipt emails render branded HTML with a text fallback.
- [ ] Adding a new email = one component + one `sendEmail` call.
- [ ] `sendEmail` still no-ops cleanly without `RESEND_API_KEY`.
- [ ] tests + types + lint clean.

## Dependencies / open questions

- Pull brand colors/logo from existing design tokens (`src/styles`,
  `tailwind`/globals) so emails match the app.
