# Orchestration Master Status - `<program-id>`

| Field | Value |
|---|---|
| Objective | `<delivery objective>` |
| Orchestrator | `<owner/session>` |
| Integration branch/worktree | `<branch/path>` |
| Baseline commit | `<sha>` |
| Updated | `<UTC timestamp>` |
| Overall status | `PLANNED` |
| Next action | `<one exact action>` |

## Phase and Workstream Status

| ID | Outcome | Status | Dependencies | Owner/worktree | Last verified commit | Evidence | Blocker/next action |
|---|---|---|---|---|---|---|---|
| `<id>` | `<outcome>` | `PLANNED` | `<ids>` | `<owner/path>` | `<sha or none>` | `<link>` | `<text>` |

## File Ownership

| Path/glob | Workstream owner | Shared integration owner | Release condition |
|---|---|---|---|
| `<path>` | `<id>` | `<orchestrator if shared>` | `<condition>` |

## Current Gates

| Gate | Status | Required evidence | Evidence/shortfall |
|---|---|---|---|
| Baseline | `PLANNED` | `<evidence>` | `<link or gap>` |
| Readiness | `PLANNED` | `<evidence>` | `<link or gap>` |
| UI mockup | `PLANNED` or `N/A` | `<approval>` | `<link or gap>` |
| Implementation | `PLANNED` | `<checks>` | `<link or gap>` |
| Independent critique | `PLANNED` | `<review>` | `<link or gap>` |
| Integration | `PLANNED` | `<combined checks>` | `<link or gap>` |

## Human Decisions

| ID | Decision | Accountable person | Due | Affected work | Safe behavior before closure | Status/evidence |
|---|---|---|---|---|---|---|
| `<id>` | `<question>` | `<name>` | `<date>` | `<ids>` | `<block/simulator/fail-safe>` | `<status/link>` |

## Recovery Checkpoint

- Last completed action: `<text>`
- Active worktree/branch: `<text>`
- Last command and result: `<text>`
- Unintegrated work: `<links/commits>`
- Current blockers: `<text>`
- Resume with: `<one exact action>`

## Change Log

Append status transitions; do not erase regressions or prior evidence.

| UTC time | ID | From | To | Reason | Evidence | Changed by |
|---|---|---|---|---|---|---|
| `<time>` | `<id>` | `<status>` | `<status>` | `<reason>` | `<link>` | `<orchestrator>` |
