# Phase 9 — Driver Accountability: Fines, Blocks & Consent Lifecycle

**Goal:** Close the biggest business gap the original plan omitted — the **driver-accountability loop** that already exists in the backend but is invisible to users. Surface fines/tolls/damages, black points, access blocks, and consent status to the people they affect, and complete the consent lifecycle. This is the substance behind the requirement "a profile page where a user sees all his issues, eligibilities, bookings, rejections/approvals and all."

> Rationale (developer note): the app already has `FinesModule` (`Recorded→Attributed→Disputed→Recovered→Closed`, auto-raises an access block on overdue black points), `ComplianceService.raiseBlock` + `access_block`, and consent records for booking/dedicated. None of this is surfaced to the employee/driver, and the accountability chain (fine → black points → block → booking denial) is not explained anywhere. This phase makes it visible and actionable.

**Scenarios:** S-28 (access-blocked), plus new S-90..S-99 (below)
**Features:** new F-90..F-99 (see `02-feature-inventory.md` group K/L)

---

## New scenarios covered

| ID | Scenario | Expected |
|---|---|---|
| S-90 | Driver has an attributed fine/toll | See it in profile with amount, date, vehicle, status; know the recovery path |
| S-91 | Driver disputes a fine | Raise a dispute (reason + evidence); status → Disputed; Fleet adjudicates |
| S-92 | Black points accumulate / overdue | See balance + consequences; overdue auto-raises an access block (existing logic) |
| S-93 | Driver is access-blocked | Profile shows **why** (linked fine/black-point/HSE reason), who to contact, and that bookings are blocked |
| S-94 | Block lifted | Steward/HSE lifts with reason; driver sees restored eligibility; audited |
| S-95 | Damage recorded at return | Return handover damage → fine/recovery; visible to driver |
| S-96 | Consent required before booking number | Existing hard gate; now with clear "my consents" history |
| S-97 | Consent version changed / re-consent | Prompt to review & re-agree; old version retained (immutable) |
| S-98 | Dedicated WithDriver consent | Assigned driver signs; requester notified; visible to both |
| S-99 | Consent withdrawal / expiry | Where policy allows, withdrawal blocks future use; audited |

---

## In scope
- **Driver-facing** views of fines, black points, blocks, and consents (read models over existing modules), wired into the Profile hub (P6).
- **Dispute** action (employee) + **adjudication** (Fleet) using the existing fine status machine.
- **Access-block explanation** (link reason → source; contact guidance) and driver visibility.
- **Consent history** ("my consents") + re-consent surfacing.

## Out of scope
- Payroll/finance recovery integration (finance module boundary); toll provider ingestion changes.

## Backend
- Read models: `GET /v1/me/fines`, `GET /v1/me/black-points`, `GET /v1/me/blocks`, `GET /v1/me/consents` (self-scoped; privacy-minimized).
- Dispute: `POST /v1/fines/:id/dispute` (employee, idempotent command) → status `Disputed`; `POST /v1/fines/:id/adjudicate` (FleetManager) → `Attributed`/`Closed`. Emit outbox + audit.
- Block explanation: extend `access_block` read with `sourceRef` (fine/black-point/manual) and a localized reason; `POST /v1/compliance/blocks/:id/lift` (HSE/Steward, with reason) — reuse existing lift path; **SoD:** a person cannot lift their own block.
- Consent: `GET /v1/me/consents` composes booking + entitlement consent records with version + signed time; surface re-consent need.
- Wire the accountability chain into eligibility messaging: when a booking is blocked by `access-blocked:<reason>`, resolve the human reason + link (P7 help + P8 reason catalog).

## Frontend
- Profile hub (P6) gains sections: **My fines & tolls**, **Black points**, **My blocks** (with reason + contact + "why am I blocked"), **My consents** (history + re-consent CTA).
- Dispute dialog (reason + optional evidence upload via P2 storage).
- Fleet adjudication surface in the existing operations/approvals area.

## Contracts / guards
- New DTOs (`MeFineDto`, `MeBlockDto`, `MeConsentDto`, `DisputeFine`) → `guard:contracts:update`; org-scoped files → `guard:org` allowlist.

## Tests
- BE: dispute transitions; adjudicate; block lift SoD (self-lift rejected); self-scoped reads; auto-block-on-overdue still holds.
- FE: profile sections render; dispute flow; blocked-driver explanation; re-consent prompt.

## Acceptance criteria
- A driver can see **why** they're blocked, trace it to a fine/black-point, and know the remediation owner.
- A driver can dispute a fine; Fleet can adjudicate; statuses and audit are correct.
- "My consents" shows history and prompts re-consent when the version changed.
- The blocking message in booking links to the real reason and help.

## Dependencies
P1 (reasons), P2 (evidence upload for disputes), P6 (profile hub), P7/P8 (help + reason catalog). Reuses FinesModule, ComplianceModule, consent records.
