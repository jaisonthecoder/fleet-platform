# Agent Metaprompt Pack — Noatum Customer Information Platform

| | |
|---|---|
| **Purpose** | Ready-to-paste prompts for Claude Code (or Copilot chat) that drive the vertical-slice plan |
| **Written** | 03.09.2026 · v2 04.09.2026 |
| **Assumes** | `CLAUDE.md` v2 is at repo root; `/docs` contains the PRD, design system, plans, KB notes, ADRs, `gaps.md`, `glossary.md` |
| **Contents** | 1 Kickoff prompt · 2 Slice task template · 3 Worked example (S1.05) · 4 Review prompt · 5 Fix-findings prompt · 6 Docs-update prompt · 7 Operating rules for you, the human |

---

## 1. Kickoff prompt (run once per new session, or when the repo is empty)

```
You are the lead engineer on the Noatum Logistics Customer Information Platform.

Read, in this order, and confirm you have read each:
1. CLAUDE.md
2. docs/plans/01-Vertical-Slice-Implementation-Plan.md — sections 1, 2 and the phase we are in
3. docs/PRD-Noatum-Customer-Platform.md — only the sections referenced by the current slice
4. docs/noatum-designsystem.md — if the slice has UI
5. docs/adr/ — all decision records

Then tell me in under 15 lines:
- what the platform is and what it is not, in your own words
- the six foundation rules
- which slice is next according to the plan and its "Depends on"
- any open question (OQ-n) the next slice touches

Do not write code yet.
```

Use the agent's summary to check it understood. If it says anything like "the platform manages rates" or "we will store CW1 records", correct it before going further.

---

## 2. Slice task template (one per slice)

Copy, fill the `<>` parts from the slice plan, paste.

```
SLICE: <S1.05 Address book>
PHASE: <1>
PLAN REFERENCE: docs/plans/01-Vertical-Slice-Implementation-Plan.md → <S1.05>
PRD REFERENCE: <FG-3.2 shared tooling — Address Manager>
DEPENDS ON: <S1.02, S1.03, S1.04> — confirm these exist in the repo before starting.
OPEN QUESTIONS TOUCHED: <none | OQ-n — interim decision: ...>

GOAL (one sentence, in business words):
<A customer manages the addresses they will reuse in quotes and bookings.>

SCOPE — build exactly this, nothing more:
DB:      <tables and key columns from the slice>
TYPES:   <DTOs, zod schemas, shared functions>
API:     <endpoints, permission codes, business rules>
UI:      <screens, components, states>
WORKER:  <none | jobs>
TESTS:   <business rules to cover, plus the standard isolation + 403 tests>

OUT OF SCOPE (do not touch):
<other modules, other tables, styling changes, anything not listed above>

ORDER OF WORK: DB → shared types → API + tests → UI. Do not start with the screen.

STEP 1 — PLAN MODE. Before any code, give me:
- the list of files you will create or change, grouped by layer
- the migration in outline (table, columns, indexes, RLS policy)
- the endpoint list with permission codes
- the test list
- any question or assumption
Stop and wait for my approval.

STEP 2 — after approval, implement in the stated order. Run `pnpm lint` and `pnpm test` after each layer.

STEP 3 — finish with the Definition of Done checklist from CLAUDE.md, ticking each item with the file that satisfies it, and a 5-line demo script I can follow locally.
```

---

## 3. Worked example — S1.05 Address book, filled in

```
SLICE: S1.05 Address book
PHASE: 1
PLAN REFERENCE: docs/plans/01-Vertical-Slice-Implementation-Plan.md → S1.05
PRD REFERENCE: FG-3.2 "Shared tooling (P0) … Address Manager (CRUD, CSV/XLSX import with mapping + row-level validation report, XLSX export)"
DEPENDS ON: S1.02 tenancy, S1.03 permissions, S1.04 design system — confirm present.
OPEN QUESTIONS TOUCHED: none

GOAL: A customer manages the addresses they will reuse in quotes and bookings, including bulk import from a spreadsheet.

SCOPE:
DB:      address_book_entry (id, customer_group_id NOT NULL, label, company_name, address_line1, address_line2, city, postal_code, country_iso CHAR(2), unloco VARCHAR(5) NULL, contact_name, contact_email, contact_phone, is_default_shipper BOOL, is_default_consignee BOOL, created_by, created_at, updated_at, deleted_at NULL) — index on (customer_group_id, label); RLS policy.
         address_import_job (id, customer_group_id, status pending/validated/committed/failed, file_ref, mapping jsonb, row_count, valid_count, error_report jsonb, created_by, created_at).
TYPES:   AddressBookEntryDto, CreateAddressBookEntryInput (zod: country_iso must be ISO-3166 alpha-2, email format, at least one of address_line1/unloco), ImportMappingInput, ImportValidationReport.
API:     GET /v1/address-book (list, search q, paging) — addressbook.manage
         POST /v1/address-book — addressbook.manage
         PATCH /v1/address-book/:id — addressbook.manage
         DELETE /v1/address-book/:id (soft delete) — addressbook.delete
         POST /v1/address-book/import (multipart CSV/XLSX → job, returns detected columns) — addressbook.manage
         POST /v1/address-book/import/:jobId/validate (body: column mapping → row-level report) — addressbook.manage
         POST /v1/address-book/import/:jobId/commit (writes valid rows only) — addressbook.manage
         GET  /v1/address-book/export.xlsx — addressbook.manage
UI:      features/address-book: list page (search, table, Grid/Card not needed here), create/edit drawer, import wizard (Upload → Map columns → Review report → Commit), export button. Design-system Input/Select/Button/SectionHeading. Loading/empty/error states.
WORKER:  none (file parse is synchronous, files under 5 MB; enforce limit).
TESTS:   zod rejects bad country and bad email; import report lists row number + field + message for each bad row and commits only valid rows; soft-deleted entries excluded from list; isolation test (group A cannot read/update group B entry → 404); 403 for user without addressbook.delete on DELETE.

OUT OF SCOPE: quotes, bookings, templates, any change to design-system package, master UNLOCO import (S1.07).

ORDER OF WORK: DB → shared types → API + tests → UI.

STEP 1 — PLAN MODE …  (as in template)
```

---

## 4. Review prompt (after the agent says it is done)

Paste this into a **fresh** session or ask the same agent to switch to reviewer mode. A fresh session catches more.

```
Act as a strict reviewer for slice <S1.05>. Read CLAUDE.md and the slice in docs/plans/01-Vertical-Slice-Implementation-Plan.md, then read the diff (git diff main...HEAD).

Check and report PASS/FAIL with file:line evidence for each:
1. Tenancy: Pattern A tables have customer_group_id NOT NULL, index, RLS; Pattern B (shipment family) tables have the shipment_visibility EXISTS policy; internal-only tables have an internal policy; every query goes through TenantRepository; customer_group_id never read from the request body or query.
2. Permissions: every new route has @RequirePermission with a code that exists in shared-types/permissions.ts and is seeded.
3. Scope: nothing outside the slice was changed. List any file outside the slice's folders.
4. Invented fields/statuses: compare schema and DTOs to the slice spec and the PRD section; list anything not in either.
5. Adapter rule: no direct call to an external system from the API module, except RateEngineAdapter in quotes.service (synchronous, with timeout and circuit breaker).
6. Design tokens: no hex colour, font-family or border-radius outside packages/design-system.
7. Brand voice: no emoji or exclamation marks in strings, emails, PDFs; dates formatted DD.MM.YYYY.
8. i18n: every visible string has EN and ES entries.
9. Tests: isolation test and 403 test present and meaningful (they must assert on a real cross-tenant fetch, not a mock); axe accessibility check on new screens; k6 smoke for new list/search endpoints.
10. Human-in-the-loop (if any automated value is produced): provenance stored, override with reason possible.

Finish with a numbered list of required fixes, highest risk first, and a one-line verdict: MERGE / FIX FIRST.
```

---

## 5. Fix-findings prompt

```
Apply the reviewer's findings for slice <S1.05> in this order: <paste numbered list>.
For each finding: state the change, make it, run the relevant test.
Do not make any other change. When finished, re-run `pnpm lint` and `pnpm test` and paste the summary.
```

---

## 6. Docs-update prompt (every 2–3 slices)

```
Review the last <3> slices (<S1.05, S1.06, S1.07>) and update documentation only:
- docs/adr/: add an ADR for any architectural decision made during these slices (one decision per file, template in docs/adr/ADR-000-template.md).
- docs/gaps.md: add anything we needed that the PRD does not cover, with the slice where it appeared.
- CLAUDE.md: add or tighten any convention that emerged (max 5 lines of change; keep the file under 200 lines).
- README of each new module: purpose, tables, endpoints, permissions, how to run its tests.
Show me the diff of the docs before committing. Do not change code.
```

---

## 7. Operating rules for you, the human

**Before a slice**
- Fill the task template yourself from the slice plan. A short written spec prevents most agent drift.
- If the slice touches an OQ, write the interim decision into the task ("carrier names hidden behind feature flag `quote.carrier_disclosure`, default off") and add it to `docs/gaps.md`.

**During plan mode**
- Read the plan for 30 seconds. Look for: new tables you did not ask for, a screen listed before the API, an external call inside the API module, a status not in the PRD. Correct, then approve.

**During implementation**
- Let it run. Do not interrupt for style. Interrupt for scope.
- If it asks a question, answer in one or two lines and point to the doc section if there is one.

**After implementation**
- Run the demo script it gives you. If the demo does not work locally, the slice is not done — send it back before review.
- Run the review prompt in a fresh session. Fix, then merge.
- Never merge a slice whose isolation test is missing, even if everything else is perfect.

**Parallel agents**
- Only on slices marked [P] in the plan, or on slices with no shared tables. The meeting point is `packages/shared-types`; if both need to change the same file there, run them in sequence.

**Cadence**
- One slice → one branch → one PR.
- Every demo runs against the CW1 simulator until real CW1 is connected.
- Every 2–3 slices, run the docs-update prompt. A stale CLAUDE.md is the most common cause of agent mistakes.

**When the agent goes wrong**
- Do not argue in a long thread. Reset: start a new session, run the kickoff prompt, paste the slice task again with a line "Previous attempt failed because <reason>; avoid that."
- If the same mistake repeats across slices, it is a missing rule in CLAUDE.md, not an agent problem. Add the rule.
