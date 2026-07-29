# Dedicated Vehicle UAT, Pilot and Rollback

| Field | Value |
|---|---|
| Scope | Dedicated Vehicle `WithoutDriver`, manual/local providers |
| Technical baseline | DEDICATED-00 through DEDICATED-07 |
| UAT owner | `UNASSIGNED_HUMAN_GATE` |
| Pilot owner | `UNASSIGNED_HUMAN_GATE` |
| Support owner | `UNASSIGNED_HUMAN_GATE` |
| Release owner | `UNASSIGNED_HUMAN_GATE` |
| Rollback owner | `UNASSIGNED_HUMAN_GATE` |
| Target-environment consent activator | `UNASSIGNED_HUMAN_GATE` |

The immutable EN/AR source and maker-checker workflow are implemented; local v3 wording is Active. Production execution requires the target organization to activate its accepted wording and complete every human gate above.

## Evidence Rules

- Record only opaque Entitlement, Workflow, Vehicle and audit references. Do not paste consent text, signatures, employee notes or unrestricted database rows.
- For every scenario record actual result, evidence ID, defect ID and named sign-off. Blank fields mean not executed.
- A failed security, consent, exclusivity, audit-chain or cross-organization check is a no-go.

## Persona Preconditions

| Persona | Required role/relationship | Required scope |
|---|---|---|
| Employee | Employee and linked Principal | Request location |
| Assigned driver | Linked Principal matching assigned driver | Owning organization |
| Line Manager | Current immutable Workflow assignee | Request scope |
| Delegate | Active same-organization, same-workflow one-hop delegation | Delegated scope |
| Fleet Manager | FleetManager | Request/Vehicle scope |
| Cluster Fleet Lead | ClusterFleetLead | Request scope |
| Cluster CEO | ClusterCEO and current immutable Workflow assignee | Request scope |
| Negative administrator | SystemAdmin only | Organization root |
| Support/audit reader | SystemAdmin or InternalAudit | Owning organization |

## Executable Journeys

| ID | Persona | Route/action | Expected API/state/audit result | Evidence ID | Actual result | Defect | Sign-off |
|---|---|---|---|---|---|---|---|
| UAT-DV-01 | Employee | `/dedicated-vehicle`; create/submit without Vehicle preference | Draft then PendingApproval; immutable route; no Vehicle hold |  |  |  |  |
| UAT-DV-02 | Employee/Fleet | Select preferred eligible Vehicle; complete approval/consent/allocation to same Vehicle | Allocated; preference honoured; one active allocation; Vehicle Dedicated/not Pool |  |  |  |  |
| UAT-DV-03 | Employee/Fleet | Request preferred Vehicle; allocate another with variance reason | Allocated; variance code persisted; preference remains advisory |  |  |  |  |
| UAT-DV-04 | Employee | Run configured eligibility with denied facts | DENY; no Draft progression; stable reasons |  |  |  |  |
| UAT-DV-05 | Approver/Employee | Request modification, edit with new preview, resubmit | Modification history retained; new revision and workflow progression |  |  |  |  |
| UAT-DV-06 | Wrong driver | Attempt consent | 403/409 consent actor mismatch; no consent timestamp/hash |  |  |  |  |
| UAT-DV-07 | Assigned driver | Accept current governed consent | AwaitingConsent progression; version and content hash persisted |  |  |  |  |
| UAT-DV-08 | Fleet | Two sessions allocate same Vehicle/range | One winner; loser stable conflict; one active allocation |  |  |  |  |
| UAT-DV-09 | Employee | Renew Allocated/Returned request | Linked Draft; no preview, workflow, consent, allocation or Vehicle carryover |  |  |  |  |
| UAT-DV-10 | Fleet/Employee | Confirm BSD window; activate; create Booking fully within window; restore after Booking ends | Pool only while Active; Booking accepted only inside range; Completed then Dedicated |  |  |  |  |
| UAT-DV-11 | Fleet | End BSD while active Booking/custody blocks restoration | Conflict; privacy-safe remediation; refresh resolves after blocker closes |  |  |  |  |
| UAT-DV-12 | Cross-org actor | Read/mutate another organization request/window/reconciliation | 403/404; no existence/data leakage; no mutation |  |  |  |  |
| UAT-DV-13 | SystemAdmin only | Attempt approve/allocate/return | 403 operational denial; audit/support reads only |  |  |  |  |
| UAT-DV-14 | Employee | Attempt `WithDriver` request | Explicit disabled reason; no Draft created |  |  |  |  |
| UAT-DV-15 | Support/audit reader | `GET /api/v1/entitlements/reconciliation` | Tenant-scoped opaque findings/metrics; no mutation or Person labels |  |  |  |  |

## Pilot Entry Checklist

- [ ] Approved immutable EN/AR consent version, hash, effective date, retirement process and outage behavior are provisioned.
- [ ] UAT, pilot, support, release and rollback owners are named.
- [ ] All UAT-DV scenarios have actual results, evidence IDs and sign-off; no open severity-1/2 defects.
- [ ] Production migration dry run and backup/restore rehearsal pass against a production-like copy.
- [ ] Reconciliation report is empty or every finding has an accepted owner/remediation record.
- [ ] Alert routing and support access are tested without Person-label leakage.
- [ ] `WithDriver` remains disabled until D16 approval.
- [ ] Go/no-go meeting records an explicit decision and rollback authority.

## Rollback Sequence

1. Release owner disables new Dedicated Draft submission, approval, consent, allocation, BSD confirmation and worker execution through the deployment/config rollback. Reads remain available.
2. Support captures deployment version, migration version, UTC time, organization, active command count and the privacy-safe reconciliation report.
3. Stop API/worker instances only after in-flight transactions drain. Do not delete command ledgers, Workflow, audit, outbox, consent, allocation, event or BSD evidence.
4. Restore the last verified application image. Database migrations `0046` through `0052` are forward-safe and have no complete down-migration set; do not manually drop tables/columns in an incident.
5. If data restoration is authorized, restore the pre-release database backup as a new isolated database, compare audit-chain heads and reconcile before cutover. Never overwrite the only evidence copy.
6. Restart reads first. Run health, migration-version, audit-chain, outbox, active-allocation, BSD and reconciliation checks.
7. Re-enable worker then mutations only after the rollback owner and release owner sign the evidence record.

## Rollback Evidence

| Check | Expected | Evidence ID | Actual | Owner/sign-off |
|---|---|---|---|---|
| Application version | Last verified image |  |  |  |
| Migration version | Known forward-compatible baseline |  |  |  |
| Audit chain | Valid, no missing sequence |  |  |  |
| Workflow/command ledgers | Preserved and readable |  |  |  |
| Consent/allocation/BSD evidence | Preserved and tenant-scoped |  |  |  |
| Outbox | No unexplained pending/duplicate event |  |  |  |
| Reconciliation | Empty or owned findings |  |  |  |
| Final decision | Mutations remain disabled or approved to resume |  |  |  |