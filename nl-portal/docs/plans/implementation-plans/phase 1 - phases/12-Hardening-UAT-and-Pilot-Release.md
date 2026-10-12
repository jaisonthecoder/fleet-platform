# P1.12 - Hardening, UAT and pilot release

Status: planned; no release evidence exists merely from this document. Version 1.0, 11.09.2026. Follow the [shared procedure](README.md) and [coverage ledger](13-Coverage-Decisions-and-Test-Ledger.md).

## Outcome and entry gates

All agreed Phase 1 administration and quotation slices have reproducible acceptance evidence, and Operations can operate/recover the system. Both publication modes work; the CW1-confirmed path has real business acknowledgement evidence.

Depends on P1.01-P1.11. Resolve applicable D-01 through D-18 and lookup gates, including Legal privacy/retention, Security profile, approved workload, host choice, real integration access and named pilot/support owners. Do not treat a simulation-only or direct-only release as full Phase 1 acceptance.

Trace: all Phase 1 FR/lookup scope and applicable NFRs; especially NFR-SEC-013, NFR-PER-001/002/003/004/005/006/008/009, NFR-REL-001/006, NFR-OPS-001 through NFR-OPS-006 and NFR-ARC-005/007.

## Vertical slices

### P1.12-A - Functional/security regression and mockup acceptance

- Reconcile ledger requirement -> slice -> automated/manual test -> build evidence. Every agreed requirement has an owner; unknown decisions remain blocked, not passed by omission.
- Execute token/tenant/RLS, per-endpoint 403, role/branch/feature revocation, invitation/last-admin, lookup/settings concurrency, quote claim/approval/acceptance and source ownership suites.
- Verify customer-safe output across API/count/search/detail/PDF/export/email and all current download paths; restricted/cost fields cannot leak through previews or history.
- Security gate: dependency/secrets/application checks and tenant/identity penetration assessment under approved profile, with remediation/retest evidence. No unresolved isolation or unauthorised cost/financial disclosure passes.
- UX: approved mockup revision reconciliation, EN/ES including outputs, axe plus manual keyboard/focus/screen-reader/contrast, supported viewports/browser matrix and no overlap. Missing mockup detail cannot waive business/security rules.
- Demo: Product and Operations execute complete user/admin/customer/pricing journeys and negative scenarios; approve results, not screenshots alone.

### P1.12-B - Performance, reliability and production runtime

- Baselines: quote list <2 s at 100k/group; relevant search <1.5 s; wizard step <300 ms; usable dashboard <3 s; stub rate timeout 25 s and live instant path <30 s only if later approved.
- Integration: configured push/write latency <=60 s, supported polling fallback <=5 min; record source occurrence/emission/receipt/commit/business-confirmation clocks. Direct mode has no fabricated priced-offer CW1 latency metric.
- D-07 defines percentile/concurrency/device/network/dataset distribution and background workload. p95 is proposed in NFRs, not an inherited promise; record p50/p95/p99/errors as approved. Bounded exports/imports/search/tree queries and backlog recovery must be tested.
- Runtime: selected App Service/Container Apps configuration keeps scheduled jobs running, supports safe shutdown/restart and retains durable work. Verify health/readiness, scaling/connection pool, managed identity and environment separation.
- Reliability: crash/retry/out-of-order/stale imports, email/CW1 outages and recovery; no falsely published or lost pending work. Availability objective 99.5% initially, 99.9% later target; preproduction testing does not prove a month of availability.
- Exit: signed performance/reliability report with actual workload/resource configuration and known limitations.

### P1.12-C - Operations, restore and data governance

- Runbooks: failed-job alert/replay, unknown mapping/ownership quarantine, organisation reassignment, stale source import, lost staff claim, bootstrap recovery and support impersonation.
- Recover: approved RPO/RTO and retention/legal hold, restore DB/private files/config references, verify RLS/grants, policy history and accepted/direct snapshots, then reconcile jobs safely. No destructive rollback assumption.
- Observe: owned alerts for errors/latency, queue age/depth, stale imports and dependencies; correlation lineage without tokens/PII/internal-price payload leakage. Verify actual alert receipt and incident response ownership.
- Privacy: approved handling of access/erasure requests pending later automation; source contacts and external drafting inputs limited to purpose-approved data. Retention tasks must not destroy required history or live invitation evidence improperly.
- Deploy: reproducible artifacts, controlled migration/promotion, compatible app rollback/forward fix and secrets rotation procedure. No speculative services introduced to clear a checklist.
- Exit: rehearsal evidence and named on-call/business contacts, not only written runbooks.

### P1.12-D - Real integration and pilot sign-off

1. Register eligible staff with no access, assign approved branch/roles, verify a second branch remains protected and configure approved policies.
2. Refresh source directory, configure multilingual lookup/category relationships, onboard linked customer, invite/accept first admin and colleague; exercise suspension, role changes and support restrictions.
3. Submit Air/FCL/LCL requests using approved references and saved tools; staff review full request, claim, price alternatives and obtain independent approval where configured.
4. Demonstrate direct publication without a priced-offer CW1 job and CW1-confirmed publication with real business acknowledgement. Repeat initial-sync and approval combinations, including failures.
5. Customer compares/accepts/rejects the correct published version, downloads safe branded PDF and receives notifications. Source-created quotes reconcile without duplication; direct collision does not overwrite accepted content.
6. Rehearse another region/branch through approved configuration without identity/tenancy/mapping code changes. Confirm policy precedence and source namespace, not merely an extra row in a mockup.
7. Product, Operations, Security, Engineering and Cloud sign evidence, open risks and release decision. Confirm pilot support window/rollback criteria and service ownership.

## Evidence record and release status

For each check record requirement/slice, fixture, environment, build/commit, command/tool, actual result, evidence location, reviewer/date, residual risk and decision. Never enter Passed before execution. CI green alone does not cover real CW1, manual AA or restore tests.

Use planned, in progress, blocked, verified and accepted only as delivery-tracking labels, not new application statuses. A bounded direct-only pilot requires explicit approval and all applicable prerequisites; unresolved real CW1 leaves full Phase 1 partial. No silent rephasing or operational workaround becomes a feature.

## Completion gate

All twelve stages and the ledger's applicable gates are accepted, pending decisions resolved for released scope, approved mockups reconciled, and both business journeys plus operational recovery demonstrated. Later modules remain access-ready but unavailable until their approved releases.
