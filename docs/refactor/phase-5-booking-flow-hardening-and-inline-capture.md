# Phase 5 — Booking Flow Hardening & Inline Capture

**Goal:** Make the booking flow reality-based: when a booking is blocked for a **remediable** credential reason, let the user fix it **in place** (capture licence/EID number, expiry, file), re-evaluate, and continue — instead of hitting a dead end. Also surface non-credential blocks (vehicle docs, employment, access block) with guidance.

**Scenarios:** S-04, S-06, S-07, S-22, S-24, S-25, S-27, S-28, S-29, S-60
**Features:** F-40, F-41, F-42, F-43, F-44

---

## In scope
- Remediable-reason plumbing; inline credential capture at consent; re-evaluate; pre-consent eligibility hint; guidance for non-remediable blocks.

## Out of scope
- Passenger identities (P8); help-article deep links (P7/P8 wiring).

## Backend
- Compliance/eligibility result: include `remediable: boolean` and a `remediationKind` (`licence` | `emiratesId` | `none`).
- Ensure consent re-evaluation path: after the user saves a credential/document (P1/P2 endpoints), re-run the gate on resubmit (existing `signConsent` already evaluates; ensure idempotency keys allow a clean retry).
- Optional `GET /v1/bookings/context` (or extend booking context) to include the requester's credential status for a **pre-consent** hint.

## Frontend
- Consent step (`book-vehicle-page.tsx`): when `consentErrorText()` maps to a remediable reason (`licence-missing`/`licence-expired`/`emirates-id-*`), render an **inline capture card** (number + expiry + upload via P2 presigned flow) instead of a dead end; on save → refetch credentials → re-enable **Sign & confirm**.
- Non-remediable blocks (vehicle docs/employment/access): show reason + guidance ("choose another vehicle" / "contact Fleet/HR/HSE") and, where relevant, a link (P7).
- Pre-consent hint: if `/me/credentials` shows ExpiringSoon/Missing, show a heads-up on the vehicle-selection step before the user invests time.

## Contracts / guards
- Result contract change → `guard:contracts:update`.

## Tests
- BE: `remediable` flag correctness per reason.
- FE: blocked-for-missing-licence → inline capture appears → save → re-evaluate → booking proceeds (MSW-mocked); non-remediable shows guidance; pre-consent hint renders.

## Acceptance criteria
- A first-time user blocked for a missing/expired licence can fix it **within the booking flow** and complete the booking.
- Non-credential blocks show a specific reason and the correct remediation owner.
- No dead-end generic error remains in the consent step.

## Dependencies
P1 (reasons + status), P2 (upload). Feeds P6.
