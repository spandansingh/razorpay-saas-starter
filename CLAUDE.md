# CLAUDE.md

Claude Code reads this file; the full working guide lives in [AGENTS.md](./AGENTS.md).
Read AGENTS.md before working on payments, auth, or the database.

Quick reference:

- Payments abstraction: `src/libs/payments/` (Stripe + Razorpay behind one `PaymentProvider` interface).
- Checkout API: `src/app/api/checkout/` — webhooks: `src/app/api/webhooks/{stripe,razorpay}/`.
- Run tests: `npm run test` · Types: `npm run check:types` · Migrations: `npm run db:generate`.
- Never log secret keys or raw webhook payloads. Webhook routes must use the raw body.
