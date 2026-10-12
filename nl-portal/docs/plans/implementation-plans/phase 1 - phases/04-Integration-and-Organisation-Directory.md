# P1.04 - Integration and organisation directory

Status: planned, source-dependent gates apply. Version 1.0, 11.09.2026. Follow the [shared procedure](README.md).

## Outcome and dependencies

Staff can inspect a reliable read-only source organisation directory and diagnose integration failures. Imported data creates no portal customer or access automatically. Source traffic uses canonical adapters and durable jobs.

Depends on P1.02 and P1.03 for administration UI. D-03/OQ-2/2a/3/3a/3b must resolve the real interface, source identity and visibility policy for production. Source company/branch and repeatable address/contact coverage must be confirmed, not inferred from a mockup. Read the [organisation research](../../08-Customer-Organisation-and-Access-Research.md).

Trace: FR-ORG-002/003/005/007, FR-SYS-001 through FR-SYS-006, FR-ECO-003/005; NFR-REL-002/003/004, NFR-ARC-003/004/005, NFR-DAT-002/005, NFR-PER-006/009, NFR-OPS-001/002.

## Vertical slices

### P1.04-A - Canonical transport and observable job round trip

- DB: raw integration message/provenance, source-message and portal/version deduplication, existing job/audit storage. Retain raw payloads under the approved 13-month baseline/legal policy.
- Contracts: quote request, pricing, business confirmation, acceptance/rejection and source-created quote samples; adapter interfaces for future modules stay unimplemented where not needed.
- API: authenticated inbound handler validates/archive/enqueues/acknowledges, never performs business integration inline. Admin message list/detail/replay uses explicit permissions and safe projections.
- Jobs: retries/backoff, idempotent upserts, out-of-order protection and approved polling fallback where supported. Transport receipt is not business confirmation.
- Simulator: explicit dev/test environment selection, matching canonical contracts and controllable duplicates, delays, rejects and conflicts; no production fallback.
- UI: integration log filter/search, safe details, correlation and authorised replay confirmation; no raw secrets or unrestricted payload browser.
- Tests/demo: one request lineage through API/job/simulator; duplicate/retry no duplicate effect; rollback no job; failed job is inspectable and replayable; production rejects simulator mode.

### P1.04-B - Daily organisation mirror and source inspection

- DB: reuse master organisation data and stable source-qualified identities; preserve original/normalised codes and portal links separately. Addresses/contacts only if supplied and purpose-approved.
- Import: full snapshot versus delta contract, paging, missing-field/removal semantics and active/merge/rename handling. Failed/partial refresh must not delete omitted records or wipe contact collections.
- API: paginated internal-only search/detail, linked/unlinked and source-status filters, permitted sync metadata. Use repository/RLS protection, not just a hidden menu.
- UI: CW1 organisations list; detail Overview, Addresses, Contacts, Portal link and Sync/history where supported. Show source status separately from portal linking/activation. Missing feed capability is labelled, not populated with fictitious data.
- Actions: View organisation, Create customer from organisation and Link to existing customer enter P1.06's controlled workflow. No Create CW1 organisation, edit-back, auto-invite contact or Link address action.
- Tests/demo: daily repeat upsert stable; refresh preserves portal-owned labels/links; inactive source and stale import visible; original script preserved; customer cannot browse the global directory.

### P1.04-C - Mappings, reference contracts and tenant resolution

- Model: reconcile existing MappingEntry with source namespace/domain/direction/cardinality; do not add parallel mapping stores. Approved location/currency reference contracts support upcoming forms; P1.07 supplies the reusable admin UI.
- Resolver: source party organisation -> deliberate customer-account links -> approved visibility. Address codes resolve through OQ-3a lookup, never independently linked. A billing addressee and shipment party remain different visibility concepts.
- Rules: unlinked/ambiguous/wrong-owner messages remain customer-invisible; no customer IDs trusted from inbound public/client payloads. Source organisation import alone grants nothing.
- UI: minimal approved mapping maintenance with audit, link to unknown-code/message diagnostics and explicit replay. Customer option lists expose no raw integration mapping metadata.
- Tests/demo: namespaced code collision, unknown code, address-vs-org fixture, changed owner reply, ambiguous outbound mapping and runtime role cannot select system context. Correct/replay cannot duplicate source quotes.
- Phase boundary: shipment visibility contracts may exist but operational tracking/unassigned shipment screens remain Phase 2; use available Phase 1 quote exceptions now.

## File and operation boundaries

Proposed surfaces: API contracts/adapters, integration jobs/CW1 client/mappers, master-data repository, Prisma/migrations, simulator fixtures and portal integration/organisation features. All external calls stay in integration jobs. Decide concrete paths from nearby implementations before approval.

Provide a contract register with endpoint/auth/version, source namespace, payload samples, transport/business acknowledgement, message ordering, idempotency, retry/polling, latency clocks and support owner. No endpoint URL or credential belongs in a general business-settings editor.

## Acceptance and handoff

Evidence must identify simulator versus real source. Real round trip remains a production gate, even if direct quotation publication works. Prove source imports and customer links survive each other's updates and that unknown ownership never leaks data.

Hand off approved organisation/branch/reference DTOs to P1.05-P1.07 and quote integration contracts to P1.08-P1.10. Next: [P1.05](05-Operating-Structure-and-Staff-Management.md).
