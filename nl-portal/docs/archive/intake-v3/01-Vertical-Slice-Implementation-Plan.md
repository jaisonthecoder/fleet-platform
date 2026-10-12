# Vertical-Slice Implementation Plan — Noatum Customer Information Platform

| | |
|---|---|
| **Based on** | PRD v2.1 (02.09.2026) · Implementation-Plan-Noatum-Customer-Platform.md · Noatum Design System |
| **Written** | 03.09.2026 |
| **Method** | Vertical slices: each slice is DB → shared types → API + tests → UI, finished and demoable before it is handed over |
| **Version** | 3 — 04.09.2026. Simplified per `Simplification-Register.md` (no Redis, no broker, no own auth, one deployable, fewer tables) |
| **Companion files** | `02-CLAUDE.md` (agent instructions, also copied to `.github/copilot-instructions.md`) · `03-Agent-Metaprompt.md` (kickoff, task template, review prompt) |

---

## 1. How to read this plan

- Slices are numbered `S1.01`, `S1.02` … (phase.sequence). Do them in order unless "Depends on" says otherwise.
- Every slice has the same skeleton: **Goal · PRD ref · Depends on · DB · Shared types · API · UI · Integration · Tests · Done when.**
- A slice is small: one or two screens, one NestJS module or a part of one, with your review between plan and implementation.
- Slices marked **[F]** are foundation — not features, but everything stands on them.
- Slices marked **[P]** can run in parallel with the previous slice because they do not touch the same tables.
- Every slice ends with the standard **Definition of Done** (section 2). Do not skip it to "go faster" — the DoD is what lets the agent go fast on the next slice.

## 2. Definition of Done — applies to every slice

1. Migration written and reversible. Pattern A (single-owner) tables have `customer_group_id NOT NULL` + index + RLS. Pattern B (shipment family) tables have RLS through `shipment_visibility`. Internal-only tables have an internal policy. No table ships without a policy (CLAUDE.md rule 1).
2. DTOs and zod schemas in `packages/shared-types`, used by both API and UI.
3. Every endpoint has `@RequirePermission()` and runs in tenant context; permission strings added to the seed.
4. Tests: unit tests for business rules, one tenant-isolation test per new entity, one permission test per endpoint.
5. UI uses only `packages/design-system` tokens and components; no colour, font or radius elsewhere. WCAG 2.1 AA (axe) passes. Performance budget met for the slice's list/search endpoints (k6 smoke).
6. Strings in i18n files for EN and ES; dates `DD.MM.YYYY`; no emoji, no exclamation marks.
7. `AnalyticsEvent` emitted for each new user action.
8. OpenAPI regenerated; `/docs` updated if a convention or decision changed.
9. Demo: the feature works end to end against local Docker Compose + CW1 simulator.

## 3. Repository shape (created in S1.01)

```
apps/portal-web · apps/api (API + in-process jobs) · apps/cw1-simulator
packages/design-system · packages/shared-types
docs/ (PRD, design system, plans, KB notes, ADRs)
infra/ (docker-compose, bicep/terraform)
```

---

## Phase 1 — Foundation + Quotation

**Phase goal**: a pilot customer logs in, sees a branded dashboard, and gets a quote that round-trips through CW1 (or the simulator).

### S1.01 [F] Monorepo, local infra, CI

- **Goal**: everything a developer or agent needs to run the platform locally in one command.
- **PRD ref**: §8 stack, FG-10 preconditions.
- **Depends on**: —
- **DB**: Postgres container, empty schema, Prisma + SQL migrations (ADR-001), pg-boss schema.
- **Shared types**: package created with tsconfig paths.
- **API**: NestJS app boots with job consumers in-process, `/health`, OpenAPI at `/docs`.
- **UI**: React + Vite SPA boots with a placeholder page (ADR-002 records why not Next.js and when public pages might move).
- **Integration**: `cw1-simulator` app boots with `/health`. No broker, no Redis (ADR-004).
- **Tests**: CI runs lint + unit tests on every PR.
- **Done when**: `docker compose up` (Postgres, simulator) + `pnpm dev` gives API and UI running and a job round-trip through pg-boss.

### S1.01b [F] Observability baseline (PRD FG-10 logging & monitoring, P0)

- **Goal**: every request and every queue message can be traced end to end from the first slice.
- **Depends on**: S1.01
- **API**: correlation-id middleware (header in, propagated to job payloads and CW1 `AdditionalReference`); structured JSON logging with email masking; Azure Application Insights SDK; `/health`; pg-boss failed-job count exposed as a metric.
- **Tests**: a request's correlation id appears in the API log, the job log and the simulator log for one round-trip.
- **Done when**: one Application Insights query shows a simulator round-trip end to end.

### S1.02 [F] Tenancy + identity

- **Goal**: a logged-in user belongs to exactly one CustomerGroup and can only ever see that group's rows.
- **PRD ref**: FG-8.1 (org/group model), FG-10 identity, §6 CustomerGroup/CustomerAccount/User, §7 security.
- **Depends on**: S1.01
- **DB**: `customer_group` (parent → children only), `customer_account` (code_norm UNIQUE, linked_by, approved_by nullable as the 4-eyes seam), `user` (customer_group_id nullable for internal, customer_account_id nullable for the addressee rule, idp_issuer/idp_subject), `audit_event`, `analytics_event`. Full DDL in LLD v3.
- **Shared types**: `CustomerGroupDto`, `UserDto`, `TenantContext`.
- **API**: validate Entra access tokens (customer tenant and staff tenant), load user by `(idp_issuer, idp_subject)`, request-scoped `TenantContext` (no cache), `TenantRepository` with `set_config` per transaction, Postgres RLS, `GET /me`. **No login, session, refresh or MFA code of our own** — the SPA uses MSAL.
- **UI**: login page (design-system Tabs "Customer Area") that starts MSAL sign-in, logged-in shell placeholder showing `/me`.
- **Integration**: —
- **Tests**: **the first isolation test** — user of group A requests group B's account → 404. Internal user can read both. Parent-group user reads child rows; child cannot read parent. Raw SQL as `app_api` with group A settings cannot select group B rows (loop over all tenant tables).
- **Done when**: two seeded groups, two users, isolation test green.

### S1.03 [F] Roles, permissions, guard

- **Goal**: every endpoint is protected by a permission string; roles are just named sets of strings.
- **PRD ref**: FG-8.4, FG-8.2 predefined roles.
- **Depends on**: S1.02
- **DB**: `role` (id, customer_group_id nullable = global preset, name), `permission` (code, description), `role_permission`, `user_role`.
- **Shared types**: `Permission` enum/constants (`quote.create`, `quote.submit`, `quote.accept`, `booking.create`, `booking.submit`, `booking.cancel`, `tt.view`, `docs.view`, `finance.view`, `addressbook.manage`, `addressbook.delete`, `claims.create`, `admin.users`, `admin.roles`, `news.publish`, `platform.impersonate` …).
- **API**: `PermissionGuard` + `@RequirePermission()` decorator, seed of nine presets (six customer roles incl. Customer Admin with `addressbook.manage`; internal Customer Success with impersonation, Ops, Platform Admin). No role designer UI (seam: `role.customer_group_id`).
- **UI**: none yet (admin screens in S1.10).
- **Tests**: a test that fails CI if any controller route lacks `@RequirePermission()`; permission-denied → 403.
- **Done when**: guard on `/me` and all future routes; lint rule enforced.

### S1.04 [F] Design-system package + app shell

- **Goal**: every later screen lands inside the correct brand automatically.
- **PRD ref**: §8a, design-system document.
- **Depends on**: S1.01 (parallel with S1.02–03 if a second agent is available)
- **DB / API**: —
- **Shared types**: —
- **UI**: `packages/design-system`: `tokens.css` copied verbatim, Mulish font load, `Button` (primary/outline), `SectionHeading` (with 40×3 red rule), `Input`, `Select`, `Tabs`, `NewsCard`, `StatCounter`, `Header` (red top bar, logo band, nav), `Footer` (brand red). App shell in `portal-web` with routing, header nav, footer, notification-bell placeholder, i18n switch EN/ES. Status-colour extension tokens (success/warning/info-navy/neutral) added and documented for OQ-14.
- **Tests**: visual regression snapshots for the core components; lint rule "no hex colours or font-family outside design-system".
- **Done when**: shell renders with real tokens; brand checklist reviewed.

### S1.05 Address book (first business slice — sets the pattern)

- **Goal**: a customer manages the addresses they will use in quotes and bookings.
- **PRD ref**: FG-3.2 shared tooling (Address Manager).
- **Depends on**: S1.02, S1.03, S1.04
- **DB**: `address_book_entry` (customer_group_id, label, company_name, address_line1/2, city, postal_code, country_iso, unloco nullable, contact_name, contact_email, contact_phone, is_default_shipper/consignee, created_by, updated_at, deleted_at). Import is synchronous — no job table.
- **Shared types**: `AddressBookEntryDto`, zod schema with country ISO validation.
- **API**: CRUD (`addressbook.manage`, delete requires `addressbook.delete`), CSV/XLSX import: upload → column mapping → row-level validation report → commit; XLSX export.
- **UI**: list with search, create/edit form, import wizard (3 steps), export button.
- **Integration**: none.
- **Tests**: isolation, permission, import validation (bad country, missing required field reported per row, valid rows committed).
- **Done when**: import of a 50-row sample file shows a correct row-level report.

### S1.06 [P] News and banners

- **Goal**: Noatum staff publish messages that customers see as pop-ups or banners.
- **PRD ref**: FG-4.5, FG-8.3.
- **Depends on**: S1.03, S1.04 (parallel with S1.05)
- **DB**: `news_item` (title, body, kind warning/info/hint, display popup_every_login/popup_once/banner, scope global/country/customer_group — region added when asked, valid_from, valid_to, published_by, status), `news_read_receipt` (user_id, news_item_id).
- **API**: author CRUD (`news.publish`), `GET /news/active` filtered by user's group/country and validity.
- **UI**: Noatum admin authoring screen; customer-side banner and pop-up components; dashboard "Noatum News" widget using `NewsCard`.
- **Tests**: validity window respected; scope filtering; "once" pop-up shown once.
- **Done when**: a banner published for one country appears only for users in that country.

### S1.07 Master data + integration backbone + tenant resolution

- **Goal**: the pipe to CW1 exists and is observable, and every inbound entity can be assigned to the right customer, even before real CW1 access.
- **PRD ref**: §5 integration service requirements, master data flow.
- **Depends on**: S1.02
- **DB**: `integration_message` (direction, message_type, source_message_id, portal_ref, payload text, status, attempts, correlation_id, created_at; retention delete job), `mapping_status`, `mapping_event_code`, `mapping_charge_code`, `mapping_document_type`, `master_unloco`, `master_currency`, `master_org` (mirror of CW1 organisations, daily upsert on lower(code), result as one audit row), `shipment_visibility` (empty until S2.01). Unmapped shipments are a view in S2.01, not a table.
- **Tenant resolution**: `TenantResolver` service in the worker — reads party org codes → `customer_account` → visibility grants using a single **global** visibility policy (local client, shipper, consignee grant; notify party and agent do not — per-group overrides deferred, see gaps.md). Worker runs in system context; API role cannot set it.
- **Shared types**: adapter interfaces `TmsQuoteAdapter`, `TmsBookingAdapter`, `TmsTrackingAdapter`, `TmsFinanceAdapter`, `TmsDocumentAdapter`, `RateEngineAdapter`.
- **API**: inbound endpoint for eAdapter outbound XML (queues, does not process inline); admin read of message log; mapping-table CRUD (Noatum admin).
- **Jobs** (pg-boss, in-process): consumer with idempotency (dedupe on source_message_id + portal_ref), retry with backoff, failed-jobs table as DLQ, raw payload in Postgres.
- **Simulator**: accepts inbound XML, logs, replies after delay.
- **UI**: Noatum admin: integration message log with filter and replay button; mapping-table editor (simple grid).
- **Tests**: same message twice = one row; failed message lands in DLQ after N retries; replay works; entity with only unmapped codes → stored, zero visibility, `unmapped_entity` row; `app_api` cannot set `app.is_system`.
- **Done when**: simulator → platform → log → replay demonstrated; organisation import from simulator CSV populates `master_org`.

### S1.07a [F] API foundation (PRD FG-9.3, P0 foundation)

- **Goal**: the platform's API is documented, versioned and ready to be exposed later without redesign.
- **Depends on**: S1.03
- **DB**: `api_client` (customer_group_id nullable, name, scopes[], status) — empty in Phase 1.
- **API**: OpenAPI published at `/v1/openapi.json`; global rate-limit middleware. No API keys, no client screen until Phase 5.
- **Done when**: OpenAPI validates in CI.

### S1.08 Quote list and quote wizard (draft)

- **Goal**: a customer fills in a quote request for Air, Sea FCL or Sea LCL and saves it as a draft.
- **PRD ref**: FG-3.1 request wizard.
- **Depends on**: S1.05, S1.07 (for UNLOCO/IATA lookups)
- **DB**: `quote` (customer_group_id, customer_account_id, reference, mode AIR/FCL/LCL, direction, incoterm, status, current_version_id, source portal/cw1, created_by), `quote_version` (quote_id, version_no, origin_unloco, dest_unloco, origin_address_id, dest_address_id, cargo jsonb or `quote_cargo_line` table, containers jsonb, commodity, hs_code, dg_flag, dg_un_no, dg_class, temp_control jsonb, services jsonb, references jsonb, remarks, validity_to, submitted_at), `quote_status_history`.
- **Shared types**: `QuoteDto`, `QuoteVersionDto`, zod per wizard step, **`chargeableWeight()`** function (Air max(kg, CBM×166.67); LCL revenue tons) shared by UI and API.
- **API**: create draft, autosave step, list with filters, get detail; `quote.create`.
- **UI**: quote list (Grid / Detail / Card switch, saved view), wizard with six steps and autosave, live chargeable-weight and CBM, FCL container picker, DG fields mandatory when flagged, address picker from address book.
- **Tests**: chargeable weight cases; DG validation; autosave restores draft.
- **Done when**: a draft survives page reload and shows correct chargeable weight.

### S1.09 Quote submit, status machine, rate-engine mock, CW1 round-trip

- **Goal**: submitting a quote either returns an instant price or goes to CW1 for manual pricing and comes back.
- **PRD ref**: FG-3.1 instant + manual paths, quote engine integration; §5 quote flows; OQ-1, OQ-2.
- **Depends on**: S1.07, S1.08
- **DB**: `quote_option` (version_id, carrier nullable, service, transit_days, validity_to, currency, total), `quote_charge_line` (option_id, charge_code, description, basis, qty, rate, currency, amount), status enum on quote.
- **API**: `POST /v1/quotes/:id/submit` (`quote.submit`) → **`RateEngineAdapter.price()` called synchronously inside `platform-api`** (25 s timeout, circuit breaker; on timeout fall through to manual path — CLAUDE.md rule 2); rates found → Quoted with options; none → In Progress + queue message for `TmsQuoteAdapter.sendRequest()` in the worker with the account's org code chosen server-side (`is_default_for_quotes` or user's pick by name); inbound "quote priced" and "staff-created quote" handlers adopt/update quotes through `TenantResolver`; replies whose org code no longer maps to the same group are quarantined; status machine Draft → Requested → In Progress/Quoted → Accepted/Rejected/Expired/Cancelled; expiry job.
- **Worker / Simulator**: rate-engine mock endpoint in the simulator (3–4 seeded lanes) consumed by the API's `RateEngineAdapter`; simulator replies with priced options after delay for the manual path.
- **UI**: submit button, status badges (status-colour tokens), option cards, charge-line table, totals per currency, activity timeline.
- **Tests**: every status transition; instant vs manual branching; rate-engine timeout → manual path; CW1-created quote appears within 60 s in simulator test; carrier name hidden when disclosure flag off (OQ-9 as feature flag); tampered org code in request body ignored; mismatched org code on reply → quarantined.
- **Done when**: both paths demoed end to end against the simulator.

### S1.10 Accept / reject, versions, branded PDF, copy, cancel

- **Goal**: customer accepts or rejects a quote; rejected quotes create a new version; accepted quotes are frozen and ready to book.
- **PRD ref**: FG-3.1 confirm/reject, quote actions, branded PDF (§8a).
- **Depends on**: S1.09
- **DB**: `quote_reject_reason` catalog; `rendered_document` (entity, version, blob_ref).
- **API**: accept (server validity check, freeze, notify CW1), reject with reason codes + text → new version in Requested, previous read-only; copy quote → new quote; cancel un-booked; PDF render job.
- **Worker**: PDF renderer from design-system template (red header band, Mulish, red rule, red footer).
- **UI**: Accept / Reject dialogs, version history tab, PDF download, copy and cancel actions.
- **Tests**: accept after validity → 409; accepted version immutable; reject creates v+1.
- **Done when**: PDF passes brand checklist; accept notifies simulator.

### S1.11 [P] Templates (quotes)

- **Goal**: save any quote as a reusable template; start a quote from a template.
- **PRD ref**: FG-3.1 quote actions, FG-3.2 Template Manager.
- **Depends on**: S1.08
- **DB**: `template` (customer_group_id, kind quote/booking, name, shared_org_wide, payload jsonb, created_by).
- **API / UI**: CRUD, share toggle, "use template" into wizard step 1.
- **Done when**: template pre-fills the wizard.

### S1.12 Customer admin and Noatum admin

- **Goal**: Noatum onboards a customer by configuration only; Customer Admin manages own users.
- **PRD ref**: FG-8.1, FG-8.2.
- **Depends on**: S1.03, S1.04
- **DB**: `user_invitation` (token_hash, expires_at, role_ids, customer_account_id, domain_override), `impersonation_session` (admin_id, target_user_id, reason, expires_at). No credential or MFA tables — Entra handles them.
- **API**: invite (single), resend, revoke, accept (Entra token + invitation token), deactivate/reactivate, assign roles (last-admin guard), set user's office (`customer_account_id`); Noatum: create group (pre-fill from `master_org`), **link org code = one audited action with a confirm dialog** (`approved_by` column ready if 4-eyes is wanted — ADR-003), tier + feature flags, parent/child, appoint Customer Admin, impersonate (always read-only) with audit.
- **UI**: Customer Admin → Users, Roles (read-only), Audit; Noatum Admin → Customers (Overview · Accounts · Users · Feature flags · Hierarchy · Audit), Impersonation banner. No approvals inbox, no role designer, no API-client screen.
- **Tests**: expired/used/revoked invitation rejected; wrong-domain email rejected; linking an already-linked code → 409 (case-insensitive); linking triggers re-evaluation; last Customer Admin cannot be removed; impersonation writes audit with both ids and blocks writes; parent sees children; user with an office set sees only that office's invoices (S2 fixture).
- **Done when**: a new pilot customer is onboarded without code.

### S1.13 Dashboard framework + notifications bell

- **Goal**: landing page with registered widgets and a working notification centre for quote events.
- **PRD ref**: FG-6 (minimal), FG-4.4 subset.
- **Depends on**: S1.09, S1.06
- **DB**: `widget_layout` (user_id, layout jsonb), `notification` (user_id, kind, title, body, deep_link, read_at).
- **API**: widget registry (code-side), layout save; notifications list, mark read/all read; quote status changes create notifications.
- **UI**: dashboard with widgets: last 5 active quotes, news, standalone-app links, StatCounter KPIs; bell with unread count.
- **Done when**: quote status change shows in bell within seconds.

### S1.14 Hardening and pilot readiness

- **Goal**: Phase 1 exit criteria met.
- **PRD ref**: §9 P1 exit, §7 NFRs.
- Includes: analytics event review, master-data import from CW1 extracts, real CW1 connection when OQ-2 clears (config change only), WCAG 2.1 AA pass on wizard + dashboard, load test quote list 100k rows < 2 s, brand review sign-off, pen test of tenant isolation.
- **Done when**: pilot customers quoting live against CW1.

---

## Phase 2 — Visibility (may start in parallel once S1.07 is done)

**Phase goal**: customers track shipments, see milestones, download documents and view invoices. Event-latency SLO met.

### S2.01 Canonical shipment model + CW1 tracking ingestion

- **PRD ref**: FG-1.3 canonical event model, §5 shipments/events flow, §6.
- **Depends on**: S1.07
- **DB** (Pattern B — no `customer_group_id`; visibility via `shipment_visibility`): `shipment` (hbl/hawb, mode, direction, service, incoterm, refs jsonb incl. customer references and PO refs, critical_path_code, status), `shipment_party` (shipment_id, role, org_code, name), `consol`, `container_unit`, `transport_leg` (vessel_id/flight, pol/pod, etd/eta/atd/ata), `milestone_event` (canonical_code, name, source_system, source_code, internal_flag, planned_at, actual_at, location, provenance jsonb), `critical_path_definition`, `mapping_event_code` rows for CW1 → Cargo IQ / sea codes, `master_vessel` (IMO, name, from CW1 master data), `business_term` (controlled business-language catalog: event names EN/ES), and **empty** `po_link` / `po_line` (PRD FG-2 architecture requirement; visibility inherited via shipment).
- **RLS**: Pattern B policy — `EXISTS (shipment_visibility WHERE customer_group_id = ANY(current_group_ids()))`; child tables join through `shipment_id`.
- **Ingestion**: `TmsTrackingAdapter` → canonical upsert → `TenantResolver` → `shipment_visibility` replaced in the same transaction.
- **Worker**: `TmsTrackingAdapter` (CW1) — UniversalShipment / UniversalEvent XML → canonical upsert; queue-polling fallback; latency metric.
- **Simulator**: emits shipment + events on a timer.
- **Tests**: mapping coverage; internal-flag set from mapping; latency measured; shipment with shipper in A and consignee in B visible to both, invisible to C; shipment with unmapped codes visible to nobody; `move_account` re-evaluation moves visibility.
- **Done when**: simulator shipment appears in DB with mapped events under 60 s.

### S2.02 Shipment search, list views, detail

- **PRD ref**: FG-1.2, FG-1.1 logged-in T&T.
- **Depends on**: S2.01
- **DB**: `saved_filter`, `saved_view`, search index (Postgres full-text or trigram on refs).
- **API**: unified search over Noatum refs, containers, customer references, PO references, invoice numbers (customer-reference fields indexed now so Phase 5 PO/SKU search is a data feed, not a search rebuild), list with Grid/Detail/Card, column chooser, export; `tt.view`.
- **UI**: search bar with type-ahead + recent; results in three views; shipment detail with milestone timeline, legs, containers, parties; internal events hidden for customers.
- **Tests**: internal event invisible in grid, detail, export; search < 1.5 s at 100k.
- **Done when**: pilot can find and open any shipment.

### S2.03 Public track & trace

- **PRD ref**: FG-1.1 public T&T, OQ-4.
- **Depends on**: S2.02
- **API**: unauthenticated endpoint calling the `SECURITY DEFINER` function `app.public_tracking(ref)` (LLD v3 §11), which returns critical-path milestones + office contact only; rate-limited, bot-protected (WAF from this phase); **multi-group match**: response shape and content identical whether the reference matches one or several customers' shipments — never reveals party names or the number of matches (decision recorded in gaps.md #1; confirm with Product).
- **UI**: public page with design-system header/footer.
- **Tests**: leak test — no addresses, documents, financials, predictive data in response or HTML.
- **Done when**: security review signs off.

### S2.04 Documents

- **PRD ref**: FG-1.5, §5 eDocs flow.
- **Depends on**: S2.01
- **DB**: `document` (shipment_id, type_code, internal_flag, **restricted** boolean, blob_ref, filename, size, uploaded_by nullable), `document_type` (code, name, internal_only, restricted_default). `restricted` limits **internal** users too: readable only with `finance.internal` (PRD FG-1.3 "internal users see everything except content flagged financial/restricted").
- **Worker**: `TmsDocumentAdapter` — eDocs to Blob with type tagging on ingest.
- **API / UI**: documents tab, single download, zip per shipment; `docs.view`; virus scan + size limit on uploads (gap).
- **Tests**: internal-only type invisible; zip contains only visible docs.

### S2.05 Financial visibility

- **PRD ref**: FG-1.6, §5 UniversalTransaction flow.
- **Depends on**: S2.01
- **DB**: `financial_transaction` (Pattern A: customer_group_id resolved from `addressee_org_code` only, shipment_id, kind invoice/credit_note, number, addressee_org_code, currency, total, issued_at, **restricted** boolean default true → internal users need `finance.internal`), `charge_line`.
- **Worker**: `TmsFinanceAdapter`.
- **API / UI**: invoices tab with charge lines; `finance.view`; **addressee rule** — visible only if user's account is the addressee.
- **Tests**: addressee rule across accounts in the same group.

### S2.06 Visibility feature flags

- **PRD ref**: FG-1.7.
- **Depends on**: S2.04, S2.05
- Flags: documents, financials, predictive, market_insights, premium. Enforced in API and UI.

### S2.07 Standard alerts + per-shipment subscriptions + notification centre

- **PRD ref**: FG-4.1, FG-4.4, OQ-6.
- **Depends on**: S2.01, S1.13
- **DB**: `alert_rule` (standard set, per-user toggle), `subscription` (user_id, shipment_id or container_id, event_codes[]).
- **Worker**: alert engine — on each ingested event / ETA change, evaluate rules and subscriptions, write notifications.
- **UI**: subscribe button on shipment; alert toggles; notification centre full page.
- **Tests**: ETA change beyond threshold creates one notification; deactivated rule creates none.

### S2.08 Full dashboard widgets

- **PRD ref**: FG-6.
- **Depends on**: S2.02, S2.07
- Widgets: shipments with potential delays, last tracking searches, last opened shipments, map of active shipments (MapLibre/Azure Maps), trade-lane overview, crisis notifications, StatCounter KPIs, "Did you know".

### S2.09 Standard reports with scheduling

- **PRD ref**: FG-7.1, RLS everywhere.
- **Depends on**: S2.01, S2.05
- **DB**: `report_definition` (standard kind), `report_assignment` (report_definition_id, customer_group_id, user_id nullable — group-level and user-level access, PRD FG-8.1 "report assignment" and FG-8.2 "assigns … report access", both P0), `report_schedule` (cron, format, recipients same-domain/same-group), `report_run`.
- **Admin**: Noatum assigns reports to a customer group; Customer Admin grants users within the group (`admin.reports.assign`).
- **Worker**: report runner + scheduler + branded PDF/XLSX/CSV export + email.
- **UI**: reports list, run with filters, export, schedule.
- **Tests**: cross-tenant test on every report; recipient domain validation.

### S2.10 Carrier event enrichment + AI data-quality (HITL)

- **PRD ref**: FG-1.3 Sea, §5 carrier enrichment, OQ-3, A.4 human-in-the-loop.
- **Depends on**: S2.01
- Provider adapter; merge step (dedupe, conflict, gap-fill) writes events with `provenance` and `confidence`; Noatum ops screen to review, override with reason, or reject merged events.
- **Tests**: every merged event has provenance; override keeps original.

### S2.11 Phase 2 hardening

- Event-latency SLO dashboard, load tests, public T&T synthetic checks, pilot tracking live.

---

## Phase 3 — Booking + Claims

### S3.01 Booking model + Path 1 (convert accepted quote)

- **PRD ref**: FG-3.2 Path 1, immutability acceptance criterion.
- **Depends on**: S1.10, S2.01
- **DB**: `booking` (customer_group_id, quote_id nullable, status, frozen_commercial_terms jsonb, cw1_shipment_ref, milestone_gate_code), `booking_version`, `booking_cargo_line`, `booking_status_history`, `milestone_gate_config`.
- **API / UI**: "Book" on accepted quote → pre-filled booking wizard (quote steps + addresses, references, documents); status machine Started → Submitted → Confirmed → In Transit → Delivered.
- **Tests**: commercial terms copied as snapshot, never a live reference.

### S3.02 Booking Path 2 (direct booking, inline quote)

- **PRD ref**: FG-3.2 Path 2.
- **Depends on**: S3.01, S1.09
- Direct start; instant price → inline accept → continue; else manual quote request and booking held as Started/Incomplete.

### S3.03 Booking documents upload → CW1, submission, confirmation

- **PRD ref**: FG-3.2 document upload, post-confirmation, §5 booking flows.
- **Depends on**: S3.01, S2.04
- **DB**: `booking_document`.
- **Worker**: `TmsBookingAdapter` — UniversalShipment (booking) + eDoc attach; inbound confirmation with CW1 shipment ref → deep link to T&T.
- **Tests**: uploaded doc arrives in simulator; ref shown after confirmation.

### S3.04 Booking cancel gate, templates, copy

- **PRD ref**: FG-3.2 booking actions, OQ-5.
- **Depends on**: S3.03, S1.11
- Cancel allowed until configured milestone (default before origin receipt), enforced server-side with clear message; booking templates; copy booking.

### S3.05 Sailing schedule (standalone + embedded)

- **PRD ref**: FG-9.2, FG-3.2 sailing integration. **Gap**: data provider not named in PRD.
- **Depends on**: S3.01
- **DB**: `sailing_schedule` cache.
- Public restricted page + inline selection in Sea booking; ranking fastest / most reliable / least disruption / best CO2 (CO2 after S4.03).

### S3.06 Claims with Dynamics 365

- **PRD ref**: FG-5.
- **Depends on**: S2.02
- **DB**: `claim` (shipment_ids[], incident_type, description, d365_case_ref, status), `claim_comment`, `claim_attachment`.
- **Worker**: Dataverse API — create case with attachments, two-way comment sync, status sync.
- **UI**: claims list, new claim form, detail with thread. Resolution notification email + in-app.
- **Tests**: case created with all attachments; comment round-trip.

### S3.07 Advanced alerts (per tier)

- **PRD ref**: FG-4.2, OQ-10.
- **Depends on**: S2.07
- Rule catalog: departed-docs-missing, arrived-not-cleared in X days, delivery delay; off by default; enabled by user or by Noatum per tier.

### S3.08 Email notification rule builder

- **PRD ref**: FG-4.3.
- **Depends on**: S3.07, S1.12
- **DB**: `email_rule` (trigger, scope filter jsonb, frequency), `email_rule_recipient` (domain-validated), `email_digest_queue`.
- **Worker**: immediate + digest sender with branded templates.
- **UI**: block-based rule builder; Customer Admin recipient management.
- **Tests**: recipient outside customer domain rejected.

### S3.09 Phase 3 hardening

- Portal bookings executing in CW1; claims round-trip with D365.

---

## Phase 4 — Intelligence & Analytics

### S4.01 Predictive ETA/ETD with provenance and override

- **PRD ref**: FG-1.4, A.4.
- **DB**: `eta_prediction` (leg_id, predicted_at, eta, confidence, model_version, override_eta, override_reason, override_by).
- **Worker**: inference client; recompute on leg change.
- **UI**: predicted vs carrier ETA with confidence and delta; ops override screen.

### S4.02 Disruption intelligence + benchmarking

- **PRD ref**: FG-1.4.
- **DB**: `disruption_event`, `benchmark_snapshot`. Feed + alerts; on-time and transit reports.

### S4.03 Emissions service + T&T CO2 + booking CO2

- **PRD ref**: FG-1.4 CO2, FG-3.2 predicted CO2, OQ-11. See `KB-CO2-Emissions-Calculator.md`.
- **DB**: `emission_factor` (versioned, never deleted), `emission_record` (+ factor_version, distance_source, leg_breakdown, override fields).
- **Worker**: `EmissionsAdapter` → `LocalGlecAdapter` (own factors, own air distance, `searoute` for sea, Azure Maps for road); predicted on leg change, final at close.
- **UI**: CO2 column, band filter, detail panel with provenance; booking wizard figure with disclaimer.

### S4.04 Public CO2 calculator

- **PRD ref**: FG-9.1.
- **Depends on**: S4.03
- Public page, mode comparison, lowest-CO2 highlight, cache + rate limit, "convert to quote/booking" requires login.

### S4.05 Self-service report builder

- **PRD ref**: FG-7.2.
- Field picker, filters, column order, aggregations, export, scheduling, personal/org-shared.

### S4.06 Embedded Power BI

- **PRD ref**: FG-7.3.
- App-owns-data embedding, service principal, dataset RLS by customer group, branded theme JSON, admin assignment of reports per customer.

### S4.07 AI assistant / chatbot

- **PRD ref**: FG-4.6.
- **DB**: `chat_session`, `chat_message`, `chat_escalation`.
- Tenant-scoped RAG over platform DB + approved content; tool calls into quote/booking wizards; brand voice; escalation → D365 case with transcript; red-team test suite.

### S4.08 Training walkthroughs

- **PRD ref**: FG-8.5, OQ-8.

### S4.09 Platform analytics for Noatum

- **PRD ref**: FG-8.6. Built on `analytics_event` stream emitted since S1.

### S4.10 Phase 4 hardening

- Predictive accuracy baseline published; chatbot tenant-isolation certified.

---

## Phase 5 — Ecosystem

### S5.01 PO visibility + OM deep link
- **PRD ref**: FG-2, OQ-7. `po_link`, `po_line` (tables exist empty since S2.01); config-gated panel; SKU/PO search; SSO deep link.

### S5.02 External API GA + API management
- **PRD ref**: FG-9.3. `api_key`, `api_usage`; Azure API Management; developer docs; scopes and quotas.

### S5.03 BYOBI data feed
- **PRD ref**: FG-7.4. Governed feed for large customers; admin controls quotas.

### S5.04 Second TMS adapter
- Implement the five interfaces for TMS2 + mapping rows — proves the architecture.

### S5.05 Additional languages
- Business-language catalog + AI-assisted translation pipeline with human review (A.4).

---

## 4. Slice order summary (Phase 1 at a glance)

```
S1.01 Monorepo ─┬─ S1.02 Tenancy ── S1.03 Roles ──┬── S1.05 Address book ── S1.08 Quote wizard ── S1.09 Submit + CW1 ── S1.10 Accept/PDF ── S1.13 Dashboard ── S1.14 Harden
                │                                  ├── S1.06 News [P]                             └─ S1.11 Templates [P]
                │                                  └── S1.12 Admin
                └─ S1.04 Design system + shell     S1.07 Integration backbone (before S1.09)
```

## 5. Scope guardrails

- Phase 1 scope is exactly the feature list in the Phase 1 table plus the foundational empty tables the PRD names (PO entities, canonical models, adapters, widget/notification frameworks, analytics events, design tokens).
- No Phase 2+ screens in Phase 1, even where tables exist.
- No rate tables: `RateEngineAdapter.price()` returns options; we store what we receive.
- No PO lifecycle: `po_link`, `po_line` only.
- Proposals we introduced beyond the PRD are tracked in `docs/gaps.md`. Everything removed for simplicity, and the seam kept for each, is in `docs/Simplification-Register.md`. Before adding a table, runtime, cache or screen, check that register first.

## 6. Rules for changing this plan

- A slice may be split, never merged into a bigger one.
- A new requirement not in the PRD is written to `docs/gaps.md` first, then added as a slice if approved.
- Re-order only within a phase; a P1/P2 item never moves ahead of an unfinished P0 in the same phase.
