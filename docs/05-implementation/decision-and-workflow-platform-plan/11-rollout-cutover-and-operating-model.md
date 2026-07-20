# Phase 11 - Rollout, Cutover, and Operating Model

## 1. Objective

Introduce the new platform safely through environment promotion, shadow comparison, controlled canary, domain-by-domain cutover, rollback rehearsal, support readiness, and clear ongoing ownership.

## 2. Owners and dependencies

- **Primary:** AI Delivery Planner and AI Platform Engineer
- **Contributors:** SRE, Backend, Frontend, Database, QA, Security, Product, Support
- **Depends on:** Phase 10 green evidence
- **Human gate:** Production go/no-go

## 3. Environment progression

1. Local developer validation.
2. CI fresh/upgrade migration and automated suites.
3. Shared development integration.
4. UAT with realistic roles/scopes and anonymized facts.
5. Production dark deployment with no consumers.
6. Shadow evaluation.
7. Scoped canary.
8. Domain-by-domain primary switch.
9. Legacy observation window.
10. Legacy removal and schema cleanup in a later release.

## 4. Deployment units

- Policy administration API/module.
- Decision runtime adapter/bundle loader.
- Optional dedicated decision endpoint/batch worker.
- Workflow runtime and timer worker.
- Policy Studio/workflow UI routes.
- Database migrations.
- Dashboards/alerts/runbooks.

Use independent feature flags and compatible deployment ordering. DB additive migration lands before code that uses it.

## 5. Cutover sequence

Recommended order based on risk and reversibility:

1. Read-only Organization explorer and quality dashboard.
2. Data remediation, stable codes and hierarchy constraints.
3. Guarded organization writes and audit/history.
4. Authorized hierarchy reads and scope-aware enforcement in shadow, then hard mode.
5. ScopeProvider propagation into domain queries.
6. Read-only policy catalog, versions and audit UI.
7. Organization-default draft authoring/simulation/review.
8. Scoped policy resolver in shadow after O6.
9. Canary one approved pool/cluster override.
10. Remaining value/routing/eligibility decisions and new workflow instances.
11. High-impact policy/workflow publication.
12. Remove legacy write/evaluation paths after observation.

## 6. Shadow rollout

- Execute legacy and new runtimes using the same normalized facts.
- Legacy remains behavioral authority.
- Record minimized divergence metrics and samples.
- Set expected difference policy per decision.
- Require stable parity window and performance capacity before canary.
- Shadow must never execute effects, escalate, or alter workflow.

## 7. Canary rollout

- Deterministic selector by organization/scope/subject hash.
- Start with internal/test pool or approved low-risk scope.
- Monitor latency, failures, outcome divergence, domain defects and support signals.
- Define automatic/manual rollback triggers.
- Promote through documented percentages/scopes; do not improvise in production.

## 8. Workflow cutover

- New instances use new definitions only after flag activation.
- Existing instances remain pinned to legacy definitions and drain.
- Dashboard tracks legacy active-instance count.
- If long-lived instances cannot drain, create and rehearse an explicit migration function per definition version.
- Never bulk-edit workflow instance state directly.

## 9. Rollback plan

### Policy runtime

- Switch deployment/selector to prior approved version or legacy adapter.
- Verify generation propagation and checksum adoption.
- Preserve decisions/domain records already completed.

### Workflow runtime

- Stop starting new instances on the failing definition.
- Existing instances remain pinned; use incident-approved repair/migration only.
- Disable timer worker only if runbook explains backlog/recovery impact.

### UI/API

- Feature flags hide authoring/publication while preserving read/audit access.
- API remains backward compatible during rollback window.

### Database

- Additive migrations stay in place during application rollback.
- Use compensating migration only when necessary and rehearsed.

## 10. Go/no-go checklist

- Phase 10 evidence approved.
- Migrations and backup/restore rehearsed.
- Active deployments and checksums recorded.
- Feature flags/selectors verified.
- Rollback target and commands verified.
- Dashboards and alerts live.
- Runbooks exercised.
- On-call/support roster and communications ready.
- Product/domain owners approve expected behavior differences.
- Security/PDPL approvals complete.
- No unresolved critical/high findings without accepted risk.

## 11. Operating ownership

| Area | Accountable owner | Operational responsibilities |
| --- | --- | --- |
| Decision platform product | Product owner | Roadmap, impact classification, business owners |
| Policy content | Named business policy owner | Accuracy, tests, review, effective dates |
| Runtime/code | Backend engineering | Adapter, APIs, performance, defects |
| Workflow definitions | Process owner | Task routes, SLAs, escalation, tests |
| Database | Database engineering | Schema, migration, query/retention health |
| UI/design | Frontend + UX | Authoring usability, a11y, i18n |
| Security/audit | Security + Internal Audit | Controls, reviews, evidence, exceptions |
| Operations | SRE/platform | Availability, alerts, incidents, capacity |
| Verification | QA | Regression, release evidence, residual risk |
| Support | Support team | Triage, KB, escalation and feedback |
| Organization/hierarchy master | Data Steward + organization owner | Codes, bilingual labels, topology, home-scope quality, restructure approval |

## 12. Change-management process

For every production policy/workflow change:

1. Owner creates change summary and expected impact.
2. Draft includes required tests.
3. Validation/simulation pass.
4. Replay completed for high-impact changes.
5. Reviewer/approver signs off under SoD.
6. Effective deployment and rollback target selected.
7. Deployment monitored through observation window.
8. Evidence retained and support notes updated.

## 13. Training and documentation

- Policy author guide with safe examples.
- Reviewer guide focused on defaults, boundaries, impact and SoD.
- Workflow template guide.
- Decision Trace and audit guide.
- SRE and support runbooks/KB.
- Arabic and English user guidance where operational users require it.
- Prohibit direct DB editing in training and operational policy.

## 14. Post-launch review

At 7, 30 and 90 days review:

- Runtime reliability/latency and fallback use.
- Policy change volume/lead time/rejections.
- Workflow SLA/escalation and stuck tasks.
- Outcome anomalies and incidents.
- UI usability/accessibility/support feedback.
- Candidate need for advanced OR groups, graph authoring or BPMN revisit.
- Legacy removal readiness and cost.

## 15. Exit gate

Phase 11 passes when organization management/scope authorization and all targeted decisions/workflows run on the approved platform, legacy behavior is retired or explicitly excepted, ownership/support/SRE are active, and production rollback plus evidence are proven.
