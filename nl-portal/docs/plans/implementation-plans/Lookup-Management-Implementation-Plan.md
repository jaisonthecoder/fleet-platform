# Lookup management implementation plan

| Document control | Value |
| --- | --- |
| Version / date | 1.0 / 11.09.2026 |
| Status | Draft implementation plan for review and approval; not implementation evidence |
| Delivery | Phase 1 reference-data foundation and dedicated administration UI |
| Agreed direction | Flexible lookup management, multilingual content, parent-child relationships and an easy-to-manage UI |
| Proposed details | Physical schema, permission codes, endpoint names, dataset inventory and relationship policies remain subject to the decision gates below |
| Owners | Product, Operations, Integration, Engineering, Security and QA; named owners to be assigned |

## 1. Purpose and outcome

Build a reusable **Administration > Lookup management** module for maintaining approved portal lookup values and inspecting imported reference data. Onboarding, quotation and pricing screens consume consistent server-validated options instead of independent hard-coded lists.

The module supports flat lists, hierarchical lists, dependent selections, EN/ES translations, controlled maintenance and historical traceability. Flexibility means adding approved data and translations without changing each screen. It does not mean administrators can invent executable business rules or make an arbitrary category appear automatically in a form.

This task produces a plan only. Approval of the UI direction does not approve every proposed dataset, database table or operational policy. Do not change the production schema, FR counts or governing requirements solely on the authority of this document.

## 2. Sources and reconciliation

| Source | Application to this plan |
| --- | --- |
| [Repository rules](../../../CLAUDE.md) | App-local contracts/design system, permissions, RLS, integration jobs, generated client, audit and no Redis |
| [Phase 1 sequence](../../Project-Kickoff-and-Phase1-Plan.md) | F1.03 access foundations, F1.04 shell, F1.05 mappings and source integration; consumers in F1.06-F1.08 |
| [PRD v4.0](../../PRD-Noatum-Customer-Platform.md) | Quotation reference fields and daily CW1 master-data integration |
| [Functional requirements](../01-Functional-Requirements.md) | FR-QTE-001/002 quotation inputs, FR-QTE-019 configured rejection reason, FR-SYS-004 mappings; organisation and configuration boundaries |
| [Non-functional requirements](../02-Non-Functional-Requirements.md) | Accessibility, localisation, performance, security and operational acceptance |
| [Simplification register](../../Simplification-Register.md) | MasterDataService boundary, PostgreSQL rather than Redis, no unnecessary approval/import-history machinery |
| [Requirements baseline and decisions](../README.md) | D-03 integration identity, D-04 permissions, D-07 workload, D-10 localisation, D-14 later mappings and D-18 policy scoping |
| [Organisation research](../08-Customer-Organisation-and-Access-Research.md) | Source-owned organisations/addresses and separately governed operating structure |
| [Design system](../../noatum-designsystem.md) | Existing Noatum components, tokens, typography and accessible interaction patterns |

Observed implementation anchor: [schema.prisma](../../../apps/noatum-customer-portal-api/prisma/schema.prisma) contains `MappingEntry` with `domain`, `portalCode`, `cw1Code`, notes and update time. It has uniqueness on domain plus portal code, but does not itself express source-instance identity, mapping direction, translated lookup items or hierarchical relationships. Reconcile and extend the existing mapping design where necessary; do not create a second competing mapping store. This is a narrow schema observation, not a full implementation audit.

**Conflict to resolve:** simplification-register D5 currently keeps rejection reasons as an enum. Moving approved reasons into editable lookup data requires explicit reconciliation and migration of existing references. Do not silently replace an enum or add a separate rejection-reason table. Similarly, adding this dedicated UI must be recorded as an agreed expansion of the earlier minimal administration approach before code implementation.

## 3. Scope and boundaries

### Phase 1 delivery

- Dedicated category catalogue, item workspace and item editor, using shared components.
- Stable identifiers/codes, translated labels and descriptions, display order and active/inactive lifecycle.
- English and Spanish initially, with locale-keyed storage that can accept additional approved languages without schema columns per language.
- Flat or hierarchical categories, configured parent rules and dependent dropdown filtering.
- Explicit applicability relationships where one option is valid for several modes/services.
- Source-owned/read-only datasets alongside editable portal-owned datasets, with clearly different actions.
- Server-side search, pagination, validation, audit, optimistic concurrency and safe deactivation.
- Reuse of integration mapping, sync status and error/replay capabilities where applicable.
- Migration of approved Phase 1 dropdown consumers to the common reference-data access boundary.

### Not included

- Generic form builder, arbitrary scripts, visual schema designer or unlimited custom attributes.
- Rate tables, automatic pricing, CRM, new identity management, Redis or another job runtime.
- Generic approval inbox, mandatory four-eyes editing or bulk file import/export without a confirmed operational requirement.
- Customer-specific lookup overrides or global/region/branch/customer inheritance until scope rules are explicitly approved.
- Replacing organisation, customer, address-book, staff, role or quotation-policy management screens.
- Editing workflow transitions, security permission codes, calculations or implemented transport-mode behaviour as lookup rows.
- Completing Phase 2 event/document configuration before its business lists and visibility rules are approved.

## 4. Lookup catalogue and ownership

Complete and approve a register before implementing each dataset: category code, business owner, authoritative source/version, source namespace, consuming fields, required locales, editable fields, relationship rules, selection rules, refresh schedule and retirement behaviour.

| Candidate dataset | Ownership and maintenance | Phase 1 treatment |
| --- | --- | --- |
| Countries, currencies and quotation locations | Approved CW1 extract/reference source or licensed standard dataset; do not combine sources implicitly | Required where used by onboarding/quotation; search large location lists; preserve code system such as UN/LOCODE versus IATA |
| Incoterms | Approved edition/source and supported business subset | Confirm supported edition, labels and validation; no invented standard codes |
| Units, package and equipment types | Approved reference source and supported mode-specific subset | Confirm exact lists used by cargo forms; lookup editing cannot change calculation semantics |
| Charge codes | CW1-owned source codes mapped to canonical charge concepts | Required for agreed pricing/write-back paths; no prices or rate management in lookup records |
| Quote-rejection reasons | Portal-owned only after resolving the enum conflict | Candidate editable category with approved EN/ES labels and history-preserving migration |
| Source status mappings | Source-qualified mappings to implemented canonical states | Expose permitted mappings; do not allow creation of new quote states |
| Event/document mappings | Source mappings with specialised visibility rules | Keep planned foundation; detailed business configuration follows Phase 2; events use exclude-list, documents allow-list |
| Organisations, addresses and branch/company records | Existing domain/source ownership | Reuse references and link to their owning screens; do not copy them into generic lookup items |
| Transport modes, permissions and publication policies | Implemented domain contracts or dedicated settings | Protected values or links to owning settings; never unrestricted lookup CRUD |

Imported source status and portal availability are separate concepts. A portal availability control may narrow an approved supported subset where authorised; it must not silently reactivate a source-inactive record or overwrite source fields. The eligibility policy is a decision gate.

## 5. Proposed logical data design

Confirm the physical model in a scoped LLD before migrations. Prefer reusing an existing suitable domain model. The following are logical responsibilities, not an instruction to create one table per row.

| Responsibility | Minimum information / constraints |
| --- | --- |
| Category definition | Stable code, ownership mode, default locale, required locales, flat/hierarchical behaviour, permitted parent categories, maximum depth and protected maintenance capabilities |
| Item identity | Stable ID, category, immutable canonical code, availability, order, version and timestamps; source identity only when imported |
| Content translation | Item ID, locale, label and optional description; unique item/locale; category display names translated using the same approach or existing i18next keys where deployment-managed |
| Parent relationship | Optional parent ID for a true single-parent tree; allowed category pairing and depth enforced; indexed parent access |
| Applicability | Explicit allowed relationships for approved many-to-many dependencies; add a join model only where a real Phase 1 consumer requires it |
| Source mapping | Reuse/evolve MappingEntry; source namespace, domain, direction and approved cardinality; stable target reference where applicable |
| Change/sync evidence | Reuse AuditEvent and existing integration/job records; no generic approval table or duplicate import-run history by default |

### Identity, hierarchy and lifecycle invariants

1. Labels are not identifiers. Code normalisation and uniqueness are defined per category/source; do not indiscriminately uppercase every source value. Locale identifiers are normalised consistently.
2. Codes become immutable once referenced. Correct an identity through an approved replacement/remapping process, not a label edit disguised as a code change.
3. Reject self-parenting, cycles, invalid parent categories, excess depth and references to unavailable parents where the category forbids them. Enforce these inside transactions with locking or serialisation sufficient to reject concurrent cycle creation.
4. Tree relationships and applicability are different. A single-parent hierarchy cannot represent an option valid for several transport modes. Use typed, bounded applicability relations instead of duplicating the option.
5. Lookup parentage grants no customer visibility, role inheritance or policy precedence. CustomerGroup hierarchy rules remain unchanged.
6. No cascading hard deletion of referenced values. Default maintenance is deactivation; retain existing references and audit history. Never repurpose an old code for a new meaning.
7. Deactivating/moving a parent requires a dependency check and an explicit policy. Proposed Phase 1 default: block when active children would become invalid; no silent recursive deactivation.
8. Category structural changes are deployment-controlled initially. Admins maintain permitted content; changing parent rules, source ownership or required semantic fields needs a reviewed migration/configuration change.

### Historical records

- New selections use current eligible values. Historical details resolve retired values without making them selectable for new work.
- Draft submission revalidates all selected values and combinations. Preserve an invalid draft selection visibly and request correction; never replace it automatically.
- Published commercial snapshots and generated documents retain the codes, labels/locales and applicable dataset or mapping revision needed to reproduce what was published. A translation edit must not rewrite a historic accepted quote/PDF.
- Use existing quote-version and job-message snapshot facilities where possible; do not snapshot every lookup table on every edit.

## 6. Multilingual behaviour

- Store lookup-content translations separately from UI text. UI controls use i18next; lookup labels come from the API for the selected supported locale.
- Proposed fallback: requested locale, then category default locale. Return the actual resolved locale/fallback indicator; show missing translations explicitly in administration.
- Proposed activation gate: all required locales for portal-managed customer-visible items must be complete. Imported datasets retain original source labels; Operations approves whether untranslated source names are acceptable before their release.
- Search matches stable codes and supported translated labels with documented case/accent behaviour. Index and benchmark the chosen query rather than loading all translations into the browser.
- Keep EN/ES fields side by side for the initial release; additional locales use a selector or translation table, not permanent columns for every language.
- Adding a content locale does not by itself launch the entire application in that language. UI catalogue, formatting, accessibility and any RTL support need separate readiness checks.
- No automatic translation service in Phase 1. Any future automated translations need source/version/confidence, human review and reasoned override under the repository's provenance rule.

## 7. Administration UI and experience

Navigation: **Administration > Lookup management**. Use existing design-system components, tokens and permission-aware navigation. Avoid large dashboard cards or explanatory architecture panels.

| Screen | Content | Main interactions |
| --- | --- | --- |
| Category catalogue | Name, ownership/source, item count, translation completeness and last change/sync | Search/filter; open category; link to source/domain owner; no unrestricted Create category action |
| Category workspace | Searchable paginated items, code, translated label, parent path, status and source indicator | Add permitted item, edit, filter, reorder and inspect history; table default; optional tree for hierarchical categories |
| Item editor | Details, Translations, Relationships and History tabs | Save/cancel, inline validation, searchable parent/applicability pickers, reason for changes, conflict resolution |
| Mapping workspace | Source namespace/code, canonical target, permitted mapping direction and conflict status | Validate/edit mapping with reason; link to affected integration records and existing replay tools |
| Sync/history detail | Last successful refresh, current outcome, counts, rejected records and audit history | Inspect errors; authorised retry through integration job controls, not direct browser-to-CW1 calls |

### Interaction rules

- Keep selection, filter and pagination when closing an item editor. Use a side panel on desktop and an accessible full-width presentation on mobile.
- Show only fields supported by the category. Stable IDs, ownership flags and protected source codes are not ordinary editable text fields.
- Searchable parent selectors show full paths so duplicate labels are distinguishable. Loading a tree must not load the full world location catalogue; load children on demand.
- Reordering must support keyboard-accessible move controls, not drag-and-drop alone. Define whether ordering is category-wide or sibling-local, and use stable code/ID tie-breakers.
- Provide labelled inputs, visible focus, accessible status text, focus return and keyboard navigation. Do not communicate source protection or inactive status through colour alone.
- Detect unsaved edits. A stale-version save shows a conflict and the latest record; never silently overwrite or merge sensitive relationship changes.
- Deactivation/reparenting confirmation shows affected children, known references and selection consequences. Recheck dependencies server-side at commit; the preview is not an authorisation token.
- Include loading, empty, no-results, unavailable-source, permission-denied and error/retry states. Imported data remains distinguishable from editable portal data.
- Validate supported viewports for text fit, panel/table containment and no document-level overflow. Follow existing Noatum visual language rather than introducing a new admin theme.

## 8. API, access and dropdown consumption

Proposed API families below are contract-design inputs. Confirm exact routing against existing conventions before implementation; every route requires a declared permission.

| Purpose | Proposed route family / behaviour |
| --- | --- |
| Administration catalogue | `/v1/admin/lookups/categories` and category detail; permitted metadata only |
| Administration items | `/v1/admin/lookups/categories/:categoryCode/items`; paginated reads and authorised writes |
| Item maintenance/history | `/v1/admin/lookups/items/:id`; versioned update, translations/relationships and audit view; avoid duplicate patch endpoints unless necessary |
| Application options | `/v1/lookups/:categoryCode/options`; bounded search, locale, parent/applicability context and eligible options only |
| Mapping administration | Existing integration mapping surface, extended where necessary; do not introduce a parallel source of truth |

### Security and storage rules

- Proposed capabilities are lookup administration read, item maintenance, translation maintenance and mapping maintenance; final permission codes/preset assignments are gated by D-04. Do not authorise by role name.
- Administration endpoints are internal-only and permission-protected. Customer users receive only explicitly approved option projections through their consuming feature's permission and CustomerGroup feature flag checks.
- Customer-safe reads must exclude source credentials, raw mappings, internal charge classifications, audit metadata and other internal-only content. Admin read permission is not required merely to fill an authorised quotation form.
- Tenancy remains in repositories and Postgres RLS. Global reference data is not falsely assigned to a customer. Use explicit safe-read/internal-write policies for global data, internal-only policies for mappings/admin data, and tenant policies for any genuine customer-owned records. Document grants for translation/relationship tables as well as roots.
- Derive customer context from authenticated identity, never client-supplied group ownership. Whitelist permitted category access; a category parameter must not become access to an arbitrary table.
- All write, activation, parent, applicability and source-ownership checks run on the server. Use optimistic versions and transactional checks to handle concurrent edits/deactivation/submission.
- Enforce read-only impersonation and next-request permission revocation. Record AuditEvent for significant writes and AnalyticsEvent for agreed user actions without unnecessary sensitive labels.

### Consumer contract

Return stable ID/code, localised label, resolved locale and only necessary parent/applicability information. Keep admin metadata out of the option DTO. Generate the SPA client from OpenAPI; never copy backend interfaces into the frontend.

Use MasterDataService as the common backend reference-data access boundary, with domain services retaining their own business validation. TanStack Query keys include category, locale, filters and relevant authenticated context. Clear sensitive query state on identity/context changes and invalidate affected options after maintenance. Server-side save validation remains authoritative even if a browser holds stale options.

Changing a parent clears or marks an incompatible child selection and prompts the user to select again. Do not silently pick the first child. Large lists use server-side search/pagination; avoid one endpoint per dropdown field and avoid unbounded downloads. No Redis is introduced.

## 9. Source integration and mapping safety

- Confirm actual CW1 payloads, dataset coverage, namespaces, authoritative sources and source licensing before building imports. A source name in a mockup is not an integration contract.
- Imports run as idempotent integration jobs with explicit real/simulator configuration. Simulator data is dev/test only, never a production fallback.
- Preserve stable identity across refreshes. Refreshes update only source-owned fields and must not erase portal translations, ordering or availability settings that the approved ownership rules reserve to the portal.
- Validate a dataset/batch before publishing changes. Preserve the last consistent selectable dataset on import failure; expose stale status and alert Operations.
- Distinguish a full snapshot from a delta. Absence from an incomplete response must not trigger mass deactivation. Source retirement behaviour requires an approved rule and history preservation.
- Mapping uniqueness must respect source namespace, domain and direction. Do not assume a bijection: multiple source codes may map to one canonical value, while outbound ambiguity must block unsafe writes.
- Quarantine unresolved mappings and ownership conflicts through the existing integration flow. Correcting a mapping does not silently replay messages or reinterpret completed jobs; replay is authorised and audited with the effective mapping revision recorded.
- Reuse existing job, message and audit facilities. Do not add a dedicated sync-history or approval subsystem unless evidence demonstrates a missing capability.

## 10. Delivery work packages

Local IDs LM-01 through LM-08 below are planning identifiers, not new approved FR IDs. Sequence: decisions, database, contracts, API/tests, OpenAPI, UI, consumer adoption and release.

| Package | Work and proposed file surfaces | Dependencies | Exit evidence |
| --- | --- | --- | --- |
| LM-01: catalogue and LLD | Approve register and decision gates; reconcile affected simplifications; specify logical/physical model, policies and consumer list in scoped docs | Product/Operations and source evidence | Signed dataset/ownership matrix; no unresolved gate for the next package |
| LM-02: data and migrations | `apps/noatum-customer-portal-api/prisma/schema.prisma`, new forward-only migrations, verified seeds; reuse MappingEntry and domain records | LM-01; F1.03 tenancy/permissions | Fresh/upgrade migration tests, RLS/grant checks, legacy-reference backfill and compensating rollback rehearsal |
| LM-03: contracts and API | `apps/noatum-customer-portal-api/src/contracts`, `apps/noatum-customer-portal-api/src/modules/lookups/`; MasterDataService placement confirmed locally; permission constants/seeds | LM-02 | DTO/zod contracts, business invariants, concurrency, 403 and isolation tests pass |
| LM-04: imports and mappings | `apps/noatum-customer-portal-api/src/integration/`; adapter/job extensions; simulator fixtures only as required | LM-03 and F1.05 source contract | Idempotent refresh, source ownership, failed-import preservation and mapping/replay tests |
| LM-05: generated client and UI | Regenerate `apps/noatum-customer-portal-ui/src/api/generated`; add `src/features/lookups/` API hooks, components, pages and EN/ES; reuse shell/design-system components | LM-03 contract stable; F1.04 shell | Catalogue/editor/tree/table workflows, accessibility, translations and conflict states verified |
| LM-06: dropdown adoption | Only approved onboarding/quotation/pricing consumer files; replace duplicated option sources without changing business semantics | LM-04/05 readiness for each dataset | API-backed dependent selects; draft revalidation and historical rendering work end to end |
| LM-07: hardening and UAT | Existing API isolation/e2e and portal e2e suites, scoped performance fixtures and ops guidance | LM-06 | Security, performance, accessibility and Operations acceptance evidence |
| LM-08: controlled release | Validated production datasets/mappings, release configuration, monitoring, support/rollback runbook | All relevant gates passed | Pilot acceptance, last-good-data recovery and deployment checklist signed |

File surfaces are proposed, not verified existing files. Inspect nearby implementations before creating anything; keep apps independent and reuse existing test helpers. No schema/API/UI files are created by this document.

Deliver the first vertical increment with an approved portal-owned flat category, translations and one consumer. Validate it before adding hierarchy/applicability and source imports. If no portal-owned category has cleared its gate, use a verified read-only reference category first rather than inventing a demo business classification.

Plan alongside F1.05 and before dependent F1.06-F1.08 forms are accepted. Mapping/source work can proceed independently of visual editor polish once contracts are stable. Estimates and staffing are assigned after LM-01; this plan does not invent a committed schedule.

## 11. Test and acceptance matrix

| ID | Check | Expected result |
| --- | --- | --- |
| LM-T01 | Item identity and duplicates | Category/source-specific normalisation enforced; duplicate identities rejected; labels can repeat where permitted |
| LM-T02 | Translations | EN/ES creation/edit/search, fallback indication and required-locale activation checks behave as approved |
| LM-T03 | Locale extensibility | Additional fixture locale requires no new data columns; unsupported application locale is not implicitly enabled |
| LM-T04 | Hierarchy | Valid parent/child path works; self-parent, cycle, invalid type and maximum-depth violations fail |
| LM-T05 | Concurrent hierarchy edits | Two individually plausible concurrent updates cannot commit a cycle or violate depth constraints |
| LM-T06 | Applicability | Shared option works for multiple approved contexts; unsupported parent/mode/service combinations fail server validation |
| LM-T07 | Retirement | Used item cannot be destructively deleted; parent dependency policy enforced; inactive items remain readable historically |
| LM-T08 | Historic commercial output | Label/mapping edits do not rewrite previously published snapshots or accepted documents |
| LM-T09 | Draft and stale client | Retired/incompatible selection is preserved for correction and rejected on submit, never silently substituted |
| LM-T10 | Endpoint permissions | At least one 403 test per endpoint; forged category/source access rejected; read-only impersonation cannot mutate |
| LM-T11 | Data-layer isolation | RLS tests per new entity including translations/relations; customers cannot read admin/source-only metadata or another tenant's domain options |
| LM-T12 | Revocation and flags | Permission/feature revocation applies on the next request, even with cached dropdowns/open editors |
| LM-T13 | Concurrency | Stale version save rejected; translation, reparent and deactivation races do not lose changes |
| LM-T14 | Audit | Significant changes include actor, reason, before/after and version; replay/refresh evidence traceable without unnecessary sensitive content |
| LM-T15 | Source imports | Duplicate delivery idempotent; failed/incomplete refresh preserves last good data; source refresh preserves portal-owned fields |
| LM-T16 | Mapping identity | Namespaced code collisions handled; allowed inbound many-to-one works; ambiguous outbound mapping blocks unsafe writes |
| LM-T17 | Mapping correction/replay | Unknown code quarantined; authorised correction and explicit replay use recorded revisions without duplicating business effects |
| LM-T18 | UI and accessibility | Create/edit/translate/reparent/deactivate flows, keyboard/focus, axe checks, error states and supported viewport screenshots pass |
| LM-T19 | Scale | Large category/tree search is bounded and paginated; translation search and deep/wide hierarchy tested against approved workload |
| LM-T20 | Migrations and recovery | Fresh/upgrade/backfill preserve existing codes/references; RLS survives deployment; tested compensating migration/recovery path |
| LM-T21 | End to end | Docker Compose plus simulator: admin change/refresh, localised consumer selection, save validation and historical read verified |

Use the repository's `pnpm test` and `pnpm lint` gates plus relevant typecheck, OpenAPI regeneration, isolation, browser and performance checks. Select concrete commands from current app scripts when implementation begins; do not claim a test passes from this plan alone.

Inherited budgets: list endpoints under 2 seconds at the PRD's 100k-row workload, search under 1.5 seconds and wizard-step interaction under 300 ms. Adapt the reference-data distribution to the catalogue and agree percentile/concurrency under D-07; do not label an unapproved percentile as a PRD requirement.

## 12. Decision gates

These local decision IDs do not renumber or resolve existing D/OQ entries.

| ID | Decision | Accountable owner | Required before |
| --- | --- | --- | --- |
| LM-D01 | Exact Phase 1 dataset inventory, source/licensing, ownership and editable fields | Product + Operations + Integration | Dataset schema/import/consumer implementation |
| LM-D02 | Editable rejection reasons versus existing enum; code mapping and historic migration; record simplification reconciliation | Product + Pricing + Engineering | Rejection-reason implementation |
| LM-D03 | Required locales, fallback, source-name exceptions and translation review ownership; align D-10 | Product + Operations | Activation/localisation implementation |
| LM-D04 | Parent/category matrix, depth limits, applicability, reparenting and parent-retirement policy | Operations + Engineering | Relationship implementation |
| LM-D05 | Global/shared access, permitted option projections, admin capabilities and grants; align D-04 | Security + Product | RLS and endpoint implementation |
| LM-D06 | Source namespace, snapshot/delta semantics, sync schedule, missing-source handling and mapping cardinality; align D-03 | CW1 + Integration | Import/mapping implementation |
| LM-D07 | Any regional/customer subset override and precedence; no implied customer inheritance; align D-18 | Product + Operations | Any scoped override implementation; otherwise remain deferred |
| LM-D08 | Supported workload, percentile, stale-data thresholds, operational owner and release targets; align D-07 | QA + Engineering + Operations | Performance tests and pilot release |

Open OQ-3a organisation/address resolution stays in its owning integration design. This lookup module does not decide shipment-party identity, region structure, financial scope or document visibility.

## 13. Release and rollback checklist

- Approved catalogue and resolved gates for every released dataset; pending datasets remain explicitly out of the released subset.
- Reviewed migrations/backfills, no orphaned references, all tables covered by RLS, tested read/write grants and explicit permission seeds.
- Correct source configuration, approved seeds/versions, no simulator fallback in production and successful initial import where required.
- Generated OpenAPI client, EN/ES UI/content readiness, accepted admin UX and consumer workflows.
- Unit, isolation, 403, concurrency, lint, accessibility, browser, performance and integration evidence attached to the release.
- Audit/analytics configured; failed/stale refreshes observable; named support owner and correction/replay runbook.
- Disable administration writes independently from consumer reads during an incident. Retain last consistent reference data and historical resolution; do not restore stale permissions or authorise invalid selections as a fallback.
- Use forward-only compensating migrations and application compatibility checks for rollback. Do not delete lookup records or reuse IDs to roll back a release. Rehearse restoration/recovery against the approved retention and recovery policy.

**Completion criterion:** authorised staff can maintain approved lookup content, translations and relationships through the UI, while customer-facing forms consume valid, localised options and all source ownership, history, access and business-rule protections remain intact.
