# Phase 1 — Consolidated Critique & Gap Analysis

Both adversarial critique rounds from [01_phase1-mvp.md](../01_phase1-mvp.md) §6–§7, carried verbatim with the **sub-phase that resolves each** and a status column. Every finding must be **closed or accepted-with-dated-risk** by the reviewer before the Phase 1 gate closes (owned by [1G](07_sub-phase-1g_hardening-and-gate.md)).

---

## Round 1 — sequencing, dependencies, scope

| # | Gap | Sev | Resolution | Resolved in |
|---|---|---|---|---|
| **P1B-R1-1** | Trip-attach (telematics) built before Booking → untestable | H | Bookings **port + test-double** in telematics; full integration at start of the core loop | [1C](03_sub-phase-1c_telematics-domain.md) → [1D](04_sub-phase-1d_core-loop.md) |
| **P1B-R1-2** | 6 of 12 rule tables need closed decisions (D8/D9/D12/D14/D3/D6) | H | Split **"engine complete"** (1A) from **"tables populated + 2nd-approved"**; track per rule type; fixtures until closed | [1A](01_sub-phase-1a_platform-completion.md) |
| **P1B-R1-3** | Consent hard-gate blocks all booking if D7 (EN+AR wording) slips | H | Pre-load Legal-reviewed **v0** to unblock *build* (not go-live); escalate D7 with a date | [1D](04_sub-phase-1d_core-loop.md) |
| **P1B-R1-4** | Migration ≥98% gate needs a cleansing sprint not in a block | H | Run cleansing **in parallel** with 1B–1E; steward assigned at kickoff | [1B](02_sub-phase-1b_master-data.md) |
| **P1B-R1-5** | Compliance ladders + booking reminders need the notification dispatcher | M | Build the **dispatcher** in platform completion; consumed by ladders + reminders | [1A](01_sub-phase-1a_platform-completion.md) → [1D](04_sub-phase-1d_core-loop.md) |
| **P1B-R1-6** | Eligibility depends on HCM-synced person data; sync not scheduled | H | Define **HCM sync + freshness SLA** in platform completion; fail-direction = block + escalate | [1A](01_sub-phase-1a_platform-completion.md) |
| **P1B-R1-7** | "Basic executive view" over-promises at one pool | M | Tag Phase-1 KPIs **measurable-now vs Phase-2**; scope dashboards to the measurable set | [1F](06_sub-phase-1f_read-models.md) |

## Round 2 — correctness, concurrency, security, edges

| # | Gap | Sev | Resolution | Resolved in |
|---|---|---|---|---|
| **P1B-R2-1** | Double-booking race: availability vs commit must share one reservation range | H | Persist PDP-expanded `reservation_start/end` + policy version; **`btree_gist` exclusion**; concurrent create/modify/extend tests | [1D](04_sub-phase-1d_core-loop.md) |
| **P1B-R2-2** | Eligibility vs HCM freshness: stale sync allows ineligible / outage blocks all | H | Freshness SLA; **fail-safe = block + escalate**; show "data as of" at the gate | [1A](01_sub-phase-1a_platform-completion.md) → [1D](04_sub-phase-1d_core-loop.md) |
| **P1B-R2-3** | Consent atomicity: number issued but consent write fails (or vice-versa) | H | **Single transaction:** consent pointer + booking + audit + outbox; number issued only after consent row commits | [1D](04_sub-phase-1d_core-loop.md) |
| **P1B-R2-4** | Substitution model unreachable (UI is Phase 2) → mis-attribution persists | M | **Minimal admin/API entry** to record windows | [1E](05_sub-phase-1e_governance.md) |
| **P1B-R2-5** | Time-zone/DST across windows, buffers, 24h/1h reminders, expiry ladders | M | Centralize UTC↔Asia/Dubai conversion; tz-boundary test cases; document the rule | [1D](04_sub-phase-1d_core-loop.md) |
| **P1B-R2-6** | D4 (PDPL) sign-off late but telematics privacy built in Block C | M | **Pull D4 to precede** telematics; build to the decided policy | [1C](03_sub-phase-1c_telematics-domain.md) |
| **P1B-R2-7** | Fine attribution edge: exact substitution-window boundary / overlapping windows | M | Define boundary rule (inclusive/exclusive); tests for overlap + no-active-booking | [1E](05_sub-phase-1e_governance.md) |
| **P1B-R2-8** | Post-go-live correction of a bad migrated record vs append-only/steward sign-off | L | **Corrective-entry pattern** (new versioned record + audit reason), never in-place edit | [1B](02_sub-phase-1b_master-data.md) |
| **P1B-R2-9** | Hard-block override attempt must be a logged denial, never a silent pass | H | Attempts logged in exception report; test proves **no override path exists** | [1D](04_sub-phase-1d_core-loop.md) |

## Sub-Phase 1A₂ — Lookup & User/Access Management (config tier)

| # | Gap | Sev | Resolution | Resolved in |
|---|---|---|---|---|
| **LU-1** | Label-vs-code coupling: business logic branching on a lookup **label** (or UUID) breaks localisation and cross-org reuse | H | Logic branches on stable **`code`** only; labels (EN/AR) are display-only; ids are storage FKs — enforced as a convention + review (ADR-009) | [1A₂](01b_sub-phase-1a2_lookup-and-user-management.md) |
| **LU-2** | A role grant could create a forbidden combination (self-approval, Finance+FleetManager co-hold) | H | **SoD enforced at assignment time** (SoD-04/05); every grant audited with `assigned_by_person_id`; grant rejected if it violates SoD | [1A₂](01b_sub-phase-1a2_lookup-and-user-management.md) |
| **LU-3** | JIT SSO provisioning could mis-match an Entra identity to the wrong `person` | M | Deterministic match (Entra `oid` unique; link to `person` by email/HCM id); unmatched ⇒ no roles until an admin links; audited | [1A₂](01b_sub-phase-1a2_lookup-and-user-management.md) |
| **LU-4** | Putting the org tree (clusters/pools) into a generic lookup table would break performance/integrity/scalability | H | **ADR-009:** hierarchy nodes stay a typed entity (`ltree`, FKs); only the *level taxonomy* + pick-lists are lookups; scopes never in the lookup table; labels never resolved on the hot path | [1A₂](01b_sub-phase-1a2_lookup-and-user-management.md) |

### 1A₂ re-run (adversarial, post-implementation) — findings + status

| # | Gap found on re-inspection | Sev | Status |
|---|---|---|---|
| **G1** | Lookup engine shipped **empty** — no seeded types/values; `getValues` threw until data existed (integration test masked it by seeding its own) | H | **Fixed** — Phase-1 fixture types (hierarchy-level, body-type, use-category, fuel-type, ownership-type, make→models) seeded bilingual in `scripts/seed-dev.sql` |
| **G2** | JIT provisioning didn't actually match a person (only stored a passed-in `personId`) → every SSO user unlinked | H | **Fixed** — `resolvePersonId` matches HCM id → email; live test asserts the link |
| **G3** | SSO not end-to-end — no Entra JWT/JWKS validation guard; only the provisioning seam + dev-login exist | M | **Fixed** — global `AuthGuard` verifies Entra JWT via `jose`/JWKS (sig/iss/aud/exp) + JIT provisioning + principal; global `RolesGuard` + `@Roles`/`@Public`; admin HTTP endpoints RBAC-gated; dev-login for lower envs. Tested: jwt-verifier (6), guards (10), HTTP e2e/int (8) |
| **G4** | Doc claimed tests for cycle-rejection / system-value-delete that weren't implemented | L | **Fixed** — doc aligned to real coverage (cycle-safe by construction; delete/deactivate land with admin HTTP surface) |

## Carried-forward from Phase 0 (completed in Phase 1)

| Ref | Item | Completed in |
|---|---|---|
| P0B-R2-2 | PDP fail-safe "+ escalate" human half | [1A](01_sub-phase-1a_platform-completion.md) |
| P0 R1#1 | `vehicle_hierarchy_assignment` forward-reference deferred to Phase 1 | [1B](02_sub-phase-1b_master-data.md) |
| P0B-R1-3 | *Binding* load test (Phase 0 was a floor) | [1G](07_sub-phase-1g_hardening-and-gate.md) |

> Reviewer rule: a finding is only **closed** with attached evidence (passing test, telemetry, sign-off) — a doc edit is never evidence.

---

## Closure status — 2026-07-18 (implementation)

All Round 1 & Round 2 findings are **closed by passing tests** except where the item is an ops/human/external gate (tracked in [09](09_production-readiness-gate.md) as accepted-with-dated-risk).

| Finding | Status | Closing evidence |
|---|---|---|
| P1B-R1-1 trip-attach before booking | ✅ closed | telematics bookings **port** + real `BookingLookupAdapter` wired in 1D; `telematics.int-spec` |
| P1B-R1-2 rule tables need decisions | ✅ mechanism closed | 12 rule types seeded; D-gated values on `fixture-` versions (register) |
| P1B-R1-3 consent v0 wording | ✅ closed | consent captured with `consentDocumentVersion`; build-unblocked |
| P1B-R1-4 migration ≥98% cleansing | 🟡 engine closed | import validate/dedup/reconcile in 1B; **steward ≥98% sign-off = ops-pending** |
| P1B-R1-5 notification dispatcher | ✅ closed | notifications module; compliance ladders + reminders |
| P1B-R1-6 / R2-2 HCM sync + freshness fail-safe | ✅ closed | `eligibility.service` freshness block; `eligibility.int-spec` |
| P1B-R1-7 exec view over-promise | ✅ closed | 1F tiles scoped; `dashboards.int-spec` |
| P1B-R2-1 double-booking race | ✅ closed | `btree_gist` + `booking.int-spec` + **`binding-load.int-spec`** (30 concurrent) |
| P1B-R2-3 consent atomicity | ✅ closed | single-tx; `booking.service.spec` + `booking.int-spec` |
| P1B-R2-4 substitution reachable | ✅ closed | `POST /vehicles/:id/substitution-windows`; `fine.int-spec` |
| P1B-R2-5 tz/DST | ✅ closed | UTC storage + `todayUtc` window; date-boundary handling |
| P1B-R2-6 D4 pulled early | ✅ engine closed | telematics privacy built; **D4 PDPL sign-off = ops-pending** |
| P1B-R2-7 fine attribution edges | ✅ closed | `fines-attribution.spec` (boundary/overlap/no-booking) + `fine.int-spec` |
| P1B-R2-8 corrective-entry | ✅ closed | soft-state; append-only history; no in-place destructive edits |
| P1B-R2-9 hard-block override logged | ✅ closed | `booking.signConsent` logs eligibility-denied; no override path |
| LU-1..4 / G1..G4 (1A₂) | ✅ closed | lookup/user/SSO specs (prior session) |

### New findings from the adversarial re-critique this session (all fixed + tested)

| # | Finding | Fix / evidence |
|---|---|---|
| N-1 | M8 `recordRecovery` prematurely marked the fine `Recovered` (Phase 1 records only) | records entry only; duplicate-guard on `hasRecovery`; `fines.service.spec` |
| N-2 | M8 attribution double-called `findActiveBooking` | single `attributeWithBooking` lookup |
| N-3 | M8 overdue-black-point could raise duplicate blocks per run | per-run `Set` dedupe; `fines.service.spec` |
| N-4 | M5/M8 user-facing writes leaked 500 on bad FK | `toDbException` wrap; `create`/`recordFine` DB-error tests |
| N-5 | M5 SoD-02 ignored `onBehalfOfPersonId` | check both actor + on-behalf; `entitlement.service.spec` |
| **N-6** | **M8 fine attribution missed the driver of an already-Completed booking** (late fines) | new `findBookingCoveringEvent` (incl. `Completed`); `fine.int-spec` |
| **N-7** | **M4 modify / request-changes returned to Draft but left `workflowInstanceId`** → re-submit no-op (stuck) | clear `workflowInstanceId`; `booking.service.spec` |
| **N-8** | **Concurrent booking contention (deadlock/serialization 40P01/40001) leaked a 500** | `toDbException` maps to retryable **409**; `binding-load.int-spec` |
| **N-9** | **`operations/overview` left `@Public`** (plates/expiry to anon) contrary to 1F RBAC intent | now authenticated; `api.e2e-spec` 401-without-auth + 200-with-auth |
| **N-10** | **Migration-test harness needed a TTY** (`drizzle-kit migrate`) → would fail in CI | rewritten to the programmatic migrator; `pnpm migration:test` green; also asserts exclusion constraints |

> Ops/human items (5k-veh soak, DR restore, pen test, UAT, go/no-go, D4 sign-off, steward ≥98% sign-off) remain **accepted-with-dated-risk** — see [09](09_production-readiness-gate.md).

### Post-gate security re-inspection — 2026-07-19

| # | Finding | Status / evidence |
|---|---|---|
| **N-11** | Booking and entitlement approval endpoints trusted a client-supplied `actorPersonId`; delegation creation trusted a client-supplied `delegatorPersonId`. A caller holding an eligible role could attempt to act as another person. | ✅ **Actor binding closed** — public action bodies no longer accept those actor fields; controllers derive the acting person from the authenticated principal and reject unlinked identities. Focused controller suites prove principal binding and strict rejection of injected actor fields. Full unit gate: **38 suites / 229 tests**, typecheck, lint, contract guard, and build green. |
| **N-12** | `onBehalfOfPersonId` is still accepted without proving an active persisted delegation from the authenticated actor to the current assignee. | 🔴 **Open — next security increment.** Validate effective-dated delegation and request type before workflow decision; add forged/on-expired/wrong-type delegation HTTP tests. |
| **N-13** | Role guards verify role name on any scope; scoped reads and writes do not yet consistently prove that the requested hierarchy node or object belongs to an allowed role subtree. | 🔴 **Open — blocks frontend scope integration.** Introduce mandatory principal-scope authorization and cross-pool adversarial tests before further domain UI wiring. |

> The 2026-07-18 production-gate counts predate this security increment. Do not replace that gate with the unit-only evidence above; re-run integration, E2E, migration, and binding suites after N-12/N-13 close.
