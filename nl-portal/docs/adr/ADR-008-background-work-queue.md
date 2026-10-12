# ADR-008 — Background work stays on PostgreSQL (pg-boss); no broker, no Redis

| | |
|---|---|
| **Status** | Accepted · 17.09.2026 |
| **Confirms** | [ADR-004](ADR-004-phase1-simplifications.md) decisions 1, 2 and 3 |
| **Supersedes** | Nothing. This record re-examines an existing decision with evidence and records the reversal path in full |
| **Decision owner** | Development, with the architecture position put to management on 17.09.2026 |

---

## 1. Why this record exists

ADR-004 removed Redis and the message broker on 04.09.2026, in a single record covering eight
unrelated simplifications. That was enough to start building, but it left three problems:

- The reasoning was one sentence long, so anyone re-opening the question had to reconstruct it.
- There was no stated **trigger** for revisiting, so the decision could only ever be re-litigated by opinion.
- The **cost of reversing it** was never written down, which is the single most useful thing to know when you are the person doing the reversing.

The question was raised again on 17.09.2026 — the original plan had included RabbitMQ and
Redis, held back for a later phase, and management asked whether that still stood. This
record answers it properly, so the next person does not have to.

**Read this record before proposing a broker or a cache.** If you still want one after
reading it, section 7 tells you exactly what it will cost.

---

## 2. History, in order

| Date | What happened |
|---|---|
| PRD v2.1 | Recommended a **message broker (Azure Service Bus)**, **Redis**, and a separately deployed integration worker. Stated as a recommended stack, not as a requirement |
| 04.09.2026 | **ADR-004** removed all three for Phase 1, with the principle *keep the seam, drop the code*. Recorded in the [Simplification Register](../Simplification-Register.md) rows A1, A2 and A3 |
| PRD v3.0 §13 | The removals were written into the PRD itself as recorded deviations, each with a documented way back |
| PRD v4.0 §8 | Carried forward unchanged: "no separate worker deployable and no message broker" |
| 11.09.2026 | pg-boss implemented and running locally. Three queues registered |
| 12.09.2026 | Transactional enqueue completed — `JobsService.enqueue(transaction, …)` — plus deterministic de-duplication |
| **17.09.2026** | **Re-examined with code evidence. Confirmed. This record** |

---

## 3. What the code actually does today

Evidence gathered on 17.09.2026 by reading the source, not the documents.

**What is built and working** — [`jobs.service.ts`](../../apps/noatum-customer-portal-api/src/integration/jobs/jobs.service.ts):

- **Transactional enqueue.** `this.boss.send(name, payload, { db: fromPrisma(transaction) })` writes the job **inside the caller's database transaction**. If the business write rolls back, the job never existed. If it commits, the job is guaranteed queued.
- **Deterministic de-duplication.** SHA-256 over `['noatum-job-v1', name, tenant, sourceMessageId, portalRef]`, folded into a UUIDv8 used as the job id, so pg-boss's own uniqueness refuses a duplicate. No second table, no advisory lock.
- **Retry with backoff.** `retryLimit: 3`, `retryBackoff: true`. Exhausted jobs remain in pg-boss's failed state, which is our dead-letter queue.
- **Tenant isolation per job.** A job never inherits the enqueuing request's context. `JobsService` builds a fresh one from the payload, and a tenant-scoped job is refused at enqueue if it carries no `customerGroupId`.
- **Schema separation.** pg-boss owns the `pgboss` schema, created by migration `20260101000000_tenancy_roles_rls` (`CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION portal_app`). The application runs with `createSchema: false, migrate: false`, so it never alters structure at runtime.

**What is not built, stated plainly so nobody mistakes this record for a completion claim:**

- **`enqueue()` has no callers.** No business code queues anything yet.
- **No scheduler.** No pg-boss `schedule()` or cron, so nothing recurring runs.
- **Two of three handlers are placeholders** — `quote.expiry` and `shipment.refresh` log and return.
- **The one real handler is bypassed.** `OrganisationsService` calls `OrganisationImportService.run()` inline from the HTTP request.
- **No `integration_message` table**, so there is no raw-message archive and no replay.

This matters to the decision: **the queue's technology is not the bottleneck — the wiring is.**
Replacing pg-boss with a broker today would produce two idle queues instead of one.

---

## 4. Decision

1. **Background work stays on pg-boss inside the existing PostgreSQL database.** No RabbitMQ, no Azure Service Bus, in Phase 1 and until a trigger in section 6 fires.
2. **No Redis.** The three uses it is normally bought for do not apply here; the fourth has a PostgreSQL answer (section 5).
3. **No new Azure resource is required.** pg-boss is an npm dependency plus a schema in the database we already provision. The only deployment obligation is a **one-time `pgboss` schema initialisation per environment**, alongside the database migrations — already automated in CI and in `infra/scripts/local-db.mjs`.
4. **If a broker is ever adopted it will be Azure Service Bus, not self-hosted RabbitMQ**, because the operating burden is the main argument against a broker and a managed service removes most of it.
5. **`JobsService.enqueue` is the port.** Business code depends on it and on nothing beneath it.

---

## 5. Redis, use by use

| Why Redis is usually added | Position here |
|---|---|
| Cache to make slow reads fast | No measured latency problem. The budget is list under 2 s at 100k rows per customer, which PostgreSQL meets with correct indexing. Every cache is also an invalidation defect waiting to happen |
| Session store | Sessions are in PostgreSQL **deliberately** — five tables with no runtime grant, FORCE RLS, digests rather than reusable tokens (ADR-006). Moving them to Redis would weaken that design, not strengthen it |
| Distributed locks | PostgreSQL advisory locks already serialise the one place that needs it (staff role mutation) |
| **Distributed rate limiting** | **A genuine gap.** `LocalAuthService` uses `RateLimiterMemory`, which counts per process. With two or more instances an attacker gets a multiple of the intended budget |

**The rate-limiting gap has a PostgreSQL answer, not a Redis one.** `rate-limiter-flexible`
ships a PostgreSQL store; the change is a constructor swap in one file, with its table
created by an explicit migration rather than at runtime.

**This must be done before the API runs on more than one instance**, which is the same
moment it goes behind a load balancer in a real environment. It is recorded as a
prerequisite, not a preference.

---

## 6. What would reverse this decision

A broker becomes correct when one of these is **observed**, not anticipated.

| # | Trigger | How we would know |
|---|---|---|
| T1 | **Fan-out** — a second, independently owned consumer needs the same event stream, for example a data platform subscribing to every milestone | A team asks for it. This is the most likely trigger, and it is an organisational need rather than a technical limit |
| T2 | **Throughput** — sustained enqueue beyond roughly 1,000 jobs per second, or a job table that autovacuum cannot keep up with | Queue-depth and job-duration metrics. Present design point is ~2 jobs per second average, so we are about two orders of magnitude below |
| T3 | **Latency** — sub-second dispatch required | Today the worker polls every 5 seconds, which is comfortably inside the 60-second CargoWise objective. A push-based broker would be needed if that objective ever tightened |
| T4 | **Independent buffering** — CargoWise pushes at a rate that must be absorbed without touching our database | Measured ingestion pressure |

**None currently apply.** T1 is the one to watch.

Before any of this can be argued from evidence, the queue needs instrumentation: depth,
oldest-job age, failure count and per-job duration. Without those the conversation is
opinion. Adding them is the cheapest thing on this page.

---

## 7. The cost of reversing, written down now

This is the section to read if you are the person moving us to a broker.

**You will lose transactional enqueue, and you must replace it.** Today the job and the
business write commit together. A broker is a second system, so the write becomes two
operations that can half-succeed: the quote saved but never sent, or sent twice.

Restoring the guarantee requires the **outbox pattern**:

1. An `outbox` table written in the same transaction as the business row.
2. A relay process that reads unpublished rows and publishes them to the broker.
3. Marking rows published, with at-least-once delivery accepted and consumers made idempotent.
4. Monitoring for relay lag and stuck rows.

That is a new table, a new long-running process, a new failure mode and a new set of tests —
**to get back to the property we have today for free**. It is the hidden cost of the
migration and it is routinely discovered late. Budget for it explicitly.

**What does not change:** `JobsService.enqueue(tx, name, payload, identity)` stays the port.
Business modules keep calling it. The change is confined to that class, the handler
registration and the new outbox relay. No business logic moves.

**What must be re-established on the other side:** de-duplication (our UUIDv8 identity maps
to a broker message id or a de-dup window), retry and backoff semantics, the dead-letter
destination, and per-job tenant context construction.

---

## 8. Consequences

- Phase 1 runs on PostgreSQL, Blob and Entra. Docker Compose is PostgreSQL plus the simulator.
- No extra Azure resource, licence or cost line for background work.
- One backup and one restore covers both the data and the pending work, and they return in step with each other. With a separate broker they can return out of step.
- The team operates one datastore rather than three, and needs no second specialism at night.
- The design is reversible along a documented path whose cost is stated in section 7.

## 9. Follow-up actions this record creates

| # | Action | Why |
|---|---|---|
| 1 | Swap `RateLimiterMemory` for the PostgreSQL store, with an explicit migration for its table | Security gap the moment there are two instances. Blocks multi-instance deployment |
| 2 | Instrument the queue — depth, oldest-job age, failures, duration | Without it, T1 to T4 cannot be argued from evidence |
| 3 | Wire the first real producers: invitation and reset email, then the organisation import, and add a schedule for it | The queue currently has no callers, and the import breaches the adapter rule by running inline |
| 4 | Record the one-time `pgboss` schema initialisation in the release checklist for every environment | The application will not create it, by design |

## 10. Related records

- [ADR-004](ADR-004-phase1-simplifications.md) — the original simplification set
- [ADR-006](ADR-006-pilot-portal-managed-authentication.md) — why sessions live in PostgreSQL
- [Simplification Register](../Simplification-Register.md) — rows A1, A2, A3
- `docs/process/Background-Work-Queue-Decision.drawio` — the same argument for a non-technical audience
