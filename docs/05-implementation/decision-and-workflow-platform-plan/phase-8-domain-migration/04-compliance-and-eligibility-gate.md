# 8.4 - Compliance and Driver Eligibility Gate

## Objective

Migrate the critical driver/vehicle eligibility decision with authoritative facts, freshness evidence, explicit structural hard-block ownership, fail-closed behavior and complete lineage.

## Owners and dependencies

- Primary: Compliance Backend owner
- Contributors: HCM, Vehicle, HSE/Security, Policy, QA, SRE
- Depends on: 8.1
- Human gate: hard-block boundary and failure strategy approval

## Structural versus configurable authority

Keep non-negotiable controls in code/DB: inactive employment, expired mandatory legal documents, active access block, non-bookable/lifecycle state where regulation requires no override. Decide whether `hard-block-conditions` is retired, used only to add stricter controls, or governed as a non-weakenable policy template. Never evaluate the same condition under conflicting authorities.

## Fact assembler

Read person, licence, employment, HCM freshness, active blocks, vehicle lifecycle/bookability, registration/insurance and vehicle scope once. Record data-as-of/source/freshness. Derive organization/scope from persisted person/vehicle relations and reject mismatch.

## Decision behavior

Structural deny first with stable reason/remediation. Configurable `driver-eligibility-gate` evaluates remaining facts. Fail closed on stale/unknown critical facts or invalid results and enqueue exactly one escalation outside simulation/shadow.

## Persistence

Eligibility evaluation stores decision identity/version/deployment, requested/resolved scope, reasons, fact fingerprint, data-as-of/freshness, subject refs, correlation and hard-block/configurable source classification.

## Tests

Expired licence/insurance/registration, inactive employment, active block, non-bookable vehicle, HCM stale boundary, exact/ancestor/default policy, cross-org mismatch, invalid typed result, cache/DB outage, shadow no-effects, duplicate escalation, provenance and localized remediation.

## Rollout

Long shadow observation because this gate blocks bookings. Canary only after zero unexplained divergence and security/HSE approval. Immediate selector rollback retained.

## Rollback

Switch the eligibility selector to legacy-only while preserving append-only evaluations and escalations already raised. Structural hard blocks remain active regardless of selector. Do not delete denial evidence or reopen bookings automatically.

## Critique checklist

Look for fail-open paths, permissive seed fallback, stale facts treated as valid, duplicate hard-block logic, raw PII logs, missing remediation and shadow-generated blocks/escalations.

## Exit gate

8.4 passes when authoritative facts/freshness and structural boundaries are approved, fail-closed behavior is proven, provenance is complete, shadow parity is accepted and rollback/escalation controls are operational.
