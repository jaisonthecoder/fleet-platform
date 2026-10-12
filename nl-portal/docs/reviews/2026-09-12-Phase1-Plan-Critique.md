# Phase 1 plan critique — requirements-led review

| Document control | Value |
| --- | --- |
| Document ID | NCP-REV-P1-001 |
| Version / date | 1.0 / 12.09.2026 |
| Status | Review findings for triage. Not an approved change to any baseline |
| Reviewed against | PRD v4.0 · `CLAUDE.md` v4 · FR v1.1 (NCP-FR) · NFR v1.1 (NCP-NFR) · Phased delivery plan v1.1 (NCP-PLAN) · Decision register v1.1 (NCP-BASELINE-2026-09) · Simplification Register v3 · `gaps.md` |
| Subjects of review | `docs/plans/Project-Kickoff-and-Phase1-Plan.md` (F1.01–F1.10) · `docs/plans/01-Vertical-Slice-Implementation-Plan.md` (S1.01–S1.14) · `docs/plans/03-Phased-Delivery-Plan.md` (F1.01–F1.10) · `docs/plans/implementation-plans/phase 1 - phases/` (P1.01–P1.12) · the current working tree |

> **Paths updated 18.09.2026** when `docs/` was reorganised. The findings and dates below are
> unchanged; only the locations of the documents reviewed have moved.
| Method | Read every governing and planning document, then read the implementation as built and compared it clause by clause. Code observations are cited by path |

> **How to read this.** Findings are severity-ranked inside each theme. Each carries the requirement it fails, the evidence, the consequence and a recommendation. A finding against the *plan* means the plan is wrong or unbuildable as written; a finding against the *build* means the working tree has diverged from the plan. Both are in scope because a plan that the build is already contradicting is not a plan.

---

## 0. Executive summary

Phase 1 is documented to an unusually high standard and built to a good engineering standard, but **the two are describing different products**, and **four separate Phase 1 plans are live at once** with conflicting stage identifiers and conflicting scope. The most expensive findings are not defects of craft; they are defects of governance and of foundation shape.

**The five findings that should change what happens next week:**

| # | Finding | Severity |
| --- | --- | --- |
| G-1 | Four competing Phase 1 plans are simultaneously authoritative; `CLAUDE.md` — the file the coding agents actually read — points at the oldest of them | Critical |
| G-2 | UC-12 (direct publication without CW1 confirmation) reverses a rule that `CLAUDE.md`, PRD FG-3.3 and every slice document still state as absolute. The reconciliation the FR baseline itself demands has not happened | Critical |
| B-1 | The built quote flow is `draft → call rate engine → rated / rate_failed`. It implements the **retired** instant-rate model and contains no pricing queue, no claim, no approval, no publication, no version chain. This is a direct contradiction of v4 override rule 1 and rule 2, and of FG-3.3 (P0) | Critical |
| F-1 | The tenancy foundation cannot express the customer hierarchy the PRD requires, and `app.is_internal()` is an unconditional read **and write** bypass on every table. Read-only impersonation is unimplementable on it | Critical |
| F-2 | Identity validates **one** Entra issuer, one audience, one JWKS tenant. Customers on Entra External ID cannot sign in at all. Portal users are bound to an Entra identity **by email match, with no invitation check** | Critical |

Foundation ground rule 1 says identity, tenancy and organisation linking are "built once and never rebuilt". F-1 and F-2 are in exactly that layer, and every later stage stands on them. They should be fixed before F1.05 onward, not after.

**Fair assessment of what is good.** The tenancy *mechanism* (transaction-local `set_config`, `FORCE ROW LEVEL SECURITY`, isolation tested against raw SQL as `portal_app` rather than through the application) is better than most teams achieve, and the isolation suite tests the right claim. The permission guard fails closed on a missing decorator, which is stronger than the build-time test the PRD asked for. The app-separation rule is enforced by an actual lint rule. The CI comment explaining why the frontend stage is deliberately absent shows the right instinct. None of the criticism below is about carelessness.

---

## 1. Theme G — Plan coherence and governance

### G-1 · Four live Phase 1 plans, conflicting stage identifiers — **Critical**

**Evidence.** Four documents each define "Phase 1, stage by stage", all current, none marked superseded:

| Plan | IDs | Stage 5 means |
| --- | --- | --- |
| `docs/plans/Project-Kickoff-and-Phase1-Plan.md` v1.0 (09.09) | F1.01–F1.10 | CargoWise connection and tenant resolution |
| `docs/plans/01-Vertical-Slice-Implementation-Plan.md` v4 (09.09) | S1.01–S1.14 | Address book |
| `docs/plans/03-Phased-Delivery-Plan.md` v1.1 (10.09) | F1.01–F1.10 | CW1 connection, mappings and tenant resolution — *different content, same ID space* |
| `docs/plans/implementation-plans/phase 1 - phases/` v1.1 (11.09) | P1.01–P1.12, 44 slices | Operating structure and staff management |

`CLAUDE.md` §"How to work" says: *"Phase 1 is the ten stages in `docs/plans/Project-Kickoff-and-Phase1-Plan.md`"* and *"Read the slice in `docs/plans/01-Vertical-Slice-Implementation-Plan.md`"*. Both are the **oldest** two. Neither mentions the FR/NFR baseline, the decision register, UC-01…UC-12, or the twelve-stage plan.

**Consequence.** An agent instructed to "build stage F1.05" builds integration. An agent instructed to "build P1.05" builds staff management. Worse, `CLAUDE.md`'s scope guardrail explicitly forbids things the newest plans now *require*: it says "No Phase 2+ screens", while FR-NAV-001 requires Track and trace, Documents, Invoices, Bookings and Claims navigation in Phase 1. An agent obeying `CLAUDE.md` will delete work an agent obeying the FR baseline just built. This is not hypothetical — it is the most likely cause of rework over the next four weeks.

**Recommendation.** Pick **one** executable plan — the twelve-stage P1.01–P1.12 set is the most complete and the most recent — and in the same change:
1. Rewrite the `CLAUDE.md` "Source of truth" and "Scope guardrail" sections to point at it, at the FR/NFR baseline and at the decision register.
2. Mark `Project-Kickoff-and-Phase1-Plan.md` and the Phase 1 half of `01-Vertical-Slice-Implementation-Plan.md` as **superseded for execution, retained for traceability**, in a banner at the top of each file, not only in a table inside another document.
3. Mirror the change into `.github/copilot-instructions.md` above the shared-content marker.

Until this is done, every finding below is being fixed against a moving target.

---

### G-2 · UC-12 direct publication is unreconciled with the governing rules — **Critical**

**Evidence.** FR-CFG-003 and FR-QTE-013 require an administrator-configurable publication mode in which staff **publish a price straight to the customer with no priced-offer submission to CW1**. The baseline index itself lists this under "source conflicts handled explicitly" and states the reconciliation is *owed*: *"Older PRD/repository statements requiring CW1 confirmation universally must be reconciled before implementation."* D-18 gates it.

Meanwhile the documents an agent reads first still state the opposite as absolute:

- `CLAUDE.md` v4 rule 2: *"the result is written to CargoWise, and only then does the customer see it."*
- PRD FG-3.3: *"A quote priced in the portal is not presented to the customer until CW1 has accepted it."*
- `Project-Kickoff-and-Phase1-Plan.md` F1.08 exit test: *"a pending-sync quote is invisible to the customer."*
- Slice `S1.09`/`SP.0x`: same rule.

**Consequence.** This is not a detail. It changes the quote state machine, the sync-state model, the definition of "published", the acceptance path (FR-QTE-018: a direct-only quote must record acceptance *without inventing a CW1 reference*), the reconciliation rules on a later CW1 message (FR-QTE-014), and the audit obligations (FR-QTE-015 must distinguish direct publication from CW1 confirmation). Building F1.08/P1.09–P1.10 before this is settled means building the state machine twice.

It also creates a commercial exposure the plan does not name: in direct mode the portal holds a **binding customer offer that the system of record has never seen**. The plan says "the portal retains the authoritative published commercial snapshot" — that is a reversal of the "CW1 is the truth" principle for that path, and it needs to be stated as such and signed, not absorbed as a configuration flag.

**Recommendation.** Before any pricing code: write **ADR-006 — quotation publication modes**. It must state (a) both modes and their state machines side by side, (b) what "published" means in each, (c) what happens to a direct-published quote when CW1 later produces a conflicting one, (d) who is accountable for an offer CW1 never received. Then amend `CLAUDE.md` rule 2 and PRD FG-3.3 to reference the ADR rather than assert the old absolute. This is exactly the "record architectural decisions before implementing affected slices" instruction the baseline gives; it has not been actioned.

---

### G-3 · The plans contradict the repository's own layout rule — **High**

**Evidence.** `CLAUDE.md` is explicit that there are no shared packages and that the two apps share no code. Yet:

- `Project-Kickoff-and-Phase1-Plan.md` F1.01: *"`packages/design-system`, `packages/shared-types`"*.
- Same document, F1.04: *"`packages/design-system`: tokens imported verbatim…"*.
- Same document, §6 Definition of done, item 2: *"Types and validation schemas in the shared package, used by both the web app and the API."*
- Same document, F1.07: *"Shared chargeable-weight function used by both the web app and the API."*
- Slice plan §2 DoD items 2 and 5, §3 repository shape, S1.04: all say `packages/*`.

`README.md` and the FR baseline both carry a note saying the real paths win — but the note lives in a *third* document. An agent reading F1.07 literally will try to share `chargeableWeight()` across the app boundary, which the lint rule in `apps/noatum-customer-portal-ui/.eslintrc.cjs` will then block, after the work is done.

**Consequence.** Predictable, repeated, low-value rework. Also a correctness trap: FR-QTE-003 now requires the **server** to calculate and the browser to display the authoritative result. The old wording invites the duplicated-function bug that FR-QTE-003 exists to prevent.

**Recommendation.** Edit the two plan documents in place — replace every `packages/shared-types` with `apps/noatum-customer-portal-api/src/contracts`, every `packages/design-system` with `apps/noatum-customer-portal-ui/src/design-system`, and rewrite F1.07's "shared chargeable-weight function" as "chargeable weight calculated by the API and displayed by the SPA". A cross-document erratum is not a substitute for correcting the text an agent will read.

---

### G-4 · Naming drift between plans and repository — **Medium**

The plans say `apps/api`, `apps/portal-web`, `apps/web`; the repository has `apps/noatum-customer-portal-api`, `apps/noatum-customer-portal-ui`. `CLAUDE.md` is correct; several `docs/` files and every archived intake are not. Cheap to fix, and it currently makes path-based instructions ambiguous.

---

### G-5 · The plans do not name what "done" is measured against — **Medium**

Three definitions of done are in force: `CLAUDE.md` §"Definition of Done" (9 items), `Project-Kickoff-and-Phase1-Plan.md` §6 (9 items, different wording, mentions the shared package), and `03-Phased-Delivery-Plan.md` §10 "Common release control" (9 gates, the most rigorous). They mostly agree, but they are not the same list, and nothing says which one a reviewer applies. Consolidate to one, cited from the others.

---

## 2. Theme B — Scope correctness against the v4 overrides

### B-1 · The built quotation flow implements the retired model — **Critical**

**Evidence.** `apps/noatum-customer-portal-api/src/modules/quotes/`:

- `quotes.controller.ts` exposes exactly four routes: list, get, create, and **`POST /quotes/:id/rate`**. There is no `submit`.
- `quotes.service.ts` `rate()` calls `RateEngineAdapter.rate()` synchronously and writes `status: 'rated'` on success, `status: 'rate_failed'` on any exception.
- `schema.prisma` `enum QuoteStatus { draft rated rate_failed expired accepted rejected }`.
- `integration.module.ts` binds `{ provide: RateEngineAdapter, useClass: Cw1RateAdapter }` — the rate port is wired to a live CW1 rate endpoint.

**What the requirements say.** v4 override rule 1: *"No rate management exists… never write code that assumes a price will come back automatically."* Rule 2: *"Internal pricing is part of the Phase 1 quotation feature."* FR-QTE-007: the instant-rate adapter *"shall leave it unconfigured and unavailable as a live promise"*. FR-QTE-008 requires the canonical lifecycle **Requested / In Progress / Quoted / Accepted / Rejected / Expired / Cancelled**. FR-QTE-006 requires submission to enter *"the owning branch's pricing queue"*.

**Consequence.** As built, the only path to a priced quote is an automatic rate call to a source that the business has confirmed **does not exist**. Every quote will land in `rate_failed`, with no manual route out of that state. The status vocabulary has no `requested`, no `in_progress`, no `quoted`, no `cancelled`; `rated`/`rate_failed` are vocabulary from the model v4 explicitly retired. There is no `quote_version` table, so the version chain, immutable accepted versions and "reject creates v+1" (FR-QTE-019) have nowhere to live. There are no claim, pricing, approval, publication or sync fields, so FG-3.3 — a **P0** feature and, per the PRD, one of the two halves of the Phase 1 feature — is entirely unmodelled.

This is the largest single divergence between plan and build, and it is in the feature Phase 1 exists to deliver.

**Recommendation.** Treat the quote module as a scaffold to be replaced, not extended. In order: (1) settle G-2 and write ADR-006; (2) migrate `QuoteStatus` to the canonical lifecycle with an explicit `quote.status.ts` transition table and a unit test per transition, as `CLAUDE.md` requires and as no file currently provides; (3) introduce `quote_version` before any quote data of value exists; (4) make `POST /quotes/:id/submit` the entry point, with the rate adapter **unbound by default** and the manual path as the only configured route. `rate()` as a customer-callable endpoint should not survive.

---

### B-2 · Sea FCL and Sea LCL are collapsed into one mode; road and rail are added — **High**

**Evidence.** `contracts/enums.ts` / `schema.prisma`: `enum TransportMode { air sea road rail }`. `contracts/chargeable-weight.ts` gives `sea: 1000` — the LCL revenue-ton divisor — and provides `road: 333`, `rail: 333`.

**What the requirements say.** FG-3.1 and FR-QTE-001: three modes, **Air / Sea FCL / Sea LCL**, each with its own wizard; FCL needs a container picker and is **not** charged on chargeable weight at all. PRD §2 non-goals: *"road and rail modes"* are out of scope (architecture must not preclude them, which is not the same as offering them).

**Consequence.** A Sea FCL request either cannot be expressed or is silently priced as LCL. `road`/`rail` are selectable modes for scope the business has not bought, with invented divisors that appear in no requirement document.

**Recommendation.** Model the mode as `air | sea_fcl | sea_lcl`. Keep the enum extensible (that is the seam) but do not seed values the PRD excludes. Give FCL an equipment-list shape rather than a chargeable weight.

---

### B-3 · Air routes cannot be entered — **High**

**Evidence.** `contracts/schemas/quote.schema.ts` applies the same `unlocode` regex `^[A-Z]{2}[A-Z0-9]{3}$` to both `originCode` and `destinationCode`, for every mode.

**What the requirements say.** FG-3.1: *"route (UN/LOCODE or IATA plus optional door addresses)"*. FR-QTE-002: *"appropriate UN/LOCODE or IATA locations"*.

**Consequence.** `MAD` → `JFK` is rejected. Air quoting — the first mode named in every requirement document — does not work.

---

### B-4 · Dangerous goods, HS code, temperature control, door addresses, incoterm and direction are absent from the contract — **High**

**Evidence.** `createQuoteSchema` accepts `accountId, mode, originCode, destinationCode, grossWeightKg, volumeM3, currency, packages, incoterm (free string, max 10), notes, payload (free-form record)`.

**What the requirements say.** FR-QTE-002 makes **UN number and class mandatory when dangerous goods are indicated** and requires commodity/HS and temperature capture. FG-3.1 adds direction, service, additional services, references and door addresses from the address book. The kickoff F1.07 exit test is explicitly *"dangerous-goods validation holds"*.

**Consequence.** The one wizard rule the plan calls out by name as an exit test has no server-side expression, and `payload: z.record(...)` is an unvalidated escape hatch through which the entire wizard body can pass unchecked. Server-side validation is the control FR-QTE-001 relies on ("validated server-side"), and it is currently nominal.

---

### B-5 · Plan-level: Phase 1 scope has grown twice without a register entry — **Medium**

Two substantial capabilities entered Phase 1 after the PRD:

- **FR-CFG-001…008 — Administration > Settings > Quotation settings** (UC-12). Eight requirements, a versioned policy store with scope inheritance, effective-value resolution, change reasons and history, and quote versions that retain their effective policy revision.
- **P1.07 — Lookup management** (`Lookup-Management-Implementation-Plan.md`): a multilingual, hierarchical, dependent-option reference-data module with its own UI and eight of its own decision gates (LM-D01…LM-D08).

Neither appears in PRD v4.0. Neither is in `gaps.md` section B ("proposals beyond the PRD… awaiting sponsor sign-off"), which is the register the project created for precisely this. Both are real needs — but the Simplification Register's whole principle is *"before adding a table, a runtime, a cache or a screen, check the register; keep the seam, do not build the machinery"*, and a versioned policy engine plus a lookup administration module is a considerable amount of machinery arriving into a phase whose headline deliverable has not been built yet.

The lookup plan is honest about this (*"adding this dedicated UI must be recorded as an agreed expansion of the earlier minimal administration approach before code implementation"*) — that record does not yet exist.

**Recommendation.** Add both to `gaps.md` section B with Status = *Pending sign-off*, and size them. If they must stay, say what moves out. Phase 1 currently contains: the foundation, onboarding, the customer wizard, internal pricing, publication in two modes, acceptance and PDF, dashboard, news, notifications, five future-module navigation catalogues, a quotation policy engine and a lookup administration module. That is not the phase the PRD roadmap describes.

---

### B-6 · Phase 2 and Phase 3 code is already present — **Low**

`app.module.ts` registers `ShipmentsModule`, `DocumentsModule`, `FinanceModule`, `BookingsModule`, `ClaimsModule`, `ReportsModule`, `ApiManagementModule`; `integration/jobs/handlers/shipment-refresh.handler.ts` and `cw1-shipment.adapter.ts` exist. The modules are empty shells with explanatory comments, which is defensible as navigation scaffolding under FR-NAV. The shipment *adapter and job* are not — they are Phase 2 integration work, and `CLAUDE.md` says "Keep changes inside the slice." Low harm, but it is scope leakage and it is the kind that accumulates.

---

## 3. Theme F — Foundation defects

> These matter more than their size suggests. Ground rule 1: the foundation is "built once and never rebuilt". Everything below is cheap now and expensive after F1.06.

### F-1 · Tenancy cannot express the hierarchy, and internal access is an unconditional bypass — **Critical**

**Evidence.** `prisma/schema.prisma`, model `CustomerGroup`: fields are `id, name, slug, tier, flags, isActive, createdAt, updatedAt`. There is **no `parent_id`**, no `status`, no `email_domains`, no `identity_mode`.

`prisma/migrations/20260101000000_tenancy_roles_rls/migration.sql`: every policy is of the form

```sql
USING (customer_group_id = app.current_group() OR app.is_internal())
WITH CHECK (customer_group_id = app.current_group() OR app.is_internal())
```

**What the requirements say.** PRD §6 and FG-8.1: a **two-level hierarchy (parent → children) driving visibility**. `Project-Kickoff-and-Phase1-Plan.md` F1.02 exit test: *"A parent-customer user sees its children; a child does not see its parent."* FR-ORG-001 requires the hierarchy with cycle rejection; FR-ORG-004 requires parent-sees-children scope. `CLAUDE.md` rule 1 and the slice plan both describe `current_group_ids()` — a **set**, not a scalar.

**Consequences, in order of severity:**

1. **No hierarchy.** `app.current_group()` returns one UUID and every policy compares with `=`. A parent-group user sees nothing of its children. There is no column to build the hierarchy from. This is a schema change to the tenancy root table plus a rewrite of every policy — trivial today, a migration with live customer data later.
2. **`OR app.is_internal()` appears in `WITH CHECK` as well as `USING`.** An internal session may **write** to any tenant's rows, on every table. PRD 4a.6 and FR-IAM-012 require impersonation to be **read-only**, enforced, with a banner and both identities audited. There is no `impersonation_session` table and no write-blocking mechanism, so read-only impersonation is not merely unimplemented — the data layer as designed cannot enforce it.
3. **`app.is_internal` is an ordinary session GUC that the runtime role sets itself.** `TenantRepository.applyScope` sets it via `set_config`. Nothing prevents any code path holding that connection from setting it to `'true'`. The slice plan explicitly wanted the opposite: S1.07 test *"`app_api` cannot set `app.is_system`"*. The single most powerful privilege in the system is a string the application grants itself.
4. **`TenantGuard` lets staff retarget freely.** On an `X-Customer-Group` header from an internal user it does `ctx.customerGroupId = requestedGroupId` with no impersonation record, no reason, no audit, no time box — and `isInternal` remains true, so RLS is bypassed regardless of the value.
5. **Tables without policies.** Policies exist for `customer_group, customer_account, invitation, quote, quote_template, address_book_entry, user, news_item, audit_event`. They do **not** exist for `role, permission, role_permission, user_role, user_account_access, master_org, mapping_entry, job_run`. `user_account_access` is customer data — it encodes which offices a user may see — and `portal_app` holds full `INSERT/UPDATE/DELETE` on it via `GRANT … ON ALL TABLES`. DoD item 1 says "No table without a policy."
6. **`ALTER DEFAULT PRIVILEGES` grants DML on every future table automatically.** So the failure mode for a forgotten policy is *silent full access*, not an error. The default should fail closed.

**Recommendation — do these before F1.05/P1.04:**
- Add `parent_id` to `customer_group` with a depth-2 constraint; replace `app.current_group()` with `app.current_group_ids() returns uuid[]` and every policy predicate with `= ANY(app.current_group_ids())`.
- Split internal access into `app.is_internal_read()` and an explicit, separately-set write capability. Remove `is_internal` from every `WITH CHECK`.
- Move the internal flag out of application reach: derive it from the connected role (`current_user`) or a `SECURITY DEFINER` function that the application cannot flip, and add the negative test the slice plan already specified.
- Add `impersonation_session` and make `TenantGuard` require an active, unexpired, reasoned session before honouring `X-Customer-Group`; deny all writes while one is active.
- Add policies to the eight unprotected tables; revoke the blanket default privileges and grant per table in the migration that creates it.

---

### F-2 · Identity: one issuer, and invitation-free binding by email — **Critical**

**Evidence.**
- `src/config/configuration.ts`: a single `entra.issuer`, a single `entra.audience`, and `jwksUri` derived from a single `ENTRA_TENANT_ID`.
- `src/config/env.validation.ts`: `ENTRA_TENANT_ID`, `ENTRA_API_AUDIENCE`, `ENTRA_ISSUER` — all singular, all required.
- `src/common/guards/auth.guard.ts`: `jwt.verify(..., { audience: getOrThrow('entra.audience'), issuer: getOrThrow('entra.issuer') })`.
- `src/modules/identity/identity.service.ts`:

```ts
where: email ? { OR: [{ entraObjectId }, { email, entraObjectId: null }] } : { entraObjectId }
...
if (!user.entraObjectId) {
  await this.prisma.user.update({ data: { entraObjectId, status: 'active', ... } });
}
```

**What the requirements say.** PRD 4a.1: *"The API is a resource server that validates the Entra access token, accepting **exactly two issuers**"* — Entra ID for staff, Entra External ID for customers, which are **different tenants with different JWKS endpoints**. FR-IAM-001 requires both configured issuers to validate and wrong-issuer tokens to be refused. FR-IAM-008: *"identify linked users by issuer and subject, not by email alone after initial identity binding."* PRD 4a.2 and FR-IAM-006: invitations are hashed, single-use, expiring, bound to the invited email, and acceptance requires presenting the token.

**Consequences:**

1. **Customers cannot sign in.** One tenant id drives the JWKS URI; External ID tokens will not validate. Whichever directory is configured, the other audience is locked out. This blocks F1.02's exit test and every customer-facing stage.
2. **The invitation is bypassable.** A user row with `entraObjectId = null` and a known email is bound to *any* successfully-authenticated identity presenting that email, and is **force-activated** (`status: 'active'`). No invitation is read. Expiry, revocation, single use and domain checks — the four controls FR-IAM-006 and FR-IAM-007 specify — are all skipped. Invitation acceptance is supposed to be a deliberate endpoint that validates the token hash; here it is a side effect of a login.
3. **No issuer discrimination on binding.** With two issuers eventually configured, a staff-tenant identity whose email matches a pending customer user would bind to that customer user and inherit its tenancy.
4. **`status: user.entraObjectId ? user.status : 'active'`** returns `'active'` for a first-time bind regardless of the stored status, so a `suspended` or `disabled` row that has never signed in authenticates.
5. **No group-level suspension check.** `CustomerGroup.isActive` exists but `AuthGuard` never reads it. FR-ORG-006 requires suspension to block all the customer's users on the next request.
6. **Schema has no `idp_issuer`** — only `entraObjectId @unique`. The (issuer, subject) pair FR-IAM-008 mandates cannot be stored.

**Recommendation.** This is the highest-risk code in the tree. Rework `AuthGuard` to hold a map of `issuer → { jwksUri, audience }` and validate against the matching entry, rejecting unknown issuers. Add `idp_issuer` + `idp_subject` to `user` with a composite unique, and drop email from the lookup entirely. Move binding into an explicit `POST /invitations/accept` that validates the token hash, expiry, status and email against the presented identity — and make login with an unbound identity a plain 401.

---

### F-3 · A linked CW1 organisation code is not globally unique — **High**

**Evidence.** `schema.prisma`, `CustomerAccount`: `@@unique([customerGroupId, cw1OrgCode])`. There is no global unique index, and no normalised (case-folded) column.

**What the requirements say.** FR-ORG-003: *"A linked organisation shall belong to **only one** CustomerGroup, with normalised code matching."* Acceptance: *"Case variants cannot grant the same source organisation to different customers."* The LLD and slice plan both specify `code_norm UNIQUE`. `gaps.md` item 5 records the format question as open and the interim decision as *"case-insensitive uniqueness"*.

**Consequence.** `ACME01` may be linked to customer A and `acme01` — or even the identical string — to customer B. Since the tenant resolver assigns inbound CW1 entities by matching party organisation codes against linked accounts, this is a direct cross-tenant disclosure path the moment shipments or invoices arrive in Phase 2. It is also the exact failure the onboarding audit trail exists to prevent, and the S1.12 test *"linking an already-linked code → 409 (case-insensitive)"* cannot pass.

**Additionally**, `CustomerAccount` has no `linked_by`, `linked_at`, `approved_by` or justification field. FR-ORG-002 requires *"audited organisation-level customer linking with justification and confirmation"* and the Simplification Register C1 explicitly keeps those three columns as the seam for the 4-eyes option (OQ-13/D-13). They are missing.

**Recommendation.** Add `code_norm` (generated, lower-cased) with a **global** unique index, plus the three linking-metadata columns, before any customer is onboarded.

---

### F-4 · Permissions and roles are not seeded, and the vocabulary does not match the requirements — **High**

**Evidence.**
- `prisma/` contains `migrations/` and `schema.prisma` only. **There is no seed file and no seed script** in `apps/noatum-customer-portal-api/package.json`.
- The RLS migration does `REVOKE INSERT, UPDATE, DELETE ON master_org, permission FROM portal_app`, so the application cannot seed them either.
- `contracts/permissions.ts` defines five roles: `customer_admin, customer_user, customer_viewer, noatum_admin, noatum_support`.

**What the requirements say.** PRD 4a.5 and `Project-Kickoff-and-Phase1-Plan.md` F1.03: **nine presets** — six customer (Standard, Quoting & Booking, Finance, Analyst, Claims, Customer Admin) and internal Customer Success, Pricing, Pricing Approver, Ops, Platform Admin. FR §5.1 gives the customer preset-to-module matrix; §5.2 gives the internal baseline.

**Consequences:**

1. **The application is not runnable end to end.** `PermissionGuard` fails closed; no permission rows exist; no role rows exist; therefore every authenticated request returns 403. F1.01's "runs locally with one command" and F1.02's exit test cannot pass today.
2. **Five roles instead of nine**, with Pricing and Pricing Approver — the two roles FG-3.3 depends on — absent, and Finance/Analyst/Claims collapsed into `customer_user`. FR §5.1's matrix cannot be expressed.
3. **No branch permission.** v4 rule 7 and FR-IAM-003 require internal users to carry a branch and require an explicit cross-branch permission. Neither the `user.branch` column nor a `pricing.cross_branch` code exists.
4. **No pricing, settings, lookup or impersonation-adjacent codes**; `admin.impersonate` exists but nothing consumes it.
5. **Code spelling differs from every planning document** (`quotes.create` here vs `quote.create` in the slice plan and FR §5.1's note that *"exact permission-code spelling must be reconciled with the API catalogue during F1.03"*). That reconciliation is owed and is gated by D-04.

**Recommendation.** Seed as an **owner-run SQL migration** (the app role is correctly denied write on `permission`), covering the nine presets and the full catalogue including the five future modules FR-NAV-002 requires. Settle D-04 first so the codes are seeded once.

---

### F-5 · Foundation tables named as Phase 1 deliverables do not exist — **High**

Missing from `schema.prisma`, each against a named requirement:

| Missing | Required by |
| --- | --- |
| `analytics_event` | PRD FG-8.6 and FG-10 "instrumented from the outset (P0)"; FR-ORG-009; `CLAUDE.md` DoD 7; every plan's DoD |
| `integration_message` (raw payload, 13-month retention, replay) | PRD §5 integration service requirements; F1.05; FR-SYS-*; NFR-DAT-002 |
| `impersonation_session` | PRD 4a.6; FR-IAM-012 |
| `quote_version` | FG-3.1 version chain; FR-QTE-019 |
| `shipment_visibility` | `CLAUDE.md` rule 1 Pattern B; F1.05 (empty in Phase 1, but the pattern must exist before Phase 2 designs around it) |
| `customer_group.parent_id`, `.status`, `.email_domains` | FR-ORG-001, FR-ORG-006, FR-IAM-007 |
| `user.branch`, `user.idp_issuer` | v4 rule 7 / FR-IAM-003; FR-IAM-008 |
| news scope, kind, display mode, validity window, read receipt | FG-4.5; F1.09 exit test *"a banner scoped to one country appears only for users in it"* |

`NewsItem` as built has `title, slug, body, locale, publishedAt` and a nullable group — it cannot express country scope, a validity window, warning/info/hint kinds, or pop-up-once behaviour, all of which are P0 in FG-4.5 and all of which appear in the F1.09 exit test.

`MappingEntry` (one generic `domain/portalCode/cw1Code` table) is a reasonable simplification of four mapping tables — but as the lookup plan itself observes, it cannot express source-instance identity, mapping direction, translations or hierarchy. That is a legitimate design conversation, not a defect; it should be recorded as an ADR rather than discovered in P1.07.

---

### F-6 · Adapter interfaces are neither complete nor where the rules say — **Medium**

`CLAUDE.md` rule 2: *"All external systems sit behind interfaces in `apps/noatum-customer-portal-api/src/contracts/adapters`: `TmsTrackingAdapter`, `TmsQuoteAdapter`, `TmsBookingAdapter`, `TmsFinanceAdapter`, `TmsDocumentAdapter`, `RateEngineAdapter`, `EmissionsAdapter`."*

Reality: `src/contracts/adapters/` does not exist. `RateEngineAdapter` lives in `src/modules/quotes/`. `Cw1ShipmentAdapter` is a concrete class with no interface. The other five ports are absent — including `TmsQuoteAdapter`, which the Phase 1 manual path depends on to send the quote request to CW1.

Also: `CLAUDE.md` specifies a **25 s** timeout for the rate call (PRD §7 instant quote < 30 s); `configuration.ts` sets `cw1.timeoutMs` to 15 s and `HttpModule.register({ timeout: 15_000 })`. Safe, but undocumented drift from a stated constant.

---

### F-7 · Correctness defects worth fixing while the code is small — **Medium**

| Item | Evidence | Problem |
| --- | --- | --- |
| Quote reference generation | `quotes.service.ts` `nextReference()` uses `count(*) + 1` | Races under concurrency; two simultaneous creates produce the same reference and the second throws a 500 on the unique constraint. Use a per-tenant sequence or a retry loop |
| Rounding | `chargeable-weight.ts` comment says *"rounded up to three decimal places"*; the code is `Math.round(...)` — round-half-up | The comment and the code disagree on a commercial number. More importantly, **no requirement defines the rounding rule**: FR-QTE-003 only says "agreed mode-specific examples match server results". That agreement does not exist. Air tariffs commonly round up to the next 0.5 kg. Raise it as a decision under D-12 |
| Rate failure | `quotes.service.rate()` catch → `status: 'rate_failed'` | `CLAUDE.md` rule 2 and FR-QTE-007 require *"fall through to the manual path"*. A dead-end status is not a fallback |
| Tier defaults | `contracts/feature-flags.ts` `TIER_DEFAULT_FLAGS` hard-codes which tier gets bookings, claims, reports, API access | OQ-10 (*"Customer tier definitions driving default features"*) is **open**, owner Commercial. This is an unapproved commercial decision baked into code. The Simplification Register C7 permits a config map — it does not authorise inventing its contents |

---

## 4. Theme V — Verification, and claims the evidence does not support

### V-1 · Definition-of-done items are asserted but not enforced — **High**

| DoD claim | Reality |
| --- | --- |
| *"A lint rule enforces this"* (`CLAUDE.md` rule 6: no colour, font or radius outside the design system) | No such rule exists in `apps/noatum-customer-portal-ui/.eslintrc.cjs`. Behaviour is currently compliant — hex values appear only in `tokens.css` — but nothing prevents regression, and the document states the control as existing |
| *"WCAG 2.1 AA checks pass (axe in CI)"* (DoD 5; NFR-UX-001; PRD FG-10 P0) | `@axe-core/playwright` is a dependency and `e2e/foundation.spec.ts` exists, but **CI runs no frontend stage**. The pipeline comment says so honestly — the *documents* do not |
| *"performance budget met… (k6 smoke)"* (DoD 5; NFR-PER-001…005) | No k6 config, no performance job, no dataset fixture anywhere in the tree |
| *"one tenant-isolation test per new entity, one 403 test per endpoint"* (DoD 4) | The isolation suite covers `quote, customerAccount, addressBookEntry, quoteTemplate, invitation` — good — but there is **no 403 test for any endpoint**, and only one business-rule unit test in the whole API (`chargeable-weight.spec.ts`) |
| *"no endpoint exists without a declared permission (enforced by a build-time test)"* (PRD 4a.7) | No build-time test. `PermissionGuard` throws on a missing decorator at request time, which is arguably **better** — but then the requirement should be amended to say so rather than left asserting a test that does not exist |
| *"OpenAPI regenerated"* (DoD 2, 8; FR-SYS; S1.07a) | The CI step is a conditional no-op: *"No OpenAPI document emitted yet — S1.07a has not landed."* Swagger is mounted at `api/docs` and **disabled in production**; S1.07a requires a published, versioned `/v1/openapi.json`. `src/api/generated/schema.d.ts` exists in the SPA but nothing in CI verifies it is current |
| *"Every string goes through i18next with EN and ES entries"* | Four i18n files exist and cover the login screen and shell only |
| Rate limiting (NFR-SEC-011; S1.07a *"global rate-limit middleware"*) | No throttler dependency, no middleware. `helmet()` and CORS only |

**Consequence.** The project's own quality gates are documented as automated and are in fact manual or absent. That is the specific failure mode `03-Phased-Delivery-Plan.md` §10 warns about: *"CI success alone is not business acceptance"* — here the inverse also holds, CI success does not even mean the stated CI checks ran.

**Recommendation.** Either build the controls or amend the documents. Given the project's stated preference for the smallest thing that works, I would: add the design-token lint rule (it is roughly ten lines of `no-restricted-syntax`), add the frontend Playwright+axe stage now that a screen exists, keep the runtime permission guard and amend PRD 4a.7 to describe it, and move the k6 budget to F1.10/P1.12 where the plans already put it — but say so in the DoD instead of claiming it per slice.

---

### V-2 · Migrations are reversible in form but not in procedure — **Medium**

Each migration folder carries a `down.sql`, which is more than most teams do and satisfies DoD 1 in spirit. But Prisma never executes them, no pipeline stage applies them, and no runbook describes when one would be used. NFR-ARC-006 requires *"reversible by a **reviewed recovery procedure**"*. Write the procedure into `docs/process/` or `prisma/migrations/README.md`, or the `down.sql` files are decoration.

---

### V-3 · The SPA has no portal — **Medium (status, not defect)**

`apps/noatum-customer-portal-ui/src/app/router.tsx` routes to `controls`, `foundation`, `overlays`, `data`, `listings` — a design-system workspace. `navigation.ts` lists those five workspace sections. There is no Quotes route, no shell navigation for the five required modules, no wizard.

This is consistent with P1.03 slice A ("Noatum-themed shadcn core kit") being the current work, so it is not a defect. It is worth stating plainly because the module scaffolding in the API, the generated `schema.d.ts` and the login page together can read as "the portal exists". It does not yet. FR-NAV-001…006 are entirely ahead.

One design question to settle now rather than later: the kit is Tailwind + Radix (`components.json`, `radix-ui`, `tailwind-merge`), sitting alongside CSS-module components driven by `tokens.css`. Two styling systems in one design system is how token discipline erodes. ADR-005 covers application structure; it does not cover this. Record the decision.

---

## 5. Theme S — Sequencing and dependency realism

### S-1 · Both plans put the highest-risk unknown behind the largest build — **High**

OQ-3a — *are shipment and invoice parties stored as organisation codes or address codes?* — is flagged in the PRD as *"the most urgent technical question"*, in `gaps.md` N1 as *"Open — highest technical risk"*, and in the kickoff risk table as the first risk. Its owner is the CW1 team; the project cannot answer it alone.

The mitigation in both plans is the same sentence: *"the resolver is written so that mapping an address code to its parent organisation is a lookup, not a redesign."* That is a good mitigation for the *resolver*. It is not a mitigation for the **data**: if parties carry address codes, the master-data feed must supply the address-to-organisation relationship, which means a new import, a new table and a new daily job — none of which is in any Phase 1 stage, and `FR-ORG-005` assumes the lookup exists.

**Recommendation.** Add a named, sized contingency slice to the plan — "address-to-organisation resolution" — marked conditional on OQ-3a, so that if the answer arrives late the schedule impact is visible rather than absorbed. Chase the answer as item 9 of the kick-off checklist says; it is now three days old with no recorded response.

### S-2 · F1.08 / P1.09 is gated on decisions nobody has taken — **High**

The pricing stage's own entry gate lists OQ-11 (cost and margin captured? approval threshold?), OQ-12 (sponsor's written narrowing of the operational non-goal) and D-18 (the entire settings-to-scope matrix, precedence, initial values, in-flight re-evaluation and direct-offer collision rules). `gaps.md` P11 records internal pricing itself as **"Pending sign-off"** — the feature that the PRD promoted to the core of Phase 1 is not yet approved by the sponsor.

The plans are correct to gate it. What they do not do is say **what the team builds while it is gated**. Since F1.07/P1.08 (the customer wizard) depends on the settings contract from F1.08/P1.07 (*"Resolve and retain the request's effective quotation-policy revision using the approved D-18 rules"*), the gate reaches backwards into the stage before it. There is a real risk of the team being blocked on a sponsor signature with no declared fallback.

**Recommendation.** Define the minimum interim policy explicitly — one platform-level default, no scope overrides, CW1-confirmed mode only, approval disabled — record it as an interim decision in the register with an expiry, and let P1.08 proceed against it. The baseline's own rule applies: *"An unresolved decision is not an approved default **unless an interim rule is explicitly stated**."* State one.

### S-3 · Two stages are sequenced against a dependency that does not exist yet — **Medium**

`Project-Kickoff-and-Phase1-Plan.md` F1.05 and slice S1.07 both deliver the CargoWise connection, and both are prerequisites for the quote stages. OQ-2 (*is the eAdapter licensed and enabled?*) and OQ-2a (*can the integration team give early access?*) are open, and D-03 gates the real contract. The simulator covers development — but `apps/cw1-simulator/` contains only `.gitkeep` files and three `.env` files. The contingency named in the plans has not been started, while the stage that depends on it is three stages away.

### S-4 · "Second-region rehearsal" has no environment named — **Low**

F1.10 / P1.12 requires onboarding a second customer in a different branch "on a test environment". The Azure prerequisites table gates Dev/Test/UAT/Prod separation behind D-17 (App Service vs Container Apps, undecided) and general cloud approval. The rehearsal that proves ground rule 2 — the single most-repeated architectural claim in the document set — currently has no environment to run in.

---

## 6. Theme D — Decision-gate load

The decision register carries **18 gates (D-01…D-18)**, the PRD carries **23 open questions**, `gaps.md` carries 11 open gaps and 6 open proposals, and the lookup plan adds 8 more (LM-D01…LM-D08). Every one is legitimate. But:

- **Seven gates block Phase 1 stages directly**: D-01 (F1.02), D-02 (F1.04), D-03 (F1.05), D-04 (F1.03), D-12 (F1.08), D-13 (F1.06), D-18 (F1.03 and F1.08).
- **Every owner is a role, not a person.** The register says so itself: *"Owner titles below are accountable roles to be assigned to named people."* Three days after the baseline was written, no names are recorded.
- **No gate has a date.**

**Consequence.** The plan's risk posture is entirely "decision-gated", which is correct discipline, but with no names and no dates a gate is indistinguishable from a blocker. D-04 alone (exact permission codes and presets) blocks F1.03 — which blocks the shell, which blocks everything.

**Recommendation.** Before the next stage starts: assign a named owner and a needed-by date to D-01, D-03, D-04, D-12, D-13 and D-18, and publish which ones have an interim rule the team may build against. This is a half-day of work that changes the schedule more than any code in this review.

---

## 7. Prioritised remediation list

**Do first — these block or invalidate work already under way**

| # | Action | Addresses |
| --- | --- | --- |
| 1 | Choose one Phase 1 plan; rewrite `CLAUDE.md` "Source of truth" and "Scope guardrail" to match; banner the superseded plans; mirror to `copilot-instructions.md` | G-1, G-5 |
| 2 | Write ADR-006 on publication modes and amend `CLAUDE.md` rule 2 and PRD FG-3.3 | G-2 |
| 3 | Fix identity: two issuers with per-issuer JWKS and audience; `(idp_issuer, idp_subject)` on `user`; remove email-based binding; explicit invitation-accept endpoint; check `user.status` and `customer_group.isActive` | F-2 |
| 4 | Fix tenancy: `parent_id` + `current_group_ids()`; remove `is_internal` from `WITH CHECK`; move the internal flag out of application reach; add `impersonation_session` and gate `X-Customer-Group` on it; policies on the eight unprotected tables; revoke blanket default privileges | F-1 |
| 5 | Global case-insensitive unique on the CW1 org code, plus `linked_by` / `linked_at` / `approved_by` | F-3 |
| 6 | Seed the permission catalogue and nine role presets as an owner-run migration — after D-04 is answered | F-4 |
| 7 | Assign named owners and dates to D-01, D-03, D-04, D-12, D-13, D-18; publish interim rules where the team may proceed | Theme D, S-2 |

**Do next — before the quote stages**

| # | Action | Addresses |
| --- | --- | --- |
| 8 | Replace the quote model: canonical lifecycle, `quote.status.ts` with a test per transition, `quote_version`, `submit` as the entry point, rate adapter unbound by default | B-1 |
| 9 | Mode enum `air / sea_fcl / sea_lcl`; IATA-or-UNLOCODE route validation; DG, HS, temperature, door-address and direction fields in the schema; remove the free-form `payload` escape hatch | B-2, B-3, B-4 |
| 10 | Create `contracts/adapters/` with the seven named ports; correct or document the 25 s / 15 s timeout | F-6 |
| 11 | Add `analytics_event`, `integration_message` and the news scope/validity/kind model | F-5 |
| 12 | Register the quotation-settings module and the lookup module in `gaps.md` section B, with sizing, and state what leaves Phase 1 if they stay | B-5 |
| 13 | Fix the reference-generation race; settle the chargeable-weight rounding rule under D-12; make rate failure fall through to manual; move tier defaults behind OQ-10 | F-7 |

**Do before the phase gate**

| # | Action | Addresses |
| --- | --- | --- |
| 14 | Add the design-token lint rule; add the Playwright + axe CI stage; make the OpenAPI check fail rather than skip; add rate-limit middleware; add per-endpoint 403 tests | V-1 |
| 15 | Write the migration-recovery procedure | V-2 |
| 16 | Record the Tailwind-plus-tokens decision in an ADR | V-3 |
| 17 | Add the conditional address-to-organisation resolution slice; start the simulator | S-1, S-3 |
| 18 | Name the environment for the second-region rehearsal | S-4 |

---

## 8. What this review did not cover

- The `REFERENCE/MOCKUP` canvases were not compared screen by screen against the FR navigation matrix.
- `docs/lld/`, `docs/design/` and the KT minutes were read for context but not audited line by line against the build.
- No tests were executed and no database was provisioned; findings about runnability are from reading configuration, migrations and the absence of a seed, not from a failed run. That inference should be confirmed by one `pnpm db:up && pnpm dev` before item 6 is scheduled.
- Cost, capacity and schedule are out of scope; the plans commit no dates, deliberately.

---

## 9. Change history

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 12.09.2026 | Initial critique of the Phase 1 plan set and the current build against PRD v4.0, FR v1.1 and NFR v1.1 |
