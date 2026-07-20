# 8.7 - Handover Fuel-Deviation Advisory

## Objective

Migrate fuel-deviation threshold as a scoped advisory decision while keeping odometer/fuel evidence and return transaction authority in the Handover domain.

## Owners and dependencies

- Primary: Handover Backend owner
- Contributors: Fleet operations, Telematics, Policy, QA
- Depends on: 8.1
- Human gate: approved default/category thresholds

## Fact assembly

Compute expected versus observed fuel from authoritative handover/telematics inputs. Facts include vehicle category, deviation percent, source quality and return event time. Resolve vehicle organization/scope at return time.

## Behavior

Policy returns typed threshold/advisory classification. Remove hardcoded 12% only after equivalent defaults are active. Invalid/missing advisory policy records degraded review state according to approved failure strategy but must not prevent legally valid vehicle return unless separately governed.

## Persistence

Store observed deviation, configured threshold, flag/advisory output and complete policy provenance. Historical return remains attributable to the version effective at return time.

## Side effects

Domain transaction records return, evidence and advisory state atomically. Shadow/replay cannot create alerts or mutate handover.

## Tests

Below/equal/above threshold, category overrides, null/invalid telemetry, event-time version, exact/ancestor/default scope, invalid output, advisory failure strategy, provenance, transaction rollback and replay no-effects.

## Rollout

Use as the first low-risk advisory canary if shared adapter is ready. Monitor alert-rate change and false positives before broader domains.

## Rollback

Return future return events to the legacy threshold selector. Completed handovers and their observed/configured values remain historical evidence; rollback does not recompute or clear advisory flags already committed.

## Critique checklist

Check hardcoded threshold remnants, telemetry authority, percentage calculation, unit/rounding, advisory accidentally blocking return and policy version overwritten after return.

## Exit gate

8.7 passes when threshold and version persist, event-time behavior is deterministic, advisory never causes unintended blocking, parity/alert-rate evidence is approved and rollback is proven.
