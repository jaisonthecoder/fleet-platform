# U3 — Booking & Consent Core Loop

> **Phase-exit critique gate (mandatory).** When this phase's build is complete, run **two rounds of rigorous critique + gap analysis** *before* starting the next phase:
> - **Round 1 — completeness & integration:** every listed screen + endpoint wired to the real backend; UI contracts match `app-api/src/contracts/`; loading/empty/error/denied states present; MSW retired for shipped screens; nav/routes/RBAC correct.
> - **Round 2 — correctness, security & UX:** RBAC + scope filtering right; consent/SoD/cost-mask rules mirrored (never bypassed); edge/concurrency/error + reason-code handling; keyboard + screen-reader a11y (axe); EN/AR + RTL; money/time formatting.
>
> Fix every finding (or record accept-with-dated-risk), then re-run the full UI gate — `tsc` · `oxlint` · `vitest` · `vite build` + in-browser vs the running backend. **A green gate + closed findings is what unlocks the next phase.**

**Goal:** the self-service pool-booking loop (M4) — **search → select → consent (hard gate) → submit → approve** — plus modify/extend/cancel and the approver inbox. A `booking` mock page already exists (`features/booking/`); this phase **reworks it onto the real backend** and completes the flow.

**Entry:** U2 done (vehicles + eligibility check reusable).
**Exit:** an employee books a vehicle end-to-end with a real booking number issued only after consent; approvers act; the double-book and consent guarantees are respected in the UX.

---

## 1. Backend dependencies (M4)
- `GET /vehicles/available?pickupAtUtc&returnAtUtc&seatingCapacity` — availability from the same reservation range as commit.
- `POST /bookings` (Draft) → `POST /bookings/:id/consent` (issues number, reserves) → `POST /bookings/:id/submit` (routes to approval).
- Approver: `POST /bookings/:id/approve|decline|request-changes` (roles: Approver/Delegate/FleetManager/ClusterFleetLead/GroupFleetLead/ClusterCEO).
- Requester: `PATCH /bookings/:id` (modify → may re-consent), `POST /bookings/:id/extend|cancel`.
- `GET /bookings/:id`, `GET /bookings/:id/events`.
- Contract: `booking.contract.ts` (statuses, `BOOKING_REASON`, DTOs).

## 2. Screens & routes
| Screen | Route | Page-spec | Consumes |
|---|---|---|---|
| Book a vehicle (wizard) | `/{lang}/book` | A1 | available → create → consent → submit |
| My bookings | `/{lang}/bookings` | A2 | `GET /bookings?me`, act on upcoming |
| Booking detail | `/{lang}/bookings/:id` | A2 | `GET /bookings/:id`, `/events` |
| Approval inbox | `/{lang}/approvals` | C1 | pending bookings → approve/decline/request-changes |

## 3. The booking wizard (the critical flow)
1. **Search** — destination, pick-up/return date-time, passengers → `GET /vehicles/available`. Shows only eligible vehicles (availability strip + recommended cards; reuse existing booking components).
2. **Select** — pick a vehicle → `POST /bookings` (Draft; no number yet). Show buffer + max-duration feedback from the backend response.
3. **Consent (HARD GATE)** — a `consent` step: versioned consent document + signature/ack → `POST /bookings/:id/consent`. **The UI must not allow "submit" until consent commits**; the booking **number** appears only after this returns. On 409 (overlap) → "vehicle no longer available" + back to search.
4. **Submit** — `POST /bookings/:id/submit` → routed to approver; show "pending approval" + the resolved approver.
- **Re-consent**: if the requester modifies vehicle/window beyond tolerance (`PATCH`), the backend voids consent and returns the booking to Draft — the UI detects `consentRecordId === null` and re-runs the consent step before re-submit.

## 4. Approval inbox (approver)
- Queue of `PendingApproval` bookings in scope; each card shows the policy-decision trace + eligibility "data as of". Actions: **approve / decline (reason) / request-changes (reason)**. SoD-01 (own booking) is blocked server-side → surface the `sod-01-self-approval` reason if attempted.

## 5. Lifecycle actions
- **Modify** (`PATCH`) pre-approval or on request-changes; **extend** (`POST /extend`, 409 on downstream conflict → "conflicts with next booking"); **cancel** (`POST /cancel`, `useConfirm`).

## 6. Data & state
- Keys: `['vehicles','available', window]`, `['bookings', {me|scope}]`, `['booking', id]`, `['booking', id, 'events']`.
- Consent/submit/decision mutations invalidate `['booking', id]` + `['bookings']`; approve → optimistic status flip then invalidate.

## 7. States
- No availability → empty-state ("join waitlist" placeholder P2); consent pending → cannot submit; overlap 409 → conflict banner + re-search; eligibility DENY at selection → block with reasons; approver on own booking → SoD reason.

## 8. RBAC & scope
- Book/my-bookings: any employee. Approvals: approver roles, scoped. The consent hard gate applies to all roles (no override, mirrors backend).

## 9. i18n / RTL
- Consent document text bilingual (D7 v0); reason codes localised; date-time pickers RTL-safe; times shown Asia/Dubai, sent UTC.

## 10. MSW → real API
- Replace the existing booking mock handlers with real calls; keep MSW for wizard component tests (including a 409 handler to test the overlap path).

## 11. Tests
- Wizard: cannot submit without consent; number appears only post-consent (MSW).
- Overlap 409 on consent → conflict UX.
- Approve/decline/request-changes update status; request-changes → re-consent required.
- Extend conflict 409 surfaced.

## 12. Exit gate
- End-to-end **book → consent → submit → approve** on the real backend; re-consent on material change; modify/extend/cancel; approval inbox with SoD reasons. Four-states complete. Gate green + browser-verified.

## 13. Traceability
- FRs: FR-BOOK-01..14 (booking), consent hard gate (Chapter 26), SoD-01. Backend: M4.
