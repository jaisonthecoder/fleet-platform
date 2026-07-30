# Governed Consent - What It Is and How It Is Activated

## What consent means in this application

Consent is the driver's explicit acknowledgement of the exact English/Arabic operational wording attached to one Booking or Dedicated Vehicle assignment. The signed evidence binds:

- authenticated driver;
- Booking/Entitlement and Vehicle;
- approved effective window;
- immutable consent version and SHA-256 content hash;
- signature/device/transport evidence permitted by the domain;
- timestamp, audit event and outbox event.

It is not a generic website privacy banner and it is not permission to bypass eligibility, compliance, approval or custody controls.

## Why it kept appearing as a blocker

The signing transaction, version checks, hashes, audit, re-consent and UI already existed. Production providers intentionally returned `null` because the application had no governed place to store and activate accepted wording. Only isolated Jest/local environment text existed. Therefore the server correctly refused to issue a Booking number or allocate a Dedicated Vehicle in production.

## What is implemented now

Migrations `0054` and `0055` add an application-owned registry:

- immutable bilingual versions for `Booking` and `DedicatedVehicle`;
- `Draft -> Active -> Retired` lifecycle;
- one Active version per organization/domain;
- effective-time enforcement;
- database trigger preventing wording/version/hash/effective-time mutation;
- DataSteward/SystemAdmin authoring;
- separate SystemAdmin activation; the author cannot activate the same version;
- automatic retirement of the prior Active version;
- organization-bound provider lookup;
- activation/retirement audit evidence;
- test fixture isolation from registry state.

Admin page: `/:lang/admin/consents`.

## Approval workflow

1. DataSteward or SystemAdmin enters exact EN/AR wording, version and effective time and saves an immutable Draft.
2. Legal, Privacy, Product, retention and operational owners review that exact wording outside or inside the organization's normal approval record.
3. A different SystemAdmin opens Consent management, verifies the accepted version/hash/effective time, and selects **Activate as approved**.
4. Booking/Dedicated providers immediately use the Active effective version. Retiring it returns the domain to fail-closed behavior until another version is activated.

The application does not invent legal clauses. Activation is the auditable technical representation that the organization accepted the wording.

## Current local state

| Domain | Active version | Status |
|---|---|---|
| Pool Booking | `booking-operational-ack-v3` | Active, UTF-8 EN/AR, registry-backed |
| Dedicated Vehicle | `dedicated-operational-ack-v3` | Active, UTF-8 EN/AR, registry-backed |

The local baseline is operational acknowledgement wording, not a liability waiver or statutory legal opinion. DataSteward `Fatima Noor` authored it and SystemAdmin `Zayed Karim` activated it through maker-checker.

Local setup command: `pnpm --filter fleet-platform-api consent:activate-local`.

Usage audit command: `pnpm --filter fleet-platform-api consent:usage -- <version...>`.

## Target-environment readiness

There is no remaining consent integration/code blocker. For UAT or production, deploy migrations through `0055`, open Consent management, create the organization-accepted wording and activate it through maker-checker. Until activation, fail-closed behavior remains intentional.

## Remaining blockers after consent

- named UAT, pilot, support, release and rollback owners;
- signed UAT/go-no-go evidence;
- manual NVDA + Chrome evidence;
- production-like 300-user HTTP soak and 10k Booking query-plan review;
- Fleet on-behalf is development-active from persisted Fleet roles and hierarchy assignments; the selected employee owns consent.
- Dedicated `WithDriver` is development-active from editable ProfessionalDriver roles and Policy Studio rules; the selected driver is fingerprint-bound and owns consent.
- advanced B5 scenarios remain separately deferred.
