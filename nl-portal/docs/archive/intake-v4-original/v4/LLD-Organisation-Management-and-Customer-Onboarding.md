# LLD v3 — Organisation Management and Customer Onboarding

| | |
|---|---|
| **Version** | 3 — simplified per `Simplification-Register.md`; includes the six must-fix items (trailing comma, case-insensitive org upsert, Customer Admin permissions, Ops role and impersonation, addressee seam on users, public T&T function) |
| **Traces to** | PRD FG-8.1, FG-8.2, FG-8.4, FG-10, §5 master data, §6, §7 · KB-CW1-Integration-Multi-Tenant v2 · ADR-003, ADR-004 |
| **Slices** | S1.02 tenancy + identity · S1.03 roles · S1.07 master data + tenant resolution · S1.12 admin |
| **Stack** | NestJS (API with in-process job consumers), PostgreSQL 16, Prisma + SQL migrations, pg-boss, Azure Blob (files only), Entra External ID (customers) / Entra ID (staff), Azure Application Insights |
| **Written** | 04.09.2026 |

---

## 1. Concepts

| Term | In code |
|---|---|
| CW1 organisation | Read-only mirror row in `master_org`, keyed by the org code CargoWise uses |
| CustomerGroup | The tenant. `customer_group`. Parent → children, two levels |
| CustomerAccount | One org code linked to one group. `customer_account`. An org code belongs to at most one group |
| Tenant context | Per request: `{ userId, groupId, groupIds[], accountId?, isInternal, isSystem, permissions[] }` |
| Visibility | `shipment_visibility` (S2): which groups may see a shipment. Invoices resolve to one group by addressee |
| Internal user | `user.customer_group_id IS NULL AND is_internal` |
| System context | Job execution: `app.is_system = 'true'`; writes with explicit tenant from resolution |

## 2. Invariants

| # | Invariant | Enforced by |
|---|---|---|
| I1 | An org code is linked to at most one group | `UNIQUE (code_norm)` on `customer_account` |
| I2 | A user has exactly one group, or is internal with none | `CHECK ((customer_group_id IS NULL) = is_internal)` |
| I3 | Hierarchy is two levels: a child never has children | Service check before setting `parent_id` |
| I4 | A user's `customer_account_id`, when set, belongs to the user's group | Service check; composite FK `(customer_account_id, customer_group_id)` |
| I5 | An active group keeps at least one active Customer Admin | Service check on role removal / deactivation |
| I6 | Invitation tokens are stored only as a hash | Schema |
| I7 | Emails are unique, case-insensitive | `UNIQUE (lower(email))` |
| I8 | Every query is tenant-filtered twice: repository filter and RLS | `TenantRepository` + policies |
| I9 | `customer_group_id` is never accepted from a client | DTOs omit it; test asserts |

## 3. Database

Conventions: `uuid` ids, `timestamptz`, `created_at`/`updated_at`, schema `app`. Tenant tables carry `customer_group_id NOT NULL` + index + RLS (Pattern A). Shipment family (S2) uses `shipment_visibility` (Pattern B).

### 3.1 Enums

```sql
CREATE TYPE app.customer_tier   AS ENUM ('sme','large','vip');
CREATE TYPE app.group_status    AS ENUM ('onboarding','active','suspended','closed');
CREATE TYPE app.identity_mode   AS ENUM ('entra_external');            -- seam: add values later, no code today
CREATE TYPE app.account_status  AS ENUM ('active','suspended');
CREATE TYPE app.user_status     AS ENUM ('invited','active','deactivated');
CREATE TYPE app.invite_status   AS ENUM ('pending','accepted','expired','revoked');
CREATE TYPE app.party_role      AS ENUM ('local_client','shipper','consignee','notify_party','agent');
```

### 3.2 `master_org` — mirror of CargoWise organisations (internal only)

```sql
CREATE TABLE app.master_org (
  code_norm        varchar(30) PRIMARY KEY,                  -- lower(cw1_org_code): upsert key (must-fix 2)
  cw1_org_code     varchar(30) NOT NULL,                     -- as CargoWise sends it
  full_name        varchar(200) NOT NULL,
  country_iso      char(2),
  city             varchar(100),
  branch_code      varchar(20),
  is_client        boolean,                                  -- from CW1 category if provided
  is_active        boolean NOT NULL DEFAULT true,
  parent_org_code  varchar(30),
  source_hash      char(64) NOT NULL,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_master_org_name ON app.master_org (lower(full_name));
```

### 3.3 `customer_group`

```sql
CREATE TABLE app.customer_group (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       uuid REFERENCES app.customer_group(id),
  name            varchar(200) NOT NULL,
  legal_name      varchar(200),
  country_iso     char(2) NOT NULL,
  tier            app.customer_tier NOT NULL DEFAULT 'sme',
  status          app.group_status NOT NULL DEFAULT 'onboarding',
  identity_mode   app.identity_mode NOT NULL DEFAULT 'entra_external',
  email_domains   text[] NOT NULL DEFAULT '{}',              -- lower-cased by zod
  feature_flags   jsonb NOT NULL DEFAULT '{}',
  default_locale  varchar(10) NOT NULL DEFAULT 'en-US',
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  activated_at    timestamptz,
  CONSTRAINT ck_cg_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX ix_cg_parent ON app.customer_group (parent_id);
CREATE UNIQUE INDEX ux_cg_name_country ON app.customer_group (lower(name), country_iso);
```

### 3.4 `customer_account`

```sql
CREATE TABLE app.customer_account (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_group_id     uuid NOT NULL REFERENCES app.customer_group(id),
  code_norm             varchar(30) NOT NULL REFERENCES app.master_org(code_norm),
  cw1_org_code          varchar(30) NOT NULL,
  display_name          varchar(200) NOT NULL,               -- copied from master_org, editable
  branch_code           varchar(20),
  country_iso           char(2),
  status                app.account_status NOT NULL DEFAULT 'active',
  is_default_for_quotes boolean NOT NULL DEFAULT false,
  linked_by             uuid NOT NULL,
  linked_at             timestamptz NOT NULL DEFAULT now(),
  approved_by           uuid,                                -- seam for 4-eyes (ADR-003); NULL today
  justification         text,
  suspended_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_account_code UNIQUE (code_norm),             -- I1
  CONSTRAINT ux_account_group_id UNIQUE (id, customer_group_id)   -- target for composite FK (I4)
);
CREATE INDEX ix_account_group ON app.customer_account (customer_group_id);
CREATE UNIQUE INDEX ux_account_default_quote ON app.customer_account (customer_group_id) WHERE is_default_for_quotes;
```

### 3.5 `user`

```sql
CREATE TABLE app."user" (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_group_id   uuid REFERENCES app.customer_group(id),
  customer_account_id uuid,                                  -- must-fix 5: NULL = all the group's offices; set = that office only (addressee rule)
  is_internal         boolean NOT NULL DEFAULT false,
  email               varchar(254) NOT NULL,
  display_name        varchar(150) NOT NULL,
  job_title           varchar(100),
  phone               varchar(40),
  locale              varchar(10) NOT NULL DEFAULT 'en-US',
  status              app.user_status NOT NULL DEFAULT 'invited',
  idp_issuer          varchar(300),                          -- Entra tenant issuer
  idp_subject         varchar(300),                          -- oid claim
  last_seen_at        timestamptz,
  notification_prefs  jsonb NOT NULL DEFAULT '{}',
  dashboard_layout    jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deactivated_at      timestamptz,
  deactivated_by      uuid,
  CONSTRAINT ck_user_group_or_internal CHECK ((customer_group_id IS NULL) = is_internal),       -- I2
  CONSTRAINT fk_user_account FOREIGN KEY (customer_account_id, customer_group_id)
    REFERENCES app.customer_account(id, customer_group_id)                                      -- I4
);
CREATE UNIQUE INDEX ux_user_email ON app."user" (lower(email));                                -- I7
CREATE UNIQUE INDEX ux_user_idp ON app."user" (idp_issuer, idp_subject) WHERE idp_subject IS NOT NULL;
CREATE INDEX ix_user_group ON app."user" (customer_group_id);
```

### 3.6 `user_invitation`

```sql
CREATE TABLE app.user_invitation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_group_id   uuid REFERENCES app.customer_group(id),  -- NULL = internal staff invitation
  customer_account_id uuid,                                    -- must-fix 5: carried onto the user at acceptance
  email               varchar(254) NOT NULL,
  display_name        varchar(150),
  role_ids            uuid[] NOT NULL,
  token_hash          char(64) NOT NULL,                       -- I6
  invited_by          uuid NOT NULL,
  invited_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  status              app.invite_status NOT NULL DEFAULT 'pending',
  accepted_at         timestamptz,
  accepted_user_id    uuid,
  revoked_at          timestamptz,
  resend_count        int NOT NULL DEFAULT 0,
  domain_override     boolean NOT NULL DEFAULT false,
  personal_message    varchar(500)
);
CREATE UNIQUE INDEX ux_invite_token ON app.user_invitation (token_hash);
CREATE UNIQUE INDEX ux_invite_pending_email ON app.user_invitation (lower(email)) WHERE status = 'pending';
```

### 3.7 Roles

```sql
CREATE TABLE app.permission (
  code         varchar(60) PRIMARY KEY,
  area         varchar(30) NOT NULL,
  description  varchar(200) NOT NULL,
  is_internal  boolean NOT NULL DEFAULT false
);
CREATE TABLE app.role (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_group_id  uuid REFERENCES app.customer_group(id),    -- seam: NULL = preset; group-specific roles possible later
  code               varchar(60) NOT NULL,
  name               varchar(100) NOT NULL,
  is_internal        boolean NOT NULL DEFAULT false,
  UNIQUE (customer_group_id, code)
);
CREATE UNIQUE INDEX ux_role_preset_code ON app.role (code) WHERE customer_group_id IS NULL;
CREATE TABLE app.role_permission (
  role_id          uuid NOT NULL REFERENCES app.role(id) ON DELETE CASCADE,
  permission_code  varchar(60) NOT NULL REFERENCES app.permission(code),
  PRIMARY KEY (role_id, permission_code)
);
CREATE TABLE app.user_role (
  user_id     uuid NOT NULL REFERENCES app."user"(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES app.role(id),
  granted_by  uuid NOT NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
```

### 3.8 `impersonation_session`

```sql
CREATE TABLE app.impersonation_session (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   uuid NOT NULL REFERENCES app."user"(id),
  target_user_id  uuid NOT NULL REFERENCES app."user"(id),
  reason          varchar(500) NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  ended_at        timestamptz
);
```
Always read-only (`allow_writes` removed — seam: add the column if ever needed).

### 3.9 `audit_event`, `analytics_event`

```sql
CREATE TABLE app.audit_event (
  id                    bigserial PRIMARY KEY,
  occurred_at           timestamptz NOT NULL DEFAULT now(),
  actor_user_id         uuid,
  impersonator_user_id  uuid,
  customer_group_id     uuid,
  action                varchar(60) NOT NULL,
  entity_type           varchar(40) NOT NULL,
  entity_id             uuid,
  before                jsonb,
  after                 jsonb,
  correlation_id        uuid
);
CREATE INDEX ix_audit_group_time ON app.audit_event (customer_group_id, occurred_at DESC);
CREATE INDEX ix_audit_entity ON app.audit_event (entity_type, entity_id);

CREATE TABLE app.analytics_event (
  id                 bigserial PRIMARY KEY,
  occurred_at        timestamptz NOT NULL DEFAULT now(),
  user_id            uuid,
  customer_group_id  uuid,
  name               varchar(60) NOT NULL,
  properties         jsonb NOT NULL DEFAULT '{}'
);
```
Emails in `before`/`after` are stored as `sha256(lower(email))` + domain. Both tables are insert-only for application roles.

### 3.10 `api_client` (foundation only, empty in Phase 1)

```sql
CREATE TABLE app.api_client (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_group_id  uuid REFERENCES app.customer_group(id),
  name               varchar(100) NOT NULL,
  scopes             text[] NOT NULL DEFAULT '{}',
  status             varchar(10) NOT NULL DEFAULT 'active',
  created_at         timestamptz NOT NULL DEFAULT now()
);
```

### 3.11 `shipment_visibility` (created in S1.07, populated in S2.01)

```sql
CREATE TABLE app.shipment_visibility (
  shipment_id          uuid NOT NULL,
  customer_group_id    uuid NOT NULL REFERENCES app.customer_group(id),
  roles                app.party_role[] NOT NULL,
  resolved_from_codes  varchar(30)[] NOT NULL,
  resolved_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shipment_id, customer_group_id)
);
CREATE INDEX ix_visibility_group ON app.shipment_visibility (customer_group_id);
```
Current state only; history is in `audit_event`. Unmapped shipments are a **view** (S2.01): shipments with no visibility row, with the org codes on them.

### 3.12 Row-level security

```sql
CREATE FUNCTION app.group_ids() RETURNS uuid[] LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN coalesce(current_setting('app.group_ids', true), '') = '' THEN '{}'::uuid[]
              ELSE string_to_array(current_setting('app.group_ids', true), ',')::uuid[] END $$;
CREATE FUNCTION app.user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;
CREATE FUNCTION app.is_internal() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.is_internal', true), 'false') = 'true' $$;
CREATE FUNCTION app.is_system() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.is_system', true), 'false') = 'true' $$;
CREATE FUNCTION app.has_perm(p text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p = ANY (string_to_array(coalesce(current_setting('app.permissions', true), ''), ',')) $$;

-- Pattern A (one block, applied to every table with customer_group_id)
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['customer_account','user','user_invitation','api_client','audit_event','analytics_event'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant ON app.%I USING (app.is_internal() OR app.is_system() OR customer_group_id = ANY (app.group_ids()))
                     WITH CHECK (app.is_internal() OR app.is_system() OR customer_group_id = ANY (app.group_ids()))$p$, t);
  END LOOP;
END $$;
-- user: a user may also read their own row
CREATE POLICY self_read ON app."user" FOR SELECT USING (id = app.user_id());
-- customer_group: read own + children, internal writes only
ALTER TABLE app.customer_group ENABLE ROW LEVEL SECURITY; ALTER TABLE app.customer_group FORCE ROW LEVEL SECURITY;
CREATE POLICY cg_read  ON app.customer_group FOR SELECT USING (app.is_internal() OR app.is_system() OR id = ANY (app.group_ids()));
CREATE POLICY cg_write ON app.customer_group FOR ALL USING (app.is_internal() OR app.is_system()) WITH CHECK (app.is_internal() OR app.is_system());
-- presets readable by all; internal-only tables
CREATE POLICY role_read ON app.role FOR SELECT USING (customer_group_id IS NULL OR app.is_internal() OR app.is_system() OR customer_group_id = ANY (app.group_ids()));
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['master_org','impersonation_session'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY internal_only ON app.%I USING (app.is_internal() OR app.is_system()) WITH CHECK (app.is_internal() OR app.is_system())', t);
  END LOOP;
END $$;
-- analytics: customers insert own, only internal reads
DROP POLICY tenant ON app.analytics_event;
CREATE POLICY analytics_insert ON app.analytics_event FOR INSERT WITH CHECK (customer_group_id IS NULL OR app.is_internal() OR app.is_system() OR customer_group_id = ANY (app.group_ids()));
CREATE POLICY analytics_read   ON app.analytics_event FOR SELECT USING (app.is_internal() OR app.is_system());
-- Pattern B (S2.01): shipment family
-- CREATE POLICY shipment_read ON app.shipment FOR SELECT USING (
--   app.is_system() OR (app.is_internal() AND (NOT restricted OR app.has_perm('finance.internal')))
--   OR EXISTS (SELECT 1 FROM app.shipment_visibility v WHERE v.shipment_id = shipment.id AND v.customer_group_id = ANY (app.group_ids())));
```

**DB roles**: `app_api` (API and in-process jobs in request context) and `app_worker` (jobs in system context). `app_worker` has DELETE revoked on every tenant table except `shipment_visibility`; `app_api` cannot make `app.is_system` effective (`ALTER ROLE app_api SET app.is_system = 'false'`). Migrations run as owner.

## 4. Request pipeline

1. **AuthGuard** validates the Entra access token (issuer = customer tenant or staff tenant, audience = API). No sessions or tokens of our own; the SPA uses MSAL with PKCE.
2. Load `user` by `(idp_issuer, idp_subject)`. Missing → 403 `IDENTITY_UNKNOWN`. `status <> active` → 401 `USER_INACTIVE`. Update `last_seen_at` at most once per hour.
3. Impersonation header `X-Impersonation: <sessionId>` (set by the admin UI after `POST /admin/impersonations`) → if the session is active and belongs to this admin, swap `userId/groupId` to the target; mark context read-only.
4. `groupIds` = `[groupId] ∪ children` (`SELECT id FROM customer_group WHERE parent_id = :g`). `accountId` = `user.customer_account_id`. Permissions = one query over `user_role → role_permission`. No cache.
5. **PermissionGuard**: `@RequirePermission(code)`; read-only impersonation rejects non-GET with 403.
6. Repository: `withTenant(ctx, fn)` opens a transaction and runs `set_config('app.group_ids' …), ('app.user_id' …), ('app.is_internal' …), ('app.permissions' …)` (transaction-scoped). Application filter `customer_group_id IN ctx.groupIds` for non-internal users; RLS is the second lock. Requires one connection per transaction (Prisma interactive tx; pooler in transaction mode or none).
7. **Addressee rule (must-fix 5)**: for `financial_transaction` and any addressee-scoped read, add `AND (ctx.accountId IS NULL OR addressee_account_id = ctx.accountId)`.

## 5. Organisation import (job `masterdata.import`)

Source behind `OrgSource` interface (CSV drop first; eAdapter or API later). Daily and on demand.

```
for each row: code_norm = lower(trim(code)); hash = sha256(canonical row)
  upsert master_org ON CONFLICT (code_norm)                 -- must-fix 2
    new → insert; changed → update + last_seen_at; same → last_seen_at
rows not seen this run → is_active = false (never deleted)
write audit_event 'master_org.import' with {inserted, updated, deactivated, errors[]}
```
Row validation: code non-empty ≤ 30 chars; name non-empty; country ISO or null. Bad rows are listed in the audit row; the run continues.

Search: `GET /v1/admin/cw1-organisations?q=` → `WHERE lower(full_name) LIKE '%q%' OR code_norm LIKE 'q%'`, default `is_client IS DISTINCT FROM false`, returns the linked group if any.

## 6. Customer creation and linking

### 6.1 Create — `platform.groups.manage`

zod: name 2–200, countryIso, tier, emailDomains[] (lower-cased, ≥ 1), parentId?, featureFlags?, seedFromOrgCode?. Pre-fill legal name and country from `master_org` when `seedFromOrgCode` is given. Parent check: parent exists and `parent.parent_id IS NULL`; the new group has no children. Flags default from `TIER_DEFAULT_FLAGS[tier]` (config). Insert, audit `group.created`.

### 6.2 Link an organisation — `platform.accounts.link`

`POST /v1/admin/customer-groups/:id/accounts { cw1OrgCode, justification }` (justification ≥ 10 chars). Checks: `master_org` row exists and active (internal override for inactive); not already linked (409 `ORG_ALREADY_LINKED`); group not closed. One transaction: insert `customer_account` (`linked_by = ctx.userId`, first account becomes default for quotes) → enqueue `visibility.reevaluate {orgCode, toGroupId}` (same transaction, pg-boss) → audit `account.linked` → `evaluateActivation`.

The confirm dialog in the UI shows the organisation name, code, country and target customer before the call. **Seam**: if 4-eyes is wanted later, add status `pending` and `POST …/accounts/:id/approve` writing `approved_by`; the table does not change.

Move / suspend / reactivate: `PATCH /v1/admin/customer-accounts/:id { customerGroupId | status }` with justification; same re-evaluation job; audit `account.moved | account.suspended | account.reactivated`.

### 6.3 Activation

`status = active` when the group has ≥ 1 active account and ≥ 1 active user with the Customer Admin role. Evaluated after linking and after invitation acceptance.

## 7. Visibility re-evaluation (job, system context, idempotent)

```
input {orgCode, fromGroupId?, toGroupId?}
shipments = SELECT shipment_id FROM shipment_party WHERE code_norm = lower(orgCode)   -- S2 table; no-op before S2
for batches of 500: grants = TenantResolver.resolve(parties) → delete/insert shipment_visibility to match; audit visibility.granted/revoked
financial_transaction WHERE addressee_code_norm = lower(orgCode) → customer_group_id, addressee_account_id
cw1-created quotes/bookings with that code and no group → assign
```
`TenantResolver.resolve(parties)`: look up active `customer_account` by `code_norm`; keep parties whose role is in `VISIBILITY_ROLES = ['local_client','shipper','consignee']` (config constant); return one grant per group with roles and codes.

## 8. Invitations and login

### 8.1 Create — `admin.users` (own group) or `platform.invite_admin` (internal, any group)

`POST /v1/invitations { email, displayName?, roleIds[], customerAccountId?, personalMessage? }`.
Checks: email lower-cased and valid; no active user (409); no pending invitation (409, offer resend); domain ∈ `email_domains` unless `domainOverride` by internal user (422); roles are presets with `is_internal = false` or group roles (403 otherwise); `customerAccountId`, if given, belongs to the group (I4); ≤ 50 per group per day (429).
Token: `base64url(randomBytes(32))`; store `sha256`; expiry `INVITATION_TTL` (default 7 days). Enqueue `email.send invitation {link, groupName, inviter, expiresAt DD.MM.YYYY, locale}`. Audit `invitation.sent` (email hashed). Resend ≤ 3 (new token). Revoke sets status.

### 8.2 Accept

`GET /v1/invitations/:token` (public, rate-limited, `Referrer-Policy: no-referrer`) → `SECURITY DEFINER` function `app.invitation_public(hash)` returning `{groupName, inviterName, email, expiresAt, status}`.

The SPA sends the user to Entra External ID (MSAL, PKCE; the tenant is configured invitation-only — no self sign-up). On return: `POST /v1/invitations/:token/accept` with the Entra access token in the `Authorization` header. `SECURITY DEFINER` procedure `app.accept_invitation(hash, issuer, subject, email_claim)`:
1. invitation pending and not expired (410 / 409); `lower(email_claim) = lower(invitation.email)` (403 `EMAIL_MISMATCH`);
2. insert `user` (active, group, `customer_account_id` from invitation, `idp_issuer/subject`, locale = group default);
3. insert `user_role` for `role_ids`; mark invitation accepted; audit `user.created`, `invitation.accepted`; enqueue welcome email; `evaluateActivation`.

### 8.3 Returning users

Nothing on our side: MSAL signs in against Entra; the API validates the token (§4). Deactivate = `status deactivated` → next request 401. "Sign out everywhere" is done in Entra. `force_reauth` and refresh handling do not exist.

## 9. Roles and permissions

### 9.1 Permission codes (seed)

```
profile.manage_own · notifications.manage_own
tt.view · docs.view · finance.view
quote.create · quote.submit · quote.accept · quote.cancel · templates.manage
booking.create · booking.submit · booking.cancel
addressbook.manage · addressbook.delete
claims.create · claims.comment
reports.view · reports.spend · reports.selfservice · reports.schedule
admin.users · admin.roles.assign · admin.reports.assign · admin.recipients · admin.audit.view
platform.groups.manage · platform.accounts.link · platform.invite_admin · platform.flags.manage
platform.impersonate · platform.news.publish · platform.usage.view · platform.masterdata.import · finance.internal
```

### 9.2 Presets

| code | permissions |
|---|---|
| `standard` | profile.manage_own, notifications.manage_own, tt.view, docs.view |
| `quoting_booking` | standard + quote.*, booking.*, templates.manage, addressbook.manage |
| `finance` | standard + finance.view, reports.view, reports.spend |
| `analyst` | standard + reports.view, reports.selfservice, reports.schedule |
| `claims` | standard + claims.create, claims.comment |
| `customer_admin` | standard + admin.users, admin.roles.assign, admin.reports.assign, admin.recipients, admin.audit.view, **addressbook.manage**, addressbook.delete (must-fix 3) |
| `noatum_customer_success` (internal) | platform.groups.manage, platform.accounts.link, platform.invite_admin, platform.news.publish, platform.usage.view, **platform.impersonate** (must-fix 4) |
| `noatum_ops` (internal) — **new (must-fix 4)** | tt.view, docs.view, finance.view, quote.*, booking.* read paths; sees all customers except `restricted` content; no admin permissions |
| `noatum_platform_admin` (internal) | all platform.*, finance.internal, platform.masterdata.import |

No custom role UI in Phase 1. `role.customer_group_id` exists for later.

### 9.3 Assignment — `PATCH /v1/users/:id/roles`

Target in `ctx.groupIds` (customer admin) or any (internal). Customer admins assign only non-internal roles. Removing the last Customer Admin of an active group → 409 `LAST_ADMIN`. Audit `role.changed`. Permissions are read per request, so the change is immediate.

`PATCH /v1/users/:id/report-access` (`admin.reports.assign`) → `report_assignment` rows from S2.09 (501 before).

`PATCH /v1/users/:id/account` (`admin.users`) → set or clear `customer_account_id` (I4).

## 10. Impersonation — `platform.impersonate`

`POST /v1/admin/impersonations { targetUserId, reason }` (reason ≥ 10 chars, target active customer user) → row with `expires_at = now() + 60 min`; response `{ sessionId }`. The admin UI sends `X-Impersonation: <sessionId>` on subsequent calls; the API swaps context (§4) and refuses writes (403 `IMPERSONATION_READ_ONLY`). Banner text from response header `X-Impersonating`. `DELETE /v1/admin/impersonations/current` ends it. Every audit row in between carries `impersonator_user_id`.

## 11. Public track and trace function (must-fix 6, used by S2.03)

```sql
CREATE FUNCTION app.public_tracking(p_ref text)
RETURNS TABLE (shipment_ref text, mode text, milestone_code text, milestone_name text, planned_at timestamptz, actual_at timestamptz,
               location text, office_name text, office_email text, office_phone text)
LANGUAGE sql SECURITY DEFINER SET search_path = app, pg_temp STABLE AS $$
  SELECT s.public_ref, s.mode::text, e.canonical_code, t.name_en, e.planned_at, e.actual_at, e.location,
         o.name, o.email, o.phone
  FROM app.shipment s
  JOIN app.milestone_event e ON e.shipment_id = s.id AND e.internal_flag = false
  JOIN app.critical_path_definition c ON c.mode = s.mode AND c.canonical_code = e.canonical_code AND c.is_public = true
  JOIN app.business_term t ON t.code = e.canonical_code
  JOIN app.office o ON o.id = s.owning_office_id
  WHERE lower(p_ref) IN (lower(s.public_ref), lower(s.hbl_hawb)) OR EXISTS (SELECT 1 FROM app.container_unit cu WHERE cu.shipment_id = s.id AND lower(cu.number) = lower(p_ref))
  ORDER BY coalesce(e.actual_at, e.planned_at);
$$;
REVOKE ALL ON FUNCTION app.public_tracking(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.public_tracking(text) TO app_api;
```
Returns only critical-path milestones and the office contact — no parties, documents, financials or predictions; identical shape however many customers the reference touches. Rate-limited at the API. Table names are those planned for S2.01.

## 12. API surface (v1)

**Noatum admin**
```
GET/POST   /admin/customer-groups                          platform.groups.manage
GET/PATCH  /admin/customer-groups/:id                      platform.groups.manage   (name, legalName, tier, emailDomains, parentId, defaultLocale)
PATCH      /admin/customer-groups/:id/feature-flags        platform.flags.manage
POST       /admin/customer-groups/:id/suspend|reactivate|close   platform.groups.manage
GET        /admin/cw1-organisations?q=                     platform.accounts.link
POST       /admin/customer-groups/:id/accounts             platform.accounts.link   (link, confirm dialog, audited)
PATCH      /admin/customer-accounts/:id                    platform.accounts.link   (displayName, isDefaultForQuotes, status, customerGroupId)
POST       /admin/masterdata/organisations/import          platform.masterdata.import
POST       /admin/customer-groups/:id/invitations          platform.invite_admin
POST       /admin/impersonations · DELETE /admin/impersonations/current   platform.impersonate
GET        /admin/customer-groups/:id/audit                platform.groups.manage
```
**Customer admin** (tenant-scoped)
```
GET /users · GET /users/:id                                admin.users
POST /invitations · POST /invitations/:id/resend · DELETE /invitations/:id · GET /invitations   admin.users
PATCH /users/:id/roles                                     admin.roles.assign
PATCH /users/:id/account                                   admin.users
PATCH /users/:id/report-access                             admin.reports.assign (S2.09)
POST /users/:id/deactivate | /reactivate                   admin.users
GET /roles                                                 admin.roles.assign
GET /audit                                                 admin.audit.view
GET /customer-accounts                                     tt.view   (id, displayName, isDefault — no org codes)
```
**Self and public**
```
GET /me · PATCH /me · PATCH /me/notification-preferences · PATCH /me/dashboard-layout
GET /invitations/:token · POST /invitations/:token/accept   (public, token + Entra token)
GET /public/tracking?ref=                                   (S2.03, public, rate-limited)
```

## 13. Errors

400 `VALIDATION_FAILED` · 401 `UNAUTHENTICATED`, `USER_INACTIVE` · 403 `PERMISSION_DENIED`, `IDENTITY_UNKNOWN`, `EMAIL_MISMATCH`, `ROLE_NOT_ASSIGNABLE`, `IMPERSONATION_READ_ONLY` · 404 `NOT_FOUND` (also for cross-tenant) · 409 `ORG_ALREADY_LINKED`, `USER_EXISTS`, `INVITATION_PENDING`, `INVITATION_USED`, `LAST_ADMIN`, `HIERARCHY_DEPTH` · 410 `INVITATION_EXPIRED` · 422 `EMAIL_DOMAIN_NOT_ALLOWED`, `ORG_INACTIVE`, `GROUP_CLOSED`, `ACCOUNT_NOT_IN_GROUP` · 429 `RATE_LIMITED`.

## 14. Configuration

| Key | Default |
|---|---|
| `INVITATION_TTL_HOURS` | 168 |
| `INVITATION_MAX_RESENDS` | 3 |
| `INVITATION_DAILY_LIMIT_PER_GROUP` | 50 |
| `IMPERSONATION_TTL_MINUTES` | 60 |
| `MASTERDATA_IMPORT_CRON` | `0 2 * * *` |
| `INTEGRATION_MESSAGE_RETENTION_DAYS` | 395 |
| `VISIBILITY_ROLES` | `local_client,shipper,consignee` |
| `TIER_DEFAULT_FLAGS` | code constant in `shared-types` |
| `RATE_ENGINE_TIMEOUT_MS` | 25000 |
| `ENTRA_CUSTOMER_ISSUER`, `ENTRA_STAFF_ISSUER`, `API_AUDIENCE` | Key Vault |

Feature flag keys: `documents · financials · predictive_eta · market_insights · co2 · po_visibility · premium_alerts · chatbot · self_service_reports · powerbi · sailing_schedule · claims · booking`.

## 15. Seeds

Permissions, nine preset roles, `TIER_DEFAULT_FLAGS`. Dev: 30 organisations from the simulator CSV; two groups (Acme Electronics with `ACMEUK001`, `ACMEAE001`; Blue Ocean Trading with `BLUEQA001`); one Customer Admin and one standard user each; one internal user per internal role (staff Entra dev tenant or a dev token issuer).

## 16. Tests

| ID | Test |
|---|---|
| T1 | Group A user gets 404 for group B users, accounts, invitations, audit; list endpoints never include B |
| T2 | Parent user reads child rows; child cannot read parent or sibling |
| T3 | Raw SQL as `app_api` with group A settings cannot read group B rows on every tenant table |
| T4 | `customer_group_id` in any request body is ignored |
| T5 | Linking an already-linked code → 409; unique index blocks a direct insert; case variants (`acmeuk001`) collide |
| T6 | Linking enqueues re-evaluation in the same transaction (rollback removes the job); audit `account.linked` |
| T7 | Moving an account re-points visibility (S2 fixtures) |
| T8 | Third hierarchy level → 409 |
| T9 | `app_api` cannot set `app.is_system`; `app_worker` cannot DELETE from tenant tables |
| T10 | Invitation: reuse → 409; expired → 410; revoked → 410; wrong domain → 422; override only for internal; `Referrer-Policy: no-referrer` present |
| T11 | Accept with Entra email ≠ invitation email → 403; success creates user + roles atomically and sets `customer_account_id` from the invitation |
| T12 | Deactivated user → 401 on next request |
| T13 | Role change effective on the next request (no cache) |
| T14 | Last Customer Admin cannot be demoted or deactivated |
| T15 | Impersonation without reason → 400; any write → 403; audit rows carry both ids; expires |
| T16 | Every route has `@RequirePermission` or `@Public` |
| T17 | Audit and analytics tables reject UPDATE/DELETE for app roles |
| T18 | `GET /customer-accounts` for customers contains no org codes |
| T19 | Activation flips only with ≥ 1 account and ≥ 1 admin |
| T20 | Org import: insert / update / deactivate via hash; bad rows reported, run continues; audit row written |
| T21 | User with `customer_account_id` set sees only invoices addressed to that account (S2.05 fixtures) |
| T22 | `public_tracking()` returns no parties, documents, financials; identical output whether the reference matches one or two customers' shipments (S2.03) |

## 17. Migrations

`0001_extensions` (pgcrypto) · `0002_enums` · `0003_master_org` · `0004_customer_group` · `0005_customer_account` · `0006_permission_role` · `0007_user` · `0008_user_invitation` · `0009_impersonation` · `0010_audit_analytics` · `0011_api_client_visibility` · `0012_rls` · `0013_functions` (`invitation_public`, `accept_invitation`) · `0014_seed` · `0015_db_roles_grants`. Each with `down.sql`. `public_tracking()` ships with S2.01.

## 18. Open items

| # | Item | Owner | Interim |
|---|---|---|---|
| 1 | Organisation export format and client category (CW1 request items 3, 4) | CW1 team | Simulator CSV; `is_client NULL` |
| 2 | Which party roles grant visibility | Product + Ops | `VISIBILITY_ROLES` constant |
| 3 | Two-person approval for linking | Mohamed | Confirm dialog + audit; `approved_by` column ready |
| 4 | Retention for deactivated users | Legal | No erasure in Phase 1 |
| 5 | Tier defaults (OQ-10) | Commercial | `TIER_DEFAULT_FLAGS` proposal |
| 6 | Whether Ops staff should see `financial` content by default | Ops + Finance | `noatum_ops` has `finance.view`, not `finance.internal` |
