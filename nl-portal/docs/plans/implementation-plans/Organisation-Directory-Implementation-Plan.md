# Organisation directory implementation plan

| Document control | Value |
| --- | --- |
| Version / date | 1.0 / 13.09.2026 |
| Status | Draft implementation plan for review and approval; not implementation evidence |
| Scope | CW1 organisation directory: database, ingestion, API and internal UI. Customers are touched only at the linking seam |
| Reference design | Three supplied mockups: organisation list, organisation overview, addresses tab |
| Governing sources | PRD v4 §4a.3, §5, §6, FG-8.1; FR-ORG-001..009; `docs/lld/Organisation-Management-and-Customer-Onboarding.md`; `docs/architecture/KB-CW1-Integration-Multi-Tenant.md`; `../../research/08-Customer-Organisation-and-Access-Research.md`; phase plan `04-Integration-and-Organisation-Directory.md` |
| Owners | Product, Customer Success, Integration, Security, Privacy and Engineering; named owners to be assigned |

## 1. Purpose and outcome

Give internal staff a trustworthy, searchable mirror of the CargoWise business-party
directory, three controlled ways to populate it, and one deliberate, audited path from an
organisation to a portal customer.

The completion criterion is narrow and security-shaped:

> An authorised member of staff can find any organisation, understand where its data came
> from and how fresh it is, and link it to exactly one customer — while it remains
> impossible for one organisation code to grant two customers sight of the same cargo.

This document is a plan. Approving the UI direction does not approve every proposed
column, endpoint or dataset. Items marked **gate** need a named decision before the
package that depends on them starts.

## 2. Findings this plan must correct

A read of the current source against the governing documents found four defects. They are
listed first because three of them are prerequisites, not improvements.

| # | Finding | Evidence | Severity |
| --- | --- | --- | --- |
| F1 | **One organisation can be linked to two customers.** The only constraint is `UNIQUE (customer_group_id, cw1_org_code)`, which prevents the harmless duplicate and permits the dangerous one. Both customers would then receive the same shipments and invoices through `orgCodesForCaller()` | `20251231000000_initial_schema/migration.sql`; contradicted by FR-ORG-003, LLD invariant I1, KB "Impossible - unique index", Simplification Register line 66 | Critical |
| F2 | **Codes are not normalised.** `cw1_org_code` is a case-sensitive `varchar(40)`; the LLD keys on `code_norm = lower(trim(code))`. `ACME001` and `acme001` are two rows, so even a corrected unique index is bypassable | `schema.prisma`; LLD §3.2, test T5 | Critical |
| F3 | **The runtime role cannot write `master_org`.** `REVOKE INSERT, UPDATE, DELETE ON master_org FROM portal_app` is in force, and the sync handler runs as `portal_app`. Every import path fails at the database until this is resolved deliberately | `20260101000000_tenancy_roles_rls/migration.sql` line 164 | Blocking |
| F4 | **`MasterOrg` cannot express an import.** Six columns, with no `source_hash`, `is_active`, `first/last_seen_at`, source instance or raw source code. Change detection, deactivation-by-absence and multi-instance disambiguation are all unimplementable against it | `schema.prisma`; LLD §3.2 defines thirteen | High |

Also true today, and not defects so much as absent work: the organisation sync job is a
placeholder that counts rows, the admin module registers no controllers, and no address,
contact or registration-identifier storage exists anywhere.

## 3. Scope

### In scope

- Source organisation model with provenance, freshness, activity and source instance.
- Three population paths: authoritative file import, CargoWise feed, provisional manual entry.
- Each path independently switchable by an administrator. The switches are **registered**
  here and **delivered** by the separate
  [feature management plan](Feature-Management-Implementation-Plan.md).
- Addresses beneath an organisation, read-only, never independently linkable.
- Registration identifiers, repeatable and jurisdiction-qualified.
- Internal directory list and detail UI with the five tabs in the mockups.
- Import run history, validation reporting and per-organisation change evidence.
- The link seam into customer onboarding, including the optional approval step.

### Out of scope

- Writing anything back to CargoWise. The mirror is read-only in that direction, always.
- Address-level linking, in any form, under any permission.
- A customer-facing organisation directory. These endpoints are internal-only.
- Creating, editing or deleting source-owned fields on an imported record.
- Contact import until the privacy gate clears (ORG-D05).
- Per-customer feature entitlements. `customer_group.flags` already exists and answers a
  different question - see the boundary in section 6.
- Customer list, customer detail, onboarding wizard and user management. This plan stops
  at the link; those screens are the next plan.
- Shipment and invoice visibility population, which is Phase 2.

## 4. The controlling idea

Three population paths raise an obvious question: if an operator can type a code, or put
one in a spreadsheet, what stops them granting a customer access to another company's
data by inventing a code that CargoWise later assigns elsewhere?

Guarding the import is the wrong answer, because a file is as forgeable as a form.

> **The guard belongs on the link, not on the import.**

Any path may populate the directory. Every row carries its provenance and a
`is_source_confirmed` flag, set only by a run that an operator has declared an
authoritative extract of a real CargoWise instance. **A row that is not source-confirmed
cannot be linked to a customer**, and that is enforced by a foreign key rather than by a
service that might forget.

This keeps manual entry available for a pilot with no live feed, while removing its
ability to pre-authorise access to data that does not exist yet. It is the same ownership
split already used for lookup management: content owned by a source, reach owned by the
portal.

**Manual entry is additionally optional.** It is a named platform switch, shipped off, and
an administrator may turn it on or off at any time without a deployment (section 6). Two
independent controls therefore stand between a typed code and a customer's data: the switch
decides whether anyone may type one at all, and the link gate decides whether a typed code
can ever grant access. Turning the switch off is an operational decision; the link gate is
not negotiable.

## 5. Proposed data model

Physical names to be confirmed in a scoped review before migration. `master_org` is
retained as the table name because the LLD, the KB and the simplification register all
reference it.

### 5.1 Identity and the link gate

| Responsibility | Design |
| --- | --- |
| Organisation identity | Surrogate `id uuid` primary key. Natural key `UNIQUE (source_system, source_instance, code_norm)`. `code_norm = lower(trim(source_code))`, maintained as a generated column so it cannot drift |
| Source instance | `source_instance` carries `CW1-EU`, `CW1-US` and similar. The mockup already filters on it. **Gate ORG-D02** confirms whether a code is unique globally or only per instance |
| Provenance | `source_kind` enum `feed` / `file` / `manual`; `is_source_confirmed boolean NOT NULL DEFAULT false`; `confirmed_by_run_id`; `first_seen_at`, `last_seen_at`, `source_version`, `source_hash` |
| Activity | `is_active`. Absence from a **complete snapshot** deactivates; nothing is ever deleted |
| Link gate | `master_org` gains `UNIQUE (id, is_source_confirmed)`. `customer_account` gains `org_id uuid` plus `org_confirmed boolean GENERATED ALWAYS AS (true) STORED`, with `FOREIGN KEY (org_id, org_confirmed) REFERENCES master_org (id, is_source_confirmed)`. An unconfirmed organisation is then unlinkable by construction, and an attempt to unconfirm a linked one is refused by the database |

That composite-foreign-key technique is already used in the LLD for
`ux_account_group_id UNIQUE (id, customer_group_id)`; this applies the same idea to a
different invariant.

### 5.2 Tables

| Table | Purpose and key columns |
| --- | --- |
| `master_org` | The mirror. Source identity, legal name, country, city, classifications, `source_branch_code` (a CargoWise attribute, explicitly **not** the servicing branch), `source_parent_code` (evidence only, never an access grant), activity, provenance and freshness |
| `org_address` | Addresses beneath an organisation. `(org_id, source_address_code)` unique, purposes, primary marker, components plus source-formatted text, activity, hash. **No customer column and no link table**: FR-ORG-005 forbids address-level linking, so the schema simply gives it nowhere to live |
| `org_registration_id` | `(org_id, scheme, value, jurisdiction)`. Repeatable and jurisdiction-qualified, as the mockup states. Never one universal VAT field |
| `org_contact` | Name, function, permitted contact fields, optional address association. **Created empty and unpopulated** until ORG-D05 clears; a contact is never an identity, an invitation or a recipient authorisation |
| `org_import_run` | One row per run: source kind and instance, mode, operator, authoritative flag, counts, error list, outcome, started/finished. See the reconciliation note below |
| `org_change_log` | Written **only when a row's hash actually changes**, not on every touch. Feeds the per-organisation history tab without 2,318 audit rows a day |

**Reconciliation required.** Simplification register C6 deliberately dropped an
`import_run` table in favour of one `audit_event`. The mockups require last-run counts,
error totals, snapshot-versus-delta, source instance and next scheduled run, and the phase
plan requires proof that a partial refresh deleted nothing. That is more than an audit blob
should carry. This plan proposes reinstating `org_import_run` and `org_change_log` as a
recorded, reasoned exception to C6, not a silent one. **Gate ORG-D07.**

### 5.3 Linking columns on `customer_account`

Per KB §"schema changes": `link_status` enum `pending` / `confirmed`, `justification`,
`linked_by_user_id`, `linked_at`, `approved_by_user_id`, `approved_at`. The list mockup
already shows all three states as chips.

A `pending` link must grant nothing. `TenantResolverService.orgCodesForCaller()` therefore
gains `link_status = 'confirmed'` alongside its existing `isActive` filter, and that
restriction carries its own isolation test.

### 5.4 Row level security

`master_org`, `org_address`, `org_registration_id`, `org_contact`, `org_import_run` and
`org_change_log` are internal-only reference data with no tenant column. They take the same
`internal_only` policy as `role`, `permission`, `region` and `branch`. No customer context
may read any of them, which is what stops a customer enumerating which organisations or
customers exist.

### 5.5 Write path for `master_org` (resolves F3)

Do **not** grant the runtime role blanket write access to the master table. Follow the
existing precedent of `app.resolve_identity` and `app.register_staff_identity`: a
`SECURITY DEFINER` function `app.apply_organisation_batch(jsonb)` performs validated,
hashed upserts and returns counts. The runtime role receives `EXECUTE` on that function
and nothing more, so the only way to modify the mirror is through the validated path.

## 6. Dependency: feature switches

Three of this plan's capabilities are optional and must be controllable by an administrator
at any time. That control is **not built here**. It is portal-wide infrastructure with its
own navigation entry, module and plan:
[Feature management implementation plan](Feature-Management-Implementation-Plan.md).

This plan registers five switches in that catalogue and reads them; it does not own the
page, the table or the guard.

| Switch | Default | Controls |
| --- | --- | --- |
| `organisations.import.file` | on | The **Import file** action |
| `organisations.import.feed` | off | The **Fetch from CargoWise** action; stays off until ORG-D06 |
| `organisations.manual_entry` | **off** | The **Add manually** action and the provisional-create endpoint |
| `organisations.link.require_approval` | off | Whether a link needs a second approver - the OQ-13 seam |
| `organisations.contacts.import` | off | Whether contact records are ingested at all; stays off until ORG-D05 |

Three of those replace what would otherwise have been code changes or permanent decisions,
so the pilot can start with every optional path off and enable each as its business approval
lands.

Two rules from that plan govern how this one uses them. A switch is checked **server-side**
in the endpoint, not merely used to hide a button. And **disabling never destroys**: turning
manual entry off stops new provisional rows and leaves existing ones readable, reconcilable
and unlinked.

The invariants this plan relies on - the link gate, one code one customer, no address-level
linking, no write-back to CargoWise - are registered on that page's **Protected** list and
are never switches.

## 7. Ingestion

### 7.1 One contract, three entry points

A single `OrgSource` interface in `contracts/adapters`, so the pipeline, validation,
reporting and audit are identical whatever populated the batch. Only the button differs.

| Path | Behaviour | Confirms the source? | Switch |
| --- | --- | --- | --- |
| **Import file** | Operator uploads an extract. Parse, validate, show a report, then commit. The LLD names this the first source: *"CSV drop first; eAdapter or API later"* | Only when the operator declares it an authoritative extract and names the instance. Their identity is recorded on the run | `organisations.import.file` |
| **Fetch from CargoWise** | Enqueues a job that pages the feed. **Never runs inline**: repo rule 2 permits exactly one synchronous external call, and this is not it | Yes | `organisations.import.feed` |
| **Add manually** | Creates one provisional row. Not an `OrgSource` at all - a direct, audited, portal-owned write | No. Stays provisional and unlinkable until a run confirms it | `organisations.manual_entry` |

Each switch is checked **on the server** in the endpoint, not merely used to hide a button.
A disabled capability returns a refusal that names the switch, so an operator who kept a
stale tab open is told why rather than seeing an unexplained failure.

### 7.2 Import algorithm

1. Validate each row: code non-empty and within length, name present, country ISO-2 or null.
   Bad rows are collected and reported; the run continues.
2. Hash the canonical row. Unchanged rows touch `last_seen_at` only.
3. Upsert on the natural key. **Never overwrite portal-owned fields** - links, labels,
   ordering and settings survive every refresh, as the overview mockup promises in its
   provenance line.
4. Snapshot mode only: rows absent from the run become `is_active = false`. Delta mode
   never deactivates by absence. Nothing is ever deleted.
5. **Safety brake.** If a snapshot returns fewer rows than a configured proportion of the
   previous successful run, or the error count exceeds its threshold, apply the upserts but
   **skip all deactivations**, mark the run `partial` and alert operations. A truncated feed
   must never read as "the customer no longer exists".
6. A manual row whose code arrives in a confirmed run is reconciled: source fields adopt the
   source, `source_kind` becomes `feed` or `file`, `is_source_confirmed` becomes true, and
   the reconciliation is audited with both the manual and source values.

### 7.3 What an import may not do

It grants no access, creates no customer, invites nobody, and writes nothing to CargoWise.
Stated in PRD §4a.3 and repeated in phase plan P1.04-C: *"Source organisation import alone
grants nothing."*

## 8. API surface

Proposed routes; confirm against existing conventions before implementation. Every route
carries `@RequirePermission`. Routes marked with a switch are refused when it is off, even
for a caller who holds the permission - the two controls are independent and both apply.

| Route | Permission | Switch |
| --- | --- | --- |
| `GET /v1/admin/organisations` (search, filters, paging) | `admin.organisations.read` | - |
| `GET /v1/admin/organisations/:id` | `admin.organisations.read` | - |
| `GET /v1/admin/organisations/:id/addresses` | `admin.organisations.read` | - |
| `GET /v1/admin/organisations/:id/contacts` | `admin.organisations.read` | `organisations.contacts.import` |
| `GET /v1/admin/organisations/:id/history` | `admin.organisations.read` | - |
| `POST /v1/admin/organisations/imports/file` (multipart, returns a validation report) | `admin.organisations.import` | `organisations.import.file` |
| `POST /v1/admin/organisations/imports/file/:id/commit` | `admin.organisations.import` | `organisations.import.file` |
| `POST /v1/admin/organisations/imports/source` (enqueues the feed job) | `admin.organisations.import` | `organisations.import.feed` |
| `GET /v1/admin/organisations/imports` and `/:id` | `admin.organisations.read` | - |
| `POST /v1/admin/organisations` (provisional manual) | `admin.organisations.create_provisional` | `organisations.manual_entry` |
| `PATCH /v1/admin/organisations/:id` (portal-owned fields only) | `admin.organisations.create_provisional` | `organisations.manual_entry` |
| `POST /v1/admin/customers/:id/accounts` (link) | `admin.organisations.link` | - |
| `POST /v1/admin/customers/:id/accounts/:accountId/approve` | `admin.organisations.link.approve` | `organisations.link.require_approval` |

`admin.organisations.link` already exists. The read, import, provisional-create and approve
codes are new and need seeding. Splitting read from import from link is deliberate: a
Customer Success user who links customers has no reason to be able to reload the directory.

The feature-switch routes themselves belong to the
[feature management plan](Feature-Management-Implementation-Plan.md), not to this one.

Customer-facing surfaces continue to expose no organisation codes at all, per PRD §260 and
the LLD's `GET /customer-accounts`.

## 9. User interface

Follow the supplied mockups for look and structure. Use existing design-system components
throughout: `DataTable`, `Pagination`, `Badge`, `Button`, `Input`, `Select`, `Tabs`,
`SectionHeading`, `StatePanel`, `Dialog` with `side="right"`, and the tightened
administration density already used by lookup management. Tokens only.

### 9.1 Directory list

Mockup 3, with its header status strip retained: last run time, organisation and address
counts, error count, snapshot mode, source instance and next scheduled run. That strip is
the honest answer to "is this data current", and it belongs above the table, not buried in
a tab.

Columns: Organisation (code, source-instance chip, then name, address count and
classifications beneath) · Country and city · CW1 status · Linked customer · Last sync ·
actions. Link state uses the mockup's three chips: **Link confirmed**, **Pending approval**,
**Not linked**.

Two additions the mockups predate, both needed once three sources exist:

- a **provenance chip** per row - `Feed`, `File`, or `Manual · provisional`;
- a **Provisional** filter chip beside the existing All / Not linked / Linked / CW1 inactive
  set, because the first question after a manual entry session is "what have I still not
  confirmed".

The three population actions sit together in the page header as one labelled group rather
than competing for primary emphasis: `Import file`, `Fetch from CargoWise`, `Add manually`.

Each is shown **disabled with its reason** when its switch is off or, for the feed, when no
source is configured - never hidden. An administrator who has just turned manual entry off
should see that it is off, not wonder whether the button ever existed. The reasons differ
and both are useful: *"turned off in Feature management"* versus *"no CargoWise source is
configured"*.

### 9.2 Organisation detail

Mockup 1 and 2. Breadcrumb, code as the heading, CW1 status and link chips beside it,
subtitle carrying name, location, source instance and the words **read-only mirror**.
Tabs: Overview · Addresses · Contacts · Portal link · Sync and history, with counts.

The overview's labelled-field grid is kept as drawn, including its three clarifying hints,
which are load-bearing rather than decorative:

- source branch field - *"CW1 attribute · not the servicing branch"*;
- source parent code - *"evidence only · never an automatic access grant"*;
- provenance - *"portal-owned links, labels and settings are never overwritten by a refresh"*.

**Addresses** keeps the mockup's note that addresses inherit any portal link and that there
is no address-level linking. Since the PRD warns that large customers may have hundreds of
addresses, this list is server-paginated with a purpose filter, not the flat table a
23-row example suggests.

**Contacts** shows a `StatePanel` explaining that contacts are not imported because the
capability is off, rather than an empty grid implying the feed returned nothing.

**Portal link** shows the current link, who made it, when and why, plus the approval action
when that policy is enabled. Before confirming, it states the consequence plainly: linking
grants this customer sight of every shipment and invoice carrying this code.

**Sync and history** lists runs that touched this organisation and the fields that changed,
from `org_change_log`.

### 9.3 Flows in drawers

File import, manual entry and link-to-customer all use right-hand drawers, consistent with
lookup management and the staff screen. The import drawer is a two-step: upload and
validate, then review the report - accepted, skipped, errors by row - and commit. A file is
never applied without the operator seeing what it will do.

## 10. Work packages

Local identifiers. Not new FR numbers.

| Package | Work | Depends on | Exit evidence |
| --- | --- | --- | --- |
| **ORG-01** Tenancy defects | F1, F2, F3: global unique on normalised code, generated `code_norm`, backfill and collision report, `SECURITY DEFINER` write path | - | Isolation test proves one code cannot reach two groups, including under concurrent inserts; case variants collide; runtime role still cannot write the table directly |
| **ORG-02** Source model | F4: extend `master_org`, add `org_address`, `org_registration_id`, `org_contact` (empty), `org_import_run`, `org_change_log`, RLS and grants; the composite link-gate key | ORG-01; ORG-D02, ORG-D07 | Fresh and upgrade migrations, RLS coverage per table, link gate refuses an unconfirmed link at the database |
| **FM** Feature management | Catalogue, table, guard and admin page - **delivered by its own plan**, not by this one | - | See [Feature management implementation plan](Feature-Management-Implementation-Plan.md) |
| **ORG-03** Contract and file import | `OrgSource` interface, file parser, validation report, run recording, safety brake | ORG-02, FM plan; ORG-D03 | Repeat import idempotent; truncated snapshot deactivates nothing; portal-owned fields survive; bad rows reported and run completes |
| **ORG-04** Directory API | List, detail, addresses, history, import endpoints, DTOs and permission seeds | ORG-03; ORG-D04 | 403 test per endpoint; customer context cannot reach any of them; paging and search within budget |
| **ORG-05** Directory UI | List and detail pages, five tabs, import drawer, generated client | ORG-04 | Mockup parity, EN and ES, loading/empty/error/denied states, disabled actions show their reason, axe pass, no page overflow |
| **ORG-06** Manual provisional entry | Create and edit provisional rows, reconciliation on confirmation, gated on `organisations.manual_entry` | ORG-03, FM plan | Provisional row cannot be linked; switch off refuses the endpoint; later import reconciles and audits both values; existing provisional rows survive the switch being turned off |
| **ORG-07** CargoWise feed | `Cw1OrgSource` behind the same interface, job-driven, simulator fixtures | ORG-03, FM plan; **ORG-D06 / OQ-2** | Paging, delta versus snapshot, failure preserves last good data, real-versus-simulator evidence labelled |
| **ORG-08** Link to customer | Link, refuse duplicates, approval seam driven by `organisations.link.require_approval`, visibility re-evaluation, resolver `confirmed` filter | ORG-02, ORG-04, FM plan; ORG-D08 | Duplicate link refused under concurrency; pending link grants nothing; switching approval on mid-flight does not retro-void existing links; re-evaluation audited |
| **ORG-09** Contacts and identifiers | Registration identifiers; contacts gated on `organisations.contacts.import` | FM plan; **ORG-D05** | Repeatable jurisdiction-qualified identifiers; contact import creates no identity or invitation; switch off means not ingested, not merely hidden |
| **ORG-10** Hardening | Performance at the PRD workload, accessibility, operations runbook | ORG-05..09 | List under 2 s at the agreed row count, search under 1.5 s, stale-import alerting proven |

Deliver ORG-01, ORG-02 and ORG-03 through ORG-05 as the first usable increment: a correct,
populated, inspectable directory. The feature management page is a prerequisite for the
optional paths and is delivered separately and first, since it is small and depends on
nothing here. Manual entry, the live feed and linking then follow as their gates clear -
and because each is a switch, enabling one is an administrative act rather than a release.

## 11. Test matrix

| ID | Check | Expected |
| --- | --- | --- |
| ORG-T01 | Same code, two customers | Refused; unique index holds under concurrent transactions |
| ORG-T02 | Case and whitespace variants | `ACME001`, `acme001`, ` ACME001 ` collide on one row |
| ORG-T03 | Two instances, same code | Distinct rows when ORG-D02 says per-instance; no accidental cross-instance match |
| ORG-T04 | Repeat identical import | No duplicates, no spurious change-log rows, `last_seen_at` advances |
| ORG-T05 | Truncated snapshot | Upserts applied, zero deactivations, run marked partial, alert raised |
| ORG-T06 | Delta with absent rows | Nothing deactivated |
| ORG-T07 | Refresh over portal-owned fields | Link, labels and settings unchanged |
| ORG-T08 | Bad rows | Reported with row numbers; valid rows still applied |
| ORG-T09 | Provisional row link attempt | Refused at API and at the database |
| ORG-T10 | Manual row later imported | Reconciled, confirmed, both values audited |
| ORG-T11 | Address-level link attempt | No endpoint, no column, no path |
| ORG-T12 | Addresses inherit link | Visible through the organisation only |
| ORG-T13 | Pending link | Grants no org code to the resolver |
| ORG-T14 | Link, then reassign | Old visibility removed, new created, both audited |
| ORG-T15 | Customer context | Cannot read directory, addresses, contacts, runs or history |
| ORG-T16 | Permission separation | Read cannot import; import cannot link; link cannot approve |
| ORG-T17 | Impersonated session | Cannot import, create, link or approve |
| ORG-T18 | Source deactivated while linked | Link retained, state shown, no silent access change |
| ORG-T19 | Scale | Directory search bounded and paginated at the agreed workload |
| ORG-T20 | Migration and rollback | Backfill preserves codes and links; collision report produced before the unique index is enforced |
| ORG-T21 | Switch off, permission held | Each of the three population endpoints is refused server-side when its switch is off, with the switch named |
| ORG-T22 | Manual entry turned off after use | Existing provisional rows remain readable, reconcilable and unlinked; nothing deleted or hidden |
| ORG-T23 | Approval switch mid-flight | Enabling `organisations.link.require_approval` applies to new links only; existing confirmed links are not retro-voided |

Generic switch behaviour - audit, next-request effect, protected invariants, unknown keys -
is tested by the feature management plan. The three rows above test only this plan's use of
it.

ORG-T20 deserves emphasis. **The unique index cannot be added blind.** The migration must
first report existing duplicate normalised codes across groups, because if production
already contains one, adding the constraint fails and the reason is a live data leak that
needs a business decision, not a retry.

## 12. Decision gates

| ID | Decision | Owner | Blocks |
| --- | --- | --- | --- |
| ~~ORG-D01~~ | **Decided 13.09.2026.** Manual entry is permitted, optional and configurable: an `organisations.manual_entry` switch on the Feature management page, shipped **off**, changeable at any time. Rows created that way stay provisional and unlinkable until a source run confirms them | Product + Security | Closed - implemented by the FM plan and ORG-06 |
| **ORG-D02** | Source namespace: is an organisation code unique globally or only within a CargoWise instance? Decides the natural key. Aligns D-03 | Integration + CW1 | ORG-02 |
| **ORG-D03** | File contract: exact columns, address and identifier representation, who owns the extract, and what makes a file authoritative | Operations + Integration | ORG-03 |
| **ORG-D04** | Final permission codes and preset assignments for read, import, provisional create, link and approve. Aligns D-04 | Security + Product | ORG-04 |
| **ORG-D05** | Which contacts and identifiers may be imported, viewed and retained, and on what legal basis. The switch enforces the answer; it does not substitute for it | Privacy + Master data | ORG-09 |
| **ORG-D06** | Is the CargoWise feed reachable for the pilot - licensed, enabled, which message set, which authentication? Aligns OQ-2 | CW1 team | ORG-07 |
| **ORG-D07** | Accept `org_import_run` and `org_change_log` as a recorded exception to simplification C6 | Engineering + Product | ORG-02 |
| **ORG-D08** | Does linking require a second approver? Aligns OQ-13. Now a switch rather than a code path, so the answer can change without a release - but the default still needs deciding | Sponsor | ORG-08 default |

**OQ-3a remains open and is not decided here.** Whether shipment parties carry organisation
or address codes stays a lookup in the resolver. If the answer is address codes, the feed
must supply the address-to-organisation relationship, which `org_address` is shaped to
hold, and the resolver gains a lookup step - but no address ever becomes linkable.

## 13. Release and rollback

- Collision report clean, or every collision resolved by a business decision, before the
  unique index is enforced.
- All new tables covered by RLS with tested grants; runtime role holds `EXECUTE` on the
  import function and no direct write.
- **Switch states reviewed and recorded as part of the release**, not left at whatever the
  last environment happened to hold. A production release states which capabilities are on
  and who approved each.
- Feed configuration correct per environment; no simulator source in production; the
  `Fetch from CargoWise` action disabled and explained where no feed exists.
- Import failure and staleness observable, with a named operations owner and a documented
  correction path.
- Rollback is forward-only and compensating. **Never delete organisation rows or reuse
  identifiers to undo a release**; a mislinked customer is corrected by an audited
  reassignment with visibility re-evaluation, not by removing evidence.
- A switch is the fastest rollback available for an optional capability: turning one off
  stops the action immediately, everywhere, on the next request, without a deployment and
  without touching data. Prefer it to a hotfix when a capability misbehaves.

**Completion criterion:** staff can populate, inspect and trust the organisation directory
through any of the three approved paths, each independently switchable by an administrator,
and can link an organisation to exactly one customer - while address-level linking,
unconfirmed linking and duplicate ownership all remain impossible rather than merely
discouraged, and remain so whatever the switches are set to.
