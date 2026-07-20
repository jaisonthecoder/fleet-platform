# Phase 7 - Policy Studio and Workflow Builder UI

## 1. Objective

Deliver an accessible, bilingual Wayfinder administration experience for policy cataloging, dynamic condition authoring, simulation, replay impact, review, deployment, version history, and bounded workflow-definition authoring.

## 2. Owners and dependencies

- **Primary:** AI Frontend Engineer (React)
- **Design owner:** AI UX/UI Designer
- **Contributors:** Backend NestJS, Product, Security, QA, Internal Audit
- **Depends on:** Phase 2 contract matrix, Phase 5 APIs, Phase 6 workflow APIs
- **Human gate:** UX/design approval and accessibility sign-off

## 3. Routes and authorization

| Route | Screen | Roles |
| --- | --- | --- |
| `/{lang}/admin/policy` | Policy catalog | SystemAdmin; InternalAudit read-only |
| `/{lang}/admin/policy/:policyId` | Policy workspace | SystemAdmin; assigned reviewer |
| `/{lang}/admin/policy/:policyId/replay/:runId` | Impact analysis | SystemAdmin, InternalAudit |
| `/{lang}/admin/workflows` | Workflow catalog | SystemAdmin; InternalAudit read-only |
| `/{lang}/admin/workflows/:workflowId` | Workflow builder/workspace | SystemAdmin; assigned reviewer |
| `/{lang}/approvals` | Unified task inbox | Assignee/delegate roles |

Keep the existing `/policy` compatibility redirect for one release. Backend authorization remains authoritative.

## 4. Policy catalog

Use a dense operational list rather than decorative cards:

- Search by business/technical name.
- Filters: family, owner, impact class, lifecycle, health, scope, governance decision.
- Columns: name/code, family, active version, scope, effective date, status, health, draft/review state, owner.
- Provisional fixture and degraded runtime states are visually explicit.
- Primary action: `New policy` from approved templates/registered decision identities.
- Scope filter/tree is sourced from O4 manageable hierarchy and distinguishes organization default, exact override, inherited source, retired scope and deployment health.
- Loading skeleton, empty state, retryable error, denied state, and stale-data indicator.

## 5. Policy workspace layout

Desktop follows a responsive three-region workspace inspired by the mockup:

1. **Start rail/list:** policy catalog or sections.
2. **Main canvas:** metadata and decision-table/graph editor.
3. **Context panel:** test, trace, diagnostics, versions, and impact tabs.

Tablet/mobile uses a single-column editor with tabs/sheets; no horizontally compressed editable table.

## 6. Dynamic condition editor

Each row contains:

- Stable row number and drag/up-down reorder controls.
- `IF`/`AND`/`OR` connector shown according to group.
- Searchable fact combobox using backend fact metadata.
- Operator select filtered by fact type.
- Typed value editor:
  - number/decimal stepper plus unit.
  - enum/lookup select or multiselect.
  - boolean segmented control.
  - date/datetime picker.
  - money amount plus locked/allowed currency.
  - role/scope selector.
- Remove condition button with accessible name.
- Add condition and add group actions.
- Inline compiler diagnostics anchored to the affected condition.

A new row starts empty; never use free text such as `New condition` as the persisted field key.

MVP exposes row-level `AND`. Advanced nested groups are feature-flagged until keyboard, RTL, and complexity testing passes.

## 7. Outcome editors

Render by declared output family:

- Eligibility: `ALLOW`/`DENY` plus reason-code selector.
- Value: typed output fields from output schema.
- Routing: ordered approval descriptors, parallel/quorum settings where allowed.
- Classification: stable-code selector.
- Calculation: approved FEEL/expression builder with constrained functions.
- Effect intents: closed catalog with clear note that domain services execute effects.

The mandatory default output is pinned, visually distinct, and cannot be deleted.

## 8. Decision graph mode

For composed decisions:

- Nodes: input/fact set, decision table, calculation, lookup, output.
- Edges show typed data dependencies.
- Prevent cycles unless a future approved runtime explicitly supports them.
- Selecting a node opens its table/expression editor.
- Provide list/tree alternative for keyboard and screen-reader users; the graph is never the only means of editing.

## 9. Simulation and Decision Trace

Test panel:

- Generates inputs from fact schema.
- Allows boundary-value presets and saved test cases.
- Runs draft simulation, clearly marked non-production.
- Highlights matched row/path and default use.
- Shows normalized facts, freshness, scope resolution, output, reasons, diagnostics, and runtime duration.
- Compares active vs draft result.
- Can save a scenario as a required regression test.

`DecisionTrace` becomes a shared pattern reused in approval evidence and Internal Audit views.

## 10. Replay impact UI

- Start replay from approved dataset selector and scope/time range.
- Show progress, sample/record count, privacy warning, and cancellation where supported.
- Compare outcomes, values, routes, and reason codes.
- Aggregate changed decisions by pool/cluster, outcome, policy row, and severity.
- Drill-down displays minimized evidence only.
- Require acknowledgment/comment before submitting a materially changing high-impact policy.

## 11. Version and lifecycle UX

- Lifecycle bar: Draft -> Review -> Approved -> Scheduled/Shadow/Canary -> Active -> Retired.
- Semantic diff: rows, facts, operators, outputs, defaults, scope, effective date, failure strategy.
- Author, reviewer, approver, publisher, timestamps, and change summary.
- Save draft, validate, submit, approve/reject, deploy, promote, and rollback are separate commands.
- Do not use a misleading single `Save & publish` action.
- Confirm destructive/high-impact commands through `useConfirm` and require reason where contract requires it.
- Prevent navigation with unsaved changes.
- Activation is disabled for unknown/retired/unauthorized scopes and until O6 capability metadata allows scoped deployment.

## 12. Workflow Builder

Use templates and bounded primitives:

- Single approval.
- Sequential multi-stage approval.
- Parallel all/any/quorum approval.
- Review -> modification -> resubmit.
- Approval with reminders/escalation.
- Policy-driven route.

Editor features:

- Stage list or accessible canvas.
- Assignee resolver selector and scope.
- Decision outcomes/transitions.
- SLA, reminder, escalation, retry and cancellation configuration.
- Controlled notification/service command intents.
- Simulation with sample requester/scope showing resolved tasks/timers/commands.
- Definition validation, version diff, review and publication lifecycle.
- Advanced source view read-only by default.
- Assignment preview resolves organization/scope and shows the hierarchy/definition versions pinned to new instances.

## 13. Unified task inbox

- Filters: assigned to me/delegated, task type, SLA, scope, status, impact.
- Evidence-first detail view with requester, subject, decision traces, history, and policy versions.
- Approve/reject/request changes controls with reason requirements.
- Color never stands alone; status uses icon, label, position and text.
- Real-time refresh can use query invalidation or approved event channel; correctness must not depend on push.

## 14. Frontend architecture

```text
src/features/policy/
  policy.contract.ts
  hooks/use-policies.ts
  pages/policy-catalog-page.tsx
  pages/policy-workspace-page.tsx
  components/condition-editor/
  components/outcome-editors/
  components/decision-trace.tsx
  components/policy-diff.tsx
  components/replay-impact.tsx

src/features/workflow-admin/
  workflow.contract.ts
  hooks/use-workflows.ts
  pages/workflow-catalog-page.tsx
  pages/workflow-workspace-page.tsx
  components/workflow-builder/
```

Use TanStack Query for server state; local reducer/form state for unsaved definitions. No direct `fetch` in components.

Organization Management from O5 owns the shared scope tree and policy-binding indicators. Policy Studio reuses its authorized scope contracts/components rather than loading the unscoped legacy `/hierarchy` response.

## 15. Query keys and invalidation

- `['policies', filters]`
- `['policy', policyId]`
- `['policy-draft', draftId, revision]`
- `['policy-replay', runId]`
- `['fact-catalog', schemaVersion]`
- `['workflow-definitions', filters]`
- `['workflow-definition', id]`
- `['workflow-tasks', filters]`

Invalidate targeted catalog/workspace/history keys after mutation. Use expected revision to surface `409` conflicts with reload/compare options.

## 16. i18n, RTL, and accessibility

- Every label, field, operator, reason, status and diagnostic has EN/AR keys.
- Use logical layout properties; condition order remains semantic under RTL.
- Full keyboard authoring including add/remove/reorder/group actions.
- Focus moves predictably after add/remove and to the first invalid diagnostic on validation.
- Table editor uses semantic controls; no clickable `div` cells.
- Graph has a fully equivalent list/tree editor.
- Announce validation, simulation completion, lifecycle change, and background replay status.
- Test at 320px, tablet, desktop and wide desktop in both themes and locales.

## 17. Tests

- Contract parsing and query hooks with MSW.
- Dynamic field/operator/value behavior by data type.
- Add/remove/reorder and mandatory default tests.
- Unsaved-change and optimistic-conflict tests.
- Simulation trace and active-vs-draft comparison.
- Lifecycle authorization/disabled-action tests.
- Replay progress and impact acknowledgment.
- Workflow template and simulation tests.
- Keyboard, focus, RTL, axe and screen-reader-oriented assertions.
- Playwright end-to-end against real backend for author -> review -> deploy -> evaluate -> rollback.

## 18. Exit gate

Phase 7 passes when O5/O6 are green and administrators/reviewers can complete organization-aware policy/workflow authoring and governance without JSON editing, invalid scope activation, or duplicated hierarchy logic; EN/AR accessibility evidence is approved.
