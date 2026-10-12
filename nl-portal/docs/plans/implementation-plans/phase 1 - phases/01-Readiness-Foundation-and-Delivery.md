# P1.01 - Readiness, foundation and delivery

Status: partially implemented; transaction-bound enqueue and retained-job duplicate protection verified. Version 1.2, 12.09.2026. Follow the [shared development procedure](README.md). This is a foundation stage; no customer business screen is claimed complete here.

## Outcome and entry gates

A developer can install, migrate, start the API/SPA/simulator and demonstrate a durable job using the approved toolchain. Delivery has named decision owners and no invented production configuration.

Entry: access to the repository and local prerequisites. Obtain approval before any schema repair, dependency installation or cloud provisioning. Inspect actual applied migration history; do not assume the scaffold is empty or safe to reset.

Trace: FR-SYS-001, FR-SYS-002, FR-ECO-003, FR-ECO-005; NFR-ARC-001/002/004/006/007/008, NFR-REL-003/004, NFR-OPS-001/003/005/006, NFR-SEC-007/008.

## Implementation checkpoint - 12.09.2026

- P1.01-B increment: `JobsService.enqueue(transaction, name, payload, identity)` requires the business transaction client and uses the installed pg-boss Prisma adapter. No separate connection is used for the enqueue. There were no existing production enqueue callers to migrate; future business services must call it inside their `TenantRepository` transaction.
- Identity requires nonblank `sourceMessageId` and `portalRef`, stable across retries. A versioned JSON tuple of job name, tenant (for tenant-scoped handlers), source message and portal reference is SHA-256 hashed into a UUIDv8 job ID. The existing pg-boss unique constraint arbitrates concurrent duplicates without another table or queue-policy change. Producers must supply identities scoped to their source; scheduled occurrences need stable occurrence IDs, not a fresh random ID on retry.
- A duplicate returns `null`, preserving the original payload, while the job record exists, including active/completed states. This does not undo other business writes in the surrounding transaction: callers must handle the result and make their business operation replay-safe. Cleanup of the job record removes this protection; durable source reconciliation and handler/external-system idempotency remain required. No exactly-once external-effect guarantee is claimed.
- Database evidence: a job is invisible to another connection before commit; commit persists the business write and job; rollback removes both; a new queue connection can fetch committed work after producer shutdown. Tests suppress background worker registration to make these assertions deterministic. Reconnection is not a process-crash or handler-recovery test.
- Duplicate-protection evidence: concurrent same-key submissions insert one job, differing tenants/messages/references remain independent, delimited tuple encoding avoids ambiguous concatenation, blank identities are rejected, rollback allows same-key resubmission, and active/retained completed jobs suppress repeat enqueue without replacing payloads.
- End-of-increment checks passed: backend typecheck, lint, build, six unit tests, twenty-six database isolation/job tests and five API bootstrap/readiness tests. The disposable database was removed; no application schema migration was needed.
- Remaining P1.01-B gates: durable replay protection beyond queue retention and handler idempotency, crash/retry/restart during processing, runtime internal-context escalation protection, upgrade/recovery rehearsal and complete audit/analytics conventions. P1.01-A simulator and P1.01-C delivery gates also remain open. This checkpoint does not mark the slice or stage complete.
- Working cadence: batch unit tests and typechecking at the end of each coherent implementation slice/increment, not after every file edit. Keep verification claims scoped to the behavior actually exercised.

## Vertical slices

### P1.01-A - Readiness register and reproducible startup

- Goal/demo: a clean checkout runs API, SPA and an explicitly selected dev simulator with documented configuration.
- Decide: named pilot, approvers, trusted issuers, email/storage access, source contract owners and deployment option. Carry D-01 through D-18 to the stage that needs them; do not block all local work on every future decision.
- Files: root/app package scripts and lockfile, API/web entry points, simulator package, environment examples, Compose and existing CI/config documentation only as needed.
- DB/contracts: establish migration baseline and connection identities; define environment validation and simulator prohibition in production. Preserve canonical adapter extension points without creating speculative future entity tables.
- API/UI: health/readiness and minimal bootable SPA; configure SPA route fallback for shared hosting. No own authentication pages beyond Microsoft-managed sign-in entry in the next stage.
- Tests: clean install, app build, invalid config rejection, production simulator rejection, health smoke and independently buildable apps. Verify secrets cannot enter frontend bundles.
- Exit: startup commands work from documented prerequisites; missing credentials/services are explicit blockers, not mocked successes.

### P1.01-B - Migration, tenancy-role and job-transaction baseline

- Goal/demo: commit creates one durable job; rollback creates none; restart resumes pending work.
- DB: controlled baseline migrations, separate migration/runtime identities, least-privilege grants and initial audit/analytics conventions. New business tables receive their RLS in their owning slices.
- Contracts/API: JobQueue and adapter contracts; confirm the installed pg-boss transaction API before claiming atomic enqueue. No second outbox/broker by default.
- Integration: consumer lifecycle, retry/backoff, shutdown and idempotency test hook using non-sensitive fixture data.
- Tests: rollback, crash after commit, duplicate delivery, restart during processing, runtime identity cannot bypass RLS or elevate to system context.
- Exit: reproducible fresh-database and upgrade rehearsal; compensating recovery documented, with no destructive reset of an existing environment.

### P1.01-C - CI, OpenAPI and observability baseline

- Goal/demo: CI builds usable artifacts; one request/job/simulator operation is traceable by correlation lineage.
- Files: current pipeline, app OpenAPI generation and scripts, structured logger, health and existing integration monitoring surfaces.
- API: versioned REST/OpenAPI and route-policy checks; explicitly review infrastructure endpoint policy rather than omitting permissions accidentally.
- UI: generated API client workflow documented; no importing backend source into the SPA.
- Operations: mask email/token/cost-sensitive log data; failed-job and error metrics; store build/test evidence. Application Insights is the baseline, not a new local observability stack.
- Tests: lint/typecheck/test/build, schema/contract drift check, usable deployment artifacts and configuration/health-path consistency.
- Exit: pipeline failures are actionable and cannot report success with missing app outputs or skipped required tests.

## Development command script

The following root scripts were observed during planning. Recheck package scripts and prerequisites before execution. Run one command at a time in PowerShell; this plan does not execute them.

```powershell
pnpm install
pnpm db:up
pnpm migrate:deploy
pnpm dev
```

`pnpm dev` currently selects the API and web apps, not the simulator. Confirm whether Compose starts the simulator; otherwise add/document its approved startup path in this stage. Validate migration history before `migrate:deploy`. CI uses a reviewed committed lockfile and frozen install once the lockfile is established.

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:isolation
pnpm build
```

Isolation tests need their configured database. App e2e, OpenAPI/client generation, accessibility and load commands must be confirmed or introduced in the owning app; they are not implied by `pnpm test`.

## Cloud boundary and deliverables

Use the [Azure checklist](../../04-Azure-Team-Request-Checklist.md). App Service and Azure Container Apps remain alternatives under D-17; choose one, not both. The selected host must support in-process scheduled/background work and safe restart; do not scale workers to zero. ACR is an image registry, not the runtime.

Deliver startup/runbook, environment contract, reproducible pipeline, migration evidence and job-transaction test results. Do not provision Redis, Service Bus, CRM, Power BI or model hosting. Local simulation does not prove production network/identity/CW1 readiness.

Next: [P1.02](02-Identity-Tenancy-and-Permissions.md).
