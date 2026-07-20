# Sub-Phase 1A₂ — Configuration: Lookup & User / Access Management

**The two platform-configuration capabilities every other module depends on:** (1) a single, bilingual, hierarchical **lookup / reference-data** engine that backs *every* dropdown and configurable value, and (2) **user & access management** — SSO login, just-in-time provisioning, and admin-driven role assignment over the hierarchy, built to accept HCM-driven provisioning later.

- **Entry dep:** [1A](01_sub-phase-1a_platform-completion.md) (RBAC `AccessService`, SoD guard, hierarchy engine, audit, HCM source port, notifications).
- **Unlocks:** [1B](02_sub-phase-1b_master-data.md) onward — vehicles use body-type/use-category/fuel-type lookups; every module's pick-lists and scoped-admin governance come from here.
- **Migration:** `0004_lookup_identity`.

> **Why a dedicated sub-phase:** the base plan referenced lookups only as *"lookup tables where org-configurable"* and covered identity only as *SSO auth + RBAC enforcement*. It did **not** design the configurable lookup engine (bilingual, parent-child, admin-managed) nor the user-management surface (JIT provisioning, admins assigning roles, access reviews). This sub-phase closes both gaps. It is a **platform tier** slice (sibling to 1A) — build it before feature blocks.

---

## Part 1 — Lookup / Reference-Data Management

### Principle
**Every dropdown, pick-list and org-configurable value in the platform sources from lookup management — nothing hard-coded in the UI or scattered as ad-hoc values.** The only exception is a **closed structural set whose behaviour the code depends on** (e.g. lifecycle/operational status, workflow status): those stay Postgres `enum`s. Everything an administrator might reword, extend or localise is a **lookup** (body type, use category, fuel type, make, model, ownership type, vendor category, document type, violation/fine type, accident type, black-point jurisdiction, key-set type, notification channel, cost centre, …).

- **Bilingual by construction:** every lookup type and value carries `label_en` + `label_ar` **and** optional `description_en` + `description_ar`. Labels/descriptions are display-only and localisable; business logic references the stable **`code`**, never the label.
- **Parent-child:** a lookup value may have a parent within the same type (e.g. **Make → Model**, **Country → Emirate**, **Category → Sub-category**), so dependent dropdowns cascade.
- **Clusters / Pools / Yards / Locations** are the org tree — a **first-class entity** (`hierarchy_node`, `ltree`), **not** flattened into lookup values (see [Design decision](#design-decision-adr-009--guardrails)). What *is* a lookup is the **level taxonomy** itself (Cluster/Pool/Yard/Location) — a `hierarchy-level` lookup type — because nothing operational foreign-keys a *level* (roles/vehicles/people scope to a *node*). The nodes gain a bilingual `name_ar` and are administered through the **same configuration surface** as lookups, so "clusters and pools come from config/lookup management" holds operationally without corrupting the data model.

### DB (`0004_lookup_identity`)
- **`lookup_type`** — a configurable list's domain: `id`, `code` (stable, unique), `label_en`, `label_ar`, `description_en`, `description_ar`, `is_hierarchical` (allows parent-child values), `is_system` (seeded; cannot be deleted), dormant `organization_id`, timestamps.
- **`lookup_value`** — a value in a type: `id`, `lookup_type_id` FK, `code` (stable), `label_en`, `label_ar`, `description_en`, `description_ar`, **`parent_id`** (self-ref, same type — parent-child), `sort_order`, `is_active`, `valid_from`/`valid_to` (effective-dated, **soft-state — never hard-deleted**), `metadata` jsonb (extra attributes). **Unique** `(lookup_type_id, code)`; index `(lookup_type_id, parent_id, sort_order)`; optional `ltree path` for deep trees.
- **Level taxonomy is a lookup:** seed a `hierarchy-level` lookup type whose values are the configured levels (`CLUSTER`, `POOL`, `YARD`, `LOCATION` for AD Ports; another org configures `COMPANY`, `REGION`, `BRANCH`) with `sort_order` = depth. Nothing FK's a level, so it lives cleanly as reference data.
- **`hierarchy_node`** (existing entity) gains **`name_ar`** (bilingual; `name` = `name_en`) and stores its level as a denormalised **`level_code`** (references the `hierarchy-level` lookup *by code*) plus the existing `level_index` — so scope/authorization queries resolve depth **without a join** (see guardrail 3). No structural change to its `ltree path`, FKs or effective-dating.

### Design decision (ADR-009) & guardrails
This split is recorded as **[ADR-009](../../../implementation-plan/01_Architecture_and_Tech_Stack.md#7-architecture-decision-candidates)** so it stays traceable. It is deliberately the option that protects simplicity, performance, scalability and cross-org reusability — flattening scopes into a generic lookup table would break all four. Guardrails (cheap now, expensive to retrofit):

1. **Business logic branches on stable `code`, never on a label or UUID.** Labels are display-only (EN/AR); ids are storage FKs; `code` is the contract — this is what keeps the platform both localisable and reusable across orgs.
2. **Never store a security scope (a `hierarchy_node`) in the generic lookup table**, and never FK an operational table to a polymorphic lookup row (a scope FK must be typed to `hierarchy_node`).
3. **Never resolve display labels on the authorization / booking / eligibility hot path** — those use ids/`code`s only (scope via `ltree` + GIST, join-free); labels are joined only for read/display responses.
4. **Soft-state everywhere** — lookups, nodes, users and role assignments are deactivated / effective-date-expired, never hard-deleted (history, audit and access reviews depend on it).
5. **The read facade is optional sugar** — two clear read endpoints (`/lookups/:type`, `/hierarchy`) suffice; no extra abstraction layer unless the UI genuinely benefits.

### Module — `config/` (lookups)
- **`LookupService`** — read APIs (values by type `code`, active-only, effective-dated at a point in time, full **tree** for hierarchical types) + **admin CRUD** (create / update / deactivate — never hard-delete a `is_system` value), reorder, and **parent-child validation** (no cycles; parent must be the same type). **Redis-cached** hot lists with invalidation on any change (reuses the compiled-cache pattern from the PDP).
- **Seeded lookup types (fixtures until org confirms):** **hierarchy-level** (Cluster/Pool/Yard/Location) · vehicle body type · use category · fuel type · ownership type · make · model (child of make) · vendor category · document type · fine/violation type · accident type · black-point jurisdiction · key-set type · notification channel · cost centre.

### Endpoints
- `GET /lookups` (list types), `GET /lookups/:typeCode` (active values; `?tree=true` for hierarchical; both labels returned, client localises), `GET /lookups/:typeCode/:parentCode` (children for cascading dropdowns).
- Admin (RBAC `DataSteward`/`SystemAdmin`): `POST /admin/lookups/:typeCode/values`, `PATCH /admin/lookups/values/:id`, `POST /admin/lookups/values/:id/deactivate`, `POST /admin/lookups/values/reorder`. Every change **audited** + effective-dated + cache-invalidated.

### Events
`LookupChanged` (→ cache invalidation, downstream refresh).

---

## Part 2 — User / Access Management

### Principle
SSO via Entra is the login; the platform keeps a **user account** linked to the HR **person**; **admins assign hierarchy-scoped roles**; SoD is enforced at assignment; access is recertifiable; and provisioning is built to accept **HCM-driven** identity/role sourcing later.

### DB (`0004_lookup_identity`, continued)
- **`user_account`** — the login identity: `id`, **`entra_object_id`** (unique — the SSO subject), `person_id` FK (link to HR master; nullable until matched), `email`, `display_name`, `status` (`Active` / `Suspended` / `Deprovisioned`), `last_login_at`, `is_service_account`, dormant `organization_id`, timestamps.
- **`role_assignment`** (exists from Phase 0 / 1A) gains provenance columns: **`source`** (`manual` / `hcm` / `entra-group`, default `manual`) and **`assigned_by_person_id`** — so an admin assignment is attributable and a future HCM/Entra-group-driven assignment is distinguishable. (Assignments stay effective-dated via existing `valid_from`/`valid_to`.)

### Module — `identity/` (extends platform)
- **`AuthService`** — Entra **OIDC/JWT** validation (MSAL on the client; `passport-azure-ad`/JWKS on `api`); exchange the Entra token for a session carrying **role + scope claims**; **MFA** enforced via conditional access for elevated roles (FR-IAM-01/06). Phase-0 **dev-login** remains available in lower environments only (structurally off in uat/prod — from 1A guard).
- **`UserProvisioningService`** — **JIT provisioning**: on first successful SSO login, create/link a `user_account`, match it to a `person` (by email / HCM employee id), set `status=Active`, and audit. This is the seam where **future HCM integration** plugs in — HCM (via the 1A `HcmSource` port) owns person/employment; Entra owns identity; provisioning reconciles the two.
- **`UserAdminService`** — admins **list users**, view a user's roles/scopes, **assign / revoke roles** (create / effective-date-expire `role_assignment` as role @ hierarchy scope), and **suspend / reactivate** users. RBAC: only `SystemAdmin` (global) or a scoped admin may assign within their scope. **SoD is enforced at assignment time** (SoD-04 no Finance+FleetManager co-hold; SoD-05 SystemAdmin cannot hold operational approval) — a role grant that would create a forbidden combination is rejected, and every assignment is **audited** with `assigned_by_person_id`.
- **`AccessReviewService`** — exportable **"who has what, where"** recertification report (FR-IAM-05).

### Endpoints
- `POST /auth/session` (exchange Entra token → session), `GET /me` (roles + scopes; from 1A).
- Admin (RBAC-gated, SoD-checked, audited): `GET /admin/users`, `GET /admin/users/:id`, `POST /admin/users/:id/roles` (assign role@scope), `DELETE /admin/users/:id/roles/:assignmentId` (revoke = effective-date expire, never hard-delete), `POST /admin/users/:id/suspend`, `POST /admin/users/:id/reactivate`, `GET /admin/access-review` (export).

### PDP / SoD / Events
- **PDP:** none new (assignment authority is RBAC + SoD, not a decision table) — though an org may later route privileged grants through the workflow engine.
- **SoD:** role assignment is itself a SoD-guarded, audited action.
- **Events:** `UserProvisioned`, `RoleAssigned`, `RoleRevoked`, `UserSuspended`.

---

## Cross-cutting
- **Cost masking (FR-IAM-03):** the access matrix that masks cost per role/scope reads role + scope from this module; dashboards (1F) enforce it server-side.
- **Localisation:** all lookup labels/descriptions EN + AR; the org tree bilingual; reason codes stay stable machine strings localised on the client.
- **Soft-state:** lookups, users and role assignments are deactivated / expired, never hard-deleted (history + audit + access reviews depend on it).

## Tests
- **Lookup:** value read by `code`; hierarchical **tree** + cascading children (Make→Model); EN/AR both returned; admin create/update audited + cache-invalidated; duplicate value code rejected; effective-dated read. *(Cycle-safe by construction — a parent must pre-exist; a `deactivate`/hard-delete path + `is_system` protection land with the admin HTTP surface.)*
- **Seed:** Phase-1 fixture types (`hierarchy-level`, `vehicle-body-type`, `use-category`, `fuel-type`, `ownership-type`, `vehicle-make`→models) ship in `scripts/seed-dev.sql`, bilingual + code-keyed, so dropdowns are populated out-of-the-box.
- **User/access:** JIT provisioning on first SSO login **matches the person by HCM id → email** (else unlinked, no roles); admin assign/revoke updates `role_assignment` with `assigned_by`/`source`; **SoD rejects a forbidden co-hold grant** (executable); revoke is an effective-date expiry not a delete; access-review export lists who-has-what-where.

## SSO / auth (implemented)
**Entra JWT authentication is fully wired.** A global `AuthGuard` accepts either a verified Entra token or dev-login: bearer tokens are validated with **`jose`** against the tenant **JWKS** (signature, issuer, audience, expiry), the user is provisioned JIT and the request principal (roles/scopes) is attached; **dev-login** (`x-dev-person-id`) is accepted only in lower environments (structurally off in uat/prod). A global **`RolesGuard`** + `@Roles()` enforces RBAC; `@Public()` exempts health. Admin HTTP endpoints (lookup + user/role admin) are live behind RBAC. jose 6 is ESM-only, loaded via a cached dynamic `import()` (build preserves native import; jest transforms jose to CJS) — kept on the latest version, no downgrade.

## Exit gate
- Every configurable dropdown sources from lookups — **no hard-coded pick-lists**; bilingual EN/AR; parent-child cascading proven; admin create/update + audit + cache invalidation green; **fixture types seeded**.
- JIT provisioning **provisions + links** a user (HCM id / email match); an admin can **assign/revoke hierarchy-scoped roles**; **SoD enforced at assignment**; access-review export works; assignments effective-dated + audited; provenance (`source`, `assigned_by`) recorded so **future HCM-driven provisioning** drops in without a schema change.
- **SSO works end-to-end:** Entra JWT verified against JWKS (jose), global auth + RBAC guards, admin HTTP endpoints role-gated; dev-login for lower environments; only the real Entra tenant values are environment-supplied.

## Traceability
- **FRs:** FR-IAM-01..06 (SSO, hierarchy-scoped RBAC, cost masking, structural SoD, access reviews, session/step-up); FR-ARC-01/02 (config-by-data, N-level hierarchy); C1 vehicle "Lookup" fields; P1 (reusability by configuration) / P2 (identity & access).
- **Critique resolved:** LU-1 (lookup label-vs-code discipline), LU-2 (SoD-at-assignment), LU-3 (JIT provisioning identity-match), LU-4 (tree stays an entity) — see [08_critique-and-gap-analysis.md](08_critique-and-gap-analysis.md).
- **Gate items advanced:** SoD-04/05 at role assignment; cost-masking source; bilingual config; access-review export.
- **Migration catalog:** `0004_lookup_identity` (`lookup_type`, `lookup_value` incl. seeded `hierarchy-level` type, `user_account`; `+hierarchy_node.name_ar` + `hierarchy_node.level_code`; `+role_assignment.source`, `+role_assignment.assigned_by_person_id`).
- **ADR:** [ADR-009](../../../implementation-plan/01_Architecture_and_Tech_Stack.md#7-architecture-decision-candidates) — hierarchy nodes are an entity; level taxonomy + pick-lists are lookups; `code`-not-label discipline.
- **D-list:** lookup *values* (make/model lists, vendor categories, jurisdiction concepts) are org-configurable fixtures until the business confirms them — dated-risk, not code-blocking.

**Next:** [Sub-Phase 1B — Master Data](02_sub-phase-1b_master-data.md).
