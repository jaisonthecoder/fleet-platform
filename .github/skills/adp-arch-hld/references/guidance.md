# Guidance

## Scope

Use this reference for detailed decisions that are too specific for `SKILL.md`.

This adp-arch-hld reference is intended for requests that need extra security, integration guidance. Load it only when the current request depends on those details.

## Rules

- Keep implementation guidance tied to the owning skill.
- Prefer existing project conventions when working in a brownfield repository.
- Record assumptions when evidence is incomplete.
- Record security assumptions, data classification, control coverage, residual risk, and required review owners.
- Document system owners, retry/idempotency behavior, payload mapping, timeouts, monitoring, and failure handling.

## Review checklist

- The guidance was applied only to the requested scope.
- Source evidence or project context is named.
- Deviations are explained.
