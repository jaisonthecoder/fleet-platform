# Pool Booking UAT, Pilot and Rollback

| Field | Value |
|---|---|
| Technical scope | Employee self-booking, approval/delegation, My Bookings changes, Fleet preparation, Handover/Return |
| Target-environment consent activator | `UNASSIGNED_HUMAN_GATE` |
| UAT owner | `UNASSIGNED_HUMAN_GATE` |
| Pilot owner | `UNASSIGNED_HUMAN_GATE` |
| Support owner | `UNASSIGNED_HUMAN_GATE` |
| Release owner | `UNASSIGNED_HUMAN_GATE` |
| Rollback owner | `UNASSIGNED_HUMAN_GATE` |

The immutable EN/AR source and maker-checker workflow are implemented; local v3 wording is Active. Production enablement requires the target organization to activate its accepted wording and complete the named human gates.

## Evidence Rules

- Record opaque Booking, Workflow, Handover, audit and outbox references. Do not paste consent signatures, unrestricted Person rows or another employee's Booking details.
- Every scenario records actual result, evidence ID, defect and named sign-off. Blank fields mean not executed.
- Any consent, cross-organization, double-booking, self-approval, custody atomicity or audit-chain failure is a no-go.

## Executable UAT Matrix

| ID | Persona | Journey | Expected result | Evidence | Actual | Defect | Sign-off |
|---|---|---|---|---|---|---|---|
| UAT-BK-01 | Employee | Search scoped window/passengers and select Vehicle | Only bookable scoped Vehicles; masked timeline |  |  |  |  |
| UAT-BK-02 | Employee | Retire/no Active target-environment consent | Draft only; no number/reservation/sign action |  |  |  |  |
| UAT-BK-03 | Employee | Sign approved consent and submit | Number, consent, reservation, workflow, event/audit/outbox commit once |  |  |  |  |
| UAT-BK-04 | Concurrent employees | Reserve same Vehicle/window | Exactly one winner; losers receive privacy-safe conflict |  |  |  |  |
| UAT-BK-05 | Line Manager | Approve assigned Booking | Current immutable step advances; requester cannot self-approve |  |  |  |  |
| UAT-BK-06 | Delegate | Decide under valid delegation; retry same key | One decision and stable replay |  |  |  |  |
| UAT-BK-07 | Approver | Request changes with reason | Booking returns to owner; consent invalidated where required |  |  |  |  |
| UAT-BK-08 | Employee | Modify material window then resume consent | Draft/current revision; new consent and fresh approval cycle |  |  |  |  |
| UAT-BK-09 | Employee | Extend Approved/Active Booking | Later return accepted or privacy-safe downstream conflict |  |  |  |  |
| UAT-BK-10 | Employee | Cancel Draft/Pending/Approved | Reservation released; history/audit/outbox once |  |  |  |  |
| UAT-BK-11 | Employee | Attempt cancel during Active custody | Denied; return must use Handover |  |  |  |  |
| UAT-BK-12 | Fleet | Open Handover from scoped register | Handover and Booking Active commit atomically; key issued |  |  |  |  |
| UAT-BK-13 | Fleet | Retry ambiguous Handover open/return | Same key replays immutable original result |  |  |  |  |
| UAT-BK-14 | Fleet | Return with odometer/fuel/damage evidence | Handover Returned and Booking Completed atomically; advisory flags only |  |  |  |  |
| UAT-BK-15 | Employee/SystemAdmin | Direct Handover access | 403; no custody data or mutation |  |  |  |  |
| UAT-BK-16 | Cross-org/sibling actor | Read or mutate Booking/Handover | Opaque 403/404; no data leakage or mutation |  |  |  |  |
| UAT-BK-17 | Cluster CEO | Assigned Booking approval | Approval inbox/action available only for assigned step |  |  |  |  |
| UAT-BK-18 | Fleet | Look for on-behalf Create Booking | Capability/navigation disabled until G-0006 approval |  |  |  |  |
| UAT-BK-19 | Employee/Fleet | English/Arabic keyboard and screen reader flow | Correct RTL, focus, labels, live errors and no overflow |  |  |  |  |

## Pilot Entry

- [ ] Legal/Privacy approves immutable EN/AR Booking consent, version/hash, effective/retirement process, retention and outage behavior.
- [ ] UAT, pilot, support, release and rollback owners are named.
- [ ] UAT-BK scenarios have actual evidence and no severity-1/2 defect.
- [ ] Manual NVDA + Chrome passes Employee search/consent/My Bookings and Fleet Handover/Return.
- [ ] Production-like 300-user HTTP soak meets p95/p99 targets.
- [ ] 10k Booking owner/worklist query plans and indexes are reviewed.
- [ ] Audit-chain, DLQ/outbox replay, backup/restore and rollback rehearsal pass.
- [ ] G-0006 remains disabled unless separately approved and tested.

## Rollback

1. Disable new Booking create/consent/submit/decision/change and Handover commands; keep read/history available.
2. Capture deployment/migration versions, UTC time, organization, command-ledger in-progress count, active reservations and custody rows.
3. Drain in-flight transactions, then stop affected API/worker instances. Preserve Booking, consent, Workflow, Handover, key, damage, audit and outbox evidence.
4. Restore the last verified application image. Migrations are forward-safe; do not manually drop Booking/Handover tables during an incident.
5. If database restore is authorized, restore to an isolated database, compare audit-chain heads and reconcile before cutover. Never overwrite the only evidence copy.
6. Restart reads, verify migration `0053`, audit chain, command ledgers, active reservations, custody register and outbox state.
7. Re-enable workers then mutations only after rollback/release owner sign-off.

## Rollback Evidence

| Check | Expected | Evidence | Actual | Owner/sign-off |
|---|---|---|---|---|
| Application/migration version | Last verified image; migration through `0053` |  |  |  |
| Booking/Handover ledgers | Preserved; no unexplained in-progress row |  |  |  |
| Reservations/custody | One legal state per Booking/Vehicle |  |  |  |
| Audit/outbox | Valid chain; no lost/duplicate unexplained event |  |  |  |
| Consent/workflow | Versioned evidence and pinned route preserved |  |  |  |
| Final decision | Writes disabled or approved to resume |  |  |  |
