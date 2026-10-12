# P1.10 - Publication, reconciliation and communication

Status: planned; UC-12/source reconciliation is an entry gate. Version 1.0, 11.09.2026. Follow the [shared procedure](README.md) and [employee workflow](../../07-Internal-Quotation-Pricing-Workflow.md).

## Outcome and dependencies

An approved/completed priced snapshot becomes customer-visible through its recorded direct or CW1-confirmed policy. Publication, CW1 acknowledgement and email delivery are three distinct events. Pricing directly in CW1 remains supported.

Depends on P1.04/P1.07/P1.09. D-18 must define multi-option/version confirmation, direct-offer collision handling and applicable acceptance/rejection mappings. Resolve the governing-source universal-CW1 conflict and record the architecture decision before coding. External drafting OQ-25/D-11 is optional; template fallback is not optional.

Trace: FR-QTE-008/013/014/015/016/017, FR-CFG-003/004/007/008, FR-SYS-001 through FR-SYS-006; NFR-REL-002 through NFR-REL-005, NFR-PER-006, NFR-SEC-006, NFR-SAF-001/002/003.

## Vertical slices

### P1.10-A - Direct customer publication

- API/transaction: authorised publication rechecks recorded policy, current permissions/branch, exclusive ownership, snapshot validity and applicable independent approval. Publish one immutable offer/version and enqueue permitted deterministic notification once.
- Direct invariant: no priced-offer CW1 job and no fabricated CW1 reference/confirmation. An initial unpriced request may independently exist in CW1; that does not mean the price is confirmed there.
- UI: Publish to customer only when permitted; pre-publication customer preview remains distinct. Show actual publication state and actor/version/policy evidence.
- Tests/demo: repeated/concurrent publish creates one result/notification; missing approval, stale snapshot, wrong branch, expired claim and lost grant fail; policy change cannot bypass an existing gate.

### P1.10-B - CW1-confirmed publication

- API/job: submit pricing transactionally records snapshot/revision and queues the configured mapped CW1 write. No inline CW1 client call from pricing service.
- Consumer: correlate source/portal/version/option references; transport acknowledgement leaves pending; only valid CW1 business confirmation for the applicable version permits publication. Define partial-option responses under D-18 before implementing them.
- UI: pending/failed sync and authorised retry are staff-only; customer keeps last published consistent version. No automatic or manual per-quote outage bypass button into direct mode.
- Tests/demo: business confirmation publishes once; transport-only, timeout, malformed/rejected/duplicate/out-of-order reply, retry after unknown outcome and stale version do not publish incorrectly or duplicate a CW1 quote.

### P1.10-C - Source-originated quotes and reconciliation

- Adoption: source-created quotes resolve via source identity and deliberate organisation links; repeated imports/late acknowledgements reconcile to existing entity/version. Unknown/conflicting ownership quarantined.
- CW1 authority: differing price in CW1-confirmed mode is handled under approved canonical rules, preserving prior snapshots and notifying staff. CW1 pricing of a claimed request releases the claim under the documented rule while retaining draft history.
- Safety: accepted versions never mutate. A later CW1 collision with a directly published offer is held for authorised D-18 reconciliation; no silent overwrite, duplicate offer or inferred booking linkage.
- Ownership: organisation relinking cannot redirect an outstanding response into a new tenant or transfer historic ownership by guesswork. Correlate recorded ownership/version and apply approved correction path.
- UI: authorised staff history/conflict detail links to existing integration diagnostics; customer sees only authorised published content, not rejection payloads or internal drafts.
- Tests/demo: source-only quote adoption, duplicate/out-of-order updates, two-source code collision, owner moved, differing amount, claimed request priced externally and direct/accepted collision cases.

### P1.10-D - Editable correspondence and reliable sending

- Drafting: external-team service behind interface/job with approved safe context; store applicable provenance/version/confidence without inventing confidence. On disabled/unavailable/malformed service use approved template.
- UI: editable draft, recipient review and explicit authorised Send; no generated automatic send. Changes retain original/provenance and mandatory reason under the human-override policy. Record draft versus sent snapshot distinctly.
- API/job: recheck current recipient eligibility, authorisation and published customer-safe version at send/execution; no unpublished prices, internal costs or prohibited attachments. Retry/deduplicate human send intent and report sending/sent/failed truthfully.
- Template ownership: use P1.07 approved templates/locales and data limits; secrets/endpoints remain environment configuration. Deterministic system notifications are separate from drafted correspondence.
- Tests/demo: service disabled/fails/returns unsafe malformed content, user edits/cancels, revoked access before send, invalid recipient, duplicate click/retry and failed provider delivery. No human send means no outbound drafted email.

## Required policy matrix

Run both publication modes with initial unpriced-request sync on and off, and approval off and required: eight base combinations. Add signed threshold/multi-currency boundary cases, two branches, stale/changed policy, revoked permissions and repeated actions. Inspect queued jobs as well as visible UI to prove the direct path does not submit priced offers to CW1.

Do not confuse a simulator fixture with live integration acceptance. P1.12 repeats the CW1-confirmed journey against the approved real interface. Direct publication is a configured workflow, not a waiver for failed CW1 integration.

## File boundaries and exit

Use quote/pricing status/services/repositories, adapter jobs/mappers, existing email interface, contracts/generated client, staff/customer quote features and audit/version storage. Required DB uniqueness/concurrency protections accompany service validation.

Exit: both modes publish only correct safe snapshots; source-created quotes appear once; conflicts cannot alter accepted/direct offers silently; customers never see internal data; drafting always has template fallback and human send. Next: [P1.11](11-Customer-Response-and-Product-Experience.md).
