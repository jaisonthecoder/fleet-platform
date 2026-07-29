# DEDICATED-00 Critique Round 1 - Contract, Security and Data

| Field | Value |
|---|---|
| Date | 2026-07-25 |
| Reviewer | Independent read-only workspace review |
| Decision | `CLOSED_NO_BLOCKING_OR_HIGH` |

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D00-R1-01 | High | Frontend create type omitted the future `preferredVehicleId` contract. | Closed: field added, while the backend rejects it until eligibility can project safe options. |
| D00-R1-02 | High | Preferred Vehicle could be accepted before governed eligibility. | Closed: create fails with `entitlement-preferred-vehicle-not-eligible`; the selector remains disabled and non-binding text is visible. |
| D00-R1-03 | Blocking | Legacy cancel was principal-optional and unscoped. | Closed: controller requires Principal and service fails closed with `entitlement-lifecycle-commands-pending`. |
| D00-R1-04 | Medium | Free-text rendering requirement was implicit. | Closed: DTO marks the note untrusted plain text; React renders it as text. |
| D00-R1-05 | Medium | Allocation-only `vehicleId` needed a negative boundary. | Closed by strict create schema and focused frontend assertion that neither requester authority nor final Vehicle is sent. |

## Closure evidence

- Migration `0046` enforces organization-safe person/node/Vehicle references, preference length, date window and revision.
- Public create binds requester/requested-by/organization from the authenticated Principal and requires `Idempotency-Key`.
- Owner list/detail are organization and person scoped.
- Submit, approval, consent, allocation, BSD and cancel are explicitly fail-closed for later phases.
- Final independent re-review found no unresolved Blocking/High contract, security or data finding.