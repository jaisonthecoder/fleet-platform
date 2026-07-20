# Phase 3 - Database Registry and Migration Foundation

## 1. Objective

Create the PostgreSQL persistence model for immutable policy/workflow definitions, revisions, deployments, approvals, test cases, replay runs, audit/change events, durable workflow tasks/events/timers, and compatibility with current tables.

## 2. Owners and dependencies

- **Primary:** AI Database Engineer
- **Implementation:** Backend NestJS / Drizzle
- **Reviewers:** Solution Architect, Security, QA, SRE
- **Depends on:** Phase 2 contracts

## 3. Persistence principles

- Store authored and compiled artifacts as immutable JSONB with schema version and checksum.
- Keep lifecycle, relationships, scope, approvals, deployments, and queryable metadata relational.
- Never normalize individual condition rows unless measured query requirements justify it.
- Every mutable draft uses optimistic revision locking.
- Active deployments are uniquely constrained per organization, decision key, scope, and effective interval.
- Production logs are append-only and partition/retention ready.
- Decision scope storage depends on O2 stable hierarchy codes/invariants and may not point to invalid, retired, or cross-organization nodes.

## 4. Policy registry entities

### `decision_definition`

Logical policy identity:

- `id`, `organization_id`, `decision_key`, localized name/description.
- owner team/person, impact class, output schema ref.
- status, created/updated timestamps.
- Unique `(organization_id, decision_key)`.

### `decision_version`

Immutable approved source version:

- `id`, `decision_definition_id`, semantic/integer version.
- `authored_definition` JSONB.
- `compiled_artifact` JSONB or bytea/blob reference.
- `definition_schema_version`, `runtime_adapter_version`.
- source/compiled checksum.
- created by/at, approved by/at, change summary.
- Unique `(decision_definition_id, version)` and checksum indexes.

### `decision_draft`

Mutable working copy:

- `id`, definition ID, based-on version ID.
- authored definition, revision integer, lifecycle status.
- author, reviewer workflow instance ID.
- validation summary, created/updated timestamps.
- Optimistic update requires expected revision.

### `decision_scope_binding`

- Version/deployment binding to organization or hierarchy node.
- scope level, precedence, valid time range.
- Exclusion constraint preventing overlapping active bindings at the same precedence.
- Explicit binding kind (`organization-default` or `hierarchy-node`), organization consistency FK/trigger and hierarchy generation metadata.

### `decision_deployment`

- `id`, version ID, environment, scope binding.
- status: Scheduled/Canary/Shadow/Active/Retired/Failed/RolledBack.
- effective range, percentage/selector for canary.
- deployment generation, activated/retired metadata.
- previous deployment ID and rollback source ID.
- Partial unique active constraint by organization/key/scope/environment.

### `decision_test_case` and `decision_test_run`

- Named facts, expected result/path/reasons, owner and tags.
- Run status, artifact checksum, actual result, duration and diagnostic differences.

### `decision_replay_run` and `decision_replay_result`

- Dataset selector, privacy approval, draft/active versions, aggregate counts.
- Per-result storage minimized or sampled according to classification.

### `decision_change_event`

Append-only lifecycle evidence: draft created/updated, validated, submitted, approved, rejected, deployed, superseded, rollback requested/completed.

## 5. Production evaluation log

Extend/replace `decision_log` with:

- decision/evaluation ID.
- organization, decision key, policy version ID, deployment ID.
- scope requested/resolved.
- subject reference where permitted.
- facts fingerprint, fact schema version, freshness summary.
- matched path/row IDs.
- output fingerprint or minimized output.
- reason codes, failure mode, duration, correlation/trace ID.
- evaluated timestamp.

Do not store raw facts by default. Partition by month/time when volume warrants it and define retention/archival.

## 6. Workflow registry and durability entities

### `workflow_definition` and `workflow_definition_version`

- Stable key and localized metadata.
- Immutable authored/compiled definition, schema/runtime versions and checksums.
- Impact class, owner and approval metadata.

### `workflow_deployment`

- Environment, effective range, status, generation and rollback lineage.
- Unique active deployment per organization/key/environment.

### Extend `workflow_instance`

- Definition version/deployment IDs.
- current state, status, variables JSONB, lock version.
- subject ref, correlation ID, started/completed timestamps.
- parent/root instance IDs if controlled composition is later enabled.

### Replace/extend `workflow_step` as `workflow_task`

- State/task key, task type, assignment source.
- assignee person/role/scope, delegation metadata.
- status, SLA/reminder/escalation timestamps.
- cycle number and optimistic lock version.

### `workflow_event`

Append-only sequence:

- instance ID, sequence, command ID.
- event type, actor, on-behalf-of, from/to state.
- minimized payload, reason, occurred timestamp.
- Unique `(instance_id, sequence)` and `(instance_id, command_id)`.

### `workflow_timer`

- Instance/state/task IDs, timer key, due time, status, attempts.
- Integrate or map to existing `scheduled_work` without two competing timer authorities.

## 7. Migration sequence

Use migrations after the current repository journal; actual generated numbers are allocated at implementation time and must account for organization migrations O1/O2 and already-landed policy draft migrations:

1. Registry metadata and immutable decision artifacts.
2. Draft, approval, and change-event entities.
3. Scope bindings and deployments with exclusion/unique constraints.
4. Test/replay entities.
5. Evaluation-log provenance additions and partition preparation.
6. Workflow definition/deployment entities.
7. Workflow instance/task/event/timer evolution.
8. Compatibility views/backfills from current policy/workflow rows.
9. Constraint hardening after backfill verification.
10. Retire legacy columns/tables only after cutover and retention approval.

Organization data cleanup and hierarchy hardening land before decision scope-binding constraints. Backfills reject unexplained multiple roots, missing stable codes, invalid parent/level/organization relations, and leaked test data.

Every forward migration has a compensating operational migration or rollback procedure. Destructive cleanup is a separate release after rollback expiry.

## 8. Backfill and compatibility

- Convert each in-memory seed into an authored version with `legacy-seed` provenance.
- Convert active `policy_rule`/`policy_version` rows into registry versions and deployments.
- Preserve original JSON and checksums for audit comparison.
- Create a compatibility adapter/view while the old evaluator remains active.
- Pin existing workflow instances to a generated `legacy-v1` definition matching their current steps.
- Do not migrate active instances into new semantics mid-flight; use compatibility execution or drain them.

## 9. Constraints and concurrency

- Advisory or row lock per `(organization, decision/workflow key, scope, environment)` during deployment.
- Partial unique index for active deployment.
- Effective-range exclusion for bindings/deployments where overlapping is illegal.
- Check constraints for lifecycle/effective-date consistency.
- FK organization, hierarchy, person, definition, version, deployment, workflow instance.
- Append-only triggers or restricted repository paths for versions/events where appropriate.

## 10. Index plan

- Catalog filtering by organization, owner, status, impact class.
- Active deployment resolution by key/scope/effective time.
- Version history by definition/version descending.
- Draft ownership/status/revision.
- Evaluation audit by key/time, subject/time, correlation ID.
- Workflow inbox by assignee/status/SLA.
- Timer worker by status/due time using `FOR UPDATE SKIP LOCKED`.

Validate query plans against realistic data volumes before finalizing.

## 11. Data governance

- Raw fact replay data requires classification and retention approval.
- Fingerprint identifiers with approved hashing and salt/key strategy where needed.
- Restrict authoring artifacts and logs by role and scope.
- Keep all data and backups in approved UAE-hosted resources.
- Define deletion/anonymization behavior without breaking immutable control evidence.

## 12. Tests and evidence

- Fresh migration and idempotent migration tests.
- Backfill parity checks and row counts.
- Concurrent deployment race test.
- Effective-range overlap rejection.
- Optimistic draft conflict test.
- Duplicate workflow command and event-sequence tests.
- Timer concurrent-claim test.
- Forward/compensating migration rehearsal.
- Query-plan and volume test.

## 13. Exit gate

Phase 3 passes when fresh and upgrade migrations succeed, organization O1/O2 gates pass, scope-binding constraints prove hierarchy/organization and concurrency invariants, current data is backfilled with parity evidence, and the old schema remains operational through the compatibility boundary.
