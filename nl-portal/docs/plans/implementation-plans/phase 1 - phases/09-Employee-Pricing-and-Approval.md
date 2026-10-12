# P1.09 - Employee pricing and approval

Status: planned; pricing/cost/approval decision gates apply. Version 1.0, 11.09.2026. Follow the [shared procedure](README.md) and [employee workflow](../../07-Internal-Quotation-Pricing-Workflow.md).

## Outcome and dependencies

An authorised employee claims a branch-owned request, reviews the full customer request, manually enters one or more options and obtains independent approval when required. A pricing draft is never mistaken for a published customer offer.

Depends on P1.08 and P1.07 policy resolution. Gates: OQ-11/12 and D-12 cost/approval/commercial validation, D-04 cost/claim/cross-branch grants, D-18 thresholds/currency and multi-option/version mapping. No invented exchange-rate policy or approval threshold.

Trace: FR-QTE-010/011/012/015/016, FR-CFG-004/005/006/008; NFR-REL-005, NFR-SEC-004/005/006, NFR-PER-002/009, NFR-UX.

## Vertical slices

### P1.09-A - Branch queue and complete request inspection

- DB/API: paginated authorised queue with request/customer/office/mode/route/cargo/contact/age/status/owner; default oldest first. Branch scope derives from staff assignment; explicit cross-branch permission enables extra scope.
- UI: mine/unclaimed/mode and permitted branch filters; open request and full-request popover, retaining unsaved pricing context. Existing full-request popover is sufficient, not a missing feature requiring a new page.
- Request: all submitted sections, cargo/DG associations, approved attachments, references and customer quotation history within permission. Never overwrite requested service/route when proposing an alternative.
- Tests/demo: two branches, no branch, explicit cross-branch grant, scoped counts/search, source attachments and late permission removal. Internal tracking scope remains unrelated.

### P1.09-B - Exclusive claim and pricing draft ownership

- DB: minimal owner/expiry/version fields and immutable claim audit, reuse quote/pricing version storage; no separate lock runtime.
- API: atomic claim, own release, configured expiry and authorised force-release with reason; all edit/save/submit actions recheck current claim, permissions and branch in the same protected operation.
- UI: Claim request, owner/expiry, Release request and authorised force-release; another employee sees read-only. Server time controls expiry, not the browser countdown.
- Gate: access revocation on branch/role loss is immediate. Claim cleanup/reassignment policy is explicitly agreed with P1.05; do not assume automatic release from a mockup footer.
- Tests/demo: concurrent claim has one owner; expired claim cannot save/submit; stale owner cannot edit after force-release; unauthorised release and late role/branch loss denied; draft retained for recovery.

### P1.09-C - Manual options, charge lines and safe preview

- DB/contracts: offered options and charge snapshots, validity/terms/service/carrier/transit, explicit alternative scope, optional protected cost data only when approved. Customer input stays immutable in its request version.
- API: approved charge code/basis/quantity/rate/currency validation; decimal calculations and totals by currency server-side; optimistic draft saves. No procurement/rate table or external inline pricing call.
- UI: Add option and charge editor, separate option totals, validity/terms/customer remarks, full request access and customer-safe preview marked not published. Do not impose a fixed number of alternatives.
- Privacy: cost/margin/internal lines omitted by safe output projection, not CSS. Enabling capture does not grant cost-view rights; disabling capture does not expose or destroy historic internal data.
- Tests/demo: multiple options, mixed currencies, invalid basis/quantity/currency/charge mapping, stale save and cost permissions. Preview has no internal fields/carrier when hidden and cannot be accepted as a live offer.

### P1.09-D - Policy-driven independent approval

- Service: evaluate recorded policy revision, signed thresholds/currency handling and complete snapshot; approval may be off or required, independently of publication mode.
- API: submit for approval, scoped approver queue/detail, approve or reject with mandatory reason. Different authorised approver when required; reject self-approval even through multiple roles or concurrent actions.
- Version: approved snapshot immutable for its decision. Edits after rejection or approval create/reopen the permitted version under explicit rules and invalidate prior approval where needed; never approve one snapshot then publish edited charges under that approval.
- UI: pending submitted work read-only, approver sees request/options/history and decision controls; rejection returns actionable reason/history. No per-request bypass toggle.
- Tests/demo: approval off/on/threshold boundary and mixed-currency signed examples in both publication modes; self-approval, stale/concurrent decisions, edited snapshot, claim/role loss and rejected submission history.

## Files and lifecycle contract

Inspect quotes/pricing service/repository/status logic, API DTOs and explicit permission codes, Prisma/version/audit fields, portal pricing/approval features and generated hooks. Define transitions in one explicit status module with tests. UI labels such as awaiting approval or sync failed are not automatically new canonical quote statuses.

Record every claim, submission, approval and rejection with actor/time/charge snapshot/policy revision. Reuse existing audit and immutable version facilities where appropriate rather than adding redundant status-history tables.

## Exit and handoff

Demonstrate customer request -> branch queue -> exclusive claim -> two priced alternatives -> independent approval or configured no-approval route. Customer cannot see unpublished prices. Handoff to P1.10 includes the exact permitted snapshot, ownership/approval evidence and recorded publication policy.

Next: [P1.10](10-Publication-Reconciliation-and-Communication.md).
