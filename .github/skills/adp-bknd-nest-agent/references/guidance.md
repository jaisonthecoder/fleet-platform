# Guidance

## Scope

Use this reference for detailed decisions that are too specific for `SKILL.md`.

This adp-bknd-nest-agent reference is intended for requests that need extra framework, policy, api guidance. Load it only when the current request depends on those details.

## Rules

- Keep implementation guidance tied to the owning skill.
- Prefer existing project conventions when working in a brownfield repository.
- Record assumptions when evidence is incomplete.
- Match the implementation approach to the framework already present in the target repository before introducing new patterns.
- Tie policy guidance to an approved standard, owner, exception path, or decision record.
- Preserve API contract compatibility and document request, response, auth, error, and versioning implications.

## Review checklist

- The guidance was applied only to the requested scope.
- Source evidence or project context is named.
- Deviations are explained.
