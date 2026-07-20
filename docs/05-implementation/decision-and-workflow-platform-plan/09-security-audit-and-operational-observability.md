# Phase 9 - Security, Audit, and Operational Observability

## 1. Objective

Implement security controls, threat mitigations, tamper-evident lifecycle evidence, decision/workflow telemetry, operational dashboards, alerts, and runbooks for the complete platform.

## 2. Owners and dependencies

- **Primary:** AI Security Engineer and AI SRE
- **Implementation:** Backend, Frontend, Database, Platform
- **Reviewers:** Internal Audit, QA, Solution Architect
- **Depends on:** Architecture and implementation surfaces from Phases 3-8

## 3. Threat model scope

Assets:

- Policy/workflow authored definitions and compiled artifacts.
- Deployment and lifecycle authority.
- Fact catalog and sensitive facts.
- Decision outputs and workflow variables.
- Approval tasks and actor/delegation identity.
- Audit/change/evaluation logs.
- Runtime cache and activation channel.

Threats:

- Unauthorized policy publication or self-approval.
- Tenant/scope leakage.
- Malicious expressions or resource exhaustion.
- Artifact tampering or cache poisoning.
- Replay/simulation leaking personal data.
- Forged/duplicate workflow commands.
- Manual DB change bypassing lifecycle/cache invalidation.
- Log injection or audit deletion.
- Stale policy or split-brain activation.
- Overprivileged service-command handlers.
- Unauthorized hierarchy browsing, arbitrary scope selection, cross-scope approval, root/path corruption, unsafe subtree move/retire and hierarchy-policy cache collision.

## 4. Authorization model

Separate permissions:

- Catalog read.
- Draft create/edit.
- Validate/simulate.
- Replay impact.
- Submit for review.
- Approve/reject.
- Schedule/deploy/promote.
- Emergency rollback.
- Audit/evaluation evidence read.
- Workflow-definition author/reviewer/publisher.
- Workflow task act/delegate/administer.

Enforce server-side with role, organization, hierarchy scope, assignment and SoD. UI affordances are not authorization.

## 5. Dual control and privileged operations

- High/critical policy/workflow author cannot approve or publish the same version.
- Publisher and emergency rollback roles are explicitly assigned and reviewed.
- Break-glass action requires approved incident context, reason, short-lived privilege, alert, and post-event review.
- Direct production DB writes to policy/workflow lifecycle tables are denied to application/support users.
- Operational repair uses audited service/API/runbook paths.

## 6. Expression/runtime sandbox

- Runtime candidate must prohibit filesystem, process, network, SQL, reflection and dynamic package loading.
- Limit definition size, row count, condition depth, expression length, evaluation steps, memory and duration.
- Constrain regex and collection operations against denial of service.
- Compile before approval/deployment; production never interprets unvalidated drafts.
- Maintain runtime adapter/version allowlist and SBOM.

## 7. Data protection

- Classify every fact and workflow variable.
- Minimize production evaluation logs to fingerprints, freshness, reason/path and approved references.
- Encrypt transport and storage using platform controls.
- Prevent secrets/tokens from entering authoring artifacts, facts, variables, logs or test cases.
- Restrict replay datasets and apply masking/sampling.
- Define retention, archival, legal hold and deletion/anonymization with PDPL stakeholders.
- Keep runtime, data, backups and telemetry in approved UAE regions.

## 8. Tamper-evident audit

Record lifecycle changes through the existing hash-chained audit mechanism:

- Definition/draft/version/deployment IDs and checksums.
- Actor/on-behalf-of, organization/scope and correlation ID.
- Action and transition.
- Before/after identifiers or minimized diff.
- Reason, approval and incident references.
- Timestamp and deployment generation.

Policy/workflow events may have domain-specific append-only tables, but privileged lifecycle evidence must also link to the central audit chain.

## 9. Runtime metrics

### Decisions

- Request count by decision/scope/outcome.
- p50/p95/p99 latency and timeout.
- Cache hit/miss/error.
- DB fallback and last-known-good use.
- Compile/deployment propagation duration.
- Evaluation failure/fail-closed/fail-open count.
- Outcome distribution shift.
- Shadow/canary divergence.

### Workflows

- Starts/completions/cancellations/failures.
- Task age and SLA breach.
- Reminder/escalation count.
- Assignment resolution failure.
- Duplicate/conflict/retry rate.
- Timer lag.
- Outbox/domain command failure.
- Instances by pinned definition version.

### Administration/UI

- Validation failure categories.
- Simulation/replay duration and failure.
- Approval/deployment lead time.
- Accessibility/client errors and API error rates.
- Hierarchy roots/invalid nodes/metadata gaps, restructure operations/failures, authorization denials, stale scope selections and policy binding invalidations by organization/scope.

## 10. Alerts

| Signal | Initial condition | Severity | Owner |
| --- | --- | --- | --- |
| Critical decision unavailable | Any sustained fail-closed/no LKG | Sev 1/2 by decision | SRE + domain owner |
| Deployment propagation incomplete | > target window | Sev 2 | SRE |
| Cache/DB split or checksum failure | Any | Sev 1 | SRE/Security |
| Decision p95 breach | > 200 ms sustained | Sev 2 | SRE/Backend |
| Outcome distribution anomaly | Baseline threshold | Sev 2/3 | Domain owner |
| Timer lag | > SLA threshold | Sev 2 | SRE/Workflow owner |
| Unresolvable assignments | Sustained or critical task | Sev 2 | Workflow owner |
| Unauthorized lifecycle attempt | Any high-risk attempt | Security alert | Security |
| Audit append failure | Any sustained failure | Sev 1/2 | SRE/Security |
| Hierarchy invariant/quality failure | Any active invalid root/path/org relation | Sev 2 | Data Steward/DB/SRE |
| Cross-org/scope authorization attempt | Any high-risk attempt or sustained pattern | Security | Security |
| Hierarchy change leaves invalid policy binding | Any | Sev 1/2 | SRE/Policy owner |

Tune alerts with production baselines; avoid paging on un-actionable noise.

## 11. Dashboards

- Decision runtime health and latency.
- Deployment propagation and version inventory.
- Decision outcome/divergence by scope.
- Workflow task/SLA/escalation health.
- Administration lifecycle throughput.
- Audit/security events.
- Replay/load job utilization.

Every dashboard links to owner and runbook.

## 12. Runbooks

- Decision runtime unavailable.
- Corrupt/mismatched artifact checksum.
- Activation propagation stuck.
- Emergency policy rollback.
- Unexpected decision outcome spike.
- Workflow timer lag/backlog.
- Stuck/unresolvable workflow task.
- Duplicate/conflicting workflow command.
- Replay job privacy or capacity incident.
- Audit append/verification failure.

Runbooks include detection, diagnosis, safe action, rollback, evidence capture, communications and escalation.

## 13. Security pipeline

- SAST, dependency/SCA, secret scanning and IaC scanning.
- SBOM for runtime candidates and UI dependencies.
- Artifact schema fuzzing and expression abuse tests.
- Authorization/SoD integration tests.
- DAST against admin and evaluation APIs.
- Container and deployment configuration scan.
- Signed/provenance-controlled build artifacts where platform standards require.

## 14. Exit gate

Phase 9 passes when organization/hierarchy and policy/workflow threat controls are implemented or formally accepted, lifecycle/restructure evidence is tamper-evident, dashboards/alerts/runbooks are actionable, and Security/SRE approve production verification.
