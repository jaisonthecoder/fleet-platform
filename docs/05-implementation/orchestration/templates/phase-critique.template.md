# Independent Phase Critique - `<phase-id>`

| Field | Value |
|---|---|
| Phase/workstream | `<id>` |
| Reviewer | `Generic isolated reviewer agent` |
| Implementation commit | `<sha>` |
| Requirements baseline | `<links/versions>` |
| Approved mockup evidence | `<link or N/A>` |
| Review date | `<UTC date>` |
| Decision | `REWORK REQUIRED` or `VERIFIED` |

## Review Inputs

- Context pack: `<link>`
- Diff/commit: `<link/sha>`
- Handoff and test evidence: `<link>`
- Contracts/migrations: `<links>`
- Known risks and accepted exclusions: `<links>`

## Findings

Findings lead the report and are ordered by severity.

### `<ID>` - `<finding title>`

- **Severity:** `BLOCKING` / `HIGH` / `MEDIUM` / `LOW` / `ACCEPTED RISK`
- **Evidence:** `<file links, behavior, or command result>`
- **Requirement:** `<source and acceptance criterion>`
- **Impact:** `<business/security/data/UI/operational impact>`
- **Owner:** `<workstream or named human>`
- **Remediation:** `<specific corrective action>`
- **Closure evidence:** `<test/review/approval needed>`
- **Status:** `OPEN` / `FIXED_PENDING_REVIEW` / `VERIFIED_CLOSED` / `ACCEPTED_RISK`

## Required Review Lenses

- [ ] Business flows, actors, states, denials, and edge cases
- [ ] Authorization, ownership, organization isolation, delegation, and SoD
- [ ] Data constraints, transactions, concurrency, idempotency, and migrations
- [ ] API/event compatibility and downstream consumers
- [ ] Security, privacy, retention, audit, and sensitive-data handling
- [ ] Dependency failure, degraded behavior, recovery, observability, and rollback
- [ ] Performance and resource risks appropriate to the change
- [ ] Test quality, negative cases, regression risk, and false-positive evidence
- [ ] Documentation/status accuracy
- [ ] UI mockup fidelity, theme/components, responsive behavior, EN/AR/RTL, accessibility, and complete states, or N/A

## Gap Summary

| Severity | Open | Closed | Required before phase closure |
|---|---:|---:|---|
| Blocking | `<n>` | `<n>` | All closed |
| High | `<n>` | `<n>` | All closed |
| Medium | `<n>` | `<n>` | Owner and target required |
| Low | `<n>` | `<n>` | Tracked |
| Accepted Risk | `<n>` | `<n>` | Named approval and expiry required |

## Re-Review Record

| Finding | Remediation commit | Validation | Reviewer disposition |
|---|---|---|---|
| `<id>` | `<sha>` | `<command/evidence>` | `<status>` |

## Final Gate Decision

`<State whether the phase is Verified, remains Blocked, or Regessed, and cite the decisive evidence.>`