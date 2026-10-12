# ADR-004 — Phase 1 runtime simplifications

| | |
|---|---|
| **Status** | Accepted · 04.09.2026 |
| **Context** | The v2 design carried Redis, a message broker (Service Bus / RabbitMQ), a separately deployed worker, our own login/session/MFA code, three worker DB roles and a number of small tables and screens. None of this is required by the PRD for the pilot; each is a place where something can break and a thing to operate. The PRD's §8 stack is a recommendation. |
| **Principle** | Keep the seam, drop the code. See `Simplification-Register.md` for the full list. |

## Decisions

1. **No Redis in Phase 1.** Master data, permissions and hierarchy are read from Postgres per request. A cache is added inside the owning service only when a measured p95 requires it.
2. **Jobs in Postgres (pg-boss), no broker.** Jobs are enqueued in the same transaction as the business write, retried with backoff, and failed jobs are kept in pg-boss's failed table (our dead-letter queue). A `JobQueue` interface allows a later move to Azure Service Bus with the same message contracts. Deviation from the PRD §8 recommendation, not from a requirement.
3. **One deployable.** Job consumers run inside the API process. `WORKER_MODE=split` starts them as a separate process when load requires it.
4. **Identity is Entra's job.** The SPA signs in with MSAL (PKCE) against Entra External ID (customers, including email + password + MFA accounts and federation to customer IdPs) or Entra ID (staff). The API validates tokens and loads the user. We write no login, session, refresh, password, MFA or lockout code. `identity_mode` stays as a one-value enum for the future.
5. **Raw CW1 messages in Postgres**, not Blob, with a 13-month retention delete. Blob is for documents and PDFs only.
6. **One worker DB role** with DELETE revoked on tenant tables, instead of three.
7. **Linking an org code is one audited action** with a confirm dialog. `customer_account.approved_by` is the seam for a two-person approval if the sponsor asks for it (ADR-003 item 2 becomes optional).
8. **No admin screens for role design, API clients, approvals or unmapped queue** in Phase 1. Presets are seeded; `api_client` exists empty; unmapped shipments are a view in Phase 2.

## Consequences

Phase 1 runs on Postgres, Blob and Entra. Docker Compose is Postgres plus the simulator. Fifteen tables instead of twenty-seven. The tenancy model, adapters, audit and idempotency rules are unchanged. Everything removed has a documented way back that does not touch the remaining tables.
