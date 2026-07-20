# O6 - Policy and Hierarchy Integration Gate

## Objective

Connect approved organization scopes to policy authoring/deployment/runtime only after organization data, constraints, administration, authorization and UI are proven.

## Owners and dependencies

- Primary: Solution Architect and Backend Decision Platform Owner
- Contributors: Organization owner, Database, Frontend, Security, QA, SRE
- Depends on: O2-O5 and Program Phase 2 contracts
- Human gate: hierarchy-scoped policy activation approval

## Policy scope model

A binding identifies organization default or one hierarchy node, effective range, environment, precedence and immutable policy version/deployment. Exact scope overrides nearest active ancestor, which overrides organization default, then declared failure strategy. Use generic ltree ancestry, never fixed pool/cluster columns.

## Contract changes

Production DecisionRequest carries organizationId, requestedScopeNodeId, effectiveAtUtc, facts/provenance and correlation. Result carries requested/resolved scope IDs/codes, policy/deployment/version IDs, matched path/reasons and degraded/failure state. Policy Studio scope selection uses manageable active nodes only.

## Persistence and constraints

Decision scope binding/deployment references organization and hierarchy node. Enforce organization consistency, active-scope validity, non-overlapping effective active deployments and one active generation per organization/key/scope/environment. Organization default uses explicit binding type rather than ambiguous fake node.

## Runtime/cache

Resolve requested node and ancestors effective at decision time. Cache key includes organization, decision key, resolved scope, environment, deployment generation and checksum. Hierarchy generation/change events invalidate affected ancestry resolution. DB and last-known-good artifacts remain authoritative per failure strategy.

## Hierarchy change integration

Move/retire impact preview includes policy drafts/bindings/deployments and recent decision volume. High-impact change blocks until policies are migrated, retired, explicitly inherited or approved to follow node identity. Publish hierarchy events through outbox; decision replicas consume idempotently and revalidate bindings.

## Policy Studio integration

Show organization default and hierarchy overrides on tree; inherited policy source; effective/scheduled versions; override count/health; create override from inherited version; block invalid/retired scope activation; semantic diff and impact replay by scope.

## Workflow/domain integration

Workflow starts pin organization/requested/resolved scope and decision deployment. Domain records retain scope and decision provenance at event time. Cross-cluster booking D24 remains deny-by-default until approved policy tables and workflow routes exist.

## Tests

Exact/ancestor/default resolution; arbitrary hierarchy depth; effective-time historical ancestry; moved/retired scopes; cross-org binding rejection; cache invalidation/generation ordering; concurrent hierarchy move/policy activation; UI inherited/override display; domain shadow parity; rollback.

## Rollout

Organization-default policies first. Run scoped resolution in shadow, then canary one approved pool, cluster overrides, wider rollout. Rollback disables scoped selector/deployment while preserving organization-default behavior and immutable evidence.

## Exit gate

O6 passes when policy scope identity, inheritance, effective dating, authorization, cache propagation, hierarchy-change impact and rollback are proven. Only then may cluster/pool/location activation be enabled.

## Implementation status - complete

- Policy requests, drafts, active rules and cache keys are organization/scope aware.
- Runtime resolves exact scope -> deepest active ancestor -> organization default at effective time and returns requested/resolved scope IDs.
- Scoped Policy Studio selection is limited by SystemAdmin hierarchy authority; scoped save/workspace/activation flows are live.
- Rule activation invalidates every requested-scope cache entry for the organization/rule, preventing stale descendant inheritance.
- External `/decisions/evaluate` ignores caller-supplied tenancy, binds Principal organization, validates requested scope closure and logs minimized context.
- Migration `0022_decision_scope_provenance` persists requested/resolved hierarchy scope with organization-consistency FKs.
- Exact/ancestor/default and warm-cache provenance integration tests pass.

Critique findings closed: spoofable organization/scope on external evaluation, incomplete decision-log provenance, and descendant cache invalidation after ancestor activation.

O6 is complete. Program Phase 8 domain integration and legacy PEP migration is now in progress.
