# Simplification Register — v3

| | |
|---|---|
| **Principle** | Keep the seam, drop the code. A nullable column, a config constant or an interface costs nothing and keeps us flexible. A second flow, an extra runtime or an admin screen costs weeks. |
| **Applies to** | LLD v3, CLAUDE.md v3, 01-Plan v3, ADR-004 |
| **Written** | 04.09.2026 |

Each row: what is removed from Phase 1, why that is safe, what we keep so it can come back without redesign.

## A. Infrastructure and runtimes

> **Rows A1, A2 and A3 were re-examined on 17.09.2026 and confirmed.** The reasoning below
> was one line long and had no stated trigger for revisiting, which made the decision
> re-openable on opinion alone. [ADR-008](adr/ADR-008-background-work-queue.md) now carries
> the full history, the code evidence, the four numbered triggers that would reverse it, and
> the cost of reversing — the outbox table and relay needed to replace the transactional
> enqueue we get for nothing today. Two corrections to the text below: the seam is
> `JobsService.enqueue(transaction, name, payload, identity)`, not a `JobQueue` interface;
> and the shared-package layout in A6 was never built — see `CLAUDE.md` for the real paths.

| # | Delete | Why it is safe | Seam kept |
|---|---|---|---|
| A1 | **Redis** (master data, permissions, group descendants, rate results, sessions) | Pilot volume is a few thousand rows and a few hundred users. Postgres answers these in single-digit milliseconds. Every cache is also an invalidation bug waiting to happen. | `MasterDataService` and `PermissionService` are the only callers; add a cache inside them when a measured p95 says so. |
| A2 | **Azure Service Bus + RabbitMQ locally** (two queue implementations) | A Postgres-backed job queue (pg-boss) gives retry, backoff, a failed-jobs table (our DLQ), scheduling and exactly the same message contract, inside the same transaction as the business write. One runtime instead of three. | `JobQueue` interface with `enqueue(name, payload, options)`. Swap the implementation for Service Bus when throughput demands it (PRD §8 lists Service Bus as a recommendation, not a requirement — recorded in ADR-004). |
| A3 | **Separate `integration-worker` deployable** | NestJS runs job consumers in the same process. One deployable, one log stream, one config. | The `integration` module boundary stays; a `WORKER_MODE=split` flag starts consumers in their own process later. |
| A4 | **Raw message archive in Blob** | Store the raw XML in `integration_message.payload` (text). 13-month retention (PRD §5) is a scheduled delete. Blob stays for documents and PDFs only. | Column can be replaced by a `payload_ref` to Blob when size matters. |
| A5 | **Nx / Turborepo** | pnpm workspaces alone build and run four packages. | Add Nx if the graph grows. |
| A6 | **`packages/cw1-adapter`** as a separate package | XML (de)serialisers live in `apps/noatum-customer-portal-api/src/integration/cw1/`. Two packages remain: `design-system`, `shared-types`. | Extract when a second app needs it (the simulator can import from the api package in dev). |
| A7 | **OpenTelemetry + local Grafana/Tempo/Loki stack** | Correlation id middleware + JSON logs + Azure Application Insights SDK is one dependency and one dashboard. | Correlation id already flows API → job → CW1 message; OTel can be added on top later. |
| A8 | **Azure Front Door + WAF in Phase 1** | Phase 1 has no public pages. Rate-limit middleware on the API is enough. | WAF goes in front of the public pages in Phase 2. |
| A9 | **Circuit breaker library on `RateEngineAdapter`** | A 25 s timeout and "fall through to manual path" is the whole behaviour needed. | Timeout constant in config. |

## B. Identity and sessions

| # | Delete | Why it is safe | Seam kept |
|---|---|---|---|
| B1 | **`local_credential`, `mfa_device`, `mfa_recovery_code`, login lockout, per-customer login slug** | Entra External ID handles passwords, MFA, lockout and password reset for customers without a corporate identity (email + password + MFA accounts live in Entra). | `customer_group.identity_mode` stays as an enum with one value in use (`entra_external`). |
| B2 | **`customer_sso` code path, `sso_config`** | Entra External ID federates to a customer's own IdP by configuration in Entra, not in our code. | Same `identity_mode` column. |
| B3 | **Our own `/auth/*` endpoints, `user_session` table, refresh tokens, `role_version`, JWT `ver`** | The SPA uses MSAL (PKCE) against Entra directly; the API is a plain resource server that validates Entra access tokens. Deactivation is enforced by checking `user.status` on every request. "Sign out everywhere" is Entra's job. | `user.last_seen_at` updated on `/me`; `user.idp_issuer` + `idp_subject` columns identify the identity. |
| B4 | **`user_identity` table** | One identity provider per user in practice. | Two columns on `user`; a table can be split out if a second IdP link is ever needed. |
| B5 | **`/auth/discover` home-realm logic** | Everyone goes to Entra; Entra does home-realm discovery. No enumeration surface at all. | — |
| B6 | **Entra orphan clean-up job** | An Entra account without a portal user simply gets 403 from the API. Harmless. | — |
| B7 | **Invitation reminder job** | The resend button does the same thing when a human notices. | `resend_count` column. |

## C. Tenancy and onboarding

| # | Delete | Why it is safe | Seam kept |
|---|---|---|---|
| C1 | **`mapping_change_request` table, approvals inbox, request/approve/reject/cancel endpoints** | Linking an org code becomes one audited action with a confirm dialog. This also removes the migration-ordering knot (FK before table). Two-person approval was our proposal, not a PRD requirement. | `customer_account.linked_by`, `linked_at`, and a nullable `approved_by`. If Mohamed wants 4-eyes, add a `pending` status and one approve endpoint — no new table. |
| C2 | **`unmapped_entity` table** | A view: shipments with no `shipment_visibility` row, grouped by the org codes on them. Phase 2, when shipments exist. | View definition in S2.01. |
| C3 | **Three worker DB roles** | One `app_worker` role with DELETE revoked on tenant tables and INSERT/UPDATE only where needed. | Grants live in one migration; split roles later if audit asks. |
| C4 | **Triggers for `email_domains` lower-casing and hierarchy depth** | zod transform lower-cases domains; the service checks "parent has no parent" before update. Two-level hierarchy needs a `WHERE parent_id = :g OR id = :g`, not a recursive function. | `parent_id` column unchanged. |
| C5 | **`pg_trgm` trigram index on `master_org`** | `ILIKE '%acme%'` on a few thousand rows is instant. | Add the index if the list reaches hundreds of thousands. |
| C6 | **`import_run` table** | The import job writes one `audit_event` (`master_org.import`) with counts and errors in `after`. | — |
| C7 | **Tier templates as a table + admin UI** | A config map `TIER_DEFAULT_FLAGS` in `shared-types`. Flags are still editable per customer in the admin screen. | `customer_group.tier` column stays. |
| C8 | **Per-group `visibility_policy`** (already deferred) | One constant `VISIBILITY_ROLES = ['local_client','shipper','consignee']`. | — |
| C9 | **Nightly visibility sweep, `users.erase` job** | Not needed for the pilot. Erasure waits for Legal's retention period (Phase 2). | Job names reserved in the queue naming doc. |
| C10 | **`region` for news targeting** | Scope = global / country / customer group. | Add a `region_code` column when someone asks. |

## D. Roles and admin

| # | Delete | Why it is safe | Seam kept |
|---|---|---|---|
| D1 | **Custom role designer UI and endpoints** | Six customer presets + three internal presets cover FG-8.4; sub-permissions already exist because roles are permission lists. | `role.customer_group_id` (nullable) stays, so a group-specific role can be inserted by migration or a later screen. |
| D2 | **`impersonation_session.allow_writes`** | Impersonation is always read-only. | Add the flag if support ever needs to act for a customer. |
| D3 | **`api_key`, `api_usage`, API-key guard, API clients screen** | FG-9.3 in Phase 1 is "foundation": publish OpenAPI and keep the `api_client` table. | `api_client` table (empty). |
| D4 | **`address_import_job` table** | CSV import is synchronous: upload → validation report → commit. Files are small. | — |
| D5 | **`quote_status_history`, `booking_status_history`, `rendered_document`, `quote_reject_reason` tables** | Status changes are already audit rows; the activity timeline reads `audit_event` for the entity. PDF ref is a column on `quote_version`. Reject reasons are an enum in `shared-types`. | — |
| D6 | **`widget_layout` table** | `user.dashboard_layout jsonb`. | — |
| D7 | **`news_read_receipt`** kept — needed for "show once" pop-ups, one small table. | | |

## E. Kept on purpose (PRD P0 or safety)

Two tenancy patterns (single-owner column, `shipment_visibility` link table) · Postgres RLS as second lock · `master_org` import · `customer_account` with unique org code · two-level hierarchy · invitations with hashed single-use tokens · preset roles with permission codes · read-only impersonation with audit · `audit_event`, `analytics_event` · idempotent jobs with retry and failed-jobs table · CW1 simulator · design-system tokens · i18n EN + ES · `api_client` and `report_assignment` (Phase 2) as foundations named by the PRD.

## F. Net effect on Phase 1

| | v2 | v3 |
|---|---|---|
| Runtimes | Postgres, Redis, RabbitMQ/Service Bus, Blob, API, worker, simulator | Postgres, Blob (files only), API (with in-process jobs), simulator |
| Tables in Phase 1 | 27 | 15 |
| Our own auth code | discovery, callback, refresh, local login, MFA, lockout, sessions | validate Entra token, load user, check status |
| Admin screens in Phase 1 | customers, accounts, approvals inbox, unmapped queue, role designer, API clients, feature flags, news, impersonation | customers (accounts, users, flags), news, impersonation |
| Scheduled jobs | org import, reminder, sweep, orphan clean-up, erasure, retention | org import, retention delete |

Everything removed can be added back without touching the tables that remain.
