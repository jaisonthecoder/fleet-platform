# Reusable Multi-Agent Delivery Orchestration

## 1. Purpose

This playbook lets one agent act as the accountable orchestrator while generic isolated agents implement, test, and independently review separate workstreams. It is designed for multi-phase delivery where progress must survive chat compaction, session failure, agent interruption, and parallel execution.

Use the workspace agent **Delivery Orchestrator** or run the prompt **Start Orchestrated Delivery** in VS Code Chat.

The orchestrator owns coordination and integration. Delegated agents own bounded work packages. An agent report is not completion evidence.

## Active Programs

- [Fleet Operations Core](fleet-operations-core/MASTER-STATUS.md) - Domain-first delivery centered on Vehicle, Pool Booking, Handover and Dedicated Entitlement, followed by full O4/O6 and Decision/Workflow integration.

## 2. Non-Negotiable Principles

1. **Evidence over claims.** Status changes require executable evidence tied to a commit and environment.
2. **Context before edits.** No implementation agent edits until its readiness gate passes.
3. **Exclusive ownership.** Parallel agents never edit the same files or shared status record.
4. **Dependency-aware execution.** Independent work may run concurrently; dependent phases remain blocked.
5. **User-approved UI.** Every frontend phase requires supplied and explicitly approved mockups.
6. **Design-system fidelity.** UI reuses the current theme, tokens, components, interaction patterns, i18n, and accessibility behavior.
7. **Independent critique.** The implementation agent cannot review or approve its own phase.
8. **Persistent state.** Git and tracked ledgers are authoritative; chat and memory are recovery indexes.
9. **Integration control.** Only the orchestrator integrates work into the main workspace.
10. **Regression honesty.** A later red gate changes a prior `VERIFIED` status to `REGRESSED`.

## 3. Execution Modes

### 3.1 Coordinated single-session mode

The orchestrator invokes generic subagents for bounded research, implementation, or review. Depending on the host, invocations may execute sequentially even though the work is organized as independent streams. Use this mode for low-conflict work or when one integration workspace is sufficient.

### 3.2 True parallel mode

Use separate VS Code sessions and one Git worktree/branch per editing workstream. Each session receives the same approved context pack but owns different files and its own status/handoff record.

Example layout:

```text
fleet-platform/                 integration workspace
fleet-platform-wt-gates/       gate and evidence workstream
fleet-platform-wt-booking/     booking backend workstream
fleet-platform-wt-ui/          approved UI phase workstream
fleet-platform-wt-policy/      independent policy migration workstream
```

The orchestrator remains in the integration workspace. Workstream agents do not merge, rebase, deploy, or update the shared master status.

## 4. Required Records

At program start, copy the templates in [templates](templates/) into a program-specific folder. Do not create empty ledgers for work that has not been authorized.

| Record | Purpose | Writer |
|---|---|---|
| `MASTER-STATUS.md` | Phase graph, current state, blockers, next action | Orchestrator only |
| `EVIDENCE-REGISTER.md` | Commit, command, result, environment, evidence URI | Orchestrator after verification |
| `DECISION-REGISTER.md` | Human decisions, owner, due date, fallback, affected gate | Orchestrator |
| `GAP-REGISTER.md` | Critique findings and closure evidence | Reviewer proposes; orchestrator records |
| `workstreams/<id>-context.md` | Approved agent context and readiness | Orchestrator |
| `workstreams/<id>-handoff.md` | Workstream progress and exact recovery point | Workstream agent |
| `reviews/<phase>-critique.md` | Independent phase critique | Reviewer agent |

Recommended program folder:

```text
docs/05-implementation/orchestration/<program-id>/
  MASTER-STATUS.md
  EVIDENCE-REGISTER.md
  DECISION-REGISTER.md
  GAP-REGISTER.md
  workstreams/
  reviews/
```

## 5. Status Model

| Status | Meaning |
|---|---|
| `PLANNED` | Defined but prerequisites or authorization are incomplete. |
| `READY` | Context, dependencies, ownership, and acceptance criteria passed readiness review. |
| `ACTIVE` | Authorized implementation is in progress. |
| `BLOCKED` | Cannot continue until a named dependency or decision closes. |
| `IMPLEMENTED` | Agent completed its changes and focused checks; independent review is pending. |
| `IN_REVIEW` | Independent critique is active. |
| `VERIFIED` | Integrated checks pass and Blocking/High findings are closed. |
| `REGRESSED` | Previously verified behavior now fails a required gate. |
| `INTERRUPTED` | Work stopped unexpectedly; handoff and partial state require inspection. |
| `SUPERSEDED` | Replaced by a controlled later work item or plan. |

Only the orchestrator changes the master phase status.

## 6. Orchestration Lifecycle

### Gate 0 - Baseline

The orchestrator verifies:

- user objective, scope, exclusions, and approval boundaries;
- controlling requirements and plan authority;
- repository status and unrelated changes;
- current commit, migrations, contracts, and validation baseline;
- dependency graph and work that can safely run independently;
- candidate workstream ownership with no overlapping edit surfaces.

Output: initialized master status and one context pack per candidate workstream.

### Gate 1 - Agent readiness

The assigned generic agent first performs read-only inspection and returns:

- task understanding and business outcome;
- controlling code paths and contracts;
- assumptions and unresolved questions;
- dependencies and risks;
- proposed smallest implementation slice;
- files it expects to edit;
- focused and combined validation plan.

The orchestrator compares this response with the approved context pack. Edits are authorized only when the response is accurate and complete.

### Gate 2 - UI mockup approval

This gate applies to every frontend phase.

1. The user supplies phase-specific mockups.
2. The agent inventories current theme tokens, shared components, typography, spacing, routes, i18n, RTL behavior, accessibility patterns, and nearby live screens.
3. The orchestrator maps mockup screens and states to requirements and API contracts.
4. Conflicts or missing states return to the user; agents do not invent business behavior.
5. The user states **Mockup approved - proceed** or an equivalent explicit approval.
6. The approval date/reference and accepted deviations are recorded before edits.

Required state coverage includes loading, empty, no-result, validation, permission denied, policy denied, conflict, degraded dependency, success, and role-specific actions where relevant.

Fidelity checks cover desktop, tablet, and mobile; EN and AR/RTL; keyboard operation; focus management; screen-reader semantics; text fit; stable layout; and exact behavior of the approved interaction model.

### Gate 3 - Implementation

- Make the smallest complete vertical slice.
- After the first substantive edit, run the cheapest focused check that can falsify the implementation hypothesis.
- Keep changes inside owned files and approved contracts.
- Record decisions and contract changes immediately.
- Do not broaden scope to fix unrelated failures.
- Keep the handoff current after meaningful milestones.

### Gate 4 - Agent validation

The implementation agent runs applicable focused tests, typecheck, lint, build, migration, contract, security, accessibility, screenshot, or E2E checks. It records exact commands and outcomes in its handoff.

Passing local checks move the workstream to `IMPLEMENTED`, not `VERIFIED`.

### Gate 5 - Independent critique and gap analysis

A separate generic reviewer receives requirements, approved mockups, context pack, diff, contracts, test evidence, and known risks. The reviewer inspects:

- business and scenario completeness;
- authorization, ownership, organization isolation, and SoD;
- data integrity, transactions, idempotency, concurrency, and migrations;
- security, privacy, retention, audit, and sensitive data;
- failure behavior, recovery, observability, performance, and rollback;
- API compatibility and downstream impact;
- UI fidelity, responsive behavior, EN/AR/RTL, accessibility, and all states;
- test quality, false-positive risk, and documentation accuracy.

Findings use `BLOCKING`, `HIGH`, `MEDIUM`, `LOW`, or `ACCEPTED RISK`. Every finding includes evidence, impact, owner, remediation, and closure proof.

All Blocking and High findings must be repaired and re-reviewed. Medium and Low findings require an owner and target. Accepted Risk requires named human approval and expiry.

### Gate 6 - Integration

The orchestrator:

1. confirms the workstream starts from an expected baseline;
2. inspects its diff and excludes unrelated changes;
3. integrates in dependency order;
4. resolves contract conflicts centrally;
5. runs affected combined gates in the integration workspace;
6. requests independent re-review if integration changes behavior;
7. records final commit and evidence.

Only then may a phase become `VERIFIED` and unblock dependents.

## 7. Agent Context Standard

Every task uses [agent-context-pack.template.md](templates/agent-context-pack.template.md). The pack must be sufficient for a new agent to work without relying on prior chat history. Link to source files rather than pasting large logs or documents.

An agent is not ready when it cannot name:

- the business outcome;
- the controlling requirement and code path;
- the dependency and authorization boundaries;
- the first falsifiable hypothesis;
- the cheapest discriminating validation;
- its exact file ownership.

## 8. Parallel Ownership Rules

- One workstream owns a file at a time.
- Shared contracts, schemas, routing, lockfiles, master ledgers, and global configuration have an explicit integration owner.
- If two streams require the same file, split by dependency and run sequentially, or move the shared contract into a preceding integration slice.
- Each parallel session writes a separate `/memories/repo/track-<id>.md`; it never edits the shared project-state summary.
- The orchestrator periodically consolidates completed tracks into `/memories/repo/project-state.md`.

## 9. Recovery and Failure Handling

### Context degradation or restart

1. Stop opening broad context.
2. Update the active workstream handoff and repo-memory track.
3. Record branch/worktree, last verified commit, last command/result, blockers, and exact next action.
4. Start a fresh orchestrator session.
5. Read `/memories/repo/project-state.md`, active track files, master status, handoffs, and Git state.
6. Rerun the last focused validation when the recorded state cannot be independently confirmed.

### Agent interruption

- Mark the workstream `INTERRUPTED`.
- Do not integrate partial changes automatically.
- Inspect diff, untracked files, tests, and handoff.
- Resume with a fresh generic agent using the same context pack, or discard only that isolated worktree after approval.

### Validation regression

- Mark affected phase and dependents `REGRESSED` or `BLOCKED`.
- Record the failing command and first known bad integration point.
- Assign a focused repair stream.
- Do not rewrite historical evidence; append the regression and later closure.

See [Copilot context management](../../../.github/copilot-chat-context-management.md) for repository-memory conventions.

## 10. User Responsibilities

The user is needed only for:

- supplying and approving frontend mockups by phase;
- resolving ambiguous business, legal, privacy, security, or rollout decisions;
- approving accepted risks, production deployment, commits when requested, and irreversible operations.

The orchestrator handles decomposition, agent context, worktree ownership, validation, critique, integration, evidence, and recovery tracking.

## 11. Starting and Resuming

Start from the agent picker with **Delivery Orchestrator**, or run:

```text
/Start Orchestrated Delivery <objective>
```

Resume after interruption with:

```text
/Start Orchestrated Delivery Resume from the orchestration ledger. Read repo memory and Git state first.
```
