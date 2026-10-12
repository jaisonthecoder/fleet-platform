---
applyTo: "apps/cw1-simulator/**"
description: The fake CW1 eAdapter — dev and test only
---

# CW1 simulator rules (apps/cw1-simulator)

A stand-in for the CargoWise One eAdapter, so the platform can be built and demonstrated
before real CW1 access (OQ-2 is open). **Development and test only. Never production.**

## Hard rules

1. **No business logic.** It replays canned XML templates with a few fields substituted.
2. **It is not a source of truth.** When real CW1 arrives, `CW1_ENDPOINT` changes and the
   simulator is switched off. **No platform code may reference it** — it is reached over
   HTTP through configuration, and `apps/noatum-customer-portal-api` and `apps/noatum-customer-portal-ui` must never import
   from this package.
3. Message formats follow the public eAdapter schemas until the CW1 team supplies
   samples. Party-role fields stay marked `TODO-CONFIRM` in the templates.
4. Its pipeline stage deploys to `dev` and `test` only, or it runs purely locally.

## What it must support

Endpoints, seed world and configuration are specified in `docs/lld/CW1-Simulator.md`.
Build against that document, not from imagination.

The seed world matters more than it looks — it is what makes the tenancy tests real:
30 organisations, four rated lanes, and three standing fixtures at start-up (a
single-customer shipment, a **shared** shipment with Acme as shipper and Blue Ocean as
consignee, and a shipment with **only unmapped codes**). Those three are what prove
tenant resolution works.

## Tests it exists to enable

Idempotency (the same message id twice), the DLQ (malformed XML), instant versus manual
quote paths, adoption of staff-created quotes, tenant resolution for shared and unmapped
shipments, the invoice addressee rule, organisation-import change detection, and
correlation-id tracing across API to job to simulator.
