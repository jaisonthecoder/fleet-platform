# P1.06 - Customer onboarding and user management

Status: planned; layouts provisional. Version 1.0, 11.09.2026. Follow the [shared procedure](README.md).

## Outcome and dependencies

Noatum can onboard and maintain a customer through the portal; customer admins can manage permitted own-customer users. Source organisations, CustomerGroups, CustomerAccounts, source contacts and login identities remain separate.

Depends on P1.04/P1.05 and P1.02 access foundations. Gates: D-01 Microsoft-managed customer provisioning/invitation acceptance sequence; D-03 source eligibility/identity/reassignment; D-13 link approval and domain-exception policy; D-16 hierarchy/pilot. Use audited single-action link confirmation as the documented interim approach, not an assumed mandatory approval inbox.

Trace: FR-IAM-005/006/007/008/009/010/011/012, FR-ORG-001 through FR-ORG-009, FR-NAV-002/003/005; NFR-SEC, NFR-DAT-001/003/004, NFR-REL-005 and NFR-UX.

## Vertical slices

### P1.06-A - Customer creation, organisation links and hierarchy

- DB: customer group, domains/tier/entitlements, source-qualified account links, office labels, approved servicing association, two-level hierarchy and link metadata. Reuse existing entities; source addresses are not accounts.
- API: paginated customer list/detail, create/update, link/unlink/reassign under approved policy and hierarchy change with reason/impact checks. Reject conflicting ownership transactionally, including case variants and simultaneous link attempts.
- UI: create from source directory or customer list uses one workflow: details, eligible organisation links, servicing, first-admin/review. Exact step count/layout follows mockups; required validation does not depend on count.
- Rules: source-active is not portal-active; inactive-source eligibility requires an explicit block/approved-exception policy. Domain/name/source-parent similarity grants no automatic links or hierarchy.
- Access: parent data visibility does not grant child-user administration; enforce authority separately. Reassignment removes obsolete visibility without a dual-access interval; historic quote ownership and delayed replies follow explicit reconciliation, not mass transfer by assumption.
- Tests/demo: multi-office customer, two-level hierarchy, cycle/third-level rejection, duplicate-link race, wrong-tenant request, unknown address mapping and source refresh preserving portal links.

### P1.06-B - First-admin invitation, acceptance and activation

- DB: hashed single-use email-bound invitation, expiry, resend/revoke evidence and identity binding; reuse jobs/audit, no credential tables.
- API/jobs: Noatum invites first admin; configured expiry defaults to seven days, resend constrained, revoke immediate. Approved invitation/welcome templates sent via transactional jobs; logs contain no plaintext invitation token.
- Identity gate: invitation email does not itself provision Entra External ID. Confirm the Microsoft-managed user-flow/provisioning path while open signup remains disallowed; no portal temporary password workaround.
- UI: invitation progress, resend/revoke, acceptance outcomes and customer onboarding readiness. Activation requires at least one linked office and an accepted Customer Admin, enforced server-side under concurrency.
- Tests/demo: valid acceptance activates once; wrong email, used/expired/revoked token and revoked/resend races fail; different subject cannot steal an existing identity; email failure does not falsify acceptance or activate the customer.

### P1.06-C - Customer-user lifecycle and own-customer administration

- API: scoped users/invitations list/detail, invite colleagues, approved external preset assignment, optional financial-office restriction, deactivate/reactivate, resend/revoke and own-customer audit. Derive customer context from identity.
- UI: separate users and pending invitations, role presets/effective module access, optional office restriction explicitly labelled financial, invitation expiry and permitted activity. Source CW1 contacts are not portal users.
- Controls: Customer Admin cannot grant internal roles, manage another customer or grant reports not assigned to its customer; report/recipient workflow itself remains later scope. Parent visibility alone does not permit editing child users.
- Last-admin invariant: active customer must retain an active Customer Admin; reject demotion/deactivation and concurrent attempts. Deactivation revokes pending invitations and next-request access while preserving records.
- Profile: own display/locale/preferences and read-only identity/company fields only as allowed by the current contract; confirm any new editable profile field before implementation. Changing email never rebinds identity.
- Tests/demo: admin invites colleague with approved roles, colleague accepts, role removal applies immediately, invalid office/cross-customer/internal-role assignment and last-admin race fail.

### P1.06-D - Customer lifecycle, support and audit

- API/UI: customer Overview, Linked organisations, Users/invitations, Features/settings links, Hierarchy and Audit; suspend/reactivate with reason, impact and optimistic concurrency. Full settings editor comes in P1.07.
- Suspension: all customer users denied on next request, data/history retained and ingestion continues. Reactivation rechecks approved readiness; do not reactivate source organisations or resurrect revoked user access automatically.
- Support: read-only impersonation with explicit grant/reason, configurable 60-minute default, persistent banner, expiry/end action and both actors recorded. All writes blocked in API, not just disabled buttons.
- Exceptions: inspect available unassigned Phase 1 records and correct links using the same authorised workflow; viewing an exception grants no customer visibility. Shipment exception workflows arrive in Phase 2.
- Privacy: audit filtered to authorised scope with required email hashing/domain treatment; erasure automation later, but a Legal-approved request-handling process is required before pilot.
- Tests/demo: suspended customer denied while imports continue; impersonation expiry, tampered target, all writes, cost/restricted output and audit scope are tested; corrected link cannot expose another customer's quote.

## File boundaries and operational contract

Use existing customer/user/role/identity/integration modules, contracts and tenant repositories; migrations for missing link/invitation/audit semantics only. Portal customer-management/user features reuse source-detail and shared editor components. No duplicate source-address storage merely to populate customer tabs.

Approved source-backed addresses/contacts remain expandable in organisation detail. Do not require a new address management screen for CW1-owned data. Customer operational address book is P1.08 and has independent ownership.

## Completion evidence

Record a full Noatum-to-first-admin-to-colleague journey; linked organisation conflict and reassignment; hierarchy isolation; suspension/reactivation; invite abuse cases; next-request revocation; last-admin concurrency and read-only impersonation. Include EN/ES email/page tests, endpoint denials and raw runtime-RLS tests for every new entity.

Next: [P1.07](07-Lookups-Features-and-Settings.md). Do not call all customer administration complete until its feature/settings surfaces and relevant P1.07 gates are also accepted.
