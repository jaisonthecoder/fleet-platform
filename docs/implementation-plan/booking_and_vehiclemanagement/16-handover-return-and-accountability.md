# Phase 16 (H1) — Handover, Return, Damage, Keys and Trip Accountability

## Objective

Connect approved pool bookings and dedicated allocations to physical vehicle release/return with complete driver, condition, fuel, odometer, key and trip evidence.

## Mandatory mockup gate — ask before implementation

Request: Fleet Manager handover queue; identity/eligibility/consent banner; walkaround; odometer/fuel; damage map/photos; signature; sticky readiness; return comparison/reconciliation; new damage; different location; lost key; offline/degraded states; tablet/mobile/RTL.

## Handover preconditions

Approved booking or active allocated entitlement; actor manages scope; vehicle/driver eligibility current; consent present; vehicle compliant/not maintenance; key available; no conflicting handover. Revalidate at release time.

Exact release gates: booking status Approved (or entitlement allocation Active); consent linked/current; driver/vehicle eligibility Allow; vehicle lifecycle Active and not maintenance/off-hire; current assignment/scope authorized; key custody Available; no active handover. Failures return stable reason plus remediation. SLA escalation never auto-releases.

## Handover capture

Identity, booking/allocation, checks, start odometer/fuel, telematics comparison, existing/new damage, assets, location, signature/condition acknowledgment, key issue. State transitions to In Use and trip can attach.

## Return

End odometer/fuel, telematics comparison, condition/damage diff, location, key return/lost, late/early flags, expected vs actual consumption, fuel deviation policy (advisory), booking completion or dedicated/BSD continuation. Never overwrite telemetry/manual evidence.

Odometer reconciliation stores both readings. If telematics is fresh (default <4h), compare with manual; deviation above configured threshold creates advisory exception. If stale/absent, accept manual with source absence evidence. Neither source overwrites the other.

## Damage/accountability

Pins/photos/notes, carried vs new, immutable evidence, actor/time, fine/toll/damage attribution windows, second-review SoD where investigation follows assignment.

Damage/fine/toll attribution windows are Phase 0 Legal/Policy decisions with owner and version. Until approved, the system records evidence and routes to review; it does not auto-assign liability.

Authenticated session/person plus immutable signature/condition evidence is the baseline. Stronger PIN/biometric/video assurance requires Legal/Security approval and device support; do not claim touchscreen capture alone proves identity.

## Offline/degraded

Phase 1 web may show degraded retry; offline mobile sync is Phase 2. Idempotent capture IDs, local evidence queue and conflict resolution must be designed before mobile implementation.

## Database/backend

Handover/return records, inspection items, damage evidence, odometer/fuel pairs, key custody, location, signatures, booking/entitlement links, trip attachment, audit/outbox and object storage.

## Tests

Preconditions, concurrent release, eligibility expiry after approval, odometer conflict, fuel deviation, damage diff, lost key, late/early, alternate location, idempotency, storage failure, audit, tablet/RTL/browser.

Add cancellation while handover Active (blocked/abort workflow), signature-person mismatch, attribution outside policy window and telematics fresh/stale/absent reconciliation.

## Rollback

Disable new release actions while preserving emergency manual runbook; committed custody/handover records are never deleted. Compensating corrections are append-only.

## Mandatory critique

Look for release without consent/compliance, double handover, overwritten evidence, lost-key orphaning, false GPS certainty, offline duplicates, signature privacy and incorrect liability windows.

## Exit gate

Every physical release/return is tied to one authorized booking/entitlement and produces immutable accountability evidence.
