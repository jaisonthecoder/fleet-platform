# 8.10 - Shadow, Canary, Cutover, and Legacy Removal

## Objective

Promote migrated consumers safely from legacy-only through shadow/canary to new-only, prove rollback and remove legacy paths only after evidence and observation gates pass.

## Owners and dependencies

- Primary: Delivery Planner, SRE and Domain owners
- Contributors: Backend, QA, Security, Product, Support
- Depends on: 8.2-8.9
- Human gate: each critical decision cutover

## Promotion sequence

1. Legacy-only baseline metrics.
2. Shadow on approved sampled scopes/subjects.
3. Resolve every unexplained divergence; classify approved intentional differences.
4. New canary for low-risk advisory/value decisions.
5. New-primary with legacy shadow.
6. New-only after observation/SLO gate.
7. Remove legacy code/fixtures only after rollback window.

Recommended domain order: handover advisory -> booking values -> fines advisory -> entitlement eligibility -> approval workflows -> critical driver eligibility -> blocking black-point behavior.

## Gates per consumer

- Golden and production shadow parity target met.
- No unexplained output/route/reason/error differences.
- Latency/error/cache/fail-safe SLOs pass.
- Provenance completeness audit passes.
- Domain effects/idempotency and UI evidence pass.
- Support/runbook/alerts/owner approved.
- Rollback selector tested in UAT/prod-like environment.

## Observability

Dashboards by decision/consumer/mode/organization/scope: volume, p50/p95/p99, cache hit, fallback/fail-safe, divergence categories, missing provenance, effects, workflow SLA and rollback events. Alerts link to runbook and owner.

## Legacy removal

CI guards prohibit direct legacy evaluator calls and hardcoded active thresholds. Remove runtime seed fallback from production, compatibility columns only after retention approval, and feature flags after observation. Record removal date/commit/release evidence.

## Rollback rehearsal

Simulate runtime/cache/DB outage, bad deployment, excessive divergence and workflow incident. Rollback changes selector/deployment; verify new decisions stop, in-flight workflows remain pinned and domain history is untouched.

## Critique checklist

Look for vanity parity rates, unobserved scopes, selector mismatch, rollback that rewrites history, removal before retention, and alerts without ownership/action.

## Exit gate

8.10 and Phase 8 pass when all required consumers are new-only or explicitly excepted, legacy paths are removed after rollback window, provenance/shadow/SLO/UI evidence is approved and support/SRE/domain ownership is active.
