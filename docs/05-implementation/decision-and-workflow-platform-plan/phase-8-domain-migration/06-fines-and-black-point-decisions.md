# 8.6 - Fines and Black-Point Decisions

## Objective

Migrate HR escalation threshold and black-point transfer timeframe using event-time scope/version resolution, persisted configured values and side-effect-free replay/shadow.

## Owners and dependencies

- Primary: Fines Backend owner
- Contributors: HR, Legal, Finance, Policy, QA
- Depends on: 8.1
- Human gate: D9 timeframe and HR threshold/window approval

## Decisions

- `fines-hr-threshold`: typed `{count, windowDays/months, recipients/action}`.
- `black-point-timeframe`: typed deadline/warning/block model with jurisdiction.

Remove hardcoded 3/12 and 14-day fallbacks after equivalent organization-default policies are approved and seeded.

## Fact/effective time

Use violation/event time, jurisdiction, attributed driver, rolling-window fine count and authoritative scope at event time. Late-arriving fines resolve the policy effective at the violation, not ingestion time.

## Persistence

Fine and black-point records/events retain separate policy provenance and configured threshold/deadline values. Resulting access block references the originating decision/evidence. Append-only attribution history remains domain-owned.

## Side-effect isolation

Shadow/replay computes comparisons only: no HR notification, access block, scheduled work or outbox side effect. Primary mode emits each effect idempotently.

## Tests

Threshold below/equal/above, rolling-window boundaries, jurisdictions, late arrivals, historic policy versions, scope overrides, invalid/no policy, duplicate fine, replay no-effects, provenance, block deadline and selector rollback.

## Rollout

Advisory HR threshold can canary before blocking timeframe. Black-point blocking requires Legal/HR approval and longer shadow period.

## Rollback

Return selectors to legacy-only for future events. Previously recorded fines, deadlines, notifications and blocks remain immutable evidence and require explicit domain reversal workflows where permitted; rollback must not delete them.

## Critique checklist

Look for processing-time evaluation, hardcoded fallback, duplicate alerts/blocks, replay side effects, attribution/policy authority mixing and missing jurisdiction.

## Exit gate

8.6 passes when both configured values and versions persist, event-time replay is deterministic, hardcoded thresholds are removed, side-effect isolation is proven and rollback does not remove already-created evidence.
