---
mode: agent
description: Start a vertical slice (e.g. /slice S1.05) — plan mode first, then DB → types → API + tests → UI
---

<!--
  Generated from .claude/commands/slice.md. Edit that file and re-run the generator,
  so both assistants receive the same instructions.
-->

Build slice **${input:args:slice id, e.g. S1.05}**.

## Step 0 — assemble the task from the plan

Read these before anything else:

- `docs/plans/Project-Kickoff-and-Phase1-Plan.md` → the Phase 1 stage this belongs to.
- `docs/plans/01-Vertical-Slice-Implementation-Plan.md` → the entry for **${input:args:slice id, e.g. S1.05}**. This is the scope.
- For anything quotation- or CargoWise-shaped, `docs/cargowise-and-quotation/` wins over both.
- `docs/03-Agent-Metaprompt.md` section 2 — the task template you are filling in, and
  section 3 for a worked example.
- `CLAUDE.md` — the six foundation rules and the Definition of Done.
- The PRD sections the slice references, and nothing else.
- `docs/Simplification-Register.md` if the slice looks like it needs a new table, runtime
  or screen.

Then restate, in your own words and in under 20 lines:

- **GOAL** in one business sentence
- **DEPENDS ON** — and confirm each dependency actually exists in the repo, by file
- **SCOPE** — DB, TYPES, API, UI, WORKER, TESTS, taken from the slice entry
- **OUT OF SCOPE** — everything adjacent you are not touching
- **OPEN QUESTIONS** the slice touches, with the interim decision from the slice or `docs/gaps.md`

## Step 1 — plan mode

Do not write code. Give me:

- the files you will create or change, grouped by layer
- the migration in outline: table, columns, indexes, **RLS policy**, grants, and the `down.sql`
- the endpoint list with the permission code for each, from `PERMISSIONS` in `@/contracts`
- the test list, including the mandatory **tenant-isolation test** and one **403 test per endpoint**
- any question or assumption

Then stop and wait for my approval.

## Step 2 — implement

In this order, and not another: **DB → shared types → API + tests → UI.** Do not start
with the screen. Run `pnpm lint` and `pnpm test` after each layer, not just at the end.

The rules that matter most here, from `CLAUDE.md` — review will hold you to them:

- every table needs `customer_group_id NOT NULL` + index + RLS policy (Pattern A), or a
  `shipment_visibility` policy (Pattern B), in the same migration
- every route needs `@RequirePermission(PERMISSIONS.X)` with a constant from `@/contracts`
- no hex colour, `font-family` or `border-radius` outside `apps/noatum-customer-portal-ui/src/design-system`
- EN and ES locale keys in step, no emoji, no exclamation marks, dates `DD.MM.YYYY`
- customer data goes through `TenantRepository`, never raw Prisma
- `customer_group_id` never comes from a client

## Step 3 — finish

Work through the nine-point Definition of Done in `CLAUDE.md`, ticking each item **with
the file that satisfies it**. Then give me a five-line demo script I can run locally
against Docker Compose and the CW1 simulator.

If you found work outside this slice, write it to `docs/gaps.md` or propose a new slice.
Do not do it silently.
