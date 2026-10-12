# P1.07 - Lookups, features and settings

Status: planned; detailed values/scopes require approval. Version 1.0, 11.09.2026. Follow the [shared procedure](README.md) and [dedicated lookup implementation plan](../Lookup-Management-Implementation-Plan.md).

## Outcome and dependencies

Authorised internal administrators can maintain approved lookup content, translations, relationships, customer entitlements and business settings through a usable UI. Customers and staff consume valid reference options and deterministic policy revisions. This completes the administration foundation before quotation submission.

Depends on P1.03-P1.06. Gates: lookup LM-D01 through LM-D08, D-04 grants, D-10 locales, D-12 commercial rules, D-13 disclosure/tier defaults and D-18 setting-to-scope matrix. Direct-publication support requires governing-source/ADR reconciliation. Simplification D5 rejection-reason enum must be reconciled before introducing editable reasons.

Trace: FR-CFG-001 through FR-CFG-008, FR-ORG-001/009, FR-NAV-003/005, FR-SYS-004, FR-QTE-019 lookup dependency; NFR-REL-005, NFR-ARC-005, NFR-UX, NFR-SEC-004/005/006, NFR-DAT-003. Lookup scope is the user's planning direction, not a newly assigned FR family.

## Vertical slices

### P1.07-A - Lookup catalogue, translations and maintenance

- Approve category register: owner/source, stable codes, consumers, required locales, editable fields, scope and retirement rules. Candidate Phase 1 countries/currencies/locations/Incoterms/cargo units/equipment/charge codes need verified sources; rejection reasons need conflict resolution.
- DB: reuse appropriate reference/domain models and MappingEntry; add logical category/item/locale responsibilities only where needed. Stable identity independent of display labels; uniqueness per category/source. Global references receive explicit safe-read/internal-write RLS, not fictitious tenant ownership.
- API: permitted internal catalogue/item maintenance, versioned writes, translation edits and audit; separate safe bounded option projection for consuming features. No arbitrary table/category access from user input.
- UI: category catalogue, searchable item workspace and compact item editor; EN/ES side-by-side, completeness indication, active/inactive and order, protected-source badges, save/cancel/reason/history.
- Tests/demo: maintain an approved portal-owned category in EN/ES; duplicate codes, missing required translations, stale save, unauthorised edit and source-code overwrite fail; customer option response omits admin/internal metadata.

### P1.07-B - Parent-child and dependent options

- DB/service: true single-parent hierarchy with allowed category pairing/depth; explicit many-to-many applicability only for approved mode/service dependencies. No generic graph builder.
- Invariants: no self-parent/cycle/orphan; concurrent relationship updates cannot commit an invalid tree. Deactivate/move parent requires dependency checks and approved consequences, not silent cascades.
- UI: optional tree beside table, searchable parent selector with full path, on-demand children and keyboard-accessible ordering. Dependencies clear/flag invalid child selections rather than choose a replacement silently.
- Localisation: requested locale/default-locale fallback is explicit; activation requires approved translation completeness. Source names preserve original script; future locale support does not imply full application/RTL readiness.
- Tests/demo: filtered child dropdown and option shared across valid modes; invalid pairing, concurrent cycle, inactive parent, stale consumer options, long translations and large searchable trees.
- Historical protection: deactivation removes new selection eligibility but preserves old quote references; published content retains its snapshot. No source-refresh overwrite of portal-owned translations/order/availability.

### P1.07-C - Customer feature management

- Model: reuse CustomerGroup feature flags and approved tier defaults. Customer entitlement, permission and release readiness remain separate; no new entitlement service or tier-designer table by default.
- API/UI: authorised feature catalogue/view and customer feature update; explain effective eligibility through structured fields, not duplicated toggles on unrelated pages. Confirm reason/affected customer and retain before/after audit.
- Rules: neither Customer Admin nor pricing staff gains feature-change permission implicitly. Enabling a customer entitlement cannot launch unimplemented Bookings/Claims, CO2 or a live rate source. Revocation applies on next request, including direct URLs/API.
- Avoid duplication: customer carrier disclosure belongs to its approved quotation policy, not two independent switches; customer detail links to the owning editor.
- Tests/demo: entitlement plus permission matrix, tier-default application versus existing overrides, future release state, malicious direct update, concurrency and immediate access loss.

### P1.07-D - Approved general settings and operational configuration boundary

| Setting area | UI owner / implementation boundary |
| --- | --- |
| Invitation expiry and resend limits | Approved internal access settings; default expiry seven days; no customer bypass of domain policy |
| Impersonation duration | Approved internal support setting; default 60 minutes; cannot enable writes |
| Customer domains, tier and hierarchy | Existing customer administration, not a duplicate global settings engine |
| Branch/region membership and readiness | Operating structure under approved model; no automatic user/customer reassignment |
| Source code mappings and sync diagnostics | Lookup/integration ownership; source identifiers and replay permissions retained |
| Quotation policies and approved templates | Slice P1.07-E; common version/history contract |
| User locale, dashboard and personal preferences | Own-profile or feature-owned settings; not global administrative overrides |
| Secrets, endpoints, deployment flags, identity security and retention configuration | Environment/Key Vault/IaC and controlled operations; not free-text business settings fields |
| Event/document rules, report schedules, claims/sailing settings | Foundations only where already required; business editors follow their later modules |

- Create a finite settings register: key, owner, type/unit, allowed range, default, scope, permission, historical effect and audit sensitivity. Reuse suitable configuration storage; no arbitrary key/value or scripting editor.
- UI: settings catalogue/groups with correct controls, current/effective values, change reason and history. Provide only approved editable settings; deployment values may have authorised health/status links, never exposed secrets.
- Tests/demo: expiry/timebox policy changes affect the approved lifecycle boundary, not already issued artefacts silently; invalid values/scopes and concurrent saves rejected. Do not invent undocumented defaults to complete a form.

### P1.07-E - Versioned quotation policy and effective scope

- Policies: direct/CW1-confirmed publication; independent initial unpriced-request sync; approval enablement/approved thresholds and currency evaluation; claim expiry/force-release grants; approved cost capture, carrier disclosure, validity/terms; email templates/drafting enablement and quotation availability.
- DB/contracts: minimal versioned policy, effective-scope result, quote/version policy reference and audit. Scope resolver follows signed D-18 rules for platform/region/branch/customer and multi-branch customers; do not assume a universal precedence chain.
- API/UI: scoped view/update/history, inherited source, explicit override/removal, effective preview, confirmation/reason and stale-version conflict. Field types/ranges/units derive from approved contracts.
- In-flight behaviour: new requests use current effective revision; existing requests retain theirs absent separately approved audited re-evaluation. Policy snapshots never retain revoked permissions. Existing-data initial revision assignment needs a migration decision.
- Protections: settings cannot disable RLS, authorisation, branch scope, exclusive claim, audit, approval independence when required, cost privacy, accepted immutability or human email send. Missing/ambiguous policy blocks the affected transition.
- Tests/demo: default/override/removal and two-branch conflict cases, direct versus confirmed setting, independent approval/request-sync switches, scope denial, stale-save rejection and no automatic pending publication or queued-job reinterpretation.

## File boundaries and acceptance

Inspect API contracts, permission seeds, customer/configuration/reference/integration modules and Prisma; add minimal lookups/settings modules only where existing owners are unsuitable. Generate the client before portal feature hooks/screens. Full suggested schema, API, lifecycle, imports and 21 lookup tests are in the linked dedicated plan; do not fork those rules.

Deliver category/settings registers, approved source/scope decisions, admin screen tests, customer-safe dropdown contract, source-refresh protection and deterministic policy tests. All settings/lookup writes audited with concurrency checks. Accessibility includes keyboard tree/selectors and translations.

Next: [P1.08](08-Customer-Quotation-and-Shared-Tools.md). No customer request may submit using an invented temporary publication/approval policy.
