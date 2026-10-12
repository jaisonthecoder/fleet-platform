# CLAUDE.md — Noatum Logistics Customer Information Platform

> Version 3 — 04.09.2026. Simplified per `docs/Simplification-Register.md` and ADR-004: no Redis, no own auth code, one deployable, Postgres job queue.

> Place this file at the repository root as `CLAUDE.md`. Copy the same content to `.github/copilot-instructions.md`. Keep it under 200 lines. It holds the rules; the long documents live in `/docs`.

## What this product is

A customer-facing portal for Noatum Logistics (a freight forwarder, part of AD Ports Group). Customers log in to track Air and Sea shipments, request quotes, book, download documents, view invoices, receive alerts, raise claims and run reports.

**CargoWise One (CW1) is the system of record.** This platform is a customer window onto CW1 plus a channel for customer requests (quotes, bookings) into CW1. We keep a synchronised copy of CW1 data in our own database for speed; CW1 stays the truth.

## What this product is NOT (never build these)

- Not a replacement for CW1 operational workflows.
- Not a rate-management or pricing system — rates come from CW1 or the designated rate engine through `RateEngineAdapter`.
- Not a purchase-order management system — PO visibility and deep links only.
- Not a brand redesign — the Noatum Design System is consumed as-is.

## Source of truth

All requirements are in `/docs`. Read the relevant file before starting a task:

- `docs/PRD-Noatum-Customer-Platform.md` — requirements, feature groups FG-1 … FG-10, priorities P0/P1/P2, open questions OQ-1 … OQ-14
- `docs/noatum-designsystem.md` — tokens, components, brand voice
- `docs/Implementation-Plan-Noatum-Customer-Platform.md` — architecture and phases
- `docs/01-Vertical-Slice-Implementation-Plan.md` — the slice backlog you work from
- `docs/KB-*.md` — knowledge-base notes on specific topics
- `docs/adr/` — architecture decision records (ADR-001 migrations, ADR-002 frontend, ADR-003 tenancy controls)
- `docs/gaps.md` — requirements not covered by the PRD, and additions we proposed that need sign-off
- `docs/glossary.md` — freight-forwarding and platform terms

**If something you need is not in `/docs`, stop and ask. Do not invent scope, fields, statuses, personas or integrations.** If a task touches an open question (OQ-n), say so and use the interim decision in the slice; do not pick an answer yourself.

## Six foundation rules (never break these)

1. **Tenancy in the data layer.** Two patterns, both enforced by Postgres RLS and by `TenantRepository`:
   - **Pattern A — single owner**: tables owned by one customer (`quote`, `booking`, `template`, `address_book_entry`, `user`, `financial_transaction`, `notification` …) carry `customer_group_id NOT NULL` with an index.
   - **Pattern B — shared visibility**: the shipment family (`shipment`, `consol`, `container_unit`, `transport_leg`, `milestone_event`, `document`, `po_link`) has **no** `customer_group_id`; visibility comes from the `shipment_visibility` link table (a shipment can be visible to several customers). Child tables inherit through `shipment_id`.
   - Never filter tenants in React. Never accept `customer_group_id` from the client. The worker resolves tenants only from the `customer_account` mapping (see `docs/KB-CW1-Integration-Multi-Tenant.md`).
2. **Canonical model + adapters.** We store our own shapes (Shipment, Quote, Booking, MilestoneEvent…), never CW1 shapes. All external systems sit behind interfaces in `packages/shared-types/adapters`: `TmsTrackingAdapter`, `TmsQuoteAdapter`, `TmsBookingAdapter`, `TmsFinanceAdapter`, `TmsDocumentAdapter`, `RateEngineAdapter`, `EmissionsAdapter`. Business modules call the interface, never the CW1 client. **Location rule**: every adapter is implemented in the `integration` module and driven by jobs, with one exception — `RateEngineAdapter` is called synchronously from `quotes.service` with a 25 s timeout, because instant quotes must return in under 30 s (PRD §7). Nothing else in the API calls an external system inline.
3. **Permissions on every endpoint.** Every controller route has `@RequirePermission('<code>')`. Permission codes are constants in `packages/shared-types/permissions.ts`. Roles are named sets of permission codes — no role checks in code, only permission checks.
4. **Feature flags per CustomerGroup.** New features are checked against `customerGroup.feature_flags` in the API and hidden in the UI when off.
5. **Mapping tables, not hard-coded codes.** CW1 status codes, event codes, charge codes and document types live in `mapping_*` tables. Never write a CW1 code in TypeScript.
6. **Design tokens only.** All colours, fonts, radii, spacing come from `packages/design-system/tokens.css` and its components. No hex colour, `font-family` or `border-radius` anywhere else. A lint rule enforces this.

## Human-in-the-loop rule

Any value produced by automation or AI (predictive ETA, merged carrier events, CO2, chatbot output, translations) must be stored with **provenance** (source, version, confidence) and must be **overridable by a human with a mandatory reason**, keeping the original. Never present automated output as read-only.

## Stack and layout

- Monorepo (pnpm workspaces + Nx/Turborepo).
- `apps/portal-web` — React + TypeScript, **Vite SPA** (ADR-002: PRD §8 suggests Next.js; we chose Vite for the logged-in portal; public pages may move to a small Next.js app later for SEO — do not introduce SSR without an ADR). TanStack Query, react-hook-form + zod, i18next, MapLibre.
- `apps/api` — NestJS, REST, OpenAPI from decorators, versioned `/v1`. **Job consumers run in the same process** (pg-boss); `WORKER_MODE=split` starts them separately when needed.
- `apps/cw1-simulator` — fake CW1 eAdapter for local development and tests.
- `packages/design-system`, `packages/shared-types`. CW1 XML code lives in `apps/api/src/integration/cw1/`.
- PostgreSQL only (migrations: ADR-001; jobs: pg-boss; raw CW1 messages in `integration_message.payload`), Azure Blob for files (documents, PDFs). **No Redis, no message broker** in Phase 1 (ADR-004) — add a cache or a broker only when a measured number says so, behind the existing service or `JobQueue` interface.
- Identity: the SPA signs in with MSAL (PKCE) against Entra External ID (customers) or Entra ID (staff); the API only validates tokens and loads the user. **We write no login, session, password or MFA code.**
- pnpm workspaces (no Nx). Local: `docker compose up` (Postgres + simulator) then `pnpm dev`. Tests: `pnpm test`. Lint: `pnpm lint`. E2E: `pnpm e2e`.

## Backend conventions (NestJS)

- One folder per module under `apps/platform-api/src/modules/<name>/` containing `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.repository.ts`, `dto/`, `entities/`, `<name>.spec.ts`.
- Controllers are thin: validate (zod pipe), call service, return DTO. Business rules live in services. Data access lives in repositories extending `TenantRepository`.
- Status machines are explicit: one `*.status.ts` file with allowed transitions and a unit test per transition.
- Anything that talks to the outside world (CW1, email, PDF, D365, carriers) runs as a job in the `integration` module, enqueued in the same database transaction as the business write. The API never calls external systems inline, except `RateEngineAdapter` for instant quotes (rule 2).
- Jobs are idempotent: dedupe key = `source_message_id + portal_ref`. pg-boss retries with backoff; failed jobs stay in its failed table (our DLQ). Raw payload kept in `integration_message.payload` with a scheduled retention delete.
- Simplicity rule: before adding a table, a runtime, a cache or a screen, check `docs/Simplification-Register.md`. Keep the seam (nullable column, config constant, interface); do not build the machinery until a real need is measured.
- Every write of business significance emits an `AuditEvent`; every user action emits an `AnalyticsEvent`.
- Errors from integrations never reach the customer as errors. Entities keep the last consistent state; ops are alerted.

## Frontend conventions (React)

- Feature folders under `apps/portal-web/src/features/<name>/` with `api/` (TanStack Query hooks generated from OpenAPI or hand-written against shared DTOs), `components/`, `pages/`, `i18n/`.
- Forms use react-hook-form with the zod schema from `packages/shared-types` — the same schema the API validates with.
- Lists support Grid / Detail / Card views where the PRD asks for it; use the shared `DataView` component.
- Dates display as `DD.MM.YYYY`. Money shows currency code and amount, never a symbol alone.
- Every string goes through i18next with EN and ES entries. No hard-coded text.
- Loading, empty and error states are required for every data view.
- **Accessibility**: WCAG 2.1 AA — keyboard reachable, visible focus, labels on every input, colour never the only signal, contrast checked (muted gray `#A7A7A6` is decorative only).
- **Performance budget** (PRD §7): list endpoints < 2 s at 100k rows per group, search < 1.5 s, wizard step < 300 ms. Paginate server-side; never load unbounded lists.

## Brand and voice (customer-facing text, emails, PDFs, chatbot)

- Sentence-case headlines. "We" for Noatum, "you" for the customer. Confident, service-led, plain.
- **No emoji. No exclamation marks.** Dates `DD.MM.YYYY`. Links "Read more…".
- Primary button solid brand red; outline variant only as second style. Cards square-cornered. No gradients, blur, bounce or scale animations.
- Status colours use the extension tokens (success green, warning amber, info navy, neutral gray); brand red is for actions and errors only.

## Security rules

- Public endpoints (public T&T, CO2 calculator, sailing schedule) never return addresses, documents, financials, predictive data, or anything revealing which customer groups exist. They are rate-limited and bot-protected.
- Financial documents and invoices are visible only when the user's CustomerAccount is the addressee.
- Documents or events flagged `internal_only` never reach customer users on any surface: list, detail, export, alert, chatbot, API.
- Secrets come from environment / Key Vault, never from code or `.env` committed files.

## Definition of Done for every task

1. Migration (reversible). Pattern A tables: `customer_group_id NOT NULL` + index + RLS. Pattern B tables: RLS via `shipment_visibility` EXISTS. Internal-only tables: internal RLS policy. No table without a policy. No new table if a column, a view or a config constant does the job.
2. DTOs + zod schemas in `packages/shared-types`.
3. `@RequirePermission()` on every new route; permission codes seeded.
4. Tests: business-rule unit tests, one tenant-isolation test per new entity, one 403 test per endpoint. `pnpm test` and `pnpm lint` pass.
5. UI uses design-system components only; loading/empty/error states present; WCAG 2.1 AA checks pass (axe in CI); performance budget met for the slice's list/search endpoints (k6 smoke).
6. EN + ES strings; `DD.MM.YYYY`; no emoji or exclamation marks.
7. `AnalyticsEvent` for new user actions; `AuditEvent` for significant writes.
8. OpenAPI regenerated. `/docs` updated if a convention or decision changed (ADR for architectural choices).
9. Works end to end locally against Docker Compose and the CW1 simulator.

## How to work

- Read the slice in `docs/01-Vertical-Slice-Implementation-Plan.md` and the PRD section it references before writing code.
- Start in **plan mode**: list files to create or change, schema changes, tests. Wait for approval before implementing.
- Work in the order DB → shared types → API + tests → UI. Do not start with the screen.
- Keep changes inside the slice. If you discover work outside the slice, write it to `docs/gaps.md` or propose a new slice; do not do it silently.
- **Scope guardrail**: Phase 1 is exactly FG-8.1/8.2/8.4, §8a, FG-6 minimal, §5 integration layer, FG-9.3 foundation, FG-3.1, FG-3.2 shared tooling, FG-4.4 subset, FG-4.5, FG-8.6 instrumentation, plus foundational empty tables the PRD names. No Phase 2+ screens. No rate tables. No PO lifecycle. Additions we proposed (4-eyes mapping approval, read-only impersonation) are listed in `docs/gaps.md` as proposals until signed off.
- Prefer small commits with messages `S1.05: address book import validation report`.
- When unsure, ask a short specific question. One question is cheaper than a rewrite.
