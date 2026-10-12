# Foundation gap register and remediation plan

| | |
| --- | --- |
| Version / date | 1.1 / 17.09.2026 |
| Purpose | The complete list of gaps between what the documents claim and what the code does, a prioritised plan to close them, and ready-to-paste task prompts for the agent doing the work |
| Evidence basis | Source read directly on 17.09.2026 — guards, tenancy, all 35 migrations, every module service, the integration module, the job runner, and the SPA. **No tests, lint, typecheck or build were run** (verification is user-scheduled) |
| Scope boundary | **This plan owns the foundation. It does not own quotations.** Everything quotation-shaped belongs to [`Quotation-Module-Phase-Plan.md`](Quotation-Module-Phase-Plan.md) — see R7 and R8. Its §0 is the precedence rule for every quotation document |
| Related | [ADR-008](../adr/ADR-008-background-work-queue.md) · [Quotation module phase plan](Quotation-Module-Phase-Plan.md) · [CW1 integration surface](../design/CW1-Integration-Surface-and-Quotation-Paths.md) · [CLAUDE.md](../../CLAUDE.md) foundation rules · `docs/03-Agent-Metaprompt.md` |

> **Honesty note.** Several of these gaps exist because documents were written from the
> *intended* architecture in `CLAUDE.md` rather than from the code. The gap register below is
> written the other way round: every row cites what the source actually does.

---

## 1. The gap register

Severity: **S1** breaks a stated foundation rule or a security property · **S2** makes a
documented claim untrue · **S3** correctness or maintenance defect.

### A · Adapter layer

| # | Gap | Evidence | Severity |
| --- | --- | --- | --- |
| A1 | **Six ports do not exist**: `TmsTrackingAdapter`, `TmsQuoteAdapter`, `TmsBookingAdapter`, `TmsFinanceAdapter`, `TmsDocumentAdapter`, `EmissionsAdapter` | `src/contracts/adapters/` contains exactly one file, `email.adapter.ts` | **S1** — foundation rule 2 names all of them |
| A2 | **`RateEngineAdapter` is in the wrong place** — `src/modules/quotes/rate-engine.adapter.ts`, so the integration module imports *upward* into a feature module | `integration.module.ts` line 4 | **S1** |
| A3 | **`Cw1ShipmentAdapter` has no port above it.** A concrete CargoWise class, exported from `IntegrationModule` and injectable directly into business code | `integration/cw1/cw1-shipment.adapter.ts`, exported at `integration.module.ts` line 56 | **S1** |
| A4 | **There is no quote write-back to CargoWise at all.** The entire CargoWise surface is `Cw1Client.post/exchange`, `Cw1RateAdapter.rate()` and `Cw1ShipmentAdapter.listByOrgCodes()` | Searched every file under `integration/cw1` | **S2.** Written on 17.09.2026 as "the Phase 1 commitment"; **corrected the same day** — the director capped the quotation scope, so the outbound write-back is path B behind a switch. The **inbound** direction is what Phase 1 needs first. Owned by the quotation phase plan, Q4 and Q5 |

### B · Background queue

| # | Gap | Evidence | Severity |
| --- | --- | --- | --- |
| B1 | **`JobsService.enqueue()` has zero callers.** Nothing in the API ever queues work | Repo-wide search for `.enqueue(` returns only the definition | **S2** |
| B2 | **No scheduler.** No pg-boss `schedule()`, no cron, so `master-org.sync` can never run automatically. "Refreshed daily" is aspirational | Search for `schedule(` / `cron` returns nothing | **S2** |
| B3 | `quote.expiry` handler is a log-only stub | `TODO(S1.06)` in `quote-expiry.handler.ts` | S3 |
| B4 | `shipment.refresh` handler is a log-only stub | `TODO(S2.01)` in `shipment-refresh.handler.ts` | S3 — Phase 2, acceptable |
| B5 | **`OrganisationsService` calls `OrganisationImportService.run()` inline from an HTTP request** | `organisations.service.ts` line 138 | **S1** — foundation rule 2: nothing but `RateEngineAdapter` calls an external system inline |
| B6 | Invitation and reset email is sent **inline and best-effort** from the request path | `customers.service.ts` `sendInvitationEmail()` | S3 |

### C · Integration foundation

| # | Gap | Evidence | Severity |
| --- | --- | --- | --- |
| C1 | **No `integration_message` table.** No raw-message archive, no replay, no durable idempotency store | No model in `schema.prisma`, no migration | **S1** — named in `CLAUDE.md` and PRD §5 (13-month retention) |
| C2 | **No inbound endpoint.** The `integration` module has no controller, so CargoWise cannot push anything to us today | No controller file in `src/integration` | **S2** |
| C3 | Correlation identifier exists in `TenantContext` but the browser → API → job → CargoWise chain has never been demonstrated end to end | No evidence either way in source | S3 |

### D · Quotes module — the weakest area, and it is the Phase 1 feature

| # | Gap | Evidence | Severity |
| --- | --- | --- | --- |
| D1 | **`create()` silently discards validated input.** `createQuoteSchema` validates `currency`, `packages`, `incoterm`, `notes`, `volumeM3`; only `grossWeightKg` and `payload` are persisted | `quotes.service.ts` `create()` against `contracts/schemas/quote.schema.ts` | **S2** |
| D2 | **`accountId` is written straight from the request body with no ownership check.** RLS protects reads, but PostgreSQL validates foreign keys internally, so a foreign account id is accepted. `TenantResolverService.orgCodeForAccount()` exists for exactly this and is not used | `quotes.service.ts` `create()` | **S1** — tenancy |
| D3 | **`nextReference()` is `count + 1`** — concurrent creates collide on `@@unique([customerGroupId, reference])` and surface as a raw 500. Also an O(n) COUNT per create | `quotes.service.ts` | S3 |
| D4 | **No `quote.status.ts`.** The lifecycle exists only as a Prisma enum | `contracts/` holds only `customer.status.ts` | **S1** — backend convention: "status machines are explicit" |
| D5 | `rate()` opens three separate transactions and enforces no service-level timeout | `quotes.service.ts` `rate()` | S3 |

### E · Customers module

| # | Gap | Evidence | Severity |
| --- | --- | --- | --- |
| E1 | **Every customer-administration audit row is written with `customerGroupId` NULL.** It runs under `runInternal`, so the RLS insert passes on `is_internal`. A Customer Admin holding `admin.audit.read` can therefore never see their own audit trail | `customers.service.ts` `audit()` | **S2** |
| E2 | **`goLiveFacts.invitedAdministrators` counts *any* user** in `invited \| registered \| active`, not administrators. The go-live gate reads "at least one user row exists" | `customers.service.ts` `goLiveFacts()` | **S2** |
| E3 | **Suspending a customer does not lock anyone out.** Only `closed` disables users; `suspended` changes status alone | `customers.service.ts` `changeStatus()` | **S1** — security |
| E4 | `detach()` hard-deletes the `customer_account` row; history survives only in audit | `customers.service.ts` `detach()` | S3 |
| E5 | `invitations()` hard-codes `emailStatus: 'not-configured'` for every historic row | `customers.service.ts` `invitations()` | S3 |

### F · Cross-cutting and security

| # | Gap | Evidence | Severity |
| --- | --- | --- | --- |
| F1 | **Login rate limiting is per process.** `RateLimiterMemory` for both the account and address budgets. With two instances an attacker gets a multiple of the intended budget | `local-auth.service.ts`, and the file's own comment admits it | **S1** — blocks multi-instance deployment |
| F2 | **`AuditInterceptor` is a placeholder.** Each service writes its own audit row, which is how E1 slipped through | `TODO(S1.03)` in `audit.interceptor.ts` | S3 |
| F3 | **`AnalyticsEvent` is never persisted.** Six services emit `logger.log({ event: 'AnalyticsEvent', … })` and there is **no `analytics_event` table in the schema** | `customers/features/lookups/operating/organisations/users` services; `schema.prisma` | **S2** — DoD item 7 and FG-8.6 assume a queryable stream |
| F4 | `TenantGuard` mutates `ctx.customerGroupId` in place and never checks the supplied group exists; a bad identifier yields silent empty results rather than 400 | `tenant.guard.ts` | S3 |
| F5 | **Email provider conflict.** `AzureEmailAdapter` targets Azure Communication Services; the app registrations are a Microsoft Graph design, and no ACS resource exists in any subscription | `integration/email/azure-email.adapter.ts` | S3 — blocked on a decision, not code |
| F6 | **Bootstrap admin lockout has no recovery.** `local_bootstrap_admin` raises when a working credential exists, and no admin route reaches an internal user's credential or MFA | migration `20260923000000`, `customers.service.ts` | S3 |
| F7 | `app.local_account_security(uuid[])` performs no tenancy check of its own; it is safe only because callers pass identifiers from a tenant-scoped query | migration `20260926000000` | S3 |
| F8 | No `Retry-After` header on 429 responses | `local-auth.controller.ts` | S3 |
| **F9** | ~~The UI cannot read a feature switch.~~ **Closed 17.09.2026 by R10.** `CurrentUserDto.features` now carries the enabled keys, from the same catalogue and rows the guard reads | `current-user.dto.ts`, `feature-switch.service.ts`, `shared/features/useFeature.ts` | Closed |

### G · Frontend

| # | Gap | Evidence | Severity |
| --- | --- | --- | --- |
| G1 | **`src/api/public/contracts.ts` hand-writes zod shapes for five endpoints that do not exist**, against the rule that API shapes are generated. The file says so itself | `src/api/public/contracts.ts` | **S2** |
| G2 | **`PublicTrackingDto` carries `eta`, `etaRevised` and `progressPct` on a public surface.** If that ETA is our computed one, it breaches the rule that public endpoints expose no predictive data | same file | **S1 — answered 18.09.2026.** Both sources are supported, each behind its own switch. The carrier's published figure may show publicly; **anything we compute is off by default and needs a recorded approval.** `etaRevised` and `progressPct` are ours, so they fall under the second switch |

### H · Verification state

| # | Gap | Severity |
| --- | --- | --- |
| H1 | No pipeline has ever been executed. CI enforces `openapi.json` freshness but has never run | S3 |
| H2 | Tests exist for isolation, jobs, staff, customers and organisations, but the newer local-auth admin and self-service paths have none | S3 |

---

## 2. What this means, in one paragraph

The **security and tenancy foundation is genuinely strong** — four guards, forced RLS, narrow
GUC gates, a link gate enforced by foreign key, an import brake, credential tables with no
runtime grant. The **weakness is the outward-facing spine**: the adapter layer is two ports
instead of eight, the queue has no producers, there is no message archive and no inbound
endpoint, and the quote write-back that Phase 1 promises has no code. Most of it is small,
mechanical work. One item — the quote write-back — is a genuine feature.

---

## 3. The remediation plan

> **Amended 17.09.2026 by product direction.** CargoWise is the main source of truth and the
> integration mechanism is deliberately still open. A quote request is **always** copied to
> CargoWise; pricing in the portal becomes an **optional capability behind a feature switch**,
> off by default, while pricing inside CargoWise is the normal path. The full specification of
> our integration surface — every plausible inbound and outbound mechanism, the envelope, the
> endpoints we expose and the configuration keys — is in
> [`design/CW1-Integration-Surface-and-Quotation-Paths.md`](../design/CW1-Integration-Surface-and-Quotation-Paths.md).
> Consequences below: **R3 rises in priority**, R7 must carry both paths from the start, and
> **R8 is reframed** from "the quotation feature" to "path B behind a switch".

> **Amended again 17.09.2026, at director level.** Christian confirmed the organisation has no
> rate database, no rate storage, no standard format and **no standardised quoting process**,
> and asked for "a very LIGHT quoting module". This caps R7 and R8 rather than changing their
> order. No rate tables, no pricing queue, no charge-code schema, no approval chain — a price
> recorded by a person or received from CargoWise, an optional document, free text. The
> phase-by-phase build is in
> [`Quotation-Module-Phase-Plan.md`](Quotation-Module-Phase-Plan.md); the scope cap and its
> reasoning are in the PRD amendment of 17.09.2026.
>
> **It also strengthens the case for R1–R4.** In an organisation redesigning its system
> landscape, the boundary work is the part that survives; anything shaped to a specific
> pricing system is the part that does not.

Ordered so each package leaves the tree in a better state than it found it, and so the cheap
truth-restoring work happens before the expensive feature work.

| # | Package | Closes | Size | Why this position |
| --- | --- | --- | --- | --- |
| **R1** | **Adapter layer made real** | A1, A2, A3 | Small | Thin abstract classes and one module rewiring. No business logic changes. Makes foundation rule 2 true and makes the CargoWise document honest |
| **R2** | **Rate limiter to PostgreSQL** | F1 | Small | **Built 18.09.2026.** New `auth_rate_limit` table reached only through `app.rate_limit_*`, and `RateLimiterService` replacing `RateLimiterMemory`. Deliberately not the library's `RateLimiterPostgres`: it needs a `pg` client we do not have and creates its own table outside migrations and RLS. 429 now carries `retryAfterSeconds`, closing F8 too |
| **R3** | **Integration spine** — `integration_message`, the universal inbound door, replay, operations screens | C1, C2 | Medium | **Half built 18.09.2026 as C1.** The table, both directions, the recording service and the relay exist and are verified. **Still open: the inbound HTTP door, replay and the operations screens** — C7 |
| **R4** | **Queue wiring** — a scheduler, `quote.expiry` implemented, retention, plus the first production `enqueue()` callers | B1, B2, B3, B5, B6 | Medium | **Built 19.09.2026.** Scheduler (`integration.relay` every minute, `quote.expiry.fanout` hourly, `master-org.sync` nightly, `integration.retention` nightly), `quote.expiry` implemented with audit, retention redacting settled payloads, and handler tests. **The two remaining inline calls — invitation email and the operator-initiated organisation import — are recorded as deliberate exceptions in [ADR-009](../adr/ADR-009-permitted-inline-external-calls.md), not left as silent breaches.** `cw1.poll` / `cw1.extract.fetch` are deferred to C2, with the transport that will use them |
| **R5** | **Audit and analytics truth** | E1, F2, F3 | Medium | **Half built 18.09.2026.** Customer audit rows now carry `customer_group_id` and the impersonator, so a Customer Admin can read their own history. **Still open: there is no `analytics_event` table**, so nothing is queryable — needed before the measurement Q3 promises |
| **R6** | **Customers correctness** | E2, E3, E4, E5 | Small | **Built 18.09.2026.** Suspending a customer now locks its people out — enforced from the customer's own status on each sign-in, not by mutating user rows, so restoring cannot re-enable someone an administrator blocked individually. Go-live counts holders of the customer administrator role instead of any user |
| **R7** | **Quotation module — the portal half** | D1–D5 | — | **Superseded. Owned by [`Quotation-Module-Phase-Plan.md`](Quotation-Module-Phase-Plan.md) phases Q0–Q3.** Q0 alone closes D1–D5. Nothing quotation-shaped is planned here any more |
| **R8** | **Quotation module — the CargoWise round trip** | A4 | — | **Superseded. Owned by the phase plan, Q4 and Q5.** Q4 creates the `quotations.cw1_request_sync` switch, Q1 creates `quotations.portal_pricing`. Both still need R1, R3 and R4 to land first |
| **R9** | **Public surfaces slice** | G1, G2 | Medium | **Unblocked 18.09.2026.** The product owner chose to carry both ETA sources and decide later by configuration. Design in §R9.1 below. Still needs the public endpoints to exist before the switches are registered — a switch that gates nothing is a lie on the admin screen |
| **R10** | **Feature switches readable by the UI** — `features: string[]` on `CurrentUserDto`, `hasFeature()` / `useFeature()` in the SPA | F9 | Small | **Built 17.09.2026.** `FeatureSwitchService.enabledKeys()` feeds `/api/me`; `useFeature(key)` reads the cached session; the lookups "New type" button is the first consumer, gated on `lookups.type_creation` — the same key its API route already enforced. **Verification pending** |

**R1 and R2 together are roughly a day and remove four S1 findings.** Start there. **R10 is
small and unblocks every switch-driven screen**, so do it before Q1's UI rather than after.

### R9.1 The public tracking ETA — decided 18.09.2026

**The question was:** is the ETA on public tracking the carrier's published figure, or one we
compute? The answer from the product owner: *"Can we put both options? Make it part of the
feature, because I am also not aware now."*

**That is the right call, and it is not the same as showing both.** The two have different
risk, so they get different switches and different defaults.

| Switch | Default | Approval | What it shows publicly |
| --- | --- | --- | --- |
| `tracking.public_eta_carrier` | **on** | No | The **carrier's own published** arrival date. A fact the carrier already publishes against that booking |
| `tracking.public_eta_predicted` | **off** | **Yes** | Anything **we** derive — a predicted ETA, `etaRevised`, `progressPct` |

**Why the computed one is off and needs a recorded approval.** The security rule says a public
endpoint returns no predictive data. A figure we calculate is our own analysis of a customer's
freight, offered to anyone holding a tracking number, and a confident-looking date we got wrong
is a commercial promise nobody at Noatum made. Turning it on is a decision somebody should have
to sign, which is exactly what `requiresApproval` records.

**Three rules for whoever builds this**

1. **Provenance is stored, not inferred.** Every ETA carries its source — `carrier` or `portal` —
   written when the value is recorded. A public surface filters on that field. Deciding at render
   time what "looks like" a carrier date is how the wrong one escapes.
2. **Off means absent, not hidden.** When `tracking.public_eta_predicted` is off the service must
   **omit the fields entirely**. A value still present in the JSON is not off, whatever the page
   draws (foundation rule 4).
3. **Register the switches with the endpoints, not before.** The five public routes do not exist
   yet. A switch that gates nothing tells an administrator they have a control they do not have.

**This also settles G1.** The hand-written zod contracts in `src/api/public/contracts.ts` are
deleted when the real endpoints land and the client is generated from OpenAPI, as every other
surface already is.

**On R7 and R8.** These two rows described quotation work before the director capped the
quotation scope on 17.09.2026. Rather than restate that cap here and let the two documents
drift apart again, **all quotation work now belongs to one plan**:
[`Quotation-Module-Phase-Plan.md`](Quotation-Module-Phase-Plan.md). This plan keeps the
foundation packages R1–R6 and R9, which the quotation phases depend on. The division is:
**this document owns the boundary and the platform; that one owns the feature.**

---

## 4. Task prompt — R1, ready to paste

```
SLICE: R1 — Adapter layer made real
PHASE: 1 (foundation correction, not a new feature)
PLAN REFERENCE: docs/plans/Remediation-Plan-Foundation-Gaps.md → R1
RULES REFERENCE: CLAUDE.md foundation rule 2 (canonical model + adapters)
DEPENDS ON: nothing. This is pure structure.
OPEN QUESTIONS TOUCHED: none.

CONTEXT YOU MUST ACCEPT BEFORE STARTING:
CLAUDE.md foundation rule 2 says every external system sits behind an interface in
src/contracts/adapters, and names TmsTrackingAdapter, TmsQuoteAdapter, TmsBookingAdapter,
TmsFinanceAdapter, TmsDocumentAdapter, RateEngineAdapter and EmissionsAdapter.
In the code today only EmailAdapter is there. RateEngineAdapter sits in
src/modules/quotes/rate-engine.adapter.ts, so IntegrationModule imports upward into a
feature module. Cw1ShipmentAdapter is a concrete CargoWise class exported straight out of
IntegrationModule with no port above it. Verify all three statements yourself before
changing anything; do not take them on trust.

GOAL (one sentence):
Every external system the platform will talk to has a port in src/contracts/adapters, so
business code can never bind to a CargoWise class.

SCOPE — build exactly this, nothing more:
DB:      none.
TYPES:   In src/contracts/adapters, create one file per port, each an abstract class with
         the method signatures and the canonical request/result types:
           - tms-tracking.adapter.ts   (shipments, consols, containers, milestones)
           - tms-quote.adapter.ts      (create request, submit priced quote, accept/reject/cancel)
           - tms-booking.adapter.ts    (create, update, cancel, confirmation)
           - tms-finance.adapter.ts    (invoices and credit notes, addressee carried)
           - tms-document.adapter.ts   (list metadata, fetch payload by identifier)
           - emissions.adapter.ts      (deferred scope — signature only, no implementation)
         MOVE rate-engine.adapter.ts from src/modules/quotes into src/contracts/adapters
         unchanged, and update its importers.
         Money stays in minor units as bigint. Never a float. Dates are Date.
API:     none. No controller changes.
WORKER:  none.
INTEGRATION:
         Make Cw1ShipmentAdapter extend the new TmsTrackingAdapter, and bind it in
         integration.module.ts as { provide: TmsTrackingAdapter, useClass: Cw1ShipmentAdapter }.
         Stop exporting the concrete class. The five ports with no implementation yet are
         NOT bound and NOT exported — a port with no provider must fail at startup if
         something injects it, which is the behaviour we want.
TESTS:   Prepare, do not run:
           - a unit test asserting every abstract method is declared (compile-level is enough)
           - a test that IntegrationModule binds TmsTrackingAdapter to Cw1ShipmentAdapter
           - a repo-structure test asserting no file under src/modules imports from
             src/integration, and no file outside src/integration imports a Cw1* class

OUT OF SCOPE — do not touch:
- Any business logic, any service method body, any controller, any migration.
- The quotes module beyond updating the RateEngineAdapter import path.
- Implementing any of the five new ports. Signatures only.
- Anything in the SPA.

ORDER OF WORK: contracts → integration module → tests. Do not start anywhere else.

STEP 1 — PLAN MODE. Before any code, give me:
- the list of files you will create, move or change, grouped by layer
- for each new port, the method signatures you propose and the canonical types they use
- how you will bind, or deliberately not bind, each port in integration.module.ts
- any question or assumption
Stop and wait for approval.

STEP 2 — after approval, implement in the stated order.

VERIFICATION POLICY — READ THIS CAREFULLY:
Verification in this repository is USER-SCHEDULED. Do NOT run tests, typecheck, lint,
formatters or verification-only builds unless the user explicitly asks in that turn.
Finishing the slice is not permission. Do not route these through a subagent or a script
either. Write the tests, leave them unrun, and report "implemented; verification pending"
with the list of deferred checks and the risks you are aware of. Never claim a check passed
that you did not run.

STEP 3 — finish with:
- the Definition of Done checklist from CLAUDE.md, each item ticked with the file that
  satisfies it, or marked not-applicable with a reason
- the exact list of checks you did not run
- a 5-line description of what a reviewer should look at first

TRAPS IN THIS REPOSITORY, LEARNED THE HARD WAY:
- The path alias @/contracts works for `import type` ONLY. Value imports must be relative,
  or the CommonJS build fails at runtime with "Cannot find module '@/contracts'".
- get_errors is not trustworthy immediately after an edit. Grep the file for what should
  now exist, or compile.
- Files checked out from git are CRLF; files you write are LF. A scripted replace whose
  anchor contains \n will match nothing and still report success. Verify the FILE, not the
  script output.
- Never rewrite a source file from PowerShell. Windows PowerShell 5.1 writes the ANSI code
  page and will corrupt every accented character.
```

---

## 5. Task prompt — R2, ready to paste

```
SLICE: R2 — Login rate limiting moves to PostgreSQL
PHASE: 1 (security correction)
PLAN REFERENCE: docs/plans/Remediation-Plan-Foundation-Gaps.md → R2 and gap F1
RULES REFERENCE: ADR-006 (pilot portal-managed authentication); ADR-008 §5 (why not Redis)
DEPENDS ON: nothing.

CONTEXT:
LocalAuthService holds two budgets, byAccount and byAddress, as RateLimiterMemory. Those
count per process. The moment the API runs on two instances an attacker gets a multiple of
the intended budget, and the file's own comment says so. rate-limiter-flexible ships a
PostgreSQL store. This is the fix. Redis is explicitly rejected — see ADR-008 §5.

GOAL:
Login, MFA and password-link attempt budgets are shared across every API instance.

SCOPE:
DB:      A migration creating the limiter's table explicitly. Do NOT let the library create
         it at runtime. Follow docs/.github/instructions/migrations.instructions.md: the
         table needs an RLS policy like every other table — decide and justify whether it is
         internal-only, and grant portal_app exactly what the limiter needs and nothing more.
         Provide down.sql.
TYPES:   none.
API:     LocalAuthService only. Swap the two RateLimiterMemory instances for the PostgreSQL
         store. Keep the existing semantics EXACTLY:
           - the address budget is consumed on every attempt, with a block duration
           - the account budget is consumed ONLY on failure, rolling window, no hard block
           - an exhausted account budget returns the SAME generic 401, so it never confirms
             that an account exists
         These three behaviours are deliberate. If the PostgreSQL store cannot express one
         of them, stop and tell the user rather than changing the behaviour.
         While you are here, add Retry-After to the 429 response (gap F8).
WORKER:  none.
TESTS:   Prepare, do not run: budget consumed on failure only; generic 401 on exhaustion;
         address budget blocks; the limiter survives a simulated second instance by sharing
         the table.

OUT OF SCOPE:
- Any other part of local-auth. No MFA, session, password or challenge changes.
- Redis, in any form.

ORDER OF WORK: migration → service → tests.

STEP 1 — PLAN MODE: files, the migration outline including the RLS policy and grants, and
how you will preserve each of the three behaviours above. Stop for approval.

VERIFICATION POLICY: identical to R1. User-scheduled. Do not run checks unless asked in
that turn. Report "implemented; verification pending".

NOTE FOR THE HUMAN REVIEWER: this slice blocks multi-instance deployment. It should land
before the API is put behind a load balancer in any real environment.
```

---

## 6. Briefing prompt — if you want one agent to own the whole programme

```
You are picking up a foundation-correction programme on the Noatum Customer Information
Platform. Read, in this order, before doing anything:
  1. CLAUDE.md — the rules. Six foundation rules, the definition of done, and the
     business-first cadence with user-scheduled verification.
  2. docs/plans/Remediation-Plan-Foundation-Gaps.md — the gap register and this plan.
  3. docs/adr/ADR-008-background-work-queue.md — why the queue is pg-boss and what would
     change that. Do not propose RabbitMQ, Service Bus or Redis without reading §6 and §7.

WHAT YOU ARE FIXING AND WHY:
The security and tenancy foundation of this platform is strong. The outward-facing spine is
not. The adapter layer has two of its eight ports, the job queue has no producers, and there
is no raw-message archive and no inbound endpoint. Several project documents currently claim
otherwise; correcting the code is how those claims become true.

Quotations are NOT in your scope here. The director capped that module on 17.09.2026 and it
has its own plan, `docs/plans/Quotation-Module-Phase-Plan.md`. Your work is what that plan
depends on.

HOW TO WORK:
- One package at a time, in the order R1 … R9 in the plan. **R7 and R8 are superseded** — take
  quotation work from `docs/plans/Quotation-Module-Phase-Plan.md` instead, and only after
  R1, R3 and R4 have landed. **R10 is small and gates every switch-driven screen**; do it
  before any UI that hides a control when a feature is off.
- Plan mode first, every time. List the files, the migration outline, the endpoints with
  their permission codes and the test list. Stop and wait for approval before writing code.
- Order within a package: DB → contracts → API + tests → OpenAPI → UI. Never start with the
  screen.
- Stay inside the package. If you find work outside it, write it to docs/gaps.md or propose
  a new package. Do not do it silently.
- Verification is USER-SCHEDULED. Do not run tests, typecheck, lint, formatters or
  verification-only builds unless the user asks in that turn. Prepare tests alongside the
  code and leave them unrun. Report "implemented; verification pending" with the deferred
  checks and the known risks. Never claim an unrun check passed, and never call a slice
  release-ready.
- A commit spans two repositories: commit and push inside apps/<app>, then git add apps/<app>
  and commit the moved pointer in the parent. Work pushed to a child the parent does not
  point at is invisible to a fresh clone and to CI.

WHAT SUCCESS LOOKS LIKE FOR THE PROGRAMME:
Every statement in CLAUDE.md foundation rule 2 is true of the code; the job queue has real
producers and a scheduler; an inbound CargoWise message can be received, archived,
de-duplicated and replayed; a customer's quote request reaches CargoWise and the priced
result comes back; and no audit or analytics claim in the definition of done is satisfied
only by a log line.

START BY: reading the three documents above, then giving me your plan for R1 only.
```

---

## 7. What is deliberately not in this plan

| Item | Why |
| --- | --- |
| Shipments, documents, invoices, bookings, claims, reports | Phase 2 and later. R1 creates their ports; their modules stay empty |
| Email provider decision (F5) | A decision, not code. ACS against Graph, and the unscoped `Mail.Send` grant on two app registrations, both need an owner |
| Public surfaces (R9) | **Unblocked 18.09.2026** — both ETA sources carried, chosen by switch. The computed one is off by default and needs approval. See §R9.1 |
| CO2 / emissions | Deferred programme-wide pending methodology, provider and disclaimer |
| Any broker or cache | Settled by ADR-008. Reopening needs a trigger from §6, not a preference |
