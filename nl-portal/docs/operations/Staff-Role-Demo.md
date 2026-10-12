# Staff role assignment increment

Implemented 12.09.2026; verification pending. The additive staff-role migration and disabled local demo seed were applied to `customer_platform` on loopback port 55432. This is the roles-only part of P1.05-B, implementing FR-IAM-003/009 against the existing user and role tables. It is not completion of P1.02 or P1.05 and is not production-ready.

## Scope

- Production UI route: `/portal/staff`, including direct navigation and a link from the staff sign-in callback. The page mounts only after `/api/me` returns internal, non-impersonated access with `admin.staff.read`.
- `GET /api/users/staff`: internal `admin.staff.read`; paginated name/email search, default 20, maximum 50 per page.
- `GET /api/users/staff/role-presets`: internal `admin.staff.read`.
- `PUT /api/users/staff/{id}/roles`: internal `admin.staff.roles.manage`, strict `{roleKeys, updatedAt, reason}`. No tenant or arbitrary permission fields accepted.
- One assignable preset: `portal_admin` (Portal Admin), with only `admin.staff.read` and `admin.staff.roles.manage`. It implies no customer data, pricing, cost, finance or impersonation access. Existing unrelated role assignments are retained and are not editable in this increment.
- Empty `roleKeys` removes the managed preset. A required reason and before/after role keys are persisted to `audit_event` in the assignment transaction. Self-removal and last-active-admin removal are refused. Transaction-scoped advisory locking serializes assignments and the actor's permission is re-read after the lock.
- `updatedAt` prevents stale overwrites. Login-only timestamp writes preserve the version using a conditional update. Permission changes are still resolved from portal database roles on each request, never Entra groups.
- Branches, pricing presets, lifecycle changes, a custom role designer, staff auto-registration, and customer administration remain outside this increment.

## Local demonstration

The login page offers fictional `portal.admin@example.test` and `registered.staff@example.test` hints only in Vite DEV on localhost, 127.0.0.1 or IPv6 loopback. Selection changes only the MSAL login hint. The separate staff directory requires authenticated internal permissions and is never a public list of real accounts.

The seed command is **not run automatically** and does not apply migrations. The orchestrator applied `20260912000000_staff_role_preset` and ran the guarded seed against the existing local database on 12.09.2026. Both fictional records were created disabled and unbound; no existing identities were overwritten. UAT/production were not changed. The migration's `down.sql` refuses rollback while assignments or other roles depend on these permissions.

From the API directory, supply these process environment variables through the operator's terminal, never through chat:

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | Exactly `development` |
| `ALLOW_LOCAL_DEMO_SEED` | Exactly `yes` |
| `DATABASE_URL` | Explicit local PostgreSQL URL, no query overrides; credentials remain outside source |
| `DEMO_DATABASE_NAME` | Exact database name from that URL, confirming the intended local target |
| `DEMO_ADMIN_ISSUER` | Optional, supplied together with the subject; exact trusted Microsoft tenant issuer |
| `DEMO_ADMIN_SUBJECT` | Optional, supplied together with issuer; **Entra object ID (`oid`)**, the identifier supported by the current schema, not JWT `sub` |
| `ENTRA_TENANT_ID`, `ENTRA_ISSUER` | Required for binding; issuer must equal `https://login.microsoftonline.com/{tenant-id}/v2.0` and the API deployment's issuer |

Run `pnpm demo:staff`. Without an explicit binding it creates two **disabled, unbound** fictional records, with the Portal Admin preset assigned only to the fictional admin. With an explicit trusted issuer/object-ID binding on initial creation, only the demo admin is active. The other fixture remains disabled. Internal email fallback is disabled, so no matching email can claim either fixture. Existing records must match exactly; the script refuses to overwrite identity/status/roles or activate an already-created unbound fixture. Use a fresh isolated demo database when changing the demonstration binding.

No Entra accounts, passwords, tokens or sessions are created. The fictional email is not the operator's real sign-in address. To sign in as an explicitly bound operator, choose "Use my Microsoft account" and authenticate with that account on Microsoft. The admin's display record remains fictional.

## Authentication limitations

Local setup used the existing ignored environment file in a child process, without exposing credentials. The first seed attempt rejected the URL's `schema=public` query hint; the orchestrator allowed only that exact hint and removed it in memory before the successful seed. No identity binding was supplied. Database reset, destructive migration, and authentication bypass were not performed.

The runtime validates one configured Microsoft issuer and resolves users by object ID. This schema does not store per-user issuer/JWT-subject pairs. The seed checks its supplied issuer against that deployment configuration; it is not multi-issuer identity support. Changing the API's trusted tenant/issuer requires a reviewed identity migration, not reusing existing bindings.

The existing pre-auth identity lookup runs before an RLS context exists, so the limited runtime database role can still fail to resolve a valid registered identity. This increment does not weaken RLS, add a privileged public lookup, switch runtime database credentials, or solve production identity bootstrap. Operator Microsoft configuration is necessary but may not be sufficient until P1.02's narrow identity resolution design is completed. A seeded record is not evidence that sign-in works.

No actual operator identity binding or successful Microsoft sign-in has been established by this increment or its review corrections. Pre-auth RLS resolution, the missing per-user issuer/subject binding model, and an actual bound and authenticated operator remain production-readiness blockers. Independent slice-review acceptance is a source-review outcome, not proof of working authentication, transaction safety, or release readiness.

## Contracts and checks

Historical commands run during the original implementation, not during the review corrections below:

1. `pnpm --dir apps/noatum-customer-portal-api openapi:generate`
2. `pnpm --dir apps/noatum-customer-portal-ui api:generate:offline`
3. `pnpm --dir apps/noatum-customer-portal-ui dev --host 127.0.0.1 --port 5176 --strictPort`

The UI development server reported ready at `http://127.0.0.1:5176/`; staff route `http://127.0.0.1:5176/portal/staff`, login `http://127.0.0.1:5176/login`. No API or integrations were started. This origin requires the appropriate Microsoft SPA redirect URI (`http://127.0.0.1:5176/login/staff`) and API CORS configuration before real sign-in can work. No browser check was run. Vite reported existing JSON import-attribute warnings about a future config-loader default; no configuration changes were made for those warnings.

The API generator constructs Nest Swagger metadata from the actual controller classes with constructor dependencies stubbed only for document construction. It does not instantiate application infrastructure, listen on a port, or substitute for runtime validation. The UI types and Zod form schema are generated from that actual OpenAPI document, not manually mirrored DTOs.

Prepared unit cases cover strict DTOs, permission guards, customer/impersonated denial, stale versions, actor re-checks, administrator protections, audit failure propagation, and internal email fallback. The review corrections also prepare HTTP and real-database cases described below. **Not run:** tests, typecheck, lint, formatters, verification builds, browser/accessibility checks, rollback rehearsal or live Microsoft sign-in. The local migration and disabled seed were subsequently applied as implementation work. Database concurrency/RLS isolation and real transaction rollback have prepared integration coverage, but execution remains pending; neither mocked cases nor unrun integration tests establish those properties.

`AnalyticsEvent` is emitted as a structured Nest log for staff list and role-save actions. The current schema has no analytics table; durable analytics delivery is not established. Significant role writes are durably audited within the database transaction once the migration is applied and runtime access works.

## Bounded review corrections, 12.09.2026

Implemented; verification pending. No commands were executed during this correction pass, including generators or network fetches. No tests, lint, typecheck, formatter, build, browser, migration or seed was run. Generated artifacts were not regenerated because the API contract did not change.

### Staff display labels

The directory's role badges, effective permissions, preset checkbox labels and retained-role text now use EN/ES display labels. The six existing role keys and all 31 current permission keys are covered. Unknown keys use localized generic labels ("Other role" / "Other permission"), never raw keys or inferred privileges. This is display-only: existing permissions and the single assignable `portal_admin` preset are unchanged. Locale completeness, type compatibility, rendering and accessibility are unverified.

### One source per generation

- `pnpm --dir apps/noatum-customer-portal-ui api:generate` retains the live workflow at `http://127.0.0.1:43000/api/docs-json`. It fetches once, requires a successful HTTP response, parses the actual OpenAPI document, and uses that same in-memory document for both API types and the staff Zod form. It does not fall back to the checked-in document when the request fails. The Node generator also accepts a URL as its first argument.
- `pnpm --dir apps/noatum-customer-portal-ui api:generate:offline` reads the API's checked-in OpenAPI document once and uses the same full pipeline. That document must first be refreshed with the API's existing `openapi:generate` command when contracts change.
- Both outputs are prepared before either is written, so a fetch, parse or schema-generation failure cannot replace just the types with a newer contract while leaving the old form. File writes themselves are sequential, not a filesystem-atomic pair; a filesystem write failure still requires rerunning the command.
- The standalone form generator remains usable with its original offline source. No dependency was added, no live API was contacted, and neither generation path has been executed for these corrections.

### Prepared integration tests, unrun

The existing Jest E2E and isolation configurations discover the two new test files without configuration changes. Both retain the existing `require-test-database.ts` guard: `NODE_ENV=test`, local `noatum_test_<32 hex characters>` database, and `portal_app`. Future execution belongs to the existing disposable-database harness, `pnpm test:db`, only when explicitly authorized. Do not redirect these tests to a demo, development or production business database.

HTTP cases use the real controller, DTO parsing, tenant and permission guards, service, repository and database. Only identity establishment is injected in the test application; the real Microsoft AuthGuard, pre-auth lookup and production module graph are not exercised by these cases.

- All three routes: HTTP 403 for internal users with no permissions, internal users with customer administration only, customer administrators, customer contexts carrying staff permissions, and impersonating staff. Assertions distinguish guard denial from the service's internal-only denial and require no repository access.
- Positive controls: staff-read access works on both GET routes but cannot PUT; a database-authorized administrator can assign the preset and retain unrelated roles.
- HTTP 403 after actor permissions have been removed in the database despite a previously authorized request context; HTTP 404 when a staff assignment targets a customer record.

Database cases use the actual service/repository transactions and the migrated preset, not mocked transaction callbacks:

- Commit preset, retained roles, changed version and one audit containing actor, before/after keys, reason and correlation ID.
- Competing administrators remove each other concurrently: exactly one commit, one revoked-actor rejection, one survivor and one audit; the survivor's version stays unchanged. A separate case refuses self-removal by the sole remaining administrator. The `LAST_STAFF_ADMIN` branch retains its existing mocked unit case; these integration cases assert observable administrator-survival behavior without fabricating a second authorized actor when only one exists.
- Stale sequential edits and concurrent saves of the same version: stale conflict, no overwrite, and only the winning audit.
- Audit rollback on both preset grant and removal: a test-local Prisma query extension changes only the attempted audit action to exceed its existing 120-character database limit. The expected PostgreSQL/Prisma constraint failure must undo already-successful role insertion/deletion and version writes. A fresh normal connection transaction asserts unchanged roles/version, retained unrelated roles and no new audit. No trigger, grant, schema or runtime code is changed; the expected error mapping and extension behavior remain unverified until execution.
- Staff records and their committed role-change audits remain invisible under each of the existing two customer tenant contexts.

Shared fixtures create uniquely named staff/retained-role records only in the guarded disposable database, use the migrated preset rather than reseeding its definition, and remove only their own users and retained role. Append-only audit rows are left for the harness to discard with the entire test database. No existing business data or global grants are edited.

### Exact correction-pass manifest

| File | Change |
| --- | --- |
| [StaffPage.tsx](../../apps/noatum-customer-portal-ui/src/features/staff/pages/StaffPage.tsx) | Supported role/permission label mappings and localized fallback on every role/permission display. |
| [en-US.json](../../apps/noatum-customer-portal-ui/src/features/staff/i18n/en-US.json) | Existing role/permission labels and generic fallbacks in English. |
| [es-ES.json](../../apps/noatum-customer-portal-ui/src/features/staff/i18n/es-ES.json) | Matching Spanish labels and fallbacks. |
| [generate-api.mjs](../../apps/noatum-customer-portal-ui/scripts/generate-api.mjs) | New common online/offline generator using one source document for both outputs. |
| [generate-staff-form.mjs](../../apps/noatum-customer-portal-ui/scripts/generate-staff-form.mjs) | Reusable form-source generation while preserving standalone offline invocation. |
| [UI package.json](../../apps/noatum-customer-portal-ui/package.json) | Both public API generation commands use the common generator. |
| [tenants.fixture.ts](../../apps/noatum-customer-portal-api/test/fixtures/tenants.fixture.ts) | Reusable isolated staff-role setup/cleanup alongside existing tenant fixtures. |
| [staff.e2e-spec.ts](../../apps/noatum-customer-portal-api/test/e2e/staff.e2e-spec.ts) | New prepared HTTP authorization cases in the existing E2E harness. |
| [staff-roles.spec.ts](../../apps/noatum-customer-portal-api/test/isolation/staff-roles.spec.ts) | New prepared transaction/concurrency/rollback/visibility cases in the existing isolation harness. |
| [Staff-Role-Demo.md](Staff-Role-Demo.md) | This correction manifest, generation behavior, unrun coverage and readiness limitations. |

No API production source, identity implementation, migrations, infrastructure, jobs, analytics storage, metrics machinery, test framework/configuration, shared instructions or memory was changed in this correction pass. No commits were made. Acceptance remains pending actual scheduled verification and resolution of the identity blockers above.

## Exact changed files

API:

- [Permission vocabulary](../../apps/noatum-customer-portal-api/src/contracts/permissions.ts)
- [Staff DTOs and validation](../../apps/noatum-customer-portal-api/src/contracts/dto/staff.dto.ts)
- [Users module](../../apps/noatum-customer-portal-api/src/modules/users/users.module.ts)
- [Users controller](../../apps/noatum-customer-portal-api/src/modules/users/users.controller.ts)
- [Users service](../../apps/noatum-customer-portal-api/src/modules/users/users.service.ts)
- [Users repository](../../apps/noatum-customer-portal-api/src/modules/users/users.repository.ts)
- [Prepared users tests](../../apps/noatum-customer-portal-api/src/modules/users/users.spec.ts)
- [Shared staff/tenant test fixtures](../../apps/noatum-customer-portal-api/test/fixtures/tenants.fixture.ts)
- [Prepared staff HTTP tests](../../apps/noatum-customer-portal-api/test/e2e/staff.e2e-spec.ts)
- [Prepared staff transaction tests](../../apps/noatum-customer-portal-api/test/isolation/staff-roles.spec.ts)
- [Identity resolution](../../apps/noatum-customer-portal-api/src/modules/identity/identity.service.ts)
- [Preset migration](../../apps/noatum-customer-portal-api/prisma/migrations/20260912000000_staff_role_preset/migration.sql)
- [Preset rollback](../../apps/noatum-customer-portal-api/prisma/migrations/20260912000000_staff_role_preset/down.sql)
- [Offline OpenAPI generator](../../apps/noatum-customer-portal-api/scripts/generate-openapi.cjs)
- [Local demo seed](../../apps/noatum-customer-portal-api/scripts/seed-demo-staff.cjs)
- [API scripts](../../apps/noatum-customer-portal-api/package.json)
- [Generated OpenAPI](../../apps/noatum-customer-portal-api/openapi.json)

UI:

- [Generated API types](../../apps/noatum-customer-portal-ui/src/api/generated/schema.d.ts)
- [Generated form schema](../../apps/noatum-customer-portal-ui/src/api/generated/staff-role-form.ts)
- [Form schema generator](../../apps/noatum-customer-portal-ui/scripts/generate-staff-form.mjs)
- [Common API/form generator](../../apps/noatum-customer-portal-ui/scripts/generate-api.mjs)
- [UI scripts](../../apps/noatum-customer-portal-ui/package.json)
- [Authenticated API helper](../../apps/noatum-customer-portal-ui/src/features/auth/api/current-user.ts)
- [Staff queries and mutation](../../apps/noatum-customer-portal-ui/src/features/staff/api/staff.ts)
- [Staff English](../../apps/noatum-customer-portal-ui/src/features/staff/i18n/en-US.json)
- [Staff Spanish](../../apps/noatum-customer-portal-ui/src/features/staff/i18n/es-ES.json)
- [Staff layout styles](../../apps/noatum-customer-portal-ui/src/features/staff/pages/StaffPage.module.css)
- [Staff page and role form](../../apps/noatum-customer-portal-ui/src/features/staff/pages/StaffPage.tsx)
- [Application providers](../../apps/noatum-customer-portal-ui/src/app/providers.tsx)
- [Navigation configuration](../../apps/noatum-customer-portal-ui/src/app/navigation/navigation.ts)
- [Authenticated staff layout](../../apps/noatum-customer-portal-ui/src/app/layouts/StaffPortalLayout.tsx)
- [Application routes](../../apps/noatum-customer-portal-ui/src/app/router.tsx)
- [Application entry](../../apps/noatum-customer-portal-ui/src/app/App.tsx)
- [SPA bootstrap](../../apps/noatum-customer-portal-ui/src/main.tsx)
- [Sign-in access panel](../../apps/noatum-customer-portal-ui/src/features/auth/components/AccessPanel.tsx)
- [Login hints](../../apps/noatum-customer-portal-ui/src/features/auth/pages/LoginPage.tsx)
- [Login English](../../apps/noatum-customer-portal-ui/src/features/auth/i18n/en-US.json)
- [Login Spanish](../../apps/noatum-customer-portal-ui/src/features/auth/i18n/es-ES.json)

Documentation: this file, `docs/operations/Staff-Role-Demo.md`. No shared instructions, memory, existing database, dependencies, jobs, or test tooling were changed. No commits were made.
