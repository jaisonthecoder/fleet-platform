# Platform critique — database, API and SPA

| | |
|---|---|
| **Written** | 20.09.2026 |
| **Scope** | `apps/noatum-customer-portal-api` (20,366 LOC), `apps/noatum-customer-portal-ui` (29,818 LOC), `prisma/` (43 models, 57 migrations, 7,706 lines of SQL), `infra/`, `.azuredevops/` |
| **Method** | Reading only. No test, lint, typecheck, build or database command was run, per the standing verification direction. Every finding below carries a file and line that can be opened |
| **Companion** | [`2026-09-20-Gap-and-Alignment-Analysis.md`](2026-09-20-Gap-and-Alignment-Analysis.md) — scope coverage and API/SPA contract defects |

---

## 1. Verdict

**The invariants are built to a standard well above the norm for a platform this young. The edges are not.**

Tenancy is not merely implemented, it is machine-proven: all 43 tables carry `ENABLE` *and* `FORCE` row-level security with at least one policy, and `test/isolation/tenant-isolation.spec.ts:163-172` fails the build if any table in `public` lacks either. The permission guard fails closed. Money is BigInt minor units everywhere, with zero floating-point columns. The quote status machine is written as data with its retired values documented and refused. Cost lives in a separate table rather than behind a mapper, because "RLS is row level and cannot hide a column" (`prisma/schema.prisma:842-848`) — which is correct, and correctly reasoned.

Against that, a customer can destroy an accepted quote with one POST; four of the five internal role presets cannot reach the staff portal at all; seven of the nine feature switches change nothing when flipped; and the fourth layer of the four-layer settings hierarchy is structurally unreadable. None of these are subtle. All of them sit one layer out from the invariants that were built so carefully.

That asymmetry is the finding. The rest of this document is evidence for it.

---

## 2. What is genuinely strong

Recorded first, because a critique that only lists defects will be read as a verdict on the whole and it is not.

| Area | Evidence |
|---|---|
| **RLS coverage, machine-enforced** | 43/43 tables `ENABLE` + `FORCE` + policy. The meta-test at `test/isolation/tenant-isolation.spec.ts:163-172` queries `pg_class`/`pg_policy` and fails on any gap, so coverage cannot silently regress |
| **Tenant context cannot leak across a pooled connection** | `set_config(key, value, true)` is transaction-local and is the first statement inside `prisma.$transaction` (`src/common/tenancy/tenant.repository.ts:42-45, 84-92`). `tenant-isolation.spec.ts:142-147` tests the pool-reuse case explicitly. `portal_app` is `NOBYPASSRLS` |
| **No unsafe SQL anywhere** | Zero `$queryRawUnsafe`/`$executeRawUnsafe` in `src`; all 72 raw sites are parameterised tagged templates |
| **Permission guard fails closed** | `src/common/guards/permission.guard.ts:49-53` throws on a route that declares no permission. 100 routes, zero undecorated. Guard order is Auth → Tenant → Permission → Feature (`src/app.module.ts:101-106`) |
| **Credential handling** | argon2id, sessions stored as `sha256(sessionId)` only, idle + absolute expiry + `security_version` + `disabled_at` enforced in one SQL predicate (`prisma/migrations/20260922000000_local_auth_foundation/migration.sql:312-315`), session regenerated before identity attaches, TOTP replay blocked by spent-step tracking, recovery codes hashed. No hand-rolled cryptography. No seeded credential of any kind |
| **The dev bypass is genuinely gated** | `DEV_AUTH_ENABLED` refuses to boot in production, double-enforced at `src/config/env.validation.ts:70-76` and `src/config/configuration.ts:49-50`. The SPA side requires `import.meta.env.DEV` *and* `VITE_DEV_AUTH` (`src/auth/dev-session.ts:20`) |
| **Quote status machine** | `src/modules/quotes/quote.status.ts` — transitions as data, retired values that remain reachable outbound but are refused as targets, and a customer badge collapse (`claimed`/`priced`/`approved` → `in_progress`) that *is* the confidentiality control. Fully unit-tested per transition |
| **Money and domain modelling** | Zero `Float`/`Double`/`real`; BigInt minor units, `Decimal(12,3)` quantities. No `booking` or `shipment` table exists, so no 1:1 quote→booking chain has been modelled — v4 rule 3 is honoured by omission, and `quote.reference` is already unique per group under a row lock, which is the join key a one-to-many booking link will need |
| **Contract generation** | `.azuredevops/templates/generate-contracts.yml` produces `openapi.json` from the real controllers without a running server and fails the build on drift. Result: 100 route decorators, 100 operations in the document, 100 in the generated client — exact set equality both directions |
| **i18n parity, enforced at build** | `vite.config.ts:38-50` fails the build unless EN and ES key sets match with no blank Spanish value. 1,599 keys across four pairs, zero drift. Hard-coded user-facing strings total 15, and 12 are inside the quarantined mock file |
| **Accessibility fundamentals** | Every input labelled, every icon-only button named, skip links on all three shells, `scope` on `<th>`, Radix for all dialogs but one, colour never the sole signal (`PricingQueuePage.tsx:189-192` pairs colour, icon and text) |
| **Honest failure over fake data** | `src/api/public/client.ts:18-25` makes the public-API stand-in opt-in, never opt-out, with the reasoning written down: one forgotten variable must never show a deployed customer a shipment that does not exist |

---

## 3. The systemic pattern

Three shapes recur often enough to be causes rather than coincidences. Each defect in §4 is an instance of one of them.

### 3.1 A mechanism is built; the one path that makes it real is missing

`docs/gaps.md` §F6 already names this lesson, in the project's own words:

> *A capability is finished when somebody outside the codebase can exercise it end to end.*

It was written on 19.09.2026 about scoped settings. The same shape is present in at least five other places today:

- **Scoped settings, again.** The customer layer — the fourth of four — is unreadable. `SettingsService.rowsFor`/`allRows` (`src/common/settings/settings.service.ts:205, 215`) read through `PrismaService` outside any tenant transaction, so `app.current_group()` is NULL and the policy at `prisma/migrations/20261003000200_scoped_settings/migration.sql:74-81` excludes every `scope = 'customer'` row from *every* caller, staff included. The admin screen writes them, lists them, and shows them beside an effective value that ignores them. The docstring at `settings.service.ts:45-48` asserts the opposite of what happens.
- **Feature switches.** Nine catalogued, two enforced (§4.3).
- **Rollback scripts.** 57 of 57 migrations have a `down.sql`, several of genuinely high quality — `20261003000100_quote_lifecycle/down.sql` inverts a status data-move and names its one lossy mapping. There is no `migrate:down` script in `package.json`, nothing references them outside documentation, and all 57 are unexecuted. Two are wrong on inspection.
- **The audit interceptor.** `src/common/interceptors/audit.interceptor.ts:29-34` is a no-op *and* is not registered as an `APP_INTERCEPTOR` in `app.module.ts:100-107`. Foundation rule 8 rests entirely on 14 hand-written `auditEvent.create` calls; a new controller inherits nothing.
- **The quote write-back.** `pricing.service.ts:899` records a `QUOTE_PRICED_SUBMIT` message. Every transport is `none` and the relay handler is report-only, so nothing reaches CargoWise and the pending backlog grows one unsettled row per publish.

### 3.2 A correct principle is written down once and not applied to its sibling

The reasoning is present in the repository. It simply was not carried across.

- `prisma/migrations/20260922000000_local_auth_foundation/migration.sql:580-582` states the principle exactly — *"any role may set its own custom GUC"* — and revokes table grants on the five credential tables so a GUC alone cannot unlock them. The same hazard on `"user"` was not revoked (§4.2).
- In one block of four policies, three are written `FOR SELECT` and the fourth — on `"user"`, the table that decides who you are — is not (`20260912000000_staff_identity_and_role_presets/migration.sql:43-62`).
- `20260929010000_quote_request_fields/migration.sql:67-77` revokes a grant **and then asserts the revoke landed**. That pattern, copied once more, would have caught the `integration_message` DELETE grant that its own comment claims does not exist (`20261001000000_integration_message/migration.sql:117-119`).
- `local_session.assurance` has a `CHECK` constraint. `branch.source`, `org_change_log.change_type` and `local_mfa_factor.type` are the same shape with none.

### 3.3 A rule is stated in a comment that the code below it does not keep

These are the most expensive defects in the set, because the comment is what a reviewer reads.

| Comment | Reality |
|---|---|
| `src/shared/money.ts:9-11` — *"The API owns every total. Nothing here adds two charge lines together"* | `OptionEditor.tsx:60-67` sums charge lines; `PricingDetailPage.tsx:87-90` reduces those sums to a maximum and drives the approval banner and the Publish button from it |
| `QuoteRequestPage.tsx:102` — *"The server recomputes chargeable weight"* | True of `chargeableKg`, false of `grossWeightKg`, which is the browser's own total and the input the server's calculation consumes (§4.4) |
| `contracts/permissions.ts:176-177` — *"a test fails the build when the database and this file disagree"* | No such test exists |
| `contracts/dto/customer-quote.dto.ts:143` — *"Never carries cost or margin"* | True, and structurally guaranteed. Recorded because it is the one in this table that holds |
| `quote.schema.ts:216-218` — claims a second server-side uniqueness check on dangerous-goods line ids | It does not exist |
| `20261001000000_integration_message/migration.sql:117-119` — *"no DELETE grant… nothing in a request path can erase the record"* | `ALTER DEFAULT PRIVILEGES` granted DELETE before the table existed, and the `FOR ALL` policy permits it for internal sessions |
| `settings.service.ts:45-48` — describes cached reads invalidated on write | The cache was removed in the §F6 pass; the comment was not |

---

## 4. Ranked findings

Severity is judged on consequence, not on how hard the fix is. **Blocker** means Phase 1's stated exit test cannot be performed today.

### BLOCKER

**B1 — Four of the five internal role presets cannot reach the staff portal.**
`apps/noatum-customer-portal-ui/src/app/layouts/StaffPortalLayout.tsx:51` gates the entire `/portal` `<Outlet>` on `admin.staff.read`. In `contracts/permissions.ts` that code appears in exactly one of the eleven presets — `PLATFORM_ADMIN`, line 194. (The other occurrence, line 103, is `INTERNAL_ONLY_PERMISSIONS`, which is a prohibition list, not a grant.) So `customer_success`, `pricing`, `pricing_approver` and `ops` sign in holding `pricing.queue.read`, `pricing.price`, `pricing.publish`, `admin.customers.read` — and land on a "no access" panel.

Phase 1's exit test is *"a Noatum user prices the request in the portal."* The roles built to do that cannot open the screen.
*Fix:* gate the shell on `dashboard.read` (which every internal preset holds) and let each route keep its own permission, as it already does.

**B2 — `POST /api/quotes/:id/rate` can destroy an accepted quote.**
`src/modules/quotes/quotes.service.ts:728-768` has no status precondition and no `assertTransition`. It overwrites `totalMinorUnits`, `currency`, `validUntil` and `rateResponse`, then writes `status: 'rated'` — a member of `RETIRED_QUOTE_STATUSES` that `canTransition` refuses from every source state. The route (`quotes.controller.ts:56`) carries only `quotes.create`, granted by two customer presets, and no `@RequireFeature('quotations.instant_rate')`.

Because no rate source is configured, the call falls into the `catch` at `:761` and writes `status: 'rate_failed'` instead — so the accepted quote is wrecked on the failure path too. This breaks the `accepted_immutability` protected capability (`contracts/feature-switches.ts:153-155`), which the catalogue states may never be switchable.
*Fix:* `@RequireFeature('quotations.instant_rate')` on the route — the switch defaults off, so this closes it everywhere — plus `assertTransition(quote.status, 'rated')` before the write.

**B3 — Pricing writes are authorised across branches on eight of nine routes.**
`pricing.cross_branch` is enforced only in the queue listing (`pricing.service.ts:88`). `detail`, `claim`, `release`, `forceRelease`, `price`, `approve`, `sendBack` and `publish` each take a quote id and never check the servicing branch. Any pricer holding a quote's UUID can price, approve and publish another branch's work. Four-eyes still holds (`:719-721`); branch separation does not.

PRD FG-3.3 makes branch scoping a v4.0 requirement, and CLAUDE.md rule 7 states it as a foundation rule.
*Fix:* lift the existing `branchFilter` into an `assertBranchAccess` helper and call it from `loadForDecision` and `detail`.

### CRITICAL

**C1 — Seven of nine feature switches gate nothing.** See §4.3 below for the matrix. Two of them carry `requiresApproval: true`, meaning they were designed as privacy or legal kill switches.

**C2 — The customer layer of scoped settings is structurally dead.** See §3.1. ADR-010's four-layer hierarchy is really three.

**C3 — Pricing cannot be saved when any optional field is blank.**
Roughly fourteen fields in `quote-pricing.schema.ts` are declared `.optional()` while the DTO behind them declares `nullable: true` (`contracts/dto/pricing.dto.ts:394-438`). The generated client therefore instructs the SPA to send `null`, and `OptionEditor.tsx:262-290` does. `costMinorUnits: null` goes on every charge line, so even a completely filled option is refused. Detailed with its three siblings in the companion report.
*Fix:* `.optional()` → `.nullish()`.

### HIGH

**H1 — The `"user"` table's identity policy grants cross-tenant write.**
`prisma/migrations/20260912000000_staff_identity_and_role_presets/migration.sql:44-46` creates `user_identity_resolution` with both `USING` and `WITH CHECK`, gated only on `current_setting('app.identity_lookup')`, and with no `FOR SELECT`. The three sibling policies immediately below are all `FOR SELECT`. `portal_app` holds full DML on the table from `GRANT … ON ALL TABLES` (`20260101000000_tenancy_roles_rls/migration.sql:160`) and from default privileges.

Not exploitable today — no unsafe raw SQL exists and nothing outside the definer functions sets the flag. It is a missing second lock on the one table where the second lock matters most: a write here reassigns `customer_group_id` or flips `is_internal`.
*Fix:* add `AND pg_has_role(current_user, 'portal_owner', 'USAGE')` to both clauses. The definer functions are unaffected.

**H2 — `org_batch_write` exposes the entire CargoWise organisation directory.**
`20260915010000_apply_organisation_batch/migration.sql:28-30` is `FOR ALL` with a bare GUC test in `USING`, so any session that sets `app.org_batch='on'` can `SELECT` the whole mirror, defeating its internal-only status. Same class as H1.
*Fix:* split into `FOR INSERT`/`FOR UPDATE` and add the same role test.

**H3 — The quote list cannot meet its own performance budget.**
The budget is lists under two seconds at 100k rows per group. `src/modules/quotes/quotes.service.ts:131-161` fails three ways: it sorts `createdAt DESC` while the only index is `(customer_group_id, status, created_at)` — `status` sits between the equality column and the sort key, so the unfiltered default reads every row and sorts; search is four OR'd `ILIKE '%term%'` with `pg_trgm` **not installed** (only `citext` is, `20251231000000_initial_schema/migration.sql:3`); and `tx.quote.count({where})` repeats the same full pass on every page.
*Fix:* `(customer_group_id, created_at DESC, id DESC)` index, `CREATE EXTENSION pg_trgm` with a GIN index on the searched columns, and an estimated count above a threshold.

**H4 — Charge-line currency is unconstrained against its option and its quote.**
Zero `CHECK` constraints reference `currency` in any migration. `quote_charge_line.currency` is `NOT NULL` (`schema.prisma:828`) while `quote_option.currency` (:796) and `quote.currency` (:653) are nullable, and `total_minor_units` is documented as "maintained as the sum of the charge lines by the service" (:794). A mixed-currency option is representable, summable and printable on a customer PDF.
*Fix:* `UNIQUE (id, currency)` on `quote_option` and a composite foreign key from `quote_charge_line (quote_option_id, currency)`.

**H5 — `grossWeightKg` is computed in the browser and trusted as authoritative.**
`QuoteRequestPage.tsx:195-207` sums the cargo lines, and `:244` sends the total as the request's `grossWeightKg`. The raw `packages[]` — each with `quantity` and `weightKg` — travel in the same payload at `:253-265`. The server persists the browser's number verbatim (`quotes.service.ts:622`) and derives `chargeableKg` *from it* (`:590-593`) rather than from the lines it holds.

A client sending lines that sum to 500 kg with `grossWeightKg: 50` is priced on 50 kg. CLAUDE.md's frontend convention says such a number must come from an API endpoint, *"duplicating it is how the number on screen ends up disagreeing with the number on the quote."* Here it is worse: the server adopted the duplicate.
*Fix:* recompute `grossWeightKg` and `volumeM3` server-side from `packages`/`equipment` and ignore the submitted totals.

**H6 — The approval threshold is computed twice and can disagree.**
`PricingDetailPage.tsx:117-118` derives `needsApproval` from `highestTotal`, a browser sum of charge lines. The security property holds — the server independently enforces the same rule from database totals at `pricing.service.ts:866-875` and refuses the publish. The defect is divergence: a pricer sees Publish enabled and receives a conflict, or sees an approval banner the server would not require. Downgraded from the security finding it first appeared to be, and still a correctness defect against the stated rule.

**H7 — Three screens render dates as `MM/DD/YYYY`, including a customer-facing quote validity.**
`CustomerPreview.tsx:66-68`, `PricingDetailPage.tsx:235-237` and `PricingQueuePage.tsx:167-169` call `toLocaleDateString(i18n.language, …)` where `i18n/index.ts:8` defaults to `en-US`. `09/14/2026` on a quote expiry is ambiguous and, against a `DD.MM.YYYY` house rule, wrong-ordered. The compliant `formatDate` is two folders away in `DateValue.tsx:26-37`, whose own comment records consolidating four implementations into one; there are now six.

**H8 — Email cannot be delivered at all.** `src/integration/email/azure-email.adapter.ts:79-89` returns `failed`. Self-service password reset returns 202 and writes the link to a log line. The blocker is a decision — Azure Communication Services versus Microsoft Graph — not code (`gaps.md` F5).

**H9 — The design-token lint rule does not exist.** CLAUDE.md rule 6 states *"A lint rule enforces this."* `.eslintrc.cjs:21-49` contains five rules, none of them about colour, font or radius; `eslint.config.cjs:45` adds nothing; there is no stylelint configuration and no CSS linter at all, so CSS Modules are entirely unlinted. The consequence is visible: 906 `px` literals across 35 files, 25 `rgba()` declarations including brand red retyped raw as `rgba(170,39,47,…)`, and four 16-px card radii against a square-corner brand rule — 250 of the px literals and 12 of the rgba in `PublicLanding.module.css` alone.

**H10 — Accessibility has never been checked.** `e2e/foundation.spec.ts` is the only Playwright spec and every `page.goto` in it targets the DEV-only component workspace. Axe has never run against `/portal/*` or `/app/*`. `.azuredevops/azure-pipelines-ci.yml:178-181` states the frontend stage is deliberately absent. WCAG 2.1 AA is item 5 of the Definition of Done.

**H11 — No error boundary exists anywhere in the SPA.** Zero matches for `ErrorBoundary`, `componentDidCatch` or `errorElement`. One render-time exception blanks the application.

**H12 — No code splitting below `main.tsx`.** `router.tsx:1-28` statically imports all 21 pages; zero `React.lazy`/`Suspense` in `src`. The built `App` chunk is 516 KB, roughly 1.1 MB of JavaScript before first paint, against a wizard-step budget of 300 ms. `vite.config.ts:57` also emits source maps on the **prod** build.

### MEDIUM

| # | Finding | Evidence |
|---|---|---|
| M1 | **1,700 lines of dead component library ship in the bundle.** The 18 `Kit*` files (2,244 lines TSX, 78 KB CSS) are imported by zero application code, but the 293-export barrel that 40 files import pulls them in. 23 duplicate pairs exist, including **four separate tab implementations**; the app uses the older one in every case | `src/design-system/index.ts`, `:53` aliases a name collision |
| M2 | `AuditInterceptor` is a no-op and unregistered | `audit.interceptor.ts:29-34`; absent from `app.module.ts:100-107` |
| M3 | `correlationId` is always the literal `"unknown"` — the filter reads a property nothing assigns | `all-exceptions.filter.ts:24-25` vs `auth.guard.ts:141` |
| M4 | `app.local_record_login` raises no GUC and runs on the bare client, so under FORCE RLS the UPDATE matches zero rows and returns success. `last_login_at` never records for any local sign-in | `20260923000000_local_auth_flows/migration.sql:325-332`, called at `local-auth.repository.ts:412` |
| M5 | `GET /api/pricing/queue` truncates at 200 with no paging and no signal; the 201st-oldest request is invisible | `pricing.service.ts:118` |
| M6 | Five bare `invalidateQueries()` evict the entire cache; one feature-switch toggle refetches everything mounted | `customers.ts:86` (7 mutations), `feature-switches.ts:50`, `organisations.ts:111`, `settings.ts:81,99` |
| M7 | 15 unindexed foreign keys, seven pointing at `user`, all `ON DELETE SET NULL`; three of those scan `quote` | `20261003000100_quote_lifecycle/migration.sql:55-62` and others |
| M8 | `news_item.customer_group_id` has no foreign key and no index, yet is filtered by RLS on every read. A deleted group's targeted news becomes indistinguishable from global news | `20251231000000_initial_schema/migration.sql:203-216` |
| M9 | `feature_switch_read` is `USING (true)` — unconditional, succeeding with no tenant context, exposing operator `reason` and `approval_reference` commentary | `20260914000000_feature_switches/migration.sql:31` |
| M10 | Dangerous-goods entries can bind to an ambiguous cargo id: uniqueness is checked before line ids are assigned, so a container `line-1` collides with the first package | `quote.schema.ts:226` vs `quotes.service.ts:575-578` |
| M11 | A failed client-side DG validation returns `null` and silently drops the entry from the payload rather than blocking submit | `DangerousGoodsEditor.tsx`, `toDangerousGoodsInput` |
| M12 | Three data views fail the loading/empty/error rule: the customer dashboard shows "nothing here yet" while loading and swallows API failures into a false empty; the quote wizard renders empty selects then rewrites the customer's Incoterm; all nine admin listings render the **same string** for error and empty | `CustomerDashboardPage.tsx:32-33`, `activity.ts:37`; `QuoteRequestPage.tsx:166-183`; `AdminListing.tsx:44,46` |
| M13 | Only 1 of 14 forms uses react-hook-form with zod. The 617-line quote wizard is ~25 `useState` calls with a hand-rolled gate. The generator at `scripts/generate-staff-form.mjs` proves the mechanism works and was never extended | `StaffPage.tsx:103-104` vs `QuoteRequestPage.tsx:118-151, 210-221` |
| M14 | The one hand-rolled modal has no focus trap, no Escape handler, no focus restore and a mouse-only scrim dismiss | `TeamPage.tsx:435-450` |
| M15 | `/app/team` loads unbounded lists — no paging on either endpoint, every row rendered. Every other list paginates server-side | `team.ts:40,53`; `TeamPage.tsx:108` |
| M16 | `MappingService` caches per process and invalidates locally; instances diverge | `mapping.service.ts:17-19, 43-47` |
| M17 | Missing partial-unique constraints: one default per group on `address_book_entry`, one primary per organisation on `org_address`, one pending invitation per (group, email). `invitation.resend_count` is documented as capped at three with no `CHECK`. The correct pattern already exists at `20261004000000_quote_pricing/migration.sql:54-56` | |
| M18 | `user.customer_group_id ON DELETE SET NULL` leaves an active non-internal user with no tenant, which no policy can ever match — a permanently broken login | `schema.prisma:499` |
| M19 | 25 of 53 permission codes are unused. 22 are documented future-phase reservations; five are not: `ADMIN_IMPERSONATE`, `ADMIN_AUDIT_READ`, `ADMIN_ACCOUNTS_MANAGE`, `ADMIN_NEWS_MANAGE`, `ADMIN_INTEGRATION_READ` | `contracts/permissions.ts` |
| M20 | Impersonation is half-built: enforcement branches exist in seven services, but `auth.guard.ts:138` hard-codes `onBehalfOfUserId: null` and no endpoint ever sets it, so all seven read-only branches are unreachable | |

### LOW

Inline string comparisons bypass the status machine (`quotes.service.ts:223,281`; `pricing.service.ts:715,757,834`) · CSRF token compared with `===` rather than a constant-time function (`local-auth.module.ts:119`) · the permission guard's diagnostic leaks class and handler names to the client (`permission.guard.ts:51`) · unvalidated `Number()` on query parameters (`settings.controller.ts:49`, `quotes.controller.ts:34-35`) · a mandatory `reason` passed in a query string (`settings.controller.ts:67`) · lockout check is read-then-act (`local-auth.service.ts:676-680`) · `enableVersioning()` is inert: no `defaultVersion`, no `@Version` anywhere, 88 unversioned paths against a documented `/v1` convention (`main.ts:29`) · `--font-mono` is undefined in `src`, so five declarations fall through to a literal stack while adjacent files use `--noa-font-mono` correctly · `initial_deny USING(false)` remains on nine tables, never dropped — harmless while all policies are permissive, a live hazard the day anyone writes `AS RESTRICTIVE` · `pnpm migrate` is wired to `prisma migrate dev`, which will report drift on two generated columns and six SQL-only indexes and can offer to drop them · `csrf-sync` and `cn` are unused dependencies · Tailwind ships its full engine and preflight for six primitive files, introducing a second unreconciled spacing scale under every Button, Select and Dialog.

---

## 5. Feature switch matrix

Foundation rule 4 and Definition of Done item 3: *"a capability nobody can turn off is a defect, not a simplification."*

| Key | Enforced? | Capability exists? | Verdict |
|---|---|---|---|
| `organisations.import.file` | no | **yes** — `organisations.controller.ts:64-74` | **Live lie** |
| `organisations.import.feed` | no | **yes** — `organisation-import.service.ts:76,93` | **Live lie** |
| `organisations.manual_entry` | no | no | Premature |
| `organisations.contacts.import` | no | no | Premature — and it carries `requiresApproval: true` |
| `lookups.type_creation` | **yes** — `lookups.controller.ts:40` | yes | Correct |
| `access.impersonation` | no | half (see M20) | Premature — `requiresApproval: true` |
| `communication.ai_drafting` | indirect only, via a setting | no | Premature |
| `quotations.instant_rate` | **no** | **yes and reachable** — `quotes.controller.ts:55-59` | **Live lie — this is B2** |
| `quotations.dangerous_goods` | **yes** — `quotes.service.ts:564-569` | yes | Correct, and e2e-tested |

No protected capability has been made a switch, and no case was found of a switch hiding a UI control while the API still returned the data. The failure is entirely one of enforcement breadth.

---

## 6. Test posture

31 test files, roughly 7,400 lines. The quality is high; the coverage is not, and the two are worth separating.

**What is excellent:** the isolation suite runs against a real PostgreSQL, tests the connection-pool leak case explicitly, and contains a meta-test that fails if any table lacks RLS. `dangerous-goods-switch.e2e-spec.ts` proves the API refuses when a switch is off, from the guard rather than the screen — it is a model of the required form.

**What is missing, measured against the Definition of Done:**

| DoD requirement | Actual |
|---|---|
| One tenant-isolation test per new entity | 5 tables covered. `quote_option`, `quote_charge_line`, `quote_dangerous_goods`, `quote_equipment`, `analytics_event`, `setting_value`, `integration_message` have none |
| One 403 test per endpoint | ~8 of 78 |
| One test per switch proving the API refuses when off | 1 of 9 |
| One unit test per status transition | **Met, both machines** |

Two structural problems compound this. First, `pnpm test` has `rootDir: "src"` and runs only the 11 unit files; the 14 isolation and 3 e2e suites need a live database and separate commands. CI runs all three, but a developer running `pnpm test` gets a fraction with no warning. Second, `quotes.service.spec.ts:89` asserts that nothing may transition into a retired status while `quotes.service.ts:768` does exactly that — the spec tests the transition table, not the service that bypasses it. **B2 is a defect a green suite reports as absent.**

Modules with zero tests include `features` — the module that decides whether every other switch is on.

---

## 7. Delivery mechanics

These are not code defects, but they determine whether the code above reaches anyone.

**The parent repository points at pre-dangerous-goods commits.** All three submodules show `+` in `git submodule status`: the API is 2 commits ahead of the recorded pointer, the SPA 3, the simulator 1, and all are already pushed to `origin/dev`. CLAUDE.md states that pipelines trigger on the parent's pointer change and never on a child push. The entire dangerous-goods slice — `gaps.md` §G, dated today — is invisible to CI and to a fresh clone. The fix is three `git add` commands.

**A large slice is uncommitted.** 18 API files including `openapi.json`, `schema.prisma` and a new migration; 82 SPA files, almost all the `Kit*` family; and an untracked `docs/plans/Noatum-UI-Kit-Component-Library-Implementation-Plan.md`. A second component library has entered the design system with no ADR, against a repository convention that requires one for architectural choices.

**Deployment readiness is zero, and honest about it.** `infra/bicep/modules/` contains a single `.gitkeep`. The CD pipeline headers state that the subscription, app name and variable group are placeholders and that no matching Azure resources exist. `.env.uat` and `.env.prod` both carry an empty `VITE_API_BASE_URL`.

**Docker Compose still has no simulator,** though its own comment says the simulator joins in S1.01 and that stage's exit test requires API, web and simulator together.

**CI is well built and omits three Definition-of-Done gates.** The pipeline does lint, typecheck, unit tests, then migrations as the owner role against a real Postgres, the pg-boss schema install, the isolation and e2e suites, then build with a Redocly OpenAPI validation. Absent: axe, k6 and visual regression — items 5 of the DoD. `trigger: none` also means nothing validates `dev` after a merge.

**Slice labels have stopped tracing.** Eight of the last fifteen parent commits carry the `S1.05:` prefix. S1.05 is the address book — "the first business slice, sets the pattern." `src/modules/address-book/` is a 17-line empty module and `src/features/address-book/` is a `.gitkeep`. The label now covers customer management, dangerous goods, the design system, a CO2 calculator and the login page.

---

## 8. What I would do next

Ordered by consequence per hour, not by area.

**Today, roughly an afternoon.** Fix B1 (one line in `StaffPortalLayout`) and B2 (one decorator plus one assertion). Both are small, both unblock the Phase 1 journey, and B2 removes the only path that can violate a protected capability. Then commit the three submodule pointers so CI sees today's work.

**This week.** B3 — lift the branch check into a helper and call it from the eight unguarded pricing routes. C2 — wrap `rowsFor`/`allRows` in `runInternal()`, which makes the fourth settings layer real. C3 and its siblings — the `nullable`/`.optional()` class in the companion report, which is mechanical and currently blocks saving a price at all. Then H1 and H2, two `pg_has_role` clauses.

**Then, and this is the one that changes the trajectory.** C1 is nine switches, of which seven do nothing. The fix is not seven decorators; it is the missing test. Adopt the `dangerous-goods-switch.e2e-spec.ts` form as a rule — one test per catalogue key asserting the API refuses when the switch is off — and the seven gaps close themselves, because a catalogue entry without a passing test stops compiling as a claim. The same reasoning applies to the permission-coverage test that `permissions.ts:176-177` already promises and does not have.

**Before any of the above is called done, decide about `down.sql`.** ADR-001 requires one per migration; `prisma/migrations/README.md` says migrations are forward-only. Fifty-seven scripts exist, none are runnable, and two are wrong. Either add a `migrate:down` script and a CI job that does deploy → down → deploy on the newest migration, or amend ADR-001 to scope rollback to emergencies and stop writing them. Both are defensible. Carrying both positions is not.

**A note on sequencing.** The pattern in §3.1 is the most expensive thing in this report, and it has a cheap counter that the team has already discovered and written down. `gaps.md` §F6 ends with the right rule. What §4 shows is that stating the rule did not prevent five recurrences in the following day's work. Making it a gate — a test per switch, a test per permission, an executed rollback — is what turns the lesson into a constraint.
