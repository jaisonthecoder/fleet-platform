# P1.05 - Operating structure and staff management

Status: planned; operating catalogue and region decisions gated. Version 1.0, 11.09.2026. Follow the [shared procedure](README.md).

## Outcome and entry gates

Authorised administrators manage the agreed employee-access lifecycle and assign valid Noatum branches without creating source organisations or an HR system. Additional branches/regions must be supported through approved configuration, not hard-coded pilot values.

Depends on P1.03 and P1.04's source contract. Gates: D-04 grants, D-16 pilot/operating ownership, D-18 region and multi-branch policy model. The [organisation research](../../08-Customer-Organisation-and-Access-Research.md) distinguishes customer offices, source companies, operating branches and regions.

Trace: FR-IAM-003/009/010, FR-ORG-009, FR-CFG-001/002/005 permission foundation, FR-NAV-002/005; NFR-SEC-004/005/006, NFR-ARC-005, NFR-REL-005, NFR-UX catalogue.

## Vertical slices

### P1.05-A - Operating branch catalogue and readiness

- DB/contract: source-qualified branch/company identity, approved portal association/readiness attributes and provenance; reuse imported domain records where available. Do not derive branch ownership from a customer address.
- Source choice: imported read-only branch catalogue when confirmed; otherwise an explicitly approved maintained reference list with reconciliation owner. Never invent a CW1 branch code or write it back from the portal.
- API/UI: internal branch list/detail with source, country, active state, assigned staff and links to effective settings; source fields read-only. Configuration actions only for portal-owned fields.
- Region: implement a managed region view only after membership/lifecycle/overlap and policy precedence are approved. Otherwise use the approved branch catalogue/label approach; do not pretend a label implements regional policy.
- Readiness: integration mappings, authorised pricing staff and required policy completeness, not available automatic rates. Final policy values arrive in P1.07.
- Tests/demo: two branches can be represented/configured without code changes; same branch code in different source namespaces cannot collide; inactive branch selection follows approved policy.

### P1.05-B - Staff directory, detail and role/branch assignment

- DB: use registered staff identities, approved role assignments and branch reference; no duplicate employee record or CW1 role import.
- API: paginated staff search/detail, approved role/branch update with version/impact checks, assignment audit. Exact routes/codes follow existing user module conventions.
- UI: staff list with access state, branch, roles and permitted activity; detail with roles/branch, effective access and history. Unassigned staff are visible to authorised administrators, not self-assigning.
- Controls: show allowed presets and action implications; union of roles; explicit cross-branch, cost/restricted and settings grants. No free-form permission strings, custom role designer or credentials/MFA fields.
- Tests/demo: administrator grants a registered employee branch-scoped pricing; same token gains only the approved actions next request; another branch remains denied; hidden controls cannot be bypassed by API.

### P1.05-C - Staff access removal, reactivation and reassignment

- API: authorised deactivate/reactivate and branch/role changes with reason, optimistic version and audit. Retain identity/history rather than deleting records; Entra account lifecycle remains outside the portal.
- Rules: deactivation and role/branch removal deny next-request access, including existing sessions and queued sensitive deliveries. Reactivation restores only valid approved assignments under the decided policy, never new grants implicitly.
- Open disposition: decide handling of an active pricing claim when staff lose access. Access revocation is immediate; automatic claim release/reassignment is not assumed. Provide existing authorised force-release once P1.09 is available.
- Administrative safety: define recovery if administrative assignments are removed using the approved bootstrap/support procedure; do not invent a new public emergency-access endpoint.
- UI: confirm affected user/branch/grants, clear result/error state and history; stale edits cannot overwrite a colleague's change.
- Tests/demo: remove access while a screen is open; save/read fails appropriately. Reactivation/branch reassignment, concurrent updates and read-only impersonation cannot bypass policy.

## File boundaries and screen contract

Reuse API user/role/branch or master-data modules, contracts, tenant repositories and migration patterns; portal staff/operating feature folders, generated hooks and EN/ES. Exact physical model for regions is a decision, not implied by a menu label.

Screen inventory for later mockups: Branch list/detail; optional approved Region view; Staff list; Staff detail/assignment; lifecycle confirmation; authorised history. Table/filter controls need loading/empty/no-results/error/denied states and keyboard access.

## Acceptance and exclusions

Demonstrate two employees/two branches, unassigned registration, audited assignment, cross-branch grant, removal and reactivation. Include 403 tests per endpoint, source ownership tests and concurrency. Branch scope must not accidentally restrict later internal tracking.

Not included: payroll/HR, staff passwords, bulk staff import/invitations, editing source companies, unapproved region engine or automatic organisation/customer access from employment. Next: [P1.06](06-Customer-Onboarding-and-User-Management.md).
