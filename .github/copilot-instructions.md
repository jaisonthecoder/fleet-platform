# AD Ports AI SDLC Instructions

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

This repo ships role-scoped GitHub Copilot artifacts under `.github/`:

- `.github/skills/<role>/SKILL.md` — full skill body, with `workflows/`, `references/`, and `templates/` assets alongside.
- `.github/agents/<role>.md` — custom agent profile for the role.
- `.github/prompts/<role>.prompt.md` — short prompt that invokes the skill.

Pick the role that matches the task, open its `SKILL.md`, and follow the matching workflow. Keep changes scoped, follow project standards, and verify outputs before handoff.

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

## Chat Context Window & Session Continuity

Long sessions degrade and can stall once the context window fills up, forcing a
forced restart that loses all prior context. See
[`.github/copilot-chat-context-management.md`](copilot-chat-context-management.md)
for the full explanation, prevention practices, and recovery steps.

- At the start of any new/resumed session, read
  `/memories/repo/project-state.md` (repo memory) before asking the user to
  re-explain project context.
- Update `/memories/repo/project-state.md` as project stage, key decisions, or open
  items change — this file is shared across all sessions on this workspace, including
  parallel ones, so keep edits scoped (own heading/own file per workstream) to avoid
  clobbering another session's concurrent update.
- Before ending a long or degraded session, offer to write a progress/handoff summary
  into repo memory (or `/memories/session/` for in-flight scratch notes) so the next
  session can resume cheaply.


