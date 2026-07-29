# Agent Context Pack - `<workstream-id>`

| Field | Value |
|---|---|
| Program/phase | `<program and phase>` |
| Workstream | `<id and title>` |
| Task type | `<feature/bugfix/tests/documentation/review/release>` |
| Status | `PLANNED` |
| Starting commit | `<sha>` |
| Worktree/branch | `<path and branch, or integration workspace>` |
| Orchestrator | `<session/owner>` |
| Implementer | `Generic isolated subagent` |
| Independent reviewer | `Unassigned generic subagent` |

## Business Outcome

`<Who needs what outcome and why?>`

## Scope

- `<required result>`

## Explicit Exclusions

- `<work this agent must not perform>`

## Controlling Sources

| Source | Authority/status | Relevant requirement |
|---|---|---|
| `<link>` | `<approved/candidate/current code>` | `<identifier/behavior>` |

## Current Implementation and Failure

- Controlling code path: `<links>`
- Current behavior: `<verified concise description>`
- Reproducing command: `<command>`
- Current result: `<failure/pass and evidence reference>`

## Contracts and Boundaries

- API/event contracts: `<links>`
- Database/migrations: `<links>`
- Authorization/organization/ownership/SoD: `<rules>`
- Transactions/idempotency/concurrency: `<rules>`
- Privacy/audit/retention: `<rules>`
- UI theme/components/i18n/accessibility: `<links or N/A>`

## Dependencies

| Dependency | Required status/evidence | Current status |
|---|---|---|
| `<phase/workstream/decision>` | `<gate>` | `<status>` |

## File Ownership

### May edit

- `<path/glob>`

### Must not edit

- `<path/glob or shared file owned by orchestrator>`

## Acceptance Criteria

1. `<observable, testable result>`

## Required Validation

1. Focused: `<command and expected result>`
2. Slice: `<command and expected result>`
3. Integration: `<command and expected result>`
4. UI evidence: `<viewports/EN/AR/RTL/screenshots, or N/A>`

## Readiness Response Required Before Edits

Return:

1. your understanding of the business outcome and scope;
2. the controlling code path and local hypothesis;
3. assumptions, unresolved questions, dependencies, and risks;
4. the smallest implementation slice;
5. exact files expected to change;
6. the first focused validation and what would falsify the hypothesis.

Do not edit until the orchestrator replies that readiness passed.
