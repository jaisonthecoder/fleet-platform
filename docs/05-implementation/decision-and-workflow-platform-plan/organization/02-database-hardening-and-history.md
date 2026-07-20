# O2 - Database Hardening and Hierarchy History

## Objective

Add storage invariants and history needed for safe reusable hierarchy administration and policy binding.

## Owners and dependencies

- Primary: Database Engineer
- Implementation: Backend NestJS/Drizzle
- Reviewers: Architecture, Security, QA, SRE
- Depends on: O0 and O1

## Schema changes

### Organization

- Unique organization code.
- Optional status/revision/settings metadata.
- Currency/timezone validation.
- One active group root invariant enforced by transaction/trigger where partial indexes cannot express it.

### Hierarchy node

- Add immutable `code` and optional metadata JSONB/address/physical-site reference seam.
- Keep `level_code`, `level_index`, bilingual names, `ltree path`, validity and timestamps.
- Unique `(organization_id, code)`.
- Unique active `(organization_id, path)`.
- Unique active sibling name/code rules as approved in O0.
- Checks for valid range and nonnegative level.
- Trigger validates parent organization, parent activity/effective overlap and allowed level progression.
- Root trigger validates level/root semantics.

### Hierarchy change event/history

Append-only entity capturing node, action, actor, reason, before/after snapshot, old/new parent/path, effective time, correlation and related workflow/approval reference.

## Safe subtree move procedure

1. Lock node, target parent and affected subtree.
2. Validate same organization, active status, allowed level progression and no cycle.
3. Run dependency impact query.
4. Require approved impact token/revision.
5. Compute old/new prefixes.
6. Update node parent and every descendant path atomically using ltree operations.
7. Recalculate/validate descendant levels only if O0 allows level-changing moves.
8. Append change event, central audit and outbox event in the transaction.
9. Increment hierarchy revision/generation.

## Retirement/reactivation

Retirement sets effective `valid_to` after checking active children, people/home scopes, roles, vehicles, entitlements, workflows and policy bindings. Strategy is block, migrate dependencies atomically, or schedule future retirement according to approved request. Reactivation validates parent and code/path conflicts.

## Indexes

Organization/code/status; hierarchy org/parent/code/path/validity; GIST ltree path; dependency lookup indexes on home scope, role scope, vehicle scope, entitlement location and policy binding; change-event node/time.

## Tests

Fresh/upgrade/backfill migrations, invalid cross-org parent, duplicate code/path/sibling, level gap, cycle/move, concurrent moves, retire with dependencies, historical events, effective-date boundaries and query plans.

## Rollback

Additive columns/constraints land after clean backfill. Constraint validation may use `NOT VALID` then validate. Compensating migration removes only new constraints/columns if no new writes depend on them; history is never deleted silently.

## Exit gate

O2 passes when database constraints reject semantic corruption, subtree moves are atomic/concurrency-safe, and fresh/upgrade/rollback evidence is approved.
