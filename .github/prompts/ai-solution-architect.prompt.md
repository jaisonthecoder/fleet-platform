---
agent: 'agent'
description: "Routes ai-solution-architect to the adp-arch-hld task skill."
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

Use the `adp-arch-hld` skill at `.github/skills/adp-arch-hld/SKILL.md`.

Open the skill, pick the matching workflow under `.github/skills/adp-arch-hld/workflows/`, and complete the request with evidence. Resolve any referenced templates or references relative to that folder.

Do not look for `.github/skills/ai-solution-architect` unless that exact folder exists.
