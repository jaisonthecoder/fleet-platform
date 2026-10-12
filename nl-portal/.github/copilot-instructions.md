# CLAUDE.md — Noatum Logistics Customer Information Platform

> Version 4 — 09.09.2026. Governing document is **PRD v4.0**; Phase 1 sequence is in `docs/plans/Project-Kickoff-and-Phase1-Plan.md`. Carries the v3 simplifications (no Redis, no own auth code, one deployable, Postgres job queue) plus the findings of the KT session of 09.09.2026.
>
> **Adapted to this repository**: there are no shared packages. Each app is self-contained
> and the two apps share no code — see "Stack and layout". Where the v4 document set says
> `packages/shared-types` or `packages/design-system`, the paths below are authoritative.

## v4 rules that override earlier assumptions

1. **No rate management, and no standard quoting process.** Quotes are priced by people. The instant-rate interface is implemented and stub-tested but has **no configured source**; never write code that assumes a price will come back automatically. **Confirmed and widened at director level on 17.09.2026**: there is also no rate store, no standard format, and no standardised quoting process anywhere in the organisation, whose system landscape is being redesigned. So the quotation module stays **light** — no rate or tariff tables, no approval workflow, no cost or margin modelling, and a quote response is valid with one or more priced options, an attached document, or both, plus free text. A person types every option; nothing derives, compares or ranks them. Build sequence: `docs/cargowise-and-quotation/` (18.09.2026, newest) and `docs/plans/Quotation-Module-Phase-Plan.md`, whose §0 says which document wins when two disagree.
2. **Internal pricing is in Phase 1, but optional.** The customer requests; the request is copied to CargoWise where that is configured; the price is recorded from **either** direction — typed into the portal by a person, or returned by CargoWise. Portal pricing sits behind the `quotations.portal_pricing` switch, **off by default** (17.09.2026). Whether the customer must wait for CargoWise to confirm is a configured gate, not a fixed rule (PRD OQ-26).
3. **Quote, booking and shipment are three separate entities.** A booking is *linked* to a quote by quote number, one-to-many. There is no conversion call. A booking is not a shipment. Never model a one-to-one chain.
4. **Both ways of working stay supported.** When a new practice is discovered, add it as an option and keep the existing path. Configure per region, branch or customer. Do not delete a designed path because another one appeared.
5. **One region now, any region by configuration.** Nothing in identity, tenancy, organisation linking, branch scoping, mapping or integration may assume a single region or branch.
6. **Events use an exclude-list; documents use an allow-list.** Document typing in CargoWise is manual and unvalidated, so only explicitly approved document types are ever visible to a customer.
7. **Internal users carry a branch.** The pricing queue is branch-scoped; track and trace is not.
8. **The AI email drafting service belongs to another team.** Call it behind an interface, present the draft as editable, require human action to send, fall back to a template.
9. **Customer linking is at organisation level only.** Addresses beneath an organisation are never linked individually. Whether shipment parties carry organisation or address codes is open (OQ-3a) — keep the resolution a lookup.

> Place this file at the repository root as `CLAUDE.md`. Copy the same content to `.github/copilot-instructions.md`. Keep it under 200 lines. It holds the rules; the long documents live in `/docs`.

## What this product is

A customer-facing portal for Noatum Logistics (a freight forwarder, part of AD Ports Group). Customers log in to track Air and Sea shipments, request quotes, book, download documents, view invoices, receive alerts, raise claims and run reports.

**CargoWise One (CW1) is the system of record.** This platform is a customer window onto CW1 plus a channel for customer requests (quotes, bookings) into CW1. We keep a synchronised copy of CW1 data in our own database for speed; CW1 stays the truth.

## What this product is NOT (never build these)

- Not a replacement for CW1 operational workflows.
- Not a rate-management system. **No rate management exists** (v4 rule 1): every quote is priced by a person. The instant-rate interface is stubbed with no configured source, so never assume a price returns automatically.
- Not a purchase-order management system — PO visibility and deep links only.
- Not a brand redesign — the Noatum Design System is consumed as-is.

## Source of truth

All requirements are in `/docs`. Read the relevant file before starting a task:

Start with `docs/README.md` — it says what each document is and which to read when.

**Reorganised 18.09.2026.** Everything now sits in a folder named for what it is.

**At the top of `docs/`, because they govern everything:**

- `docs/PRD-Noatum-Customer-Platform.md` — **PRD v4.0, governing.** Feature groups FG-1 … FG-10, priorities, open questions
- `docs/Simplification-Register.md` — what was deliberately dropped, and the seam kept for each
- `docs/gaps.md` — needed but not in the PRD, plus proposals awaiting sign-off
- `docs/glossary.md` — freight-forwarding and platform terms
- `docs/noatum-designsystem.md` — tokens, components, brand voice (also the `noatum-designsystem` skill)
- `docs/03-Agent-Metaprompt.md` — the task, review and fix prompts

**The folders:**

- `docs/cargowise-and-quotation/` — **start here for quotations and CargoWise.** The plan of 18.09.2026: every adapter operation, the quote status machine, manual pricing, publishing
- `docs/plans/` — what to build and in what order: `Project-Kickoff-and-Phase1-Plan.md` (the Phase 1 stages), `01-Vertical-Slice-Implementation-Plan.md` (the slice backlog), `Quotation-Module-Phase-Plan.md`, `Remediation-Plan-Foundation-Gaps.md`, `Implementation-Plan-Noatum-Customer-Platform.md`, and `implementation-plans/` for the per-module detail
- `docs/quotation/` — the Q0–Q5 build sheets, one per phase
- `docs/requirements/` — the numbered functional and non-functional requirements
- `docs/architecture/` — how the system hangs together: tenancy (`KB-CW1-Integration-Multi-Tenant.md`), CW1 data contracts, the organisation schema
- `docs/integration/` — what we exchange with CargoWise, and what we still need from them
- `docs/design/` — how one capability works: identity and access, customer onboarding, internal quote pricing
- `docs/adr/` — architecture decisions (migrations, frontend, tenancy, simplifications, auth, party model, work queue)
- `docs/lld/` — low-level design: DDL, endpoints, invariants, test lists
- `docs/research/` — background reading on freight forwarding and customer structures
- `docs/operations/` — Azure, DevOps, deployment, repository structure, assistant memory
- `docs/process/` — how we work: onboarding flow, the organisation and branch explainer
- `docs/walkthroughs/` — the same story end to end, for explaining onboarding
- `docs/meetings/` — KT minutes and Q&A. **The session of 09.09.2026 produced the v4 override rules above**, so it is evidence rather than history
- `docs/briefings/` — stakeholder decks and diagrams. Presentation, never specification
- `docs/reviews/` — critiques of our own plans and code
- `docs/reference-data/` — the CargoWise document and event catalogues
- `docs/archive/` — the raw v3 and v4 intake drops, untouched

**If something you need is not in `/docs`, stop and ask. Do not invent scope, fields, statuses, personas or integrations.** If a task touches an open question (OQ-n), say so and use the interim decision in the slice; do not pick an answer yourself.

## Six foundation rules (never break these)

1. **Tenancy in the data layer.** Two patterns, both enforced by Postgres RLS and by `TenantRepository`:
   - **Pattern A — single owner**: tables owned by one customer (`quote`, `booking`, `template`, `address_book_entry`, `user`, `financial_transaction`, `notification` …) carry `customer_group_id NOT NULL` with an index.
   - **Pattern B — shared visibility**: the shipment family (`shipment`, `consol`, `container_unit`, `transport_leg`, `milestone_event`, `document`, `po_link`) has **no** `customer_group_id`; visibility comes from the `shipment_visibility` link table (a shipment can be visible to several customers). Child tables inherit through `shipment_id`.
   - Never filter tenants in React. Never accept `customer_group_id` from the client. The worker resolves tenants only from the `customer_account` mapping (see `docs/architecture/KB-CW1-Integration-Multi-Tenant.md`).
2. **Canonical model + adapters.** We store our own shapes (Shipment, Quote, Booking, MilestoneEvent…), never CW1 shapes. All external systems sit behind interfaces in `apps/noatum-customer-portal-api/src/contracts/adapters`: `TmsTrackingAdapter`, `TmsQuoteAdapter`, `TmsBookingAdapter`, `TmsFinanceAdapter`, `TmsDocumentAdapter`, `RateEngineAdapter`, `EmissionsAdapter`. Business modules call the interface, never the CW1 client. **Location rule**: every adapter is implemented in the `integration` module and driven by jobs, with one exception — `RateEngineAdapter` is called synchronously from `quotes.service` with a 25 s timeout, because instant quotes must return in under 30 s (PRD §7). Nothing else in the API calls an external system inline.
3. **Permissions on every endpoint.** Every controller route has `@RequirePermission('<code>')`. Permission codes are constants in `apps/noatum-customer-portal-api/src/contracts/permissions.ts`. Roles are named sets of permission codes — no role checks in code, only permission checks.
4. **Everything optional is switchable, and the switch governs API *and* UI.** Two layers, both stored in PostgreSQL, never in code: **platform switches** (`feature_switch` table, catalogue in `apps/noatum-customer-portal-api/src/contracts/feature-switches.ts`, managed on the Feature management screen — "may anyone at Noatum use this at all") and **customer entitlements** (`customerGroup.feature_flags` — "may this customer use it"). **The catalogue is code, the state is data**: an administrator may flip a switch, never invent one.
   - **Register a switch for every optional capability, including a variation of one.** Not just whole modules — if the business might want one price instead of several, that is a switch too. If you are about to ship behaviour somebody could reasonably want off, it needs a key.
   - **The API is the control.** `@RequireFeature('<key>')` fails closed with 403. Where a switch changes a *response* rather than access, the service must omit the data as well — a hidden field that still ships in JSON is not off.
   - **The UI reads the same key** and hides the control. **Hiding a button is never the control**, only the courtesy.
   - **A switch changes behaviour and presentation, never the schema.** Never create a table or column conditionally. Data already captured stays readable when a switch goes off; the switch governs what happens next.
   - **Default off** for anything new that changes what a customer sees; on for a capability the mockups already treat as normal. `requiresApproval: true` where privacy, legal or the sponsor must sign off.
   - **`PROTECTED_CAPABILITIES` may never become switches** — tenancy, RLS, permissions, audit, human-send, the link gate. Safety is not configurable.
5. **Mapping tables, not hard-coded codes.** CW1 status codes, event codes, charge codes and document types live in `mapping_*` tables. Never write a CW1 code in TypeScript.
6. **Design tokens only.** All colours, fonts, radii, spacing come from `apps/noatum-customer-portal-ui/src/design-system/styles/tokens.css` and its components. No hex colour, `font-family` or `border-radius` anywhere else. A lint rule enforces this.

## Human-in-the-loop rule

Any value produced by automation or AI (predictive ETA, merged carrier events, CO2, chatbot output, translations) must be stored with **provenance** (source, version, confidence) and must be **overridable by a human with a mandatory reason**, keeping the original. Never present automated output as read-only.

## Stack and layout

- **Five repositories, one workspace (16.09.2026; docs split 30.09.2026).** The parent
  `noatum-customer-portal` holds the pnpm workspace, the lockfile and `.azuredevops/`. Each app is
  its own Git repository attached as a **submodule** under `apps/*`, tracking branch `dev`:
  `noatum-customer-portal-ui`, `noatum-customer-portal-api`; `infra/` is the
  `noatum-customer-portal-infra` submodule; `docs/` is the `noatum-customer-portal-wiki`
  submodule, published from `dev` as the project's code wiki. Clone with
  `git clone --recurse-submodules`, or run `git submodule update --init --recursive` after;
  a plain clone leaves `apps/` empty and nothing installs. Tag
  `pre-submodule-split-20260916` marks the last single-repo state.
- pnpm workspaces, **no Nx or Turborepo**. Each app is self-contained — its own
  tsconfig, eslint and prettier config — so `apps/noatum-customer-portal-api` or `apps/noatum-customer-portal-ui` can be lifted
  out and still build. The apps **share no code**: they talk over HTTP.
- `apps/noatum-customer-portal-ui` — React + TypeScript, **Vite SPA** (ADR-002: PRD §8 suggests Next.js; we chose Vite for the logged-in portal; public pages may move to a small Next.js app later for SEO — do not introduce SSR without an ADR). TanStack Query, react-hook-form + zod, i18next, MapLibre.
- `apps/noatum-customer-portal-api` — NestJS, REST, OpenAPI from decorators, versioned `/v1`. **Job consumers run in the same process** (pg-boss); `WORKER_MODE=split` starts them separately when needed.
- `apps/noatum-customer-portal-ui/src/design-system` — tokens and UI primitives, inside the SPA that uses them.
- `apps/noatum-customer-portal-api/src/contracts` — the API DTOs, zod schemas, permission codes and enums. Not shared:
  the SPA generates its client from the OpenAPI document instead.
- CW1 XML code lives in `apps/noatum-customer-portal-api/src/integration/cw1/`.
- PostgreSQL only (migrations: ADR-001; jobs: pg-boss; raw CW1 messages in `integration_message.payload`), Azure Blob for files (documents, PDFs). **No Redis, no message broker** (ADR-004, **re-confirmed with code evidence on 17.09.2026 in `docs/adr/ADR-008-background-work-queue.md`**). pg-boss needs **no Azure resource** — it is a library plus a `pgboss` schema in the database we already run, initialised once per environment by the deployment. Do not propose a broker or a cache without reading ADR-008 §6 (the triggers) and §7 (reversing costs you transactional enqueue and buys you an outbox table).
- **Pilot identity exception (15.09.2026, ADR-006):** external customers and the explicitly provisioned local bootstrap Portal Admin use portal-managed authentication through maintained libraries, PostgreSQL credentials/challenges and opaque server-side sessions. Follow `docs/plans/implementation-plans/Pilot-Portal-Authentication-Implementation-Plan.md` for activation, password/MFA/recovery and revocation. No custom cryptography, public signup, default admin password or development bypass. Staff Entra SSO remains supported; portal roles remain database-owned. This supersedes the no-portal-owned-credentials assumption only for this pilot scope. Verification remains user-scheduled; documentation approval is not release acceptance.
- Local: `pnpm db:up` (Postgres; the simulator joins compose in S1.01) then `pnpm dev`.
  Tests: `pnpm test`. Lint: `pnpm lint`. Both delegate to each app, which owns its own config.

## Backend conventions (NestJS)

- One folder per module under `apps/noatum-customer-portal-api/src/modules/<name>/` containing `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.repository.ts`, `dto/`, `entities/`, `<name>.spec.ts`.
- Controllers are thin: validate (zod pipe), call service, return DTO. Business rules live in services. Data access lives in repositories extending `TenantRepository`.
- Status machines are explicit: one `*.status.ts` file with allowed transitions and a unit test per transition.
- Anything that talks to the outside world (CW1, email, PDF, D365, carriers) runs as a job in the `integration` module, enqueued in the same database transaction as the business write. The API never calls external systems inline, except the three recorded exceptions: `RateEngineAdapter` for instant quotes (rule 2), and the invitation email and the operator-initiated organisation import (ADR-009). **No other exception is implied — add one only with an ADR.**
- Jobs are idempotent: dedupe key = `source_message_id + portal_ref`. pg-boss retries with backoff; failed jobs stay in its failed table (our DLQ). Raw payload kept in `integration_message.payload` with a scheduled retention delete.
- Simplicity rule: before adding a table, a runtime, a cache or a screen, check `docs/Simplification-Register.md`. Keep the seam (nullable column, config constant, interface); do not build the machinery until a real need is measured.
- Every write of business significance emits an `AuditEvent`; every user action emits an `AnalyticsEvent`.
- Errors from integrations never reach the customer as errors. Entities keep the last consistent state; ops are alerted.

## Frontend conventions (React)

- Feature folders under `apps/noatum-customer-portal-ui/src/features/<name>/` with `api/` (TanStack Query hooks over the generated client), `components/`, `pages/`, `i18n/`.
- The API client and its types are **generated from the OpenAPI document** into `src/api/generated`. Never hand-write a type that mirrors an API shape, and never import from `apps/noatum-customer-portal-api` — regenerate instead.
- Forms use react-hook-form with a zod schema derived from that generated client. The server validates every request regardless; a client-side check is a convenience, never a second rulebook.
- Anything the browser needs to compute the same way as the server (chargeable weight, totals) comes from an API endpoint rather than a duplicated function — duplicating it is how the number on screen ends up disagreeing with the number on the quote.
- **Build screens from the design system, never from scratch.** Before writing any
  markup, look for the component in `apps/noatum-customer-portal-ui/src/design-system`
  and in the gallery at `/kit` (dev only), which lists every UI-kit code and shows
  what is built. Freight-specific components already exist for route progress,
  container utilisation, free time, charge and leg breakdowns, incoterm handover,
  the mode ladder, ring gauge, sparkline, stat tiles, the date treatments, the
  selection cards and every loading state. If one exists, use it.
- **Ordinary controls come from the shadcn primitives** in
  `src/design-system/primitives` (the `ui` alias in `components.json`) — button,
  input, select, checkbox, switch, tabs, dialog, popover, command, calendar,
  slider, sheet, sonner, skeleton and the rest. They already wear the brand
  through `.noa-control` and the tokens. Do not wrap a primitive in a new
  component that adds nothing, and do not hand-roll one that already exists.
- If the kit genuinely lacks something, build it **in the design system** against
  the mockup (`REFERENCE/MOCKUP - Fright Forwarder Customer Portal/Noatum UI Kit.dc.html`),
  in its own folder with a stylesheet, a test and a barrel — not inside the feature.
- An animated component references its keyframe through a token
  (`animation: var(--noa-anim-run) …`). A CSS Module rewrites a bare keyframe name
  to a scoped identifier that does not exist, and the animation silently never runs.
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
2. DTOs + zod schemas in `apps/noatum-customer-portal-api/src/contracts`; OpenAPI regenerated so the SPA client follows.
3. `@RequirePermission()` on every new route; permission codes seeded. **Every optional capability registered in the switch catalogue** and gated in the API, with the UI reading the same key — a capability nobody can turn off is a defect, not a simplification.
4. Tests: business-rule unit tests, one tenant-isolation test per new entity, one 403 test per endpoint. **One test per new switch proving the API refuses when it is off** — from the guard, not the screen. `pnpm test` and `pnpm lint` pass.
5. UI uses design-system components only; loading/empty/error states present; WCAG 2.1 AA checks pass (axe in CI); performance budget met for the slice's list/search endpoints (k6 smoke).
6. EN + ES strings; `DD.MM.YYYY`; no emoji or exclamation marks.
7. `AnalyticsEvent` for new user actions; `AuditEvent` for significant writes.
8. OpenAPI regenerated. `/docs` updated if a convention or decision changed (ADR for architectural choices).
9. Works end to end locally against Docker Compose and the CW1 simulator.

## How to work

- **Business-first cadence (user direction, 12.09.2026):** prioritise approved business slices through DB, API and UI. Do not divert into infrastructure hardening, test tooling, lint configuration or unrelated cleanup unless it directly blocks that slice; explain genuine blockers before expanding scope.
- **Verification is user-scheduled:** do not run tests (unit, integration, database or browser), typechecking, linting, formatters or verification-only builds without the user's explicit instruction to run those checks. Finishing a slice or receiving "continue" is not permission to run them. Do not launch equivalent checks through subagents, scripts or alternate tools. Necessary implementation/startup/code-generation work is separate; do not disguise verification as implementation.
- Prepare relevant tests alongside business code, but leave execution pending until requested. The Definition of Done above remains the acceptance standard, not automatic permission to execute checks. Report "implemented; verification pending" with the deferred checks and known risks; never claim unrun checks passed or that the slice is release-ready.
- Apply this cadence to every delegated task and reviewer. Review requirements and code without running checks unless authorised. This direction supersedes older repository notes that automatically run checks after each edit, increment or slice; higher-priority platform requirements still apply.
- Read the slice in `docs/plans/01-Vertical-Slice-Implementation-Plan.md` and the PRD section it references before writing code.
- Start in **plan mode**: list files to create or change, schema changes, tests. Wait for approval before implementing.
- Work in the order DB → contracts → API + tests → OpenAPI → UI. Do not start with the screen.
- Keep changes inside the slice. If you discover work outside the slice, write it to `docs/gaps.md` or propose a new slice; do not do it silently.
- **Scope guardrail**: Phase 1 is the ten stages in `docs/plans/Project-Kickoff-and-Phase1-Plan.md` — foundation, onboarding, customer quote request, internal pricing and write-back, accept and PDF, dashboard shell, news, plus the integration layer and observability. No Phase 2+ screens. No rate tables. No PO lifecycle. No AI email service of our own. Proposals awaiting sign-off are in `docs/gaps.md`.
- Prefer small commits with messages `S1.05: address book import validation report`.
- **A commit spans two repositories.** Commit and push inside the submodule (`apps/<app>`,
  `infra` or `docs`), then `git add` it and commit the moved pointer in the parent. Work pushed to a child
  that the parent does not point at is invisible to a fresh clone and to CI — and the
  pipelines trigger on the parent's pointer change, never on a child push.
- When unsure, ask a short specific question. One question is cheaper than a rewrite.

<!-- ─────────────────────────────────────────────────────────────────────────────
     END OF SHARED CONTENT.

     Everything above this line is identical in CLAUDE.md and
     .github/copilot-instructions.md, and is mirrored between them.

     Everything BELOW is specific to one assistant and is NOT mirrored. When copying
     CLAUDE.md over copilot-instructions.md, stop at this marker and keep the existing
     tail — the two assistants handle context and memory differently, so their sections
     genuinely differ.
     ───────────────────────────────────────────────────────────────────────────── -->

## Chat Context Window & Session Continuity

Long sessions degrade and can stall once the context window fills up, forcing a
forced restart that loses all prior context. See
[`.github/copilot-chat-context-management.md`](copilot-chat-context-management.md)
for the full explanation, prevention practices, and recovery steps.

- At the start of any new/resumed session, read
  `/memories/repo/project-state.md` (repo memory) before asking the user to
  re-explain project context.
- Update `/memories/repo/project-state.md` as project stage, key decisions, or open
  items change — this file is shared across all sessions on this workspace, including
  parallel ones, so keep edits scoped (own heading/own file per workstream) to avoid
  clobbering another session's concurrent update.
- Before ending a long or degraded session, offer to write a progress/handoff summary
  into repo memory (or `/memories/session/` for in-flight scratch notes) so the next
  session can resume cheaply.
