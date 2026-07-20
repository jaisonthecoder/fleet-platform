# 8.9 - Domain UI Decision Evidence

## Objective

Expose operationally useful decision reasons, version/scope provenance and degraded states in booking, eligibility, approval, entitlement, fine and handover experiences without reproducing policy logic in React.

## Owners and dependencies

- Primary: Frontend React and UX
- Contributors: Domain Backend, Accessibility, QA, Security
- Depends on: 8.2-8.7 stable response contracts

## Shared presentation model

Create reusable `DecisionEvidence`/`DecisionTrace` components for authorized users: localized reason codes, remediation, policy/version, requested/resolved scope, effective time and degraded/provisional state. Facts are minimized/redacted by backend role.

## Domain surfaces

- Booking validation/consent/modification/approval evidence.
- Eligibility denial with remediation and freshness state.
- Entitlement eligibility and route evidence.
- Fines/black-point deadline and escalation rationale.
- Handover fuel advisory threshold/evidence.

## UX rules

No UI threshold calculation or route resolution. Errors use stable reason codes with EN/AR messages. Sensitive facts/employee data are role-restricted. Mobile, RTL, keyboard, screen reader and print/export states are defined.

## Tests

Contract/MSW, all reason/degraded states, authorization/redaction, EN/AR/RTL, keyboard/focus, axe and real-browser screenshots at desktop/mobile. Verify unknown reason fallback is safe and observable.

## Rollback

Components tolerate absent provenance during compatibility window. Hide advanced trace while retaining domain outcome/reason. No domain state rollback.

## Critique checklist

Look for duplicated logic, raw reason codes, sensitive facts, stale traces after mutation, missing RTL/focus and traces shown to unauthorized users.

## Exit gate

8.9 passes when every migrated domain exposes approved evidence/remediation, accessibility/i18n/redaction tests pass and no outcome is recomputed client-side.
