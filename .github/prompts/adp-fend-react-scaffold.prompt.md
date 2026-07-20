---
agent: 'agent'
description: "App structure, build setup, lint, format, test harness, folder conventions, shared utilities, global store config. Use when producing or updating \\\"frontend React source, test setup, repo configuration\\\". Owned by AI Frontend Engineer (React)."
---

## Role Agents vs Task Skills

This project uses two naming layers:

- `ai-*` names are role/agent identities, for example `ai-business-analyst` and `ai-product-manager`.
- `adp-*` names are executable task skills and slash-command prompts, for example `adp-ba-brd` and `adp-pm-prd`.

When a user asks for an `ai-*` role, use the mapped `adp-*` task skill.

Do not look for skills named after the role unless those exact skill folders exist.

## Skill Suggestion Protocol

When a user request is unclear or maps to multiple AD Ports skills, use the ADP skill suggestion mechanism before choosing a skill:

- In VS Code chat, ask `@adpai /suggest <task>`.
- In CLI-capable environments, run `adpai suggest "<task>" --tier <tier> --tools <tools>`.
- Use only catalog skill IDs returned by the suggestion result.
- If the suggestion mechanism is unavailable, state the fallback and choose the nearest installed skill by catalog evidence.
- Do not invent skill IDs.

Use the `adp-fend-react-scaffold` skill at `.github/skills/adp-fend-react-scaffold/SKILL.md`.

Open the skill, pick the matching workflow under `.github/skills/adp-fend-react-scaffold/workflows/`, and complete the request with evidence. Resolve any referenced templates or references relative to that folder.

## Available Workflows

- `after-you-finish`
- `apply-to-feature`
- `before-you-start`
- `build-showcase`
- `produce-artifact`
- `review-artifact`
- `shadcn-after-you-finish`
- `shadcn-before-you-start`
- `shadcn-build-showcase`
- `shadcn-scaffold-kit`
- `test-frontend`
- `update-artifact`

# Prompt Enhancement Policy

Before acting on a user request, enrich the working context only when it helps complete the task safely.

## Required Guidance

- Classify the request as one primary task type: feature, bugfix, review, documentation, tests, release, support, or exploration.
- Use the selected role, skill, workflow, and project standards that best match the task.
- Inspect existing repository patterns before proposing or editing implementation details.
- Preserve unrelated user changes and avoid broad refactors unless they are required for the request.
- Prefer the narrowest useful validation command, then broaden only when the risk or blast radius requires it.
- Keep final handoff concise: summarize changed files, validation run, and any remaining risk.

## Token Discipline

- Keep injected context short.
- Do not inject logs, full diffs, full file contents, package output, stack traces, or copied documentation.
- Add no extra context for casual acknowledgements, greetings, or prompts that already contain enough operational detail.
- If the request is ambiguous, add a short clarification checklist instead of guessing large requirements.
