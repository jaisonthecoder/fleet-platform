# Phase 14 (D1) — Dedicated Vehicle Request and Eligibility

## Objective

Deliver the separate live Dedicated Vehicle request journey for long-term/temporary and with-driver/without-driver entitlements, including self and governed on-behalf requests.

## Mandatory mockup gate — ask before implementation

Request: Employee dedicated request; Fleet Manager on-behalf variant; request-type and driver-option controls; duration/location/cost centre/justification/evidence; eligibility checking/result/blocked/escalated states; professional-driver fields; request history; mobile/RTL.

Mockups are not the Pool Booking wizard. Dedicated requests remain a distinct route/domain.

## Actors and authority

Employee self-request; authorized Fleet Manager/HR support on behalf where business approves and inside scope; line manager/Fleet Lead/CEO later. Requester, beneficiary and assigned driver are separate. SoD prevents self-approval.

## Request fields

Long-term/temporary; with/without driver; duration/start/end; organization scope/location; vehicle class preference; cost centre; business justification; operational pattern/sites; professional-driver details/evidence where applicable; supporting documents.

## Eligibility

`dedicated-vehicle-eligibility` uses current HR grade/role/employment, request type/duration/scope and approved exceptions. Result is Allow/Deny/Escalate with eligible class and reasons. Fail safe. Eligibility is evidence, not allocation.

## UI flow

Request form → validate scope/person → check eligibility → explain matched reasons → save Draft/submit. Blocked result names owner/remediation. Eligible result shows expected approval chain/cost information if available. No allocation or consent is faked.

## Database/backend

Entitlement requester/beneficiary/driver separation, request data, evidence, policy provenance history, eligibility evaluation, status/revision, scope consistency, create/update/check/submit APIs, scoped people/location options, audit/outbox.

## Tests

Grade/role boundaries, long-term/temporary, with/without driver, professional driver, self/on-behalf scope, inactive/out-org, policy failure, duplicate request, SoD, evidence, EN/AR/RTL/responsive.

## Rollback

Disable new submissions; retain Draft/read/history. Policy selector returns future checks to legacy-only.

## Mandatory critique

Look for mixing with booking, guessed grade thresholds, entitlement=allocation confusion, consent impersonation, scope leakage, missing driver eligibility and inaccessible explanations.

## Exit gate

A real employee or authorized on-behalf actor can create and submit an eligibility-evidenced dedicated request with no vehicle allocation yet.
