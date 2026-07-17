# Build Backlog — Specs

Specs for what's left to build on this SaaS starter, grounded in a survey of the
current product surface (2026-07). Each file is a standalone, executable spec.

Ordered by priority. P0 items are what stop this from being a *working* SaaS
starter — the payments engine exists but nothing in the UI reaches it.

| # | Spec | Priority | Effort | Blocks |
|---|---|---|---|---|
| [01](01-wire-checkout-ui.md) | Wire checkout to the pricing UI | **P0** | ~half day | payments unusable without it |
| [02](02-subscription-management.md) | Subscription management (billing page) | **P0** | ~1 day | 01 |
| [03](03-role-permission-gating.md) | Role / permission gating | **P1** | ~half day | — |
| [04](04-demo-crud-feature.md) | Demo org-scoped CRUD feature | **P1** | ~1 day | — |
| [05](05-react-email-templates.md) | React Email templates | **P2** | ~half day | — |
| [06](06-billing-event-history.md) | Billing-event history | **P2** | ~1 day | 02 |
| [07](07-e2e-test-coverage.md) | E2E test coverage | **P2** | ~1–2 days | 01, 02 |
| [08](08-payments-hardening.md) | Payments hardening (currency, total_count) | **P2** | ~half day | — |
| [09](09-file-storage-uploads.md) | File storage / uploads | **P3** | ~1 day | — (deferred) |

## Spec format

Each spec has: Problem · Current state (with file refs) · Goal · Scope (in/out)
· Approach · Data-model changes · Files touched · Acceptance criteria ·
Dependencies / open questions.

Specs describe *what* and *why* precisely enough to implement; they don't lock
every implementation detail. Deviations discovered during build should be noted
back in the spec.
