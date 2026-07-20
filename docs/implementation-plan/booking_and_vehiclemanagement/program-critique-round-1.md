# Program Critique Round 1 — Booking, Vehicle, Vendor and Lease

**Date:** 2026-07-20  
**Scope:** README and phases 00–19  
**Lenses:** business/scenario traceability; architecture/data/security; UX/delivery/testing/operations

## Decision

**Conditional GO for planning and mockup intake. NO-GO for implementation until Phase 0/1 exit gates and the relevant phase mockup gate pass.**

The program is not claiming Phase 1 implementation readiness merely because a phase exists. External Organization/Decision/Workflow foundations remain dependencies and are referenced rather than duplicated.

## Accepted critical/high findings

1. Enforce mockup approval evidence before every UI phase.
2. Define actor/SoD concepts and separate approval delegation from operational on-behalf actions.
3. Add owners/due-before-phase/fallback/blocked-feature fields for D1–D24 and vendor-specific decisions.
4. Freeze UTC/org-timezone/effective-date semantics.
5. Specify concurrency, idempotency, DB exclusion/locking and transaction boundaries.
6. Enumerate append-only tables, audit/outbox delivery, retention and privacy.
7. Add source-authority and cross-organization vendor/contract/vehicle constraints.
8. Clarify Phase 1 vs Phase 2 boundaries for recurring, break-glass, professional/substitute drivers, real telematics and vendor/lease automation.
9. Detail lease replacement, BSD, early/late return, dedicated actor combinations and transfer blocking.
10. Add quantified performance/resilience, accessibility, UAT, observability and rollback evidence.
11. Define traceability status vocabulary and mockup approval references.
12. Add compliance, fines, dashboards, HCM and policy/workflow foundation dependencies to the completion matrix.
13. Complete vendor I2/I3/OCR/portal source, SoD, FX, off-hire and scorecard semantics.

## Already covered by external foundations

These are not recreated inside this program; Phase 1 validates their contracts/evidence:

- Organization N-level hierarchy, stable scopes and organization consistency.
- Policy PAP/PDP/PEP, versioning, scope inheritance, cache and decision provenance.
- Workflow durability/versioning/tasks/timers.
- Core compliance eligibility, fines/black-points and dashboards already present in current backend baseline.
- Hash-chain audit, outbox/inbox and global authentication/RBAC foundations.

The program still owns domain adoption, UI, scenario completeness and end-to-end proof.

## Rejected or corrected findings

- `OffHirePending` is already present in the vehicle lifecycle; no duplicate state is added.
- PostgreSQL cross-row organization consistency is implemented with composite FKs/triggers, not subquery CHECK constraints.
- Booking overlap is already enforced by a GiST exclusion constraint; the plan now names it explicitly.
- Exactly-once notification delivery is not promised; delivery is at-least-once with idempotent consumers.
- Touchscreen signature plus forced biometrics/video is not assumed. Legal-approved identity/session authentication plus immutable consent evidence is the baseline; stronger assurance is a Legal/Security decision.
- Emergency decision ID is D17 in the startup source; any stale D20 reference is corrected.

## Residual human gates

- D6 Procurement source authority/I3 direction.
- D8 dedicated eligibility thresholds.
- D9 black-point timeframe.
- D12 re-consent tolerance.
- D14 utilization/max-duration definitions.
- D16 professional-driver liability.
- D17 emergency booking categories/SLA.
- D18 smart-key scope.
- D24 cross-node booking pairs/approvers.
- Legal consent evidence/retention requirements.
- Data retention periods for audit, documents, location and portal disputes.

## Closure evidence required

- All document patches from this critique applied.
- Continuous numbering and all links valid.
- No critical/high accepted finding left without owner phase and exit gate.
- Phase 19 matrix contains external foundation, scenario, mockup, security, operations and rollback evidence rows.
- Repository memory updated.

## Closure status

**Critical/high document findings closed on 2026-07-20.** Applied changes include:

- External foundation evidence matrix for Organization, Policy, Workflow, HCM, Compliance, Fines, Dashboards and audit/outbox.
- Enforceable mockup approval register/template and supplied-vs-approved distinction.
- EN/AR/RTL, responsive, accessibility-tool and design-system/component gates.
- Actor/SoD vocabulary and decision register template with due-before-phase/fallback/blocked capability.
- UTC/org-timezone, effective range, transaction/concurrency/idempotency, append-only, consent, audit/outbox/notification, retention and masking contracts.
- Vendor I2/I3/manual/OCR/portal source and failure behavior, suspension, FX, duplicate ingest, contract version and off-hire evidence rules.
- Vehicle onboarding quarantine/lease replacement; registry GPS/privacy; lifecycle transfer/maintenance; custody/telematics boundaries.
- Booking actor fields/on-behalf notification, eligibility remediation, atomic consent/submit, pinned approval, status/action, re-consent/extension and advanced scenario boundaries.
- Dedicated actor matrix, eligibility recheck, allocation lock, BSD/renewal/reassignment lifecycle.
- Handover exact gates, odometer reconciliation, signature assurance and policy-gated liability.
- Notification/observability routing, quantified performance, UAT/accessibility, migration dedup/mock-data and in-flight rollback rehearsals.
- Traceability status vocabulary, mockup evidence and cross-cutting completion rows.

Residual items are human decisions/mockup approvals, not undocumented implementation ambiguity. They remain NO-GO gates for their impacted phases.
