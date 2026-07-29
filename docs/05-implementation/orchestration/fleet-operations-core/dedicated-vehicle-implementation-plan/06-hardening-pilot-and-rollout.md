# DEDICATED-06 - Hardening, Pilot and Rollout

> **Status:** `TECHNICALLY_VERIFIED_AWAITING_UAT`

## Automated hardening completed - 2026-07-26

- Migrations through `0052` pass forward/idempotency. Consent content hash is persisted; expired unreferenced previews have scheduled retention.
- Backend Dedicated/Workflow/Booking focused tests pass 84/84; lint/typecheck/build pass.
- Real PostgreSQL Dedicated journey passes 5/5 through eligibility, Draft, pinned four-step approval, consent, allocation, BSD, return, renewal and history.
- Booking PostgreSQL passes 17/17 after shared Vehicle resource locking and BSD-window containment.
- Frontend Dedicated/approval/navigation tests pass 23/23; typecheck/build pass.
- Live browser: Employee EN and Arabic RTL mobile, Approver unified inbox desktop, and Fleet Dedicated Allocation desktop have no horizontal overflow or alerts; role navigation is correct.
- Static security scan found no dynamic HTML/eval/hardcoded secret pattern; consent remains explicit local/test only and production fails closed.
- Three critique rounds were reconciled against current executable evidence. External reviewers lacked current filesystem access; stale findings were not accepted. Direct findings on transaction snapshot, Booking race, orphan workflow, allocated-worklist reachability and stale messaging were repaired.

## Remaining production gates

- Target environment must activate organization-accepted EN/AR wording through Consent management; the immutable source/workflow are implemented.
- Human UAT/pilot owners, support owner, release owner and rollback authority must sign the release evidence.
- WithDriver remains disabled pending D16.
- Full persisted BSD calendar/conflict workbench and independent-connection allocation stress are Medium residual hardening items, not blockers to the verified local/manual flow.

No production release is claimed. The complete local/manual WithoutDriver business flow is technically verified and capability-scoped.

## Objective

Prove the complete Dedicated Vehicle lifecycle is secure, resilient, accessible, observable, supportable and reversible before production enablement.

## Entry Criteria

- DEDICATED-00 through 05 verified for release scope.
- D3, D8, D16, Legal consent, renewal, BSD and utilization decisions resolved or affected capabilities explicitly disabled.
- Pilot organization/pool, users, support owner, release owner and rollback authority named.

## Hardening Scope

### Security and privacy

- Full role/scope/ownership matrix including mixed roles, revocation and cross-organization negatives.
- Consent, HR eligibility, preference note, attachment and leave-data privacy review.
- Input validation, malware scanning, XSS-safe note rendering, rate limits and audit access controls.

### Reliability and performance

- Create/submit/decide/consent/allocate/BSD/return idempotency and failure injection.
- Concurrent allocation, workflow decision, lifecycle and scheduler stress.
- Query/index plans for My Requests, approval/allocation queues and eligible Vehicle options.
- Defined SLOs, timeout/retry budgets and degraded dependency behavior.

### Product and UX

- End-to-end Employee self-request through allocation and return.
- Fleet on-behalf path if approved.
- D16 WithDriver path only if approved; otherwise explicit disabled-state UAT.
- Preference honored, preference unavailable/equivalent variance and no-preference scenarios.
- EN/AR/RTL, 320/768/1024/1440, keyboard, screen reader and axe evidence.

### Operations and rollout

- Metrics for eligibility outcomes, approval SLA, consent delay, allocation time, preference fulfillment/variance, no-vehicle rate, BSD conflicts and failures without person-level labels.
- Alerts, dashboards, runbook, reconciliation jobs and support diagnostics.
- Canary by organization/scope and feature capability; no migration of in-flight legacy requests without explicit plan.
- Rollback disables new commands while preserving readable pinned workflows, consents, allocations, BSD windows and audit evidence.

## Required End-to-End Journeys

1. Employee WithoutDriver request, eligible class, no preference, approval, consent and allocation.
2. Optional preferred Vehicle honored.
3. Preferred Vehicle unavailable; governed equivalent and variance reason.
4. Eligibility deny and stale-fact remediation.
5. Modification request, edit, re-evaluate and resubmit.
6. Concurrent allocation with one winner.
7. Renewal without silent extension.
8. BSD schedule, activation, Booking use and safe restoration.
9. Cross-org, SystemAdmin, self-approval and wrong-driver denials.
10. WithDriver/professional-driver journey only when D16 is approved.

## Three Critique Rounds

### Round 1 - Security, Privacy and Data

Independent release review of threat model, tenancy, HR/consent/leave privacy, preference-note handling, migration/rollback, audit integrity and data retention. Repair all Blocking/High findings and rerun security/contract evidence.

### Round 2 - Resilience, Concurrency and Operations

Independent chaos/race review of workflow, consent, allocation, return, BSD workers, retries, SLOs, alerts and reconciliation. Repair and rerun load/concurrency/failure-injection evidence.

### Round 3 - UX, Accessibility and UAT

Independent persona walkthrough for Employee, Fleet, approver, assigned driver and support in EN/AR across viewports. Review mockup fidelity, optional preference clarity, no-guarantee wording, error recovery and accessibility. Repair and rerun UAT/browser/build evidence.

## Exit Gate

- All three critique rounds and closure re-review have no unresolved Blocking/High findings.
- Security, performance, accessibility, E2E, rollback and reconciliation evidence is signed.
- Pilot owners accept open Medium/Low risks.
- Production enablement remains capability-scoped and reversible.
