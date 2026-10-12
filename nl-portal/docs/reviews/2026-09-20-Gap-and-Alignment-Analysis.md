# Gap analysis and API/SPA alignment

| | |
|---|---|
| **Written** | 20.09.2026 |
| **Baseline** | PRD v4.0 feature groups FG-1…FG-10 · `plans/Project-Kickoff-and-Phase1-Plan.md` stages F1.01–F1.10 · `plans/Remediation-Plan-Foundation-Gaps.md` R1–R10 · `plans/Quotation-Module-Phase-Plan.md` Q0–Q5 |
| **Method** | Reading only. No test, lint, typecheck, build or database command was run. Counts are from the working tree, which contains an uncommitted slice |
| **Companion** | [`2026-09-20-Platform-Critique.md`](2026-09-20-Platform-Critique.md) — code quality and ranked defects |

---

## Part A — Gap analysis

### A.1 Phase 1 coverage, stage by stage

Judged against each stage's own exit test, not against its bullet list.

| Stage | Goal | State | What is missing |
|---|---|---|---|
| **F1.01** Repository, local environment, pipeline | One command runs everything | **Mostly met** | Compose starts PostgreSQL only; the simulator never joined it, though the exit test requires API, web *and* simulator. `packages/design-system` and `packages/shared-types` were deliberately replaced by self-contained apps — a documented deviation, not a gap |
| **F1.02** Identity and tenancy | A user can never see another's data | **Met, and then some** | Nothing. This is the strongest area of the codebase. ADR-006 added portal-managed pilot authentication on top |
| **F1.03** Roles, permissions, branch scoping | Every endpoint protected | **Met in mechanism, broken in delivery** | The guard fails closed, which is stronger than the promised route-coverage test — but that test is still claimed in `permissions.ts:176-177` and does not exist. **Branch scoping is enforced on 1 of 9 pricing routes** (critique B3) |
| **F1.04** Design system and application shell | Every screen lands in the brand automatically | **Partial** | The shell and tokens exist. The lint rule that rule 6 says enforces them **does not exist**; the CI accessibility check does not exist; visual regression does not exist. A second, unreferenced `Kit*` component family now duplicates 23 components |
| **F1.05** CargoWise connection and tenant resolution | The pipe exists and is observable | **Half** | `integration_message`, `mapping_entry`, `master_org` and the tenant resolver exist. **No inbound HTTP endpoint** — the `integration` module has no controller, so CargoWise cannot push anything. **No replay.** **No `shipment_visibility` table at all.** Correlation id is always the literal `"unknown"`, so the end-to-end trace the exit test demands cannot be produced |
| **F1.06** Customer onboarding and user management | Onboard by configuration alone | **Largely met** | Customers, organisations, linking, invitations, roles and self-service team management are real and substantial. Three gaps: **email cannot be delivered at all**, impersonation is half-built and unreachable, and customer editing has an API route no screen calls |
| **F1.07** Customer quote request | A complete structured request | **Partial** | The wizard, dangerous goods and equipment are built. **Address book does not exist** — `address_book_entry` is a table with RLS and no module, no controller, no screen. **Templates do not exist**, same shape. The exit test's "a tampered organisation code is ignored" **passes** (`quotes.service.ts:701-722` checks ownership explicitly). The exit test's chargeable weight is computed server-side but from a browser-supplied gross weight (critique H5) |
| **F1.08** Internal pricing, approval, write-back | Price in the portal, CargoWise receives it | **Built well beyond the cap, except the write-back** | The pricing module is 1,158 lines: queue, claim, release, force-release, price, approve, send-back, publish, four-eyes, threshold from scoped settings. That is more than the "very light" director cap of 17.09.2026 asked for. **The write-back does not deliver** — `pricing.service.ts:899` records a message, every transport is `none`, and the backlog is never settled |
| **F1.09** Accept, reject, PDF, dashboard, news | The customer completes the journey | **Quarter** | Accept and reject exist in the status machine. **No PDF generation exists anywhere in either app.** **News does not exist** — `news_item` is a table with RLS and seeded permissions above a 17-line empty module. Dashboard is a shell with a small widget set. No notification bell backing |
| **F1.10** Hardening and pilot readiness | Exit criteria met | **Not started** | No k6, no axe, no penetration test, no second-region rehearsal. `infra/bicep/modules/` holds one `.gitkeep`; the CD pipelines state their Azure targets are placeholders that do not exist |

**Phase 1's exit test is: the pilot customer requests a quote, an internal user prices it, CargoWise has it, the customer accepts and downloads the PDF.** Four of those five steps are blocked today — pricing by critique B1, CargoWise by the undelivered write-back, and the PDF by its complete absence.

### A.2 The recurring shape: table, policy, permission — and nothing above it

Three Phase 1 capabilities exist entirely in the data layer with no code above them. Each has a table with row-level security, seeded permissions, and a 17-line empty NestJS module.

| Capability | Table | Permissions | Module | Screen |
|---|---|---|---|---|
| Address book (S1.05, "the first business slice") | `address_book_entry` (`schema.prisma:952`) | `addressbook.manage`, `addressbook.delete` | 17-line shell | `.gitkeep` |
| Templates | `quote_template` (`schema.prisma:934`) | seeded | 17-line shell | `.gitkeep` |
| News and banners | `news_item` (`schema.prisma:978`) | `news.publish` | 17-line shell | `.gitkeep` |

This matters more than three missing features. It is the same shape `gaps.md` §F6 already identified and named — *"a mechanism without its write path is not a slice, it is a half-built thing that reads as complete in a summary"* — and it is what makes module counts misleading: **16 of 30 API modules are 17-line empty shells**, all registered in `AppModule`, so the application's import list describes a platform roughly twice the size of the one that exists.

### A.3 Remediation register R1–R10, verified against code

`plans/Remediation-Plan-Foundation-Gaps.md` records several items as built with verification pending. Read against the source today:

| # | Claim | Verified state |
|---|---|---|
| **R1** Adapter layer made real | Built | **Confirmed.** All seven ports exist in `src/contracts/adapters/` with a boundary spec. A1–A3 genuinely closed |
| **R2** Rate limiter to PostgreSQL | Built 18.09 | **Confirmed.** `auth_rate_limit` table, rolling account budget, `retryAfterSeconds` on 429 |
| **R3** Integration spine | Half built | **Confirmed half.** Table, recording service and relay exist. **Inbound HTTP door and replay still absent** — no controller in `src/integration` |
| **R4** Queue wiring | Built 19.09 | **Confirmed.** `enqueue()` now has two callers (`pricing.service.ts:889`, `quote-expiry-fanout.handler.ts:56`); scheduler live with four cron entries; dedupe key is exactly `sourceMessageId + portalRef` folded into a deterministic UUID; enqueue joins the caller's transaction. The claim in the Q-plan that `enqueue()` has zero callers is **out of date** |
| **R5** Audit and analytics truth | Half built | **Confirmed half, and the other half is not what the register says.** `analytics_event` now exists. But `AuditInterceptor` remains a no-op *and is not registered as an interceptor at all*, so F2 is open, not partial |
| **R6** Customers correctness | Built 18.09 | **Confirmed.** Suspension now locks out from the customer's own status; go-live counts administrator-role holders |
| **R7** Quotation portal half | Superseded by Q0–Q3 | **Q0 largely landed.** `quote.status.ts` exists and is excellent; `nextReference` is now a row-locked SECURITY DEFINER function; `accountId` ownership is checked. **D-class defect remaining:** `rate()` still bypasses the status machine it now sits beside (critique B2) |
| **R8** CargoWise round trip | Superseded by Q4–Q5 | **Not started.** No CW1 quote adapter implementation; transports are `none` |
| **R9** Public surfaces slice | Unblocked | **Not started.** Five endpoints still do not exist (see B.3) |
| **R10** Feature switches readable by the UI | Built 17.09 | **Confirmed on the read side.** `/api/me` carries `features`; `useFeature` exists. **But only two call sites exist app-wide, and only two of nine switches are enforced server-side** — the reading mechanism landed, the gating did not |

### A.4 Feature-group coverage, PRD v4.0

| Group | Priority | State |
|---|---|---|
| FG-1 Shipment visibility, track and trace | P0, Phase 2 | Not started — correct. No `shipment` family and no `shipment_visibility`, so **tenancy Pattern B has no instance and has never been exercised** |
| FG-2 Purchase orders | Phase 5 | Not started — correct |
| FG-3.1 Quotations, customer side | P0 | Request wizard, DG, equipment, list, detail, accept, decline. Missing: PDF, templates, address book, saved views, copy quote |
| FG-3.2 Booking | P0, Phase 3 | Not started — correct. The schema correctly avoids a 1:1 quote→booking chain |
| FG-3.3 Internal pricing | P0 | Built beyond the cap except the CargoWise write-back and the AI-drafting interface |
| FG-4 Alerts and notifications | P0 | Bell placeholder only. News absent. No subscription model |
| FG-5 Claims | P1, Phase 3 | Not started — correct |
| FG-6 Dashboard | P0 | Shell with a small widget set; no widget registry, no persistence |
| FG-7 Reporting | P0/P1, Phase 2 | Not started — correct |
| FG-8 Platform administration | P0 | The strongest delivered area: customers, organisations, operating structure, staff, lookups, features, settings. Missing: news administration, report assignment, working impersonation |
| FG-9.3 Platform API foundation | P0 | OpenAPI published and CI-validated. **`api_client` table absent; versioning inert** |
| FG-10 Preconditions | P0 | Identity, tenancy, adapters and i18n met. Scalability untested; observability broken by the constant correlation id |

### A.5 Gaps not in the project's own register

`gaps.md` and the remediation plan are unusually thorough, which makes the residue worth listing precisely. These are not recorded anywhere:

1. **The staff portal shell locks out four of five internal presets** (critique B1). Not in any register.
2. **`quotations.instant_rate` is reachable without its switch** (critique B2), and can overwrite an accepted quote — against a protected capability the catalogue declares non-switchable.
3. **Seven of nine switches gate nothing**, two of them carrying `requiresApproval: true`. The register applies "a switch that gates nothing is a lie on the admin screen" to the public-surface switches only; it applies to the majority of the catalogue.
4. **The customer layer of scoped settings is unreadable** — the same defect class as the region layer that §F6 records fixing, one layer over.
5. **`grossWeightKg` is browser-computed and trusted** (critique H5). The plan's "shared chargeable-weight function" was correctly not written; what replaced it is worse.
6. **Branch scoping is absent from eight of nine pricing routes** (critique B3).
7. **No PDF generator exists** — an F1.09 exit-test item with no entry anywhere.
8. **`down.sql` policy is self-contradictory.** ADR-001 requires one per migration; `prisma/migrations/README.md` says forward-only. 57 exist, none are runnable, two are wrong.
9. **`pg_trgm` is not installed** while four `ILIKE '%…%'` predicates carry the quote search under a 1.5-second budget.
10. **`mapping_entry` is seeded empty** while 6,700 lines of CargoWise document-type and event-code catalogues sit in `prisma/seed-data/` as JSON. Foundation rule 5 assigns those codes to mapping tables; confirm they reach one.
11. **Tenancy Pattern B has never been exercised.** Half of foundation rule 1 is unimplemented and untested, and Phase 2 depends entirely on it.
12. **The parent repository points at stale submodule commits**, so CI has never seen the newest slice.

---

## Part B — API and SPA alignment

### B.1 The pipeline is sound

Worth stating first, because it removes a whole category of suspicion. 100 route decorators across 15 controllers, 100 operations in `openapi.json`, 100 in the generated `schema.d.ts` — **exact set equality in both directions**. `generate-contracts.yml` produces the document from the real controllers without a running server and fails the build on drift. The uncommitted `QuoteEquipmentDto` is already in the document.

**Every alignment defect below is in what the contract does not carry, or in what the two sides read differently from the same field.** None is a stale artefact.

### B.2 The dominant defect class: `nullable` in the DTO, `.optional()` in the zod

The OpenAPI DTO declares a field `nullable: true`; the zod schema that actually validates it says `.optional()`, which rejects `null`. The generated client faithfully tells the SPA it may send `null`, the SPA does, and the server refuses. **The client obeys the contract and the server rejects it.**

| # | Symptom | API | SPA |
|---|---|---|---|
| **A1** | **A price cannot be saved when any optional field is blank.** ~14 fields affected; `costMinorUnits: null` is sent on *every* charge line, so even a fully completed option 400s | `quote-pricing.schema.ts:26,29,39,44-58,83` vs `pricing.dto.ts:394-438` | `OptionEditor.tsx:262,266-279,284,286,290`; `money.ts:15-26` returns `null` for an empty box |
| **A2** | **Declining a quote without a reason always 400s**, and the button is never disabled | `customer-quote.dto.ts:285` `.optional()` vs `:288-290` `nullable: true` | `quotes.ts:144` sends `reason: null`; `QuoteDetailPage.tsx:415` |
| **A3** | A dangerous-goods flashpoint left blank becomes `NaN` → `null` → 500 | | `DangerousGoodsEditor.tsx:288-290` |

*Fix for the whole class:* `.optional()` → `.nullish()`. Then add a contract test that fails when a DTO declares `nullable: true` over a zod schema that is not `.nullish()` — otherwise the class returns with the next DTO.

### B.3 Endpoints that exist on only one side

**SPA calls routes that do not exist — 5, all public.**

`/api/public/landing`, `/api/public/tracking`, `/api/public/emissions/reference`, `/api/public/emissions/estimate`, `/api/public/access-request` (`src/api/public/contracts.ts:37-41`). This is `gaps.md` P12, still open, with one detail the register does not record: the stand-in is opt-in and `.env.uat:10` and `.env.prod:10` both set `VITE_PUBLIC_API_MOCK=false`. A UAT or production build therefore renders the landing counters, the CO2 calculator and the access-request form as failures, and the tracking box reads a 404 as "no such container" (`client.ts:120-124`).

The design is deliberate and the reasoning is written down at `client.ts:18-25` — honest failure beats a fabricated shipment. The gap is that the endpoints were never built, and R9 remains not started. `.env.uat` and `.env.prod` also carry an empty `VITE_API_BASE_URL`, so no deployed build is configured at all yet.

**API endpoints no screen consumes — 14 of 100.** Most are correct (health probes, the unbuilt `POST /quotes/:id/rate`). Two are real gaps:

- `PATCH /api/admin/customers/{id}` (`customers.controller.ts:116`) — there is no `PATCH` anywhere in `src/features/admin/api/customers.ts`. **A customer's profile cannot be edited through the portal.**
- `POST /api/admin/customers/{id}/discard` (`customers.controller.ts:164`) — `useCustomerLifecycle` handles go-live, suspend and close only. A draft customer cannot be discarded.

**Matched:** 86 of 86 non-public calls agree exactly on method and path. No verb or spelling mismatch anywhere.

Bookings, shipments, documents, invoices, news, claims, reports, templates and address book are empty on **both** sides, so there is nothing to compare — those are scope gaps (Part A), not alignment defects.

### B.4 Error contract — the two sides read different fields

`all-exceptions.filter.ts:33` emits `{ statusCode, error, details, correlationId, path }`. Several SPA handlers read `body.message`, which the filter never sends — `team.ts:26-31` and `local-auth.ts:84-87`, so every invitation refusal renders as `Request failed (409)` rather than its reason.

Four routes make this worse by passing a zod issues **array** into `BadRequestException`, so `.message` is `undefined` and the body carries no message at all: `pricing.service.ts:471`, `quotes.service.ts:265,339`, `settings-admin.service.ts:160`. Combined with B.2, a pricer who leaves a field blank gets a blank toast.

Three further routes call `.parse()` and throw a bare `ZodError` the filter does not recognise, producing **500 for a validation failure**: `quotes.service.ts:557`, `account.service.ts:196,328`.

`correlationId` is the literal string `"unknown"` in every response and every error log (`all-exceptions.filter.ts:24-25` reads a property that `auth.guard.ts:141` sets on `request.user` instead).

### B.5 Status and enum alignment

| Defect | Evidence |
|---|---|
| `AccountUserDto.status` declares 3 values; the service emits all 5 Prisma values. With `fallbackLng: false`, `registered` and `suspended` render as the literal key `teamStatus_registered` | `account.dto.ts:98` vs `account.service.ts:158`; `TeamPage.tsx:122-126` |
| The staff stepper reports "all stages complete" for `rate_failed`, `withdrawn` and `expired` | `PricingDetailPage.tsx:28-33` |
| Five reachable statuses have no staff label | |
| `rate_failed` is badged "Requested" but excluded from that filter, so it is unreachable in the list | |
| `expired` and `withdrawn` are missing from the customer badge list | |
| `emailStatus` has four values; one is handled | |

The quote status machine itself is correct and complete on the API side (`quote.status.ts`). Every defect here is the SPA handling a subset of what the API can emit.

### B.6 Permission and feature-key alignment

- **The shell gate** — critique B1, the single most damaging item in this report.
- **`StaffPage.tsx:22-74` hand-copies 51 of 55 permission codes** and has already drifted from `contracts/permissions.ts`. This is the one place a hand-written mirror of an API shape has caused live divergence.
- **Eight permissions gate writes the UI shows unconditionally** — the user sees a control that 403s.
- **`/portal/unassigned` is gated on the wrong permission family.**
- **`useFeature` is non-reactive.** It reads `getQueriesData()` without subscribing (`useFeature.ts:26`), so a control hidden before `/api/me` resolves stays hidden. Only two call sites exist app-wide, against nine catalogue keys.
- **`isCustomerVisible` defaults to `true` in the lookup form and `false` in the contract** (`LookupsPage.tsx:538` vs `lookup.dto.ts:74`) — a privacy default inverted at the screen.

### B.7 Validation alignment

Beyond the `nullable`/`.optional()` class:

- Slug, lookup-key, region and branch regexes exist server-side only; the forms submit and receive a 400.
- `password-rule.ts:8-19` duplicates the server's password policy and says so — *"Keep in step with"* — manual synchronisation by admission.
- IMDG rules are re-implemented at `DangerousGoodsEditor.tsx:293-311`, and `toDangerousGoodsInput` returns `null` on failure, **silently dropping the entry from the payload** instead of blocking submit. A customer can submit a request believing they declared dangerous goods when they did not.
- `GET /api/quotes` marks all four query parameters required, forcing the SPA into `as never`. Eleven `as never` casts on request bodies exist in total, including `team.ts:88` where `InviteColleagueDto` exists and types `roleKeys` as a six-value enum while the client declares `string[]`.

### B.8 Pagination and envelope

Consistent everywhere except `CustomerQuoteListDto`, the only list envelope without `page`/`pageSize`. `GET /api/pricing/queue` truncates at 200 with no paging and no signal (critique M5). `/app/team` loads two unbounded lists and renders every row (critique M15).

### B.9 Auth and session

Cookie session with a CSRF token, restored before the portal decides who is signed in (`main.tsx`). Two defects: 401 and 403 are collapsed in the SPA's error handling, and a 401 leaves the stale CSRF token in place so every subsequent call also 401s — the user must reload rather than being sent to sign-in.

---

## Part C — Ordered remediation

Sequenced by consequence per hour. Items marked ▲ unblock Phase 1's exit test.

**1 — Half a day, unblocks the Phase 1 journey**

| | Fix | Where |
|---|---|---|
| ▲ | Gate the staff shell on `dashboard.read`, not `admin.staff.read` | `StaffPortalLayout.tsx:51` |
| ▲ | `@RequireFeature('quotations.instant_rate')` + `assertTransition` on `rate()` | `quotes.controller.ts:56`, `quotes.service.ts:728` |
| | `.optional()` → `.nullish()` across the pricing and decline schemas | `quote-pricing.schema.ts`, `customer-quote.dto.ts:285` |
| | Emit `message` alongside `error`, and pass a string into `BadRequestException` | `all-exceptions.filter.ts:33` and the four call sites |
| | Commit the three submodule pointers | parent repository |

**2 — This week**

▲ Branch check on the eight unguarded pricing routes · wrap `SettingsService.rowsFor`/`allRows` in `runInternal()` · `pg_has_role` clause on `user_identity_resolution` and `org_batch_write` · fix the three `MM/DD/YYYY` dates · assign DG line ids before validating uniqueness · block submit instead of dropping a DG entry · register or delete `AuditInterceptor` · assign `correlationId` where the filter reads it.

**3 — The change that alters the trajectory**

Adopt `dangerous-goods-switch.e2e-spec.ts` as a rule: **one test per catalogue key proving the API refuses when the switch is off.** Seven of the nine switches close as a consequence, and a future catalogue entry without a passing test stops being a claim anybody can make. Do the same for the permission-coverage test that `permissions.ts:176-177` already promises.

**4 — Decisions that are blocking work, not code**

The `down.sql` contradiction between ADR-001 and `prisma/migrations/README.md`. The email provider (ACS versus Graph) — until it is settled, no invitation and no password reset can be delivered. Whether `mapping_entry` is seeded from the existing JSON catalogues. Whether the public endpoints (R9) are in Phase 1 at all, since the landing page is a prototype until they exist.

**5 — Before Phase 2 starts**

Tenancy Pattern B — `shipment_visibility` and the shipment family — is half of foundation rule 1, has no instance, and has never been tested. Every Phase 2 feature stands on it. It should be built and exercised against the isolation suite before the first shipment screen is designed, not alongside it.
