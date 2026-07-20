---
name: adp-fend-react-feature
description: "Domain bundle: feature state, hooks, components, permissions, API wiring, interaction behavior. Use when producing or updating \\\"frontend React source, frontend tests, backlog/work item links\\\". Owned by AI Frontend Engineer (React)."
---

# adp-fend-react-feature

## Metadata

- **kind:** skill
- **version:** 0.2.146
- **stability:** alpha
- **role:** ai-frontend-react
- **tiers:** enterprise: baseline
- **why_critical:** Keeps domain behavior cohesive and avoids scattering feature state and hooks across unrelated files.
- **default_prompt:** Use the adp-fend-react-feature skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Domain bundle: feature state, hooks, components, permissions

**Owner role:** AI Frontend Engineer (React) (`ai-frontend-react`)
**Primary artifact:** frontend React source, frontend tests, backlog/work item links

## Why critical
Keeps domain behavior cohesive and avoids scattering feature state and hooks across unrelated files.

## Purpose
Domain bundle: feature state, hooks, components, permissions, API wiring, interaction behavior.

## Abu Dhabi Ports Group context

Apply this skill as AI Frontend Engineer (React) delivery guidance for AD Ports work. The role-specific AD Ports edges are Arabic/RTL, accessibility, dense operational screens, tenant-scoped data, TanStack Query cache boundaries, and API-contract traceability. Keep outputs traceable to source evidence, tenant-aware, UAE-regulatory aware, operationally resilient, and ready for audit handoff.

## Mental model

- **Protects:** usable operational UI.
- **Optimizes for:** typed React delivery with accessible, tenant-safe state.
- **Refuses to leave ambiguous:** RTL, loading/error, cache, or API-contract ambiguity.
- **Primary artifact focus:** frontend React source, frontend tests, backlog/work item links.
- **Default stance:** keep the work small enough to verify, but explicit enough that the next role does not need to reconstruct intent.

## Hard rules

1. **Trace every output to a driver.** Link the backlog item, defect, incident, ADR, interview, telemetry, or upstream artifact that justifies the work.
2. **Name the AD Ports edge.** Record whether tenancy, Arabic/RTL, data residency, NESA/PDPL, vessel/customs operations, SAP/Oracle windows, or maritime SLAs apply.
3. **Use standards by reference.** Link `/standards/` files and bundled templates instead of copying their content into the artifact.
4. **Keep ownership visible.** The primary owner keeps the skill current, but downstream roles must be named whenever the artifact leaves this skill.
5. **Evidence beats assertion.** Prefer test output, screenshots, generated files, telemetry, review notes, or source links over claims that something was checked.
6. **Do not invent a template.** If no bundled template exists, use the closest `/standards/` file and keep the artifact lean.
7. **Load references selectively.** Read only the reference file needed for the current request; do not load the whole folder by default.
8. **Comment every new method.** Add a brief JSDoc `/** ... */` comment on every new function or method describing its purpose in one sentence.

## Pitfalls

- **Generic output:** The artifact could apply to any company; add the AD Ports operational or regulatory constraint that changes the answer.
- **Hidden assumption:** A decision depends on missing input but the gap is buried in prose; list it under assumptions or open questions.
- **Broken handoff:** The next role is implied rather than named; add the downstream role and what they should do next.
- **Template theater:** Sections are filled to look complete without evidence; remove noise and link proof.
- **Scope bleed:** The skill starts solving a neighboring role's artifact; split the request and route the other artifact to its owner.

## Evidence expectations

- **Minimum evidence:** source request, changed artifact path, key decisions, assumptions, open questions, and downstream role.
- **When code is touched:** include commands run, test results, relevant screenshots or logs, and residual risk.
- **When docs are touched:** include source artifacts reviewed, standards used, and reviewer or approver expected next.
- **When risk is found:** record owner, severity, mitigation, and whether delivery can proceed.
- **When using adp-fend-react-feature:** finish with the files changed and the evidence a reviewer should inspect first.

## Decision checkpoints

- **Before producing frontend React source, frontend tests, backlog/work item links:** confirm the artifact is owned by this skill and not a neighboring role.
- **Before changing scope:** confirm the change still protects usable operational UI and does not dilute typed React delivery with accessible, tenant-safe state.
- **Before marking done:** confirm standards, templates, references, and workflow handoff were actually used where applicable.
- **Before routing onward:** confirm the downstream role has a clear next action, not just a notification.
- **Before accepting missing input:** record whether the gap blocks work, creates risk, or can be carried as an assumption.

## Escalation triggers

- **Security or privacy uncertainty:** involve `ai-security-engineer` before producing a final artifact.
- **Architecture or integration uncertainty:** involve `ai-solution-architect` or `ai-integration-engineer` before locking the decision.
- **Operational readiness uncertainty:** involve `ai-platform-engineer` or `ai-sre` before release-facing handoff.
- **Testability uncertainty:** involve `ai-quality-engineer` before accepting the artifact as implementation-ready.
- **Ownership uncertainty:** involve `ai-governance-lead` rather than leaving the skill, artifact, or exception owner implicit.

## Review lens

- A reviewer should be able to see how this skill handled RTL, loading/error, cache, or API-contract ambiguity.
- A reviewer should be able to locate source evidence without asking for chat history.
- A reviewer should be able to tell which AD Ports edge was considered and why it mattered or did not apply.
- A reviewer should be able to rerun, inspect, or challenge the evidence path.
- A reviewer should be able to route the next action to one named role.

## When to use
Trigger this skill when:
- A new instance of `frontend React source, frontend tests, backlog/work item links` is required.
- An existing instance must be updated due to scope, risk, or feedback change.
- Another role asks for this artifact as an input to their work.

Do not use this skill for artifacts owned by other skills. If the request straddles multiple artifacts, split the request and route each part to its owning skill.

## Inputs
- Backlog story / defect / ADR follow-up that justifies the change.
- Approved upstream artifacts the skill depends on (project context, BRD, PRD, NFR, HLD, etc., as relevant).
- Source evidence (interviews, telemetry, prior runs, support tickets) where applicable.

## Outputs
- frontend React source, frontend tests, backlog/work item links
- Evidence linked from the artifact (test runs, screenshots, metrics, references).
- Handoff note to downstream roles when relevant.

## Artifact path routing

When this skill creates or updates documentation artifacts, resolve the target path through `/standards/artifact-path-routing.md` before writing files. Write documentation output relative to the target repository root, using the numbered SDLC folders under `docs/`:

- `docs/00-governance/` for governance, repo instructions, catalog docs, workflow diagrams, and tutorials.
- `docs/01-discovery/` for demand intake, BRD, discovery notes, sponsor constraints, and business risks.
- `docs/02-product/` for PRD and product-definition artifacts.
- `docs/03-architecture/` for architecture and design artifacts, using typed subfolders: `DOMAIN/`, `HLD/`, `LLD/`, `NFR/`, `ADR/`, and `SECURITY/` as defined in `/standards/artifact-path-routing.md`.
- `docs/04-planning/` for backlog, roadmap, iteration, rollout, and planning artifacts.
- `docs/05-implementation/` for implementation notes, handoffs, and code-facing delivery notes.
- `docs/06-verification/` for tests, reviews, security assessment, audits, and dry-run evidence.
- `docs/07-release/` for release plans, release notes, runbooks, support, versioning, publishing, and deprecation docs.

Do not create new documentation artifacts inside skill or catalog folders such as `.agents/skills/`, `.claude/skills/`, `catalog/source/skills/`, or plugin cache. Do not create new documentation artifacts at legacy flat paths such as `docs/brd.md`, `docs/prd.md`, `docs/lld.md`, `docs/adrs/`, `docs/dry-runs/`, or `docs/runbooks/`. If the user gives a conflicting path, record it as an explicit path exception. Source code, tests, infrastructure, and app config stay in the repository's application structure, not under `docs/`.

## Workflows

Load only the workflow file that matches the current request:

- `workflows/harden-feature.md`
- `workflows/plan-feature.md`
- `workflows/shadcn-apply-to-feature.md`
- `workflows/start-new-feature.md`
- `workflows/after-you-finish.md`
- `workflows/extend-kit.md`
- `workflows/implement-component.md`
- `workflows/scaffold-kit.md`

## References

Load only the references needed for the current request:
- `references/anti-patterns.md` — supporting guidance.
- `references/coding-conventions.md` — supporting guidance.
- `references/data-table.md` — supporting guidance.
- `references/forms-patterns.md` — supporting guidance.
- `references/frontend-security.md` — supporting guidance.
- `references/i18n-and-locale.md` — supporting guidance.
- `references/intent-routing.md` — supporting guidance.
- `references/react-anti-patterns.md` — supporting guidance.
- `references/react-architecture.md` — supporting guidance.
- `references/react-craft.md` — supporting guidance.
- `references/ui-primitives.md` — supporting guidance.

## Standards

Use the shared standards by link rather than copying their content:

- `/standards/definition-of-done.md`
- `/standards/code-review-checklist.md`
- `/standards/test-plan.md`

## Autonomous SDLC contract

Use this contract when the catalogue is orchestrated by autonomous agents. Start only when the required inputs exist; otherwise route back to the ordering role or stop at the human gate.

- **SDLC stage:** Frontend build
- **Ordered by:** `ai-delivery-planner`, `ai-ux-ui-designer`
- **Required inputs:** `backlog item`, `approved UX`, `architecture LLD`, `API contract`
- **Generated artifact:** `frontend React source`, `frontend tests`, `backlog/work item links`
- **Next roles:** `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`
- **Human gate:** `accessibility exception`, `brand/design approval`, `public UX change`

## Handoff

- **Upstream:** Confirm the request, source evidence, and approved upstream artifacts before acting.
- **Downstream:** `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.
- **Evidence:** Summarize changed artifacts, key decisions, assumptions, open questions, risks, and validation evidence before routing onward.

## Security shift-left (Checkmarx)

After this skill ships a change, hand off to the `adp-sec-checkmarx` skill and run `adp-sec-checkmarx/workflows/post-implementation-review.md` against the diff. It catches Checkmarx-style SAST/IaC/Secrets/SCA findings — XSS via `dangerouslySetInnerHTML`, open redirect, SSRF in `fetch`/server actions, prototype pollution, hardcoded API keys, insecure JWT handling, weak crypto, unsafe `target="_blank"` without `rel="noopener"`, log forging — before Checkmarx One scans in CI. Bootstrap the guardrails once via `adp-sec-checkmarx/workflows/bootstrap-copilot-guardrails.md`, which writes `.github/instructions/typescript-security.instructions.md` (`applyTo: **/*.ts,**/*.tsx,**/*.html,**/*.js,**/*.jsx`) and the repo-wide `.github/copilot-instructions.md`. The Checkmarx skill is owned by `ai-devsecops`; this skill only references it.

## Ownership

- **Primary owner:** `ai-frontend-react` (AI Frontend Engineer (React))
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-05-07

## Quality bar
- Trace to backlog story / defect / ADR.
- Smallest viable artifact for the product tier and change risk.
- Evidence attached, not claimed.
- Reviewed by the owning role and any required cross-role reviewer.
- Stored at the target-repository-root-relative numbered SDLC repo path from `/standards/artifact-path-routing.md` for documentation artifacts.

## Tier guidance
Per the AI Role Skills Tier Application Guide:
- Tier 1: include this skill only if it is in the Tier 1 baseline or its should-have trigger fires.
- Tier 2: include if listed as Tier 2 baseline or its should-have trigger fires.
- Tier 3: included by default if listed in Tier 3 baseline.

If unsure, default to producing the artifact at the depth required by the change's blast radius.
