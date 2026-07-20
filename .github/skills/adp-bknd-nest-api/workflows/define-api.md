# Workflow: Define API (NestJS)

## Position in the chain
- **Prerequisite:** [`design-backend`](design-backend.md) — the design must be approved before the contract is locked.
- **Successor:** [`build-backend`](build-backend.md) — implementation begins once the OpenAPI is committed and reviewed by frontend + integration.
- **Pairs with:** [`test-backend`](test-backend.md) — contract tests against the spec start here, not after build.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] PRD/ACs, resource model, auth requirements, and integration constraints are available.
- [ ] Each operation traces to a user/business outcome and acceptance criterion; speculative endpoints are out of scope.
- [ ] The OpenAPI destination is decided (hand-authored `openapi.yaml` or generated from `@nestjs/swagger` — see SKILL.md § Stack).
- [ ] The frontend role used by the project (`frontend-react` / `frontend-angular` / equivalent) and `integration-engineer` are identified as reviewers.
- [ ] You are on the right branch.
- [ ] Relevant API conventions have been skimmed: [`../references/api-conventions.md`](../references/api-conventions.md).

If inputs are missing, write a short "waiting on" note and stop.

## References to consult
- [`../references/api-conventions.md`](../references/api-conventions.md) — REST conventions, ProblemDetails, examples policy, OpenAPI source-of-truth rules.
- [`../references/security-baseline.md`](../references/security-baseline.md) — auth on operations, output hygiene, rate-limiting requirements that must appear in the spec.

## Goal
A stable HTTP contract that NestJS implementation and consumers can build against.

## Steps
1. **Write or update OpenAPI first.** Either hand-author `openapi.yaml` or generate from decorated DTOs — whichever the project picked. Generated mode requires the output is **checked in** and reviewed.
2. **Use REST conventions.** Plural nouns, correct verbs, predictable status codes, version prefix `/v1`. See [`../references/api-conventions.md`](../references/api-conventions.md) § URL shape and versioning.
3. **Model DTOs precisely.** Request, response, and error schemas explicit. Mark nullable and optional fields intentionally — never conflate. See [`../references/api-conventions.md`](../references/api-conventions.md) § DTO naming and shape.
4. **Document validation.** Required fields, enum values, string formats, numeric ranges, and cross-field validation rules.
5. **Define pagination/filtering/sorting.** Whitelist query fields, set default and max page sizes, document stable sort behavior. See [`../references/api-conventions.md`](../references/api-conventions.md) § Pagination, filtering, sorting.
6. **Document auth per operation.** Required scopes, roles, tenant constraints, and ownership checks. See [`../references/security-baseline.md`](../references/security-baseline.md) § Authentication and § Authorization at the data layer.
7. **Standardize errors.** ProblemDetails-compatible shape with stable error codes. Never expose stacks or raw downstream errors. See [`../references/api-conventions.md`](../references/api-conventions.md) § Error shape.
8. **Add examples.** Success, validation failure, auth failure, not found, conflict, and downstream failure where applicable.
9. **Mount the docs UI.** Expose the OpenAPI document at `GET /<prefix>/docs-json` (machine-readable feed for codegen and contract tests) and the human-readable renderer at `GET /<prefix>/docs`. Default renderer is **Scalar API Reference** via `@scalar/nestjs-api-reference`; alternative is Swagger UI behind a recorded ADR. See [`../references/api-conventions.md`](../references/api-conventions.md) § Docs UI for the exact snippet.

## Anti-patterns
- Implementation-first API drift.
- `200 OK` error payloads.
- Unbounded list endpoints.
- Auth requirements hidden in prose or code only.

See [`../references/anti-patterns.md`](../references/anti-patterns.md) for the full PR-review citation catalog.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Contract is saved, rendered, or linked in the expected location and lints clean.
- [ ] Breaking changes and assumptions are called out explicitly.
- [ ] The project's frontend role and `integration-engineer` are notified for review.
- [ ] Handoff package prepared via `adp-handoffs/workflows/handoff-to-next-role.md` for `build-backend`.
- [ ] `git status` shows only intended changes.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-sre`.

## Definition of Done
- [ ] Operations trace back to PRD/ACs and the consuming user journey.
- [ ] OpenAPI contract exists, lints clean, and is checked into the repo.
- [ ] Docs UI is mounted: machine-readable feed at `/<prefix>/docs-json`, human-readable renderer at `/<prefix>/docs` (Scalar by default; Swagger UI only with an ADR).
- [ ] DTOs, validation, auth, and error responses are documented.
- [ ] Examples cover happy and error paths per [`../references/api-conventions.md`](../references/api-conventions.md) § Examples policy.
- [ ] Versioning and pagination choices are clear.
- [ ] Reviewed by the project's frontend role and `integration-engineer`.
